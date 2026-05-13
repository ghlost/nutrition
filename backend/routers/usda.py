from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from pydantic import BaseModel
from database import get_session
from models import FoodItem, User
from auth import get_current_user
from services.usda import search_usda, get_usda_food

router = APIRouter()


@router.get("/search")
def search(
    q: str = Query(..., min_length=2),
    current_user: User = Depends(get_current_user)
):
    """Search USDA database. Results are not saved until user adds one."""
    try:
        results = search_usda(q)
        return results
    except ValueError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(502, f"USDA API error: {str(e)}")


class AddUSDARequest(BaseModel):
    fdc_id: int


@router.post("/add")
def add_usda_food(
    body: AddUSDARequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Cache a USDA food into our DB when user adds it to diary.
    Checks if already cached to avoid duplicates.
    """
    # Check if already cached by any user
    existing = session.exec(
        select(FoodItem).where(FoodItem.usda_fdc_id == body.fdc_id)
    ).first()

    if existing:
        return existing

    # Fetch from USDA and save
    food_data = get_usda_food(body.fdc_id)
    if not food_data:
        raise HTTPException(404, "Food not found in USDA database")

    item = FoodItem(
        name=food_data["name"],
        brand=food_data.get("brand"),
        serving_size=food_data["serving_size"],
        calories=food_data["calories"],
        protein_g=food_data["protein_g"],
        carbs_g=food_data["carbs_g"],
        fat_g=food_data["fat_g"],
        fiber_g=food_data.get("fiber_g"),
        sugar_g=food_data.get("sugar_g"),
        sodium_mg=food_data.get("sodium_mg"),
        source="usda",
        created_by=current_user.id,
        usda_fdc_id=body.fdc_id,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item