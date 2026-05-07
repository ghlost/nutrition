import base64
import json
import os
import anthropic
from dotenv import load_dotenv

load_dotenv()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def _encode_image(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


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
    response = client.messages.create(
        model="claude-opus-4-20250514",
        max_tokens=1500,
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
    return json.loads(clean)