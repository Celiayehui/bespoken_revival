# 🗣️ BeSpoken AI Tutor

A simple **AI-powered English conversation simulator** built with **Flask**, **OpenAI Whisper**, and **GPT**.  
Users can record short voice responses in different everyday scenarios (like ordering coffee ☕️) and receive **instant, native-sounding feedback** on pronunciation, fluency, and word choice.

---

## 🚀 Features
- 🎙️ Upload or record short audio (≤ 1 min)
- 🧠 Transcription powered by **Whisper**
- 💬 Real-time feedback via **GPT**
- ☕️ Scenario-based context (starting with “Ordering Coffee”)
- 🌐 Runs on both desktop and mobile browsers

---

## 🧩 Tech Stack
- **Backend:** Python + Flask  
- **AI:** OpenAI Whisper (STT) + GPT (feedback generation)  
- **Storage:** Amazon S3 (audio uploads)  
- **Database (optional):** MongoDB (for storing conversations)

---

## 🛠️ Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/bespoken-ai-tutor.git
cd bespoken-ai-tutor
2. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate  # (Mac/Linux)
# OR
venv\Scripts\activate     # (Windows)

3. Install dependencies
pip install -r requirements.txt

4. Add your environment variables

Create a .env file in the project root:

FLASK_DEBUG=true
PORT=5000
CORS_ALLOW_ORIGINS=*

OPENAI_API_KEY=sk-xxxxxx
WHISPER_MODEL=whisper-1
GPT_MODEL=gpt-4o-mini

AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
S3_BUCKET=your_s3_bucket_name

# MongoDB (optional)
MONGODB_URI=your_mongo_uri
DB_NAME=langsim

5. Run the Flask server
python app.py


Visit the app at:
👉 http://127.0.0.1:5000

🧪 Testing

You can test the /upload route with:

curl -X POST \
  -F "audio=@test_audio.wav" \
  -F "user_id=test-user" \
  -F "scenario_id=1" \
  -F "turn_index=1" \
  http://127.0.0.1:5000/upload


Expected JSON:

{
  "transcript": "I want a coffee.",
  "feedback": {
    "tip": "Try 'Can I get a coffee, please?' to sound more natural.",
    "rewrite": "Can I get a coffee, please?"
  },
  "latency_ms": 5000
}

📈 Roadmap
MVP (Current)

✅ Flask backend with Whisper + GPT feedback

✅ Audio upload + S3 integration

✅ Scenario-based prompt (“Order coffee”)

Next

 Frontend with HTML + JS (upload + display feedback)

 Add more scenarios (hotel, meeting, etc.)

 Connect MongoDB for saving full conversations

 Deploy on Render / Railway for demo testing
