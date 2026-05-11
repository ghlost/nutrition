import base64
import json
import os
import anthropic
from dotenv import load_dotenv

load_dotenv()

haiku  = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
sonnet = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Both use same client — separate vars make it easy to swap models independently


def _encode(image_bytes: bytes) -> tuple:
    data = base64.b64encode(image_bytes).decode("utf-8")
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        mime = "image/png"
    elif image_bytes[:3] == b'\xff\xd8\xff':
        mime = "image/jpeg"
    elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        mime = "image/webp"
    else:
        mime = "image/jpeg"
    return data, mime


# ── Step 1: Vision — identify foods ──────────────────────────────────────────

def identify_foods(image_bytes: bytes, description: str | None = None) -> dict:
    b64, mime = _encode(image_bytes)

    # Prepend user description to guide the model
    context = ""
    if description:
        context = f"""The user provided this description of the meal: "{description}"
Use this as primary context. The photo may not clearly show all details.\n\n"""

    response = haiku.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": mime, "data": b64}
                },
                {
                    "type": "text",
                    "text": f"""{context}Analyze this food photo. Return ONLY valid JSON, no markdown.
{{
  "foods": [
    {{
      "name": string,
      "preparation": string,
      "estimated_portion": string,
      "confidence": "high" | "medium" | "low"
    }}
  ],
  "meal_type": string,
  "visible_plate_size": "small" | "medium" | "large" | "unknown",
  "complexity": "simple" | "mixed" | "complex",
  "notes": string
}}
Be specific about preparation (grilled, fried, steamed, raw).
Estimate portion in common units (1 cup, 6oz, 2 tbsp).
If a description was provided, prioritize it over visual inference."""
                }
            ]
        }]
    )

    raw = response.content[0].text.strip()
    clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(clean)

# ── Step 2: Context — generate follow-up questions ───────────────────────────

def generate_questions(identified: dict) -> list[dict]:
    """Haiku text — generate targeted clarifying questions."""

    response = haiku.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[{
            "role": "user",
            "content": f"""Based on this food analysis, generate 2-3 follow-up questions
to improve calorie estimation accuracy. Focus on the biggest unknowns.

Food analysis: {json.dumps(identified)}

Return ONLY valid JSON, no markdown:
{{
  "questions": [
    {{
      "id": string,
      "question": string,
      "type": "single" | "multiple" | "number" | "boolean",
      "options": [string] or null,
      "purpose": string
    }}
  ]
}}

Question types:
- "single": pick one option from options list
- "multiple": pick multiple from options list
- "number": user types a number
- "boolean": yes/no

Focus on: portion size, cooking method if unclear,
added sauces/dressings, restaurant vs homemade, protein weight.
Max 3 questions. Only ask what's genuinely unclear from the photo."""
        }]
    )

    raw = response.content[0].text.strip()
    clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(clean)["questions"]


# ── Step 3: Estimation — calculate macros ────────────────────────────────────

def estimate_macros(identified: dict, questions: list, answers: dict) -> dict:
    """Sonnet — reason across all context to estimate macros."""

    # Format Q&A for the prompt
    qa_text = ""
    for q in questions:
        answer = answers.get(q["id"], "not answered")
        qa_text += f"Q: {q['question']}\nA: {answer}\n\n"

    response = sonnet.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=800,
        messages=[{
            "role": "user",
            "content": f"""Estimate the nutritional content of this meal.
Use the food analysis and user answers to make the most accurate estimate possible.

FOOD ANALYSIS:
{json.dumps(identified, indent=2)}

USER ANSWERS TO CLARIFYING QUESTIONS:
{qa_text}

Return ONLY valid JSON, no markdown:
{{
  "items": [
    {{
      "name": string,
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "portion_used": string
    }}
  ],
  "totals": {{
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number
  }},
  "calorie_range": {{
    "low": number,
    "high": number
  }},
  "confidence": "high" | "medium" | "low",
  "confidence_reason": string,
  "assumptions": [string]
}}

Be precise. Use USDA nutrition data as reference.
Calorie range should reflect genuine uncertainty (±10% high, ±20% medium, ±30% low)."""
        }]
    )

    raw = response.content[0].text.strip()
    clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(clean)


# ── Step 4: Critic — sanity check ────────────────────────────────────────────

def critic_check(identified: dict, estimate: dict) -> dict:
    """Haiku — flag obvious errors in the estimate."""

    response = haiku.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[{
            "role": "user",
            "content": f"""Sanity check this nutritional estimate against the food identified.
Flag any obvious errors.

FOOD: {json.dumps(identified)}
ESTIMATE: {json.dumps(estimate)}

Return ONLY valid JSON, no markdown:
{{
  "approved": boolean,
  "issues": [string],
  "corrected_totals": {{
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number
  }} | null,
  "final_confidence": "high" | "medium" | "low"
}}

Flag if:
- Calories seem impossibly high or low for the food
- Macros don't add up (protein*4 + carbs*4 + fat*9 should ≈ calories)
- Portion size seems unrealistic
Only correct if there's a clear error. Otherwise approve as-is."""
        }]
    )

    raw = response.content[0].text.strip()
    clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(clean)


# ── Orchestrator ──────────────────────────────────────────────────────────────

def run_food_scan_step1(image_bytes: bytes, description: str | None = None) -> dict:
    identified = identify_foods(image_bytes, description=description)
    questions  = generate_questions(identified)
    return {
        "identified":   identified,
        "questions":    questions,
        "description":  description,  # pass through for display
    }


def run_food_scan_step2(identified: dict, questions: list, answers: dict) -> dict:
    """
    Run steps 3 and 4 — estimate macros and critic check.
    Call after user answers the follow-up questions.
    """
    estimate = estimate_macros(identified, questions, answers)
    critique = critic_check(identified, estimate)

    # Use corrected totals if critic found issues
    final_totals = critique.get("corrected_totals") or estimate["totals"]
    final_confidence = critique.get("final_confidence", estimate["confidence"])

    return {
        "items":             estimate["items"],
        "totals":            final_totals,
        "calorie_range":     estimate["calorie_range"],
        "confidence":        final_confidence,
        "confidence_reason": estimate["confidence_reason"],
        "assumptions":       estimate.get("assumptions", []),
        "critic_issues":     critique.get("issues", []),
        "approved":          critique.get("approved", True),
    }