import base64
import json
import os
import anthropic
import re
import urllib.request
import ssl
import certifi
import requests
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def _encode_image(image_bytes: bytes) -> tuple:
    data = base64.b64encode(image_bytes).decode("utf-8")

    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        mime = "image/png"
    elif image_bytes[:3] == b'\xff\xd8\xff':
        mime = "image/jpeg"
    elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        mime = "image/webp"
    elif image_bytes[:3] == b'GIF':
        mime = "image/gif"
    else:
        mime = "image/jpeg"

    result = (data, mime)
    print(f"DEBUG _encode_image returning {len(result)} values, mime={mime}")
    return result


def extract_nutrition_label(image_bytes: bytes) -> dict:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": _encode_image(image_bytes)
                    }
                },
                {
                    "type": "text",
                    "text": """Extract the nutrition facts from this label.
Return ONLY valid JSON, no markdown, no explanation.
Use this exact schema:
{
"name": string,
"brand": string or null,
"serving_size": string,
"calories": number,
"protein_g": number,
"carbs_g": number,
"fat_g": number,
"fiber_g": number or null,
"sugar_g": number or null,
"sodium_mg": number or null,
"saturated_fat_g": number or null,
"trans_fat_g": number or null,
"cholesterol_mg": number or null
}
If a value is not visible on the label, use null."""
                }
            ]
        }]
    )

    raw = response.content[0].text.strip()
    clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(clean)


def extract_recipe(image_bytes: bytes) -> dict:
    b64, media_type = _encode_image(image_bytes)
    print(f"DEBUG media_type: {media_type}, b64 length: {len(b64)}")

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": b64
                    }
                },
                {
                    "type": "text",
                    "text": """Extract the recipe from this image.
Return ONLY valid JSON, no markdown, no explanation.
Use this exact schema:
{
  "name": string,
  "servings": number or null,
  "prep_time_min": number or null,
  "cook_time_min": number or null,
  "calories_per_serving": number or null,
  "protein_per_serving_g": number or null,
  "carbs_per_serving_g": number or null,
  "fat_per_serving_g": number or null,
  "tags": [string],
  "instructions": [string],
  "ingredients": [
    {
      "quantity": number,
      "unit": string or null,
      "ingredient": string,
      "notes": string or null
    }
  ]
}
Convert all fractions to decimals (e.g. 1/2 → 0.5).
Each instruction should be one complete step.
For tags, infer relevant ones e.g. ["high-protein", "vegetarian", "quick"]."""
                }
            ]
        }]
    )

    raw = response.content[0].text.strip()
    clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    extracted = json.loads(clean)

    # Step 1: free — calculate from macros if available
    extracted = estimate_calories_from_macros(extracted)

    # Step 2: cheap Haiku call only if still no calorie data
    if not extracted.get("calories_per_serving"):
        extracted = estimate_calories_from_ingredients(extracted)

    return extracted

# Rough kcal per gram for common units — no API needed
UNIT_TO_GRAMS: dict[str, float] = {
    "g": 1, "gram": 1, "grams": 1,
    "kg": 1000,
    "oz": 28.35, "ounce": 28.35, "ounces": 28.35,
    "lb": 453.6, "pound": 453.6, "pounds": 453.6,
    "cup": 240, "cups": 240,
    "tbsp": 15, "tablespoon": 15, "tablespoons": 15,
    "tsp": 5, "teaspoon": 5, "teaspoons": 5,
    "ml": 1, "l": 1000,
}

def estimate_calories_from_macros(extracted: dict) -> dict:
    """
    If the AI returned macro data, calculate calories from them.
    protein: 4 kcal/g, carbs: 4 kcal/g, fat: 9 kcal/g
    Only fills in if calories_per_serving is missing.
    """
    if extracted.get("calories_per_serving"):
        return extracted  # already have it, do nothing

    protein = extracted.get("protein_per_serving_g") or 0
    carbs   = extracted.get("carbs_per_serving_g") or 0
    fat     = extracted.get("fat_per_serving_g") or 0

    if protein or carbs or fat:
        calories = round((protein * 4) + (carbs * 4) + (fat * 9))
        extracted["calories_per_serving"] = calories

    return extracted


def estimate_calories_from_ingredients(extracted: dict) -> dict:
    """
    Last resort — ask Haiku to estimate calories from the ingredient list.
    Only called if we still have no calorie data after macro check.
    """
    if extracted.get("calories_per_serving"):
        return extracted

    ingredients = extracted.get("ingredients", [])
    if not ingredients:
        return extracted

    # Format ingredient list for the prompt
    ingredient_lines = []
    for ing in ingredients:
        qty  = ing.get("quantity", "")
        unit = ing.get("unit", "") or ""
        name = ing.get("ingredient", "")
        ingredient_lines.append(f"- {qty} {unit} {name}".strip())

    servings = extracted.get("servings") or 1
    ingredient_text = "\n".join(ingredient_lines)

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[{
            "role": "user",
            "content": f"""Estimate the total calories and macros for this recipe with {servings} servings.
Ingredients:
{ingredient_text}

Return ONLY valid JSON, no explanation:
{{
  "total_calories": number,
  "total_protein_g": number,
  "total_carbs_g": number,
  "total_fat_g": number
}}"""
        }]
    )

    raw = response.content[0].text.strip()
    clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        totals = json.loads(clean)
        servings_count = max(servings, 1)
        extracted["calories_per_serving"]  = round(totals["total_calories"]  / servings_count)
        extracted["protein_per_serving_g"] = round(totals["total_protein_g"] / servings_count, 1)
        extracted["carbs_per_serving_g"]   = round(totals["total_carbs_g"]   / servings_count, 1)
        extracted["fat_per_serving_g"]     = round(totals["total_fat_g"]     / servings_count, 1)
    except (json.JSONDecodeError, KeyError):
        pass  # if estimation fails, just leave nulls

    return extracted

def fetch_recipe_from_url(url: str) -> dict:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        resp.raise_for_status()
        html = resp.text
    except requests.HTTPError as e:
        raise ValueError(f"Could not fetch page ({e.response.status_code}). The site may block automated access.")

    # Strip scripts, styles, and tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>',  '', text,  flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    text = text[:8000]

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        messages=[{
            "role": "user",
            "content": f"""Extract the recipe from this webpage text.
Return ONLY valid JSON, no markdown, no explanation.
Use this exact schema:
{{
  "name": string,
  "servings": number or null,
  "prep_time_min": number or null,
  "cook_time_min": number or null,
  "calories_per_serving": number or null,
  "protein_per_serving_g": number or null,
  "carbs_per_serving_g": number or null,
  "fat_per_serving_g": number or null,
  "tags": [string],
  "instructions": [string],
  "ingredients": [
    {{
      "quantity": number or null,
      "unit": string or null,
      "ingredient": string,
      "notes": string or null
    }}
  ]
}}
Convert all fractions to decimals (e.g. 1/2 → 0.5).
Each instruction should be one complete step.
For tags, infer relevant ones e.g. ["high-protein", "vegetarian", "quick"].
If no recipe is found, return {{"error": "no recipe found"}}.

Webpage text:
{text}"""
        }]
    )

    raw = response.content[0].text.strip()
    clean = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    result = json.loads(clean)

    if "error" in result:
        raise ValueError(result["error"])

    result = estimate_calories_from_macros(result)
    if not result.get("calories_per_serving"):
        result = estimate_calories_from_ingredients(result)

    return result