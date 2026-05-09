from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from database import get_session
from models import Recipe, RecipeIngredient
from services import extract_recipe, fetch_recipe_from_url
from services.embeddings import index_recipe, search_recipes, delete_recipe
from pydantic import BaseModel
import json

class UrlRequest(BaseModel):
    url: str

router = APIRouter()

@router.get("/")
def list_recipes(session: Session = Depends(get_session)):
    recipes = session.exec(select(Recipe).order_by(Recipe.created_at.desc())).all()
    result = []
    for r in recipes:
        ingredients = session.exec(
            select(RecipeIngredient).where(RecipeIngredient.recipe_id == r.id)
        ).all()
        result.append({
            **r.dict(),
            "instructions": json.loads(r.instructions) if r.instructions else [],
            "tags": json.loads(r.tags) if r.tags else [],
            "ingredients": [i.dict() for i in ingredients]
        })
    return result

@router.get("/search")
def search(q: str, session: Session = Depends(get_session)):
    if not q.strip():
        return []

    recipe_ids = search_recipes(q, n_results=5)
    if not recipe_ids:
        return []

    results = []
    for rid in recipe_ids:
        recipe = session.get(Recipe, rid)
        if not recipe:
            continue
        ingredients = session.exec(
            select(RecipeIngredient).where(RecipeIngredient.recipe_id == rid)
        ).all()
        results.append({
            **recipe.dict(),
            "instructions": json.loads(recipe.instructions),
            "tags":         json.loads(recipe.tags),
            "ingredients":  [i.dict() for i in ingredients]
        })

    return results

@router.get("/{recipe_id}")
def get_recipe(recipe_id: str, session: Session = Depends(get_session)):
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    ingredients = session.exec(
        select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe_id)
    ).all()
    return {
        **recipe.dict(),
        "instructions": json.loads(recipe.instructions),
        "tags": json.loads(recipe.tags) if recipe.tags else [],
        "ingredients": [i.dict() for i in ingredients]
    }

@router.post("/scan")
def scan_recipe(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/heic"):
        raise HTTPException(400, "File must be an image (JPEG, PNG, WEBP, or HEIC)")

    image_bytes = file.file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image too large. Max 10MB.")

    try:
        extracted = extract_recipe(image_bytes)
    except Exception as e:
        import traceback
        traceback.print_exc()  # prints full stack to terminal
        raise HTTPException(422, f"Could not extract recipe: {str(e)}")

    # Pop these explicitly before building the model
    ingredients_data = extracted.pop("ingredients", [])
    instructions     = json.dumps(extracted.pop("instructions", []))
    tags             = json.dumps(extracted.pop("tags", []))

    # Whitelist only fields that exist on Recipe model
    recipe = Recipe(
        name                  = extracted.get("name", "Unknown Recipe"),
        servings              = extracted.get("servings"),
        prep_time_min         = extracted.get("prep_time_min"),
        cook_time_min         = extracted.get("cook_time_min"),
        calories_per_serving  = extracted.get("calories_per_serving"),
        protein_per_serving_g = extracted.get("protein_per_serving_g"),
        carbs_per_serving_g   = extracted.get("carbs_per_serving_g"),
        fat_per_serving_g     = extracted.get("fat_per_serving_g"),
        instructions          = instructions,
        tags                  = tags,
        source                = "screenshot",
    )

    session.add(recipe)
    session.flush()

    for ing in ingredients_data:
        # skip malformed ingredients with no name
        if not ing.get("ingredient"):
            continue
        ingredient = RecipeIngredient(recipe_id=recipe.id, **ing)
        session.add(ingredient)

    session.commit()
    session.refresh(recipe)

    index_recipe(recipe.id, {
        **recipe.dict(),
        "instructions": json.loads(recipe.instructions),
        "tags":         json.loads(recipe.tags),
        "ingredients":  ingredients_data,
    })

    return {
        **recipe.dict(),
        "instructions": json.loads(recipe.instructions),
        "tags":         json.loads(recipe.tags),
        "ingredients":  ingredients_data,
    }

@router.post("/url")
def recipe_from_url(
    body: UrlRequest,
    session: Session = Depends(get_session)
):
    try:
        extracted = fetch_recipe_from_url(body.url)
    except Exception as e:
        raise HTTPException(422, f"Could not extract recipe from URL: {str(e)}")

    ingredients_data = extracted.pop("ingredients", [])
    instructions     = json.dumps(extracted.pop("instructions", []))
    tags             = json.dumps(extracted.pop("tags", []))

    recipe = Recipe(
        name                  = extracted.get("name", "Unknown Recipe"),
        servings              = extracted.get("servings"),
        prep_time_min         = extracted.get("prep_time_min"),
        cook_time_min         = extracted.get("cook_time_min"),
        calories_per_serving  = extracted.get("calories_per_serving"),
        protein_per_serving_g = extracted.get("protein_per_serving_g"),
        carbs_per_serving_g   = extracted.get("carbs_per_serving_g"),
        fat_per_serving_g     = extracted.get("fat_per_serving_g"),
        instructions          = instructions,
        tags                  = tags,
        source                = "url",
    )
    session.add(recipe)
    session.flush()

    for ing in ingredients_data:
        if not ing.get("ingredient"):
            continue
        ingredient = RecipeIngredient(recipe_id=recipe.id, **ing)
        session.add(ingredient)

    session.commit()
    session.refresh(recipe)

    index_recipe(recipe.id, {
        **recipe.dict(),
        "instructions": json.loads(recipe.instructions),
        "tags":         json.loads(recipe.tags),
        "ingredients":  ingredients_data,
    })

    return {
        **recipe.dict(),
        "instructions": json.loads(recipe.instructions),
        "tags":         json.loads(recipe.tags),
        "ingredients":  ingredients_data,
    }
