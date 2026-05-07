from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from database import get_session
from models import Recipe, RecipeIngredient
from services import extract_recipe
import json

router = APIRouter()

@router.get("/")
def list_recipes(session: Session = Depends(get_session)):
    return session.exec(select(Recipe).order_by(Recipe.created_at.desc())).all()

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
        raise HTTPException(422, f"Could not extract recipe: {str(e)}")

    # Pop these first before spreading into Recipe()
    ingredients_data = extracted.pop("ingredients", [])
    instructions = json.dumps(extracted.pop("instructions", []))
    tags = json.dumps(extracted.pop("tags", []))

    recipe = Recipe(
        **extracted,
        instructions=instructions,
        tags=tags,
    )
    session.add(recipe)
    session.flush()

    for ing in ingredients_data:
        ingredient = RecipeIngredient(recipe_id=recipe.id, **ing)
        session.add(ingredient)

    session.commit()
    session.refresh(recipe)

    return {
        **recipe.dict(),
        "instructions": json.loads(recipe.instructions),
        "tags": json.loads(recipe.tags),
        "ingredients": ingredients_data
    }