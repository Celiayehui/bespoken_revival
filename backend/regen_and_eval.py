import os
import json
import pandas as pd
from tqdm import tqdm
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv
import subprocess
from pathlib import Path

# === Setup ===
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# === Load system prompt ===
with open("system_prompt.txt", encoding="utf-8") as f:
    system_prompt = f.read()

# === Load test dataset ===
csv_path = Path(__file__).resolve().parent.parent / "BeSpoken_eval.csv"

try:
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
except UnicodeDecodeError:
    print("⚠️ UTF-8 decode failed; retrying with latin-1 encoding.")
    df = pd.read_csv(csv_path, encoding="latin1")

# === Helper ===
def clean_text(text):
    if not isinstance(text, str):
        return ""
    return (
        text.replace("â€™", "'")
        .replace("â€“", "-")
        .replace("â€œ", '"')
        .replace("â€", '"')
        .replace("Â", "")
        .strip()
    )

# === Regeneration ===
def regenerate_feedback(row):
    partner = row.get("turn_transcript", "")
    learner = row.get("transcript", "")
    scenario = row.get("scenario_title", "")
    description = row.get("scenario_description", "")

    user_message = f"""
Scenario: {scenario}
Description: {description}

Partner said: {partner}
Learner replied: {learner}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
        )
        feedback = json.loads(response.choices[0].message.content)
        return feedback
    except Exception as e:
        print(f"⚠️ Error regenerating row: {e}")
        return {"tip": "", "rewrite": "", "grade": ""}

# === Run regeneration ===
regenerated = []
print("🔁 Regenerating feedback for all rows...")
for _, row in tqdm(df.iterrows(), total=len(df)):
    regenerated.append(regenerate_feedback(row))

df["feedback.tip_new"] = [clean_text(fb.get("tip", "")) for fb in regenerated]
df["feedback.rewrite_new"] = [clean_text(fb.get("rewrite", "")) for fb in regenerated]
df["feedback.grade_new"] = [clean_text(fb.get("grade", "")) for fb in regenerated]

# === Save regenerated file ===
timestamp = datetime.now().strftime("%Y%m%d_%H%M")
regen_file = f"BeSpoken_regen_{timestamp}.csv"
df.to_csv(regen_file, index=False, encoding="utf-8-sig")
print(f"💾 Regenerated feedback saved to {regen_file}")

# === Step 2: Run your evaluation script ===
eval_script = "eval.py"
print("🧮 Running evaluation...")
subprocess.run(["python", eval_script, regen_file], check=False)

# === Step 3: Generate Markdown Summary (optional inline) ===
try:
    eval_df = pd.read_csv("BeSpoken_eval_output.csv") if os.path.exists("BeSpoken_eval_output.csv") else pd.read_csv(regen_file)
    md_filename = f"BeSpoken_Report_{timestamp}.md"

    with open(md_filename, "w", encoding="utf-8") as md:
        md.write(f"# 🧩 BeSpoken Evaluation Report\n\n")
        md.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        md.write(f"**Total Samples:** {len(eval_df)}\n\n")

        md.write("## 🧠 All Evaluation Examples\n\n")
        for i, row in eval_df.iterrows():
            md.write(f"### Example {i+1}\n\n")
            md.write(f"**🧭 Scenario:** {row.get('scenario_title', '')}\n\n")
            md.write(f"**🗣 Partner said:** {row.get('turn_transcript', '')}\n\n")
            md.write(f"**👩‍🎓 Learner said:** {row.get('transcript', '')}\n\n")

            md.write(f"**💬 Model Tip:** {clean_text(row.get('feedback.tip', ''))}\n\n")
            md.write(f"**🎯 Ideal Tip:** {clean_text(row.get('feedback.tip_ideal', ''))}\n\n")
            md.write(f"**🧪 Eval Tip:** {row.get('eval_tip', '?')}\n\n")
            md.write(f"**📈 Tip Score:** {row.get('tip_score', 0)}\n\n")

            md.write(f"**✏️ Model Rewrite:** {clean_text(row.get('feedback.rewrite', ''))}\n\n")
            md.write(f"**🏆 Ideal Rewrite:** {clean_text(row.get('feedback.rewrite_ideal', ''))}\n\n")
            md.write(f"**🧪 Eval Rewrite:** {row.get('eval_rewrite', '?')}\n\n")
            md.write(f"**📈 Rewrite Score:** {row.get('rewrite_score', 0)}\n\n")

            md.write(f"**✅ Model Grade:** {row.get('feedback.grade', '')}\n\n")
            md.write(f"**🎯 Ideal Grade:** {row.get('feedback.grade_ideal', '')}\n\n")
            md.write(f"**🧪 Grade Score:** {row.get('grade_score', 0)}\n\n")
            md.write(f"**Overall Score:** {row.get('avg_score', 0)}\n\n")
            md.write("---\n\n")

    print(f"📝 Markdown report saved to {md_filename}")
except Exception as e:
    print(f"⚠️ Markdown generation skipped: {e}")
