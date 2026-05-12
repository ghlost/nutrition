from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from database import get_session
from models import Recipe, RecipeIngredient, UserRecipeNutrition
from auth import get_current_user
from models import User
import json

router = APIRouter()


def merge_nutrition(recipe: Recipe, profile: UserRecipeNutrition | None) -> dict:
    """Merge global recipe with user's nutrition overrides."""
    return {
        "calories_per_serving":  profile.calories_per_serving  if profile and profile.calories_per_serving  is not None else recipe.calories_per_serving,
        "protein_per_serving_g": profile.protein_per_serving_g if profile and profile.protein_per_serving_g is not None else recipe.protein_per_serving_g,
        "carbs_per_serving_g":   profile.carbs_per_serving_g   if profile and profile.carbs_per_serving_g   is not None else recipe.carbs_per_serving_g,
        "fat_per_serving_g":     profile.fat_per_serving_g     if profile and profile.fat_per_serving_g     is not None else recipe.fat_per_serving_g,
        "servings":              profile.servings_override      if profile and profile.servings_override     is not None else recipe.servings,
        "name":                  profile.custom_name            if profile and profile.custom_name           else recipe.name,
    }


def build_recipe_response(recipe: Recipe, profile: UserRecipeNutrition | None, session: Session) -> dict:
    ingredients = session.exec(
        select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id)
    ).all()

    merged = merge_nutrition(recipe, profile)

    return {
        **recipe.dict(),
        **merged,                                                    # overrides win
        "instructions":      json.loads(recipe.instructions) if recipe.instructions else [],
        "tags":              json.loads(recipe.tags) if recipe.tags else [],
        "ingredients":       [i.dict() for i in ingredients],
        "has_user_profile":  profile is not None,
        "user_profile_id":   profile.id if profile else None,
        "user_notes":        profile.notes if profile else None,
    }


@router.get("/")
def list_my_recipes(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """All global recipes, merged with user's nutrition profiles where they exist."""
    recipes = session.exec(select(Recipe).order_by(Recipe.created_at.desc())).all()

    result = []
    for recipe in recipes:
        profile = session.exec(
            select(UserRecipeNutrition)
            .where(UserRecipeNutrition.recipe_id == recipe.id)
            .where(UserRecipeNutrition.user_id == current_user.id)
        ).first()
        result.append(build_recipe_response(recipe, profile, session))

    return result


@router.get("/{recipe_id}")
def get_my_recipe(
    recipe_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")

    profile = session.exec(
        select(UserRecipeNutrition)
        .where(UserRecipeNutrition.recipe_id == recipe_id)
        .where(UserRecipeNutrition.user_id == current_user.id)
    ).first()

    return build_recipe_response(recipe, profile, session)


class NutritionProfileUpdate(BaseModel):
    calories_per_serving:  Optional[float] = None
    protein_per_serving_g: Optional[float] = None
    carbs_per_serving_g:   Optional[float] = None
    fat_per_serving_g:     Optional[float] = None
    servings_override:     Optional[int]   = None
    custom_name:           Optional[str]   = None
    notes:                 Optional[str]   = None


@router.post("/{recipe_id}/nutrition")
def save_nutrition_profile(
    recipe_id: str,
    body: NutritionProfileUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Create or update a user's nutrition profile for a recipe."""
    recipe = session.get(Recipe, recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")

    # Upsert — update if exists, create if not
    profile = session.exec(
        select(UserRecipeNutrition)
        .where(UserRecipeNutrition.recipe_id == recipe_id)
        .where(UserRecipeNutrition.user_id == current_user.id)
    ).first()

    if profile:
        for key, value in body.model_dump(exclude_none=True).items():
            setattr(profile, key, value)
        from models import now
        profile.updated_at = now()
    else:
        profile = UserRecipeNutrition(
            user_id=current_user.id,
            recipe_id=recipe_id,
            **body.model_dump(exclude_none=True)
        )

    session.add(profile)
    session.commit()
    session.refresh(profile)

    return build_recipe_response(recipe, profile, session)


@router.delete("/{recipe_id}/nutrition")
def delete_nutrition_profile(
    recipe_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Remove user's nutrition overrides — reverts to global recipe values."""
    profile = session.exec(
        select(UserRecipeNutrition)
        .where(UserRecipeNutrition.recipe_id == recipe_id)
        .where(UserRecipeNutrition.user_id == current_user.id)
    ).first()

    if not profile:
        raise HTTPException(404, "No nutrition profile found")

    session.delete(profile)
    session.commit()
    return {"deleted": recipe_id}