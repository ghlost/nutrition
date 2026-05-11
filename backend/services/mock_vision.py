def extract_nutrition_label(image_bytes: bytes) -> dict:
    return {
        "name": "Mock Protein Bar",
        "brand": "Test Brand",
        "serving_size": "1 bar (60g)",
        "calories": 250.0,
        "protein_g": 20.0,
        "carbs_g": 25.0,
        "fat_g": 8.0,
        "fiber_g": 3.0,
        "sugar_g": 10.0,
        "sodium_mg": 180.0,
        "saturated_fat_g": 3.0,
        "trans_fat_g": 0.0,
        "cholesterol_mg": 5.0
    }


def extract_recipe(image_bytes: bytes) -> dict:
    return {
        "name": "Mock Chicken & Rice Bowl",
        "servings": 4,
        "prep_time_min": 10,
        "cook_time_min": 25,
        "calories_per_serving": None,   # ← test the estimation path
        "protein_per_serving_g": None,
        "carbs_per_serving_g": None,
        "fat_per_serving_g": None,
        "tags": ["high-protein", "meal-prep", "gluten-free"],
        "instructions": [
            "Season chicken breasts with salt, pepper, and garlic powder.",
            "Heat oil in a skillet over medium-high heat. Cook chicken 6-7 minutes per side.",
            "Rest chicken for 5 minutes, then slice.",
            "Cook rice according to package instructions.",
            "Divide rice into bowls, top with sliced chicken and vegetables.",
            "Drizzle with sauce and serve."
        ],
        "ingredients": [
            {"quantity": 4.0, "unit": None,   "ingredient": "chicken breasts", "notes": "boneless, skinless"},
            {"quantity": 2.0, "unit": "cup",  "ingredient": "jasmine rice",    "notes": None},
            {"quantity": 2.0, "unit": "tbsp", "ingredient": "olive oil",       "notes": None},
            {"quantity": 1.0, "unit": "tsp",  "ingredient": "garlic powder",   "notes": None},
            {"quantity": 1.0, "unit": "tsp",  "ingredient": "salt",            "notes": None},
            {"quantity": 0.5, "unit": "tsp",  "ingredient": "black pepper",    "notes": None},
        ]
    }

def fetch_recipe_from_url(url: str) -> dict:
    return {
        "name": "Mock URL Recipe (Pasta Primavera)",
        "servings": 4,
        "prep_time_min": 15,
        "cook_time_min": 20,
        "calories_per_serving": 420.0,
        "protein_per_serving_g": 14.0,
        "carbs_per_serving_g": 68.0,
        "fat_per_serving_g": 11.0,
        "tags": ["vegetarian", "quick", "italian"],
        "instructions": [
            "Bring a large pot of salted water to boil and cook pasta until al dente.",
            "Sauté garlic in olive oil over medium heat for 1 minute.",
            "Add vegetables and cook for 5-7 minutes until tender.",
            "Toss pasta with vegetables, parmesan, and pasta water.",
            "Season with salt and pepper and serve immediately."
        ],
        "ingredients": [
            {"quantity": 12.0, "unit": "oz",   "ingredient": "penne pasta",      "notes": None},
            {"quantity": 2.0,  "unit": "tbsp",  "ingredient": "olive oil",        "notes": None},
            {"quantity": 3.0,  "unit": None,    "ingredient": "garlic cloves",    "notes": "minced"},
            {"quantity": 1.0,  "unit": "cup",   "ingredient": "cherry tomatoes",  "notes": "halved"},
            {"quantity": 1.0,  "unit": "cup",   "ingredient": "zucchini",         "notes": "diced"},
            {"quantity": 0.5,  "unit": "cup",   "ingredient": "parmesan cheese",  "notes": "grated"},
        ]
    }

def run_food_scan_step1(image_bytes: bytes, description: str | None = None) -> dict:
    print('test')
    return {
        "identified": {
            "foods": [
                {"name": "Grilled chicken breast", "preparation": "grilled", "estimated_portion": "6oz", "confidence": "high"},
                {"name": "White rice", "preparation": "steamed", "estimated_portion": "1 cup", "confidence": "medium"},
                {"name": "Steamed broccoli", "preparation": "steamed", "estimated_portion": "1 cup", "confidence": "high"},
            ],
            "meal_type": "lunch",
            "visible_plate_size": "medium",
            "complexity": "mixed",
            "notes": "Healthy balanced meal, portions look moderate"
        },
        "questions": [
            {
                "id": "q1",
                "question": "How was the chicken seasoned or sauced?",
                "type": "single",
                "options": ["Plain/dry rub only", "Light sauce", "Heavy sauce/marinade", "Breaded"],
                "purpose": "Affects calorie count significantly"
            },
            {
                "id": "q2",
                "question": "Is this a restaurant meal or homemade?",
                "type": "single",
                "options": ["Homemade", "Restaurant / takeout", "Meal prep service"],
                "purpose": "Restaurant portions and oils differ significantly"
            },
            {
                "id": "q3",
                "question": "Any oil, butter, or dressing added?",
                "type": "single",
                "options": ["None", "Light drizzle (~1 tsp)", "Moderate (~1 tbsp)", "Generous (~2+ tbsp)"],
                "purpose": "Hidden fats are biggest source of estimation error"
            }
        ]
    }


def run_food_scan_step2(identified: dict, questions: list, answers: dict) -> dict:
    return {
        "items": [
            {"name": "Grilled chicken breast", "calories": 280, "protein_g": 52, "carbs_g": 0, "fat_g": 6, "portion_used": "6oz"},
            {"name": "White rice (steamed)", "calories": 206, "protein_g": 4, "carbs_g": 45, "fat_g": 0, "portion_used": "1 cup"},
            {"name": "Steamed broccoli", "calories": 55, "protein_g": 4, "carbs_g": 11, "fat_g": 0, "portion_used": "1 cup"},
        ],
        "totals": {"calories": 541, "protein_g": 60, "carbs_g": 56, "fat_g": 6},
        "calorie_range": {"low": 480, "high": 620},
        "confidence": "medium",
        "confidence_reason": "Chicken portion estimated from photo — weight uncertain",
        "assumptions": ["Chicken cooked without oil", "Rice is plain steamed"],
        "critic_issues": [],
        "approved": True,
    }