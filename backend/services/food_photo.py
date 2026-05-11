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

    context = ""
    if description:
        # Escape any quotes in the description to prevent prompt injection
        safe_desc = description.replace('"', "'").replace('\n', ' ')
        context = f"""The user described this meal as: "{safe_desc}"
Use this as primary context. Prioritize this description over visual inference.\n\n"""

    response = haiku.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,  # bump tokens — complex meals need more room
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": mime, "data": b64}
                },
                {
                    "type": "text",
                    "text": f"""{context}Analyze this food photo. Return ONLY valid JSON, no markdown, no extra text.

{{
  "foods": [
    {{
      "name": "string",
      "preparation": "string",
      "estimated_portion": "string",
      "confidence": "high"
    }}
  ],
  "meal_type": "string",
  "visible_plate_size": "medium",
  "complexity": "simple",
  "notes": "string"
}}

Rules:
- confidence must be exactly: high, medium, or low
- visible_plate_size must be exactly: small, medium, large, or unknown
- complexity must be exactly: simple, mixed, or complex
- Keep notes under 100 characters
- No trailing commas
- Return only the JSON object, nothing else"""
                }
            ]
        }]
    )

    raw = response.content[0].text.strip()

    # More aggressive cleaning
    clean = raw
    clean = clean.removeprefix("```json").removeprefix("```")
    clean = clean.removesuffix("```").strip()

    # Find the JSON object boundaries in case there's extra text
    start = clean.find('{')
    end   = clean.rfind('}')
    if start != -1 and end != -1:
        clean = clean[start:end + 1]

    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"Raw response: {raw}")
        # Return a safe fallback so the pipeline doesn't crash
        return {
            "foods": [{"name": description or "Unknown food", "preparation": "unknown", "estimated_portion": "1 serving", "confidence": "low"}],
            "meal_type": "unknown",
            "visible_plate_size": "unknown",
            "complexity": "simple",
            "notes": "Could not fully analyze image"
        }

# ── Step 2: Context — generate follow-up questions ───────────────────────────

def generate_questions(identified: dict) -> list[dict]:
    response = haiku.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=400,
        messages=[{
            "role": "user",
            "content": f"""Based on this food analysis, generate 2-3 follow-up questions
to improve calorie estimation accuracy.

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

STRICT RULES — follow these exactly:
- NEVER ask for weight in grams, ounces, or pounds
- NEVER ask "how many grams" or "what was the weight"
- NEVER ask for precise measurements the user would need a scale for
- For portion size: use visual anchors (deck of cards, fist, palm, plate coverage)
- For protein pieces: ask about size category (small/medium/large) not weight
- For multiple pieces: the photo likely shows count — only ask if truly unclear
- Prefer "single" type questions with intuitive option labels
- Focus on: cooking method, added fats/sauces, size relative to common objects, restaurant vs homemade
- Max 3 questions, only ask what genuinely affects the estimate

Good question examples:
- "How large was each chicken wing?" → ["Small bar-style", "Medium", "Large restaurant-style"]
- "How much of the plate did the rice fill?" → ["About a quarter", "About a third", "About half", "More than half"]
- "Any oil, butter, or sauce added?" → ["None", "Light drizzle", "Moderate amount", "Heavily sauced"]

Bad questions to avoid:
- "How many grams of chicken?" ← never ask this
- "What was the portion weight?" ← never ask this
- "How many ounces?" ← never ask this"""
        }]
    )

    raw = response.content[0].text.strip()
    clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(clean)["questions"]


# ── Step 3: Estimation — calculate macros ────────────────────────────────────

def estimate_macros(identified: dict, questions: list, answers: dict) -> dict:
    # """Sonnet — reason across all context to estimate macros."""
    """Haiku — estimate macros from all context."""

    # Format Q&A for the prompt
    qa_text = ""
    for q in questions:
        answer = answers.get(q["id"], "not answered")
        qa_text += f"Q: {q['question']}\nA: {answer}\n\n"

    response = haiku.messages.create(
        # model="claude-sonnet-4-20250514", // can't use sonnet
        model="claude-haiku-4-5-20251001",
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