import os
import io
import time
import uuid
from datetime import datetime, timezone

from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from pymongo import MongoClient

# If you use the OpenAI Python SDK for Whisper + GPT-5
# pip install openai>=1.40.0
try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

# ----------------------------
# App / Config
# ----------------------------
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
print("🔎 Using .env at:", dotenv_path, "exists=", os.path.exists(dotenv_path))
load_dotenv(dotenv_path, override=True)
print("✅ Loaded MONGODB_URI:", os.getenv("MONGODB_URI"))

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ALLOW_ORIGINS", "*")}})

# Required environment variables
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "Cluster0")

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
S3_BUCKET = os.getenv("S3_BUCKET")
S3_PUBLIC_BASE = os.getenv("S3_PUBLIC_BASE", "")  # optional CDN/base URL

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # used for Whisper + GPT-5
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "whisper-1")
GPT_MODEL = os.getenv("GPT_MODEL", "gpt-5")

MAX_AUDIO_SECONDS = int(os.getenv("MAX_AUDIO_SECONDS", "70"))  # enforce < 1 minute + buffer
ALLOWED_EXTENSIONS = set(os.getenv("ALLOWED_EXTENSIONS", "wav,mp3,m4a,webm,ogg").split(','))
MAX_CONTENT_LENGTH_MB = float(os.getenv("MAX_CONTENT_LENGTH_MB", "20"))
app.config['MAX_CONTENT_LENGTH'] = int(MAX_CONTENT_LENGTH_MB * 1024 * 1024)

# Optional: Google OAuth placeholders (handled in a separate auth module or proxy)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Initialize clients
mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
db = mongo_client[DB_NAME]

s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
)

openai_client = None
if OPENAI_API_KEY and OpenAI is not None:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

# ----------------------------
# Helpers
# ----------------------------

def allowed_file(filename: str) -> bool:
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[-1].lower()
    return ext in {e.strip().lower() for e in ALLOWED_EXTENSIONS}


def _s3_key(user_id: str, scenario_id: str, ext: str) -> str:
    return f"uploads/{user_id}/{scenario_id}/{uuid.uuid4().hex}.{ext}"


def upload_to_s3(fileobj: io.BytesIO, key: str, content_type: str) -> str:
    """Upload a file-like object to S3 and return the public URL (or s3:// key)."""
    try:
        s3_client.upload_fileobj(
            Fileobj=fileobj,
            Bucket=S3_BUCKET,
            Key=key,
            ExtraArgs={"ContentType": content_type},
        )
    except (BotoCoreError, ClientError) as e:
        raise RuntimeError(f"S3 upload failed: {e}")

    if S3_PUBLIC_BASE:
        # e.g., https://cdn.example.com/bucket-prefix/<key>
        return f"{S3_PUBLIC_BASE.rstrip('/')}/{key}"
    # Default to virtual-hosted–style URL
    return f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"


def transcribe_with_whisper(file_bytes: bytes, filename: str) -> str:
    """Send audio to Whisper API and return the transcript text."""
    if not openai_client:
        raise RuntimeError("OpenAI client is not initialized. Set OPENAI_API_KEY and install openai SDK.")

    # Use the new OpenAI Audio API (whisper-1). The SDK handles multipart upload.
    # See: https://platform.openai.com/docs (adjust if your org uses a proxy)
    try:
        result = openai_client.audio.transcriptions.create(
            model=WHISPER_MODEL,
            file=(filename, io.BytesIO(file_bytes)),
            response_format="text",
        )
        # SDK may return str when response_format="text"
        transcript_text = result if isinstance(result, str) else getattr(result, "text", "").strip()
        if not transcript_text:
            raise RuntimeError("Empty transcription returned from Whisper.")
        return transcript_text
    except Exception as e:
        raise RuntimeError(f"Whisper transcription failed: {e}")


def generate_feedback_with_gpt(transcript: str, scenario_title: str | None = None) -> dict:
    """Call GPT-5 to generate concise pronunciation/fluency/word-choice feedback and a suggested native-like rewrite."""
    if not openai_client:
        raise RuntimeError("OpenAI client is not initialized. Set OPENAI_API_KEY and install openai SDK.")

    system_prompt = (
        "You are a friendly American English speaking coach who helps ESL learners sound more natural and conversational."
        " Your goal is to help them speak the way people in the U.S. actually talk day to day — not textbook English."
        " Be brief, encouraging, and actionable."
        " Return JSON with keys:"
        " tip (one short coaching note or compliment, ≤25 words),"
        " rewrite (one natural, native-sounding version of what the learner said, or 'none' if it's already perfect)."
        " If the learner’s sentence already sounds natural and polite, celebrate that and set rewrite='none'."
        " Avoid IPA or phonetic symbols."
    )

    user_prompt = (
        f"Scenario: {scenario_title or 'conversation'}\n"
        f"Learner said: \"{transcript}\"\n"
        "Give one quick tip about how to sound more natural to a native U.S. English speaker."
        " If it already sounds natural, praise them instead of suggesting a rewrite."
    )

    try:
        model = os.getenv("FAST_GPT_MODEL", "gpt-4o-mini")
        completion = openai_client.chat.completions.create(
            model=model,
            temperature=1,
            max_tokens=120,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = completion.choices[0].message.content
        import json
        return json.loads(content)
    except Exception as e:
        raise RuntimeError(f"GPT feedback failed: {e}")


def save_turn(
    user_id: str,
    scenario_id: str,
    turn_index: int,
    audio_url: str,
    transcript: str,
    feedback: dict,
) -> str:
    doc = {
        "user_id": user_id,
        "scenario_id": scenario_id,
        "turn_index": turn_index,
        "audio_url": audio_url,
        "transcript": transcript,
        "feedback": feedback,
        "created_at": datetime.now(timezone.utc),
    }
    res = db.conversation_turns.insert_one(doc)
    return str(res.inserted_id)


# ----------------------------
# Routes
# ----------------------------
@app.get("/health")
def health():
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}


@app.get("/scenarios")
def list_scenarios():
    """Return a small static list for now. In production, fetch from DB."""
    return jsonify([
        {"id": "coffee_shop", "title": "Order coffee at Starbucks"},
        {"id": "hotel_checkin", "title": "Hotel check-in"},
        {"id": "job_interview", "title": "Job interview: Tell me about yourself"},
    ])


@app.post("/upload")
def handle_upload():

    """
    POST /upload (multipart/form-data)
    form fields:
      - audio: file (required)
      - user_id: str (required)
      - scenario_id: str (required)
      - turn_index: int (required)
      - duration_sec: float (optional, used for simple server-side validation)

    Flow:
      1) Validate + store audio to S3
      2) Transcribe via Whisper
      3) Generate feedback via GPT-5
      4) Persist in MongoDB
      5) Return transcript + feedback (JSON)
    """
    t0 = time.perf_counter()
    t_s3_ms = None
    t_stt_ms = None
    t_llm_ms = None

    if "audio" not in request.files:
        return jsonify({"error": "Missing file field 'audio'."}), 400

    file = request.files["audio"]
    filename = secure_filename(file.filename or "audio.webm")

    if not allowed_file(filename):
        return jsonify({"error": f"Unsupported file type. Allowed: {sorted(ALLOWED_EXTENSIONS)}"}), 400

    user_id = request.form.get("user_id")
    scenario_id = request.form.get("scenario_id")
    turn_index_raw = request.form.get("turn_index")

    if not user_id or not scenario_id or turn_index_raw is None:
        return jsonify({"error": "Missing required fields: user_id, scenario_id, turn_index."}), 400

    try:
        turn_index = int(turn_index_raw)
    except ValueError:
        return jsonify({"error": "turn_index must be an integer."}), 400

    # Optional lightweight validation on duration
    try:
        duration_sec = float(request.form.get("duration_sec", 0))
        if duration_sec and duration_sec > MAX_AUDIO_SECONDS:
            return jsonify({"error": f"Audio too long. Limit {MAX_AUDIO_SECONDS}s."}), 400
    except ValueError:
        duration_sec = 0

    # Read file bytes once
    file_bytes = file.read()
    if not file_bytes:
        return jsonify({"error": "Empty file."}), 400

    ext = filename.rsplit(".", 1)[-1].lower()
    key = _s3_key(user_id, scenario_id, ext)

    # Upload to S3 and Transcribe with Whisper concurrently
    def _upload_task() -> tuple[str, int]:
        _t = time.perf_counter()
        url = upload_to_s3(io.BytesIO(file_bytes), key, file.mimetype or "application/octet-stream")
        return url, int((time.perf_counter() - _t) * 1000)

    def _transcribe_task() -> tuple[str, int]:
        _t = time.perf_counter()
        text = transcribe_with_whisper(file_bytes, filename)
        return text, int((time.perf_counter() - _t) * 1000)

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_upload = executor.submit(_upload_task)
        future_transcribe = executor.submit(_transcribe_task)
        try:
            audio_url, t_s3_ms = future_upload.result()
        except Exception as e:
            return jsonify({"error": str(e)}), 502
        try:
            transcript, t_stt_ms = future_transcribe.result()
        except Exception as e:
            return jsonify({"error": str(e)}), 502

    # Generate feedback with GPT-5
    scenario_title = request.form.get("scenario_title")  # optional hint
    try:
        _t = time.perf_counter()
        feedback = generate_feedback_with_gpt(transcript, scenario_title)
        t_llm_ms = int((time.perf_counter() - _t) * 1000)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502

    # Save to MongoDB
    try:
        turn_id = save_turn(user_id, scenario_id, turn_index, audio_url, transcript, feedback)
    except Exception as e:
        # DB failure shouldn't hide the learning result; return result but flag storage error
        return jsonify({
            "audio_url": audio_url,
            "transcript": transcript,
            "feedback": feedback,
            "turn_id": None,
            "storage_error": f"MongoDB insert failed: {e}",
            "t_s3_ms": t_s3_ms,
            "t_stt_ms": t_stt_ms,
            "t_llm_ms": t_llm_ms,
            "latency_ms": int((time.perf_counter() - t0) * 1000),
        }), 207

    return jsonify({
        "audio_url": audio_url,
        "transcript": transcript,
        "feedback": feedback,
        "turn_id": turn_id,
        "t_s3_ms": t_s3_ms,
        "t_stt_ms": t_stt_ms,
        "t_llm_ms": t_llm_ms,
        "latency_ms": int((time.perf_counter() - t0) * 1000),
    })


# ----------------------------
# Auth placeholders (Google OAuth)
# ----------------------------
@app.get("/auth/google")
def auth_google_start():
    """
    Placeholder redirect endpoint. In production, use a proper OAuth flow (e.g., Authlib) on the backend
    or run Google Sign-In on the frontend and forward the ID token here to verify.
    """
    return jsonify({"message": "Implement Google OAuth or ID token verification here."}), 501


@app.post("/auth/google/verify")
def verify_google_id_token():
    """
    Accept a Google ID token from the client and verify it on the server.
    This endpoint is a stub; implement verification with Google's certs (google.oauth2.id_token / authlib).
    """
    return jsonify({"message": "Verify Google ID token here and create a session/JWT."}), 501


# ----------------------------
# Run
# ----------------------------
if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
