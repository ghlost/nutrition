import os
import requests
from dotenv import load_dotenv

load_dotenv()

USDA_API_KEY = os.getenv("USDA_API_KEY", "")
USDA_BASE    = "https://api.nal.usda.gov/fdc/v1"

# USDA nutrient IDs
NUTRIENT_IDS = {
    "calories":  [1008, 2047, 2048],  # Energy kcal (multiple possible IDs)
    "protein":   [1003],
    "carbs":     [1005],
    "fat":       [1004],
    "fiber":     [1079],
    "sugar":     [2000, 1063],
    "sodium":    [1093],
}


def _get_nutrient(nutrients: list, nutrient_ids: list[int]) -> float | None:
    for n in nutrients:
        try:
            nid = int(n.get("nutrientId", 0))
            if nid in nutrient_ids:
                val = n.get("value")
                if val is not None:
                    return round(float(val), 1)
        except (TypeError, ValueError):
            continue
    return None


def _normalize_food(food: dict) -> dict | None:
    nutrients = food.get("foodNutrients", [])

    calories = _get_nutrient(nutrients, NUTRIENT_IDS["calories"])
    protein  = _get_nutrient(nutrients, NUTRIENT_IDS["protein"])
    carbs    = _get_nutrient(nutrients, NUTRIENT_IDS["carbs"])
    fat      = _get_nutrient(nutrients, NUTRIENT_IDS["fat"])

    if calories is None:
        return None

    # Build serving size string
    serving_size = food.get("servingSize")
    serving_unit = food.get("servingSizeUnit", "g")
    serving_str  = f"{serving_size} {serving_unit}" if serving_size else "100g"

    return {
        "fdcId":        food.get("fdcId"),
        "name":         food.get("description", "Unknown"),
        "brand":        food.get("brandOwner") or food.get("brandName") or None,
        "serving_size": serving_str,
        "calories":     calories,
        "protein_g":    protein or 0,
        "carbs_g":      carbs or 0,
        "fat_g":        fat or 0,
        "fiber_g":      _get_nutrient(nutrients, NUTRIENT_IDS["fiber"]),
        "sugar_g":      _get_nutrient(nutrients, NUTRIENT_IDS["sugar"]),
        "sodium_mg":    _get_nutrient(nutrients, NUTRIENT_IDS["sodium"]),
        "source":       "usda",
    }


def search_usda(query: str, page_size: int = 10) -> list[dict]:
    if not USDA_API_KEY:
        raise ValueError("USDA_API_KEY not set")

    resp = requests.get(
        f"{USDA_BASE}/foods/search",
        params={
            "query":    query,
            "api_key":  USDA_API_KEY,
            "pageSize": page_size,
            "dataType": "SR Legacy,Foundation,Branded",
        },
        timeout=10
    )
    resp.raise_for_status()

    results = []
    for food in resp.json().get("foods", []):
        normalized = _normalize_food(food)
        if normalized:
            results.append(normalized)

    return results


def get_usda_food(fdc_id: int) -> dict | None:
    resp = requests.get(
        f"{USDA_BASE}/food/{fdc_id}",
        params={"api_key": USDA_API_KEY},
        timeout=10
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()

    food = resp.json()
    # Detail endpoint wraps nutrients differently
    nutrients = food.get("foodNutrients", [])

    # Detail endpoint uses nested nutrient object
    normalized_nutrients = []
    for n in nutrients:
        nutrient = n.get("nutrient", {})
        normalized_nutrients.append({
            "nutrientId": nutrient.get("id"),
            "value":      n.get("amount"),
        })

    food["foodNutrients"] = normalized_nutrients
    return _normalize_food(food)