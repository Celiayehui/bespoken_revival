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
from scenarios import get_turn_context, get_video_url, get_all_scenarios, get_scenario_data, get_turn_question
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

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
# OAuth redirect URI for Google sign-in flow
REDIRECT_URI = os.getenv("REDIRECT_URI", "https://bespoken-frontend.onrender.com/auth/callback")

# Initialize clients with proper SSL configuration
mongo_client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=30000,
    connectTimeoutMS=30000,
    socketTimeoutMS=30000,
    retryWrites=True,
    tls=True,
    tlsAllowInvalidCertificates=False,
    tlsAllowInvalidHostnames=False
)
db = mongo_client[DB_NAME]

# Test MongoDB connection with retry logic
def test_mongodb_connection():
    """Test MongoDB connection with retry logic"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Try to ping the server
            mongo_client.admin.command('ping')
            print(f"✅ MongoDB connection successful (attempt {attempt + 1})")
            return True
        except Exception as e:
            print(f"⚠️ MongoDB connection attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(1)  # Wait 1 second before retry
            else:
                print(f"❌ MongoDB connection failed after {max_retries} attempts")
                return False

# Test connection on startup
test_mongodb_connection()

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


def generate_feedback_with_gpt(transcript: str, scenario_title: str | None = None, scenario_description: str | None = None, turn_transcript: str | None = None) -> dict:
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
        f"The scenario is: {scenario_description or 'conversation'}. In this turn, the conversation partner said: '{turn_transcript or '[no context]'}'. Now the learner responded with: '{transcript}'\n"
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
    try:
        res = db.conversation_turns.insert_one(doc)
        return str(res.inserted_id)
    except Exception as e:
        print(f"⚠️ MongoDB insert_one failed: {e}")
        raise e


# ----------------------------
# Routes
# ----------------------------
@app.get("/health")
def health():
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}


@app.get("/scenarios")
def list_scenarios():
    """Return all scenarios from centralized config."""
    scenarios = get_all_scenarios()
    return jsonify(scenarios)


@app.get("/api/turn")
def get_turn():
    scenario_id = request.args.get('scenario_id')
    turn_index = request.args.get('turn_index')
    
    if not scenario_id or not turn_index:
        return jsonify({"error": "Missing scenario_id or turn_index"}), 400
    
    try:
        turn_index = int(turn_index)
    except ValueError:
        return jsonify({"error": "turn_index must be an integer"}), 400
    
    turn_context = get_turn_context(scenario_id, turn_index)
    video_url = get_video_url(scenario_id, turn_index)
    
    if not turn_context or not video_url:
        return jsonify({"error": "Scenario or turn not found"}), 404
    
    return jsonify({
        "scenario_name": turn_context["scenario_title"],
        "scenario_description": turn_context["scenario_description"],
        "turn_index": turn_index,
        "video_url": video_url,
        "turn_transcript": turn_context["turn_transcript"]
    })


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

    def _context_task() -> dict:
        try:
            return get_turn_context(scenario_id, turn_index)
        except Exception as e:
            print(f"⚠️ Failed to get turn context: {e}")
            return None

    with ThreadPoolExecutor(max_workers=3) as executor:
        future_upload = executor.submit(_upload_task)
        future_transcribe = executor.submit(_transcribe_task)
        future_context = executor.submit(_context_task)
        
        try:
            audio_url, t_s3_ms = future_upload.result()
        except Exception as e:
            return jsonify({"error": str(e)}), 502
        try:
            transcript, t_stt_ms = future_transcribe.result()
            print(f"📝 WHISPER TRANSCRIBED: '{transcript}'")
        except Exception as e:
            return jsonify({"error": str(e)}), 502
        try:
            turn_context = future_context.result()
        except Exception as e:
            print(f"⚠️ Failed to get turn context: {e}")
            turn_context = None

    # Generate feedback with GPT-5
    print(f"🤖 SENDING TO GPT - Scenario: '{turn_context.get('scenario_title') if turn_context else 'unknown'}', Turn question: '{turn_context.get('turn_transcript', '')[:50] if turn_context else 'none'}...', User said: '{transcript}'")
    try:
        _t = time.perf_counter()
        feedback = generate_feedback_with_gpt(
            transcript=transcript, 
            scenario_title=turn_context.get('scenario_title') if turn_context else None,
            scenario_description=turn_context.get('scenario_description') if turn_context else None,
            turn_transcript=turn_context.get('turn_transcript') if turn_context else None
        )
        t_llm_ms = int((time.perf_counter() - _t) * 1000)
        print(f"💬 GPT RESPONSE: {feedback}")
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502

    # Save to MongoDB (non-blocking background task)
    def _save_to_db():
        try:
            return save_turn(user_id, scenario_id, turn_index, audio_url, transcript, feedback)
        except Exception as e:
            print(f"⚠️ MongoDB save failed: {e}")
            return None
    
    # Submit MongoDB save as background task (don't wait for it)
    with ThreadPoolExecutor(max_workers=1) as db_executor:
        future_db = db_executor.submit(_save_to_db)
        # Don't wait for the result - let it run in background
    
    # Return response immediately without waiting for MongoDB
    turn_id = "pending"  # Placeholder since we're not waiting for the actual ID

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
# Google OAuth Authentication
# ----------------------------
@app.post("/auth/google/signin")
def google_signin():
    """
    POST /auth/google/signin
    Accepts a Google ID token from the frontend and verifies it.
    
    Request body:
      - credential: str (Google ID token)
    
    Returns:
      - user_id: str
      - email: str
      - name: str
    """
    try:
        # Get the credential from request body
        data = request.get_json()
        if not data or 'credential' not in data:
            return jsonify({"error": "Missing 'credential' field in request body"}), 400
        
        credential = data['credential']
        if not credential:
            return jsonify({"error": "Credential cannot be empty"}), 400
        
        # Verify the Google ID token
        try:
            idinfo = id_token.verify_oauth2_token(
                credential, 
                google_requests.Request(), 
                GOOGLE_CLIENT_ID
            )
        except ValueError as e:
            return jsonify({"error": f"Invalid Google ID token: {str(e)}"}), 401
        
        # Extract user information
        google_id = idinfo.get('sub')
        email = idinfo.get('email')
        name = idinfo.get('name')
        
        if not google_id or not email:
            return jsonify({"error": "Missing required user information in token"}), 400
        
        # Create or find user in MongoDB
        try:
            user_doc = {
                "google_id": google_id,
                "email": email,
                "name": name or email.split('@')[0],  # Use email prefix if name not available
                "created_at": datetime.now(timezone.utc),
                "last_signin": datetime.now(timezone.utc)
            }
            
            # Use upsert to create or update user
            result = db.users.update_one(
                {"google_id": google_id},
                {
                    "$set": {
                        "email": email,
                        "name": name or email.split('@')[0],
                        "last_signin": datetime.now(timezone.utc)
                    },
                    "$setOnInsert": {
                        "created_at": datetime.now(timezone.utc)
                    }
                },
                upsert=True
            )
            
            # Get the user document
            user = db.users.find_one({"google_id": google_id})
            user_id = str(user['_id'])
            
            print(f"✅ User authenticated: {email} (ID: {user_id})")
            
            return jsonify({
                "user_id": user_id,
                "email": email,
                "name": name or email.split('@')[0]
            })
            
        except Exception as e:
            print(f"⚠️ MongoDB user creation failed: {e}")
            return jsonify({"error": "Failed to create/find user in database"}), 500
            
    except Exception as e:
        print(f"⚠️ Google sign-in error: {e}")
        return jsonify({"error": "Authentication failed"}), 500


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
# Analytics Endpoints
# ----------------------------

@app.get("/analytics/users")
def get_analytics_users():
    """Returns list of all unique user IDs and their activity count"""
    try:
        # Aggregate user activity counts
        pipeline = [
            {"$group": {
                "_id": "$user_id",
                "activity_count": {"$sum": 1},
                "last_activity": {"$max": "$created_at"}
            }},
            {"$sort": {"activity_count": -1}}
        ]
        
        users = list(db.conversation_turns.aggregate(pipeline))
        
        # Format response
        result = []
        for user in users:
            result.append({
                "user_id": user["_id"],
                "activity_count": user["activity_count"],
                "last_activity": user["last_activity"].isoformat() if user["last_activity"] else None
            })
        
        return jsonify({
            "success": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": result,
            "total_users": len(result)
        })
        
    except Exception as e:
        print(f"❌ Error in /analytics/users: {e}")
        return jsonify({
            "success": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e)
        }), 500

@app.get("/analytics/user/<user_id>")
def get_analytics_user(user_id):
    """Returns all conversation turns for a specific user, sorted by timestamp"""
    try:
        # Find all turns for the user, sorted by timestamp
        turns = list(db.conversation_turns.find(
            {"user_id": user_id}
        ).sort("created_at", -1))
        
        # Format response
        result = []
        for turn in turns:
            result.append({
                "turn_id": str(turn["_id"]),
                "scenario_id": turn.get("scenario_id"),
                "turn_index": turn.get("turn_index"),
                "timestamp": turn.get("created_at").isoformat() if turn.get("created_at") else None,
                "transcript": turn.get("transcript"),
                "has_feedback": bool(turn.get("feedback"))
            })
        
        return jsonify({
            "success": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "data": result,
            "total_turns": len(result)
        })
        
    except Exception as e:
        print(f"❌ Error in /analytics/user/{user_id}: {e}")
        return jsonify({
            "success": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e)
        }), 500

@app.get("/analytics/scenarios")
def get_analytics_scenarios():
    """Returns scenario usage statistics (count of turns per scenario)"""
    try:
        # Aggregate scenario usage
        pipeline = [
            {"$group": {
                "_id": "$scenario_id",
                "turn_count": {"$sum": 1},
                "unique_users": {"$addToSet": "$user_id"},
                "last_used": {"$max": "$created_at"}
            }},
            {"$addFields": {
                "unique_user_count": {"$size": "$unique_users"}
            }},
            {"$sort": {"turn_count": -1}}
        ]
        
        scenarios = list(db.conversation_turns.aggregate(pipeline))
        
        # Format response
        result = []
        for scenario in scenarios:
            result.append({
                "scenario_id": scenario["_id"],
                "turn_count": scenario["turn_count"],
                "unique_user_count": scenario["unique_user_count"],
                "last_used": scenario["last_used"].isoformat() if scenario["last_used"] else None
            })
        
        return jsonify({
            "success": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": result,
            "total_scenarios": len(result)
        })
        
    except Exception as e:
        print(f"❌ Error in /analytics/scenarios: {e}")
        return jsonify({
            "success": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e)
        }), 500

@app.get("/analytics/recent")
def get_analytics_recent():
    """Returns the most recent conversation turns across all users with scenario data"""
    try:
        # Parse limit parameter
        limit_param = request.args.get('limit', '20')
        
        if limit_param.lower() == 'all':
            limit = 0  # No limit
        else:
            try:
                limit = int(limit_param)
                if limit < 1:
                    limit = 20
                elif limit > 1000:
                    limit = 1000
            except ValueError:
                limit = 20
        
        # Find most recent turns
        query = db.conversation_turns.find().sort("created_at", -1)
        if limit > 0:
            query = query.limit(limit)
        
        turns = list(query)
        
        # Format response with scenario data
        result = []
        for turn in turns:
            scenario_id = turn.get("scenario_id")
            turn_index = turn.get("turn_index")
            
            # Get scenario data
            scenario_data = get_scenario_data(scenario_id) if scenario_id else None
            scenario_name = scenario_data.get("title") if scenario_data else None
            
            # Get turn question
            turn_question = get_turn_question(scenario_id, turn_index) if scenario_id and turn_index else None
            
            # Format feedback object
            feedback_data = turn.get("feedback", {})
            feedback = {
                "overall_feedback": feedback_data.get("tip"),  # GPT returns 'tip' not 'overall_feedback'
                "try_instead": feedback_data.get("rewrite"),  # GPT returns 'rewrite' not 'try_instead'
                "tips": feedback_data.get("tip")  # Use 'tip' for tips field
            } if feedback_data else None
            
            result.append({
                "user_id": turn.get("user_id"),
                "scenario_id": scenario_id,
                "scenario_name": scenario_name,
                "turn_index": turn_index,
                "turn_question": turn_question,
                "transcript": turn.get("transcript"),
                "feedback": feedback,
                "turn_id": str(turn["_id"]),
                "timestamp": turn.get("created_at").isoformat() if turn.get("created_at") else None
            })
        
        return jsonify({
            "success": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": result,
            "count": len(result)
        })
        
    except Exception as e:
        print(f"❌ Error in /analytics/recent: {e}")
        return jsonify({
            "success": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e)
        }), 500

# ----------------------------
# Run
# ----------------------------
if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
