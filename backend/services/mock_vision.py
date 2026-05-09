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