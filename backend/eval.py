import os
from pathlib import Path
import pandas as pd
from tqdm import tqdm
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

# ------------------------------
# Setup
# ------------------------------
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ------------------------------
# Shared ABCDE rubric evaluator (for tip and rewrite)
# ------------------------------
def eval_vs_ideal(question, expert, submission):
    # Handle missing or placeholder text cases first
    expert = str(expert or "").strip()
    submission = str(submission or "").strip()

    # Case 1: both missing → skip scoring (E)
    if not expert and not submission:
        return "E"

    # Case 2: model missing but expert exists → D
    if not submission and expert:
        return "D"

    # Case 3: expert missing but model exists → D
    if not expert and submission:
        return "D"

    # ------------------------------
    # System + user prompt for GPT
    # ------------------------------
    system_message = """\
You are an evaluation assistant that grades how well a model’s feedback matches an expert (ideal) response.
Always evaluate in the context of the full conversation between the partner and the learner.

Rules:
1. If the model feedback addresses a different linguistic issue (e.g., tone vs. vocabulary vs. grammar), treat that as a disagreement (D).
2. If the model feedback misses or ignores the expert’s main point, treat it as a disagreement (D).
3. If either the expert or model feedback is missing, mark it as D (unless both are blank → E).
Output only a single letter from A–E and nothing else.
"""

    user_message = f"""\
You are comparing a model-generated feedback message to an expert version.
Evaluate whether the model’s message provides correct, relevant, and consistent feedback 
based on the dialogue context between the partner and the learner.

[BEGIN DATA]
************
[Conversation Context]
{question}
************
[Expert Feedback]
{expert}
************
[Model Feedback]
{submission}
************
[END DATA]

Compare the factual and semantic content of the model feedback with the expert version.
Ignore minor stylistic differences (tone, punctuation, formatting).

Choose ONE option:

(A) The model feedback identifies the same issue or correction as the expert, but it is less complete — missing explanation, reasoning, or examples that the expert provides.  
(B) The model feedback adds extra relevant detail while staying fully consistent with the expert.  
(C) The model feedback covers the same ideas and explanations as the expert — equally complete and accurate.  
(D) The model feedback gives different, incorrect, or irrelevant advice.  
(E) The model feedback only differs stylistically (tone, punctuation, or rephrasing) but conveys the same meaning.


Output a single capital letter (A–E).
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
    )

    return response.choices[0].message.content.strip()[0]
# ------------------------------
# Specialized evaluation functions
# ------------------------------
def eval_tip(row):
    question = (
        f"Partner said: {row.get('turn_transcript', '')}\n"
        f"Learner replied: {row.get('transcript', '')}"
    )
    expert = row.get("feedback.tip_ideal", "")
    submission = row.get("feedback.tip", "")
    return eval_vs_ideal(question, expert, submission)


def eval_rewrite(row):
    question = (
        f"Partner said: {row.get('turn_transcript', '')}\n"
        f"Learner replied: {row.get('transcript', '')}"
    )
    expert = row.get("feedback.rewrite_ideal", "")
    submission = row.get("feedback.rewrite", "")
    return eval_vs_ideal(question, expert, submission)


# ------------------------------
# Structured deterministic grade evaluator
# ------------------------------
def eval_grade(row):
    model_grade = str(row.get("feedback.grade", "")).strip().lower()
    ideal_grade = str(row.get("feedback.grade_ideal", "")).strip().lower()

    if not model_grade or not ideal_grade:
        return 0.0
    return 1.0 if model_grade == ideal_grade else 0.0


# ------------------------------
# Run evaluation
# ------------------------------
csv_path = Path(__file__).resolve().parent.parent / "BeSpoken_eval.csv"

try:
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
except UnicodeDecodeError:
    print("⚠️ UTF-8 decode failed; retrying with latin-1 encoding.")
    df = pd.read_csv(csv_path, encoding="latin1")

print("🔍 Running BeSpoken Evaluation (context-aware ABCDE rubric)...")

VALID_LETTERS = {"A", "B", "C", "D", "E"}


def extract_label(raw_value):
    if raw_value is None:
        return "?"
    value = str(raw_value).strip().upper()
    for ch in value:
        if ch in VALID_LETTERS:
            return ch
    return "?"


def safe_eval(func, row):
    try:
        raw = func(row)
        letter = extract_label(raw)
        if letter == "?":
            print(f"⚠️ Unexpected evaluator output: {raw}")
        return letter
    except Exception as exc:
        print(f"⚠️ Evaluation error: {exc}")
        return "?"


df["eval_tip"] = [safe_eval(eval_tip, row) for _, row in tqdm(df.iterrows(), total=len(df))]
df["eval_rewrite"] = [safe_eval(eval_rewrite, row) for _, row in tqdm(df.iterrows(), total=len(df))]
df["grade_score"] = [eval_grade(row) for _, row in tqdm(df.iterrows(), total=len(df))]

# ------------------------------
# Scoring rubric
# ------------------------------
score_map = {"A": 0.8, "B": 0.8, "C": 1.0, "E": 1.0, "D": 0.0}
df["tip_score"] = df["eval_tip"].map(score_map).fillna(0)
df["rewrite_score"] = df["eval_rewrite"].map(score_map).fillna(0)

# ------------------------------
# Summary
# ------------------------------
print("\n📊 Summary:")
print(f"✅ Grade match accuracy: {df['grade_score'].mean():.2%}")
print(f"💡 Average tip score: {df['tip_score'].mean():.2f}")
print(f"✍️ Average rewrite score: {df['rewrite_score'].mean():.2f}")

for col in ["eval_tip", "eval_rewrite"]:
    print(f"\n{col} distribution:")
    print(df[col].value_counts())

out_name = f"bespoken_eval_results_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
df.to_csv(out_name, index=False)
print(f"\n💾 Results saved to {out_name}")


# ------------------------------
# Markdown report generation
# ------------------------------
avg_tip = df["tip_score"].mean()
avg_rewrite = df["rewrite_score"].mean()
avg_grade = df["grade_score"].mean()

timestamp = datetime.now().strftime("%Y%m%d_%H%M")
md_filename = f"BeSpoken_eval_report_{timestamp}.md"

df["avg_score"] = df[["tip_score", "rewrite_score", "grade_score"]].mean(axis=1)
lowest_rows = df.sort_values("avg_score").head(5)

with open(md_filename, "w") as md:
    md.write(f"# 🧩 BeSpoken Evaluation Report\n\n")
    md.write(f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
    md.write(f"**Total Samples:** {len(df)}\n\n")

    md.write("## 📊 Overall Scores\n\n")
    md.write(f"- **Tip Score (avg):** {df['tip_score'].mean():.2f}\n")
    md.write(f"- **Rewrite Score (avg):** {df['rewrite_score'].mean():.2f}\n")
    md.write(f"- **Grade Accuracy:** {df['grade_score'].mean():.2f}\n\n")

    md.write("## 🧠 All Evaluation Examples\n\n")
    df["avg_score"] = df[["tip_score", "rewrite_score", "grade_score"]].mean(axis=1)

    # Sort by scenario or average score if you prefer
    sorted_df = df.sort_values(by=["scenario_title", "avg_score"], ascending=[True, False])

    for i, row in sorted_df.iterrows():
        md.write(f"### Example {i+1}\n\n")
        md.write(f"**🧭 Scenario:** {row.get('scenario_title', 'N/A')}\n\n")
        md.write(f"**🗣 Partner said:** {row.get('turn_transcript', '')}\n\n")
        md.write(f"**👩‍🎓 Learner said:** {row.get('transcript', '')}\n\n")

        # Handle NaN or None text cleanly
        tip = row.get('feedback.tip', '') or "(none)"
        tip_ideal = row.get('feedback.tip_ideal', '') or "(none)"
        rewrite = row.get('feedback.rewrite', '') or "(none)"
        rewrite_ideal = row.get('feedback.rewrite_ideal', '') or "(none)"
        grade = row.get('feedback.grade', '') or "(none)"
        grade_ideal = row.get('feedback.grade_ideal', '') or "(none)"

        md.write(f"**💬 Model Tip:** {tip}\n\n")
        md.write(f"**🎯 Ideal Tip:** {tip_ideal}\n\n")
        md.write(f"**🧪 Eval Tip:** {row.get('eval_tip', '?')}\n\n")
        md.write(f"**📈 Tip Score:** {row.get('tip_score', 0):.2f}\n\n")

        md.write(f"**✏️ Model Rewrite:** {rewrite}\n\n")
        md.write(f"**🏆 Ideal Rewrite:** {rewrite_ideal}\n\n")
        md.write(f"**🧪 Eval Rewrite:** {row.get('eval_rewrite', '?')}\n\n")
        md.write(f"**📈 Rewrite Score:** {row.get('rewrite_score', 0):.2f}\n\n")

        md.write(f"**✅ Model Grade:** {grade}\n\n")
        md.write(f"**🎯 Ideal Grade:** {grade_ideal}\n\n")
        md.write(f"**🧪 Grade Score:** {row.get('grade_score', 0):.2f}\n\n")

        md.write(f"**Overall Score:** {row['avg_score']:.2f}\n\n")
        md.write("---\n\n")

print(f"📄 Markdown report saved to {md_filename}")
