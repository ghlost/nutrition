from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from pydantic import BaseModel
from database import get_session
from models import FoodItem, User
from services import extract_nutrition_label
from typing import Optional
from auth import get_current_user

class FoodItemUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    serving_size: Optional[str] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    saturated_fat_g: Optional[float] = None
    trans_fat_g: Optional[float] = None
    cholesterol_mg: Optional[float] = None

class ManualEntryRequest(BaseModel):
    name: str = "Manual Entry"
    calories: float
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0

router = APIRouter()

@router.get("/")
def list_foods(session: Session = Depends(get_session)):
    return session.exec(select(FoodItem).order_by(FoodItem.created_at.desc())).all()

@router.get("/search")
def search_foods(q: str, session: Session = Depends(get_session)):
    if not q.strip():
        return []
    # Simple name/brand search across all food items
    from sqlmodel import or_
    results = session.exec(
        select(FoodItem).where(
            or_(
                FoodItem.name.ilike(f"%{q}%"),
                FoodItem.brand.ilike(f"%{q}%")
            )
        ).limit(20)
    ).all()
    return results

@router.get("/{food_id}")
def get_food(food_id: str, session: Session = Depends(get_session)):
    item = session.get(FoodItem, food_id)
    if not item:
        raise HTTPException(404, "Food item not found")
    return item

@router.post("/scan")
def scan_label(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/heic"):
        raise HTTPException(400, "File must be an image (JPEG, PNG, WEBP, or HEIC)")

    image_bytes = file.file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image too large. Max 10MB.")

    try:
        extracted = extract_nutrition_label(image_bytes)
    except Exception as e:
        raise HTTPException(422, f"Could not extract nutrition data: {str(e)}")

    item = FoodItem(**extracted, created_by=current_user.id)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@router.put("/{food_id}")
def update_food(food_id: str, updates: FoodItemUpdate, session: Session = Depends(get_session)):
    item = session.get(FoodItem, food_id)
    if not item:
        raise HTTPException(404, "Food item not found")
    for key, value in updates.model_dump(exclude_none=True).items():
        setattr(item, key, value)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@router.post("/manual")
def create_manual_entry(
    body: ManualEntryRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    item = FoodItem(
        name=body.name,
        serving_size="1 serving",
        calories=body.calories,
        protein_g=body.protein_g,
        carbs_g=body.carbs_g,
        fat_g=body.fat_g,
        source="manual",
        created_by=current_user.id,
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item