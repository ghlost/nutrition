import os
from dotenv import load_dotenv

load_dotenv()

if os.getenv("USE_MOCK", "false").lower() == "true":
    from services.mock_vision import (
        extract_nutrition_label,
        extract_recipe,
        fetch_recipe_from_url,
        run_food_scan_step1,
        run_food_scan_step2,
    )
else:
    from services.vision import (
        extract_nutrition_label,
        extract_recipe,
        fetch_recipe_from_url,
    )
    from services.food_photo import (
        run_food_scan_step1,
        run_food_scan_step2,
    )