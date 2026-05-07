from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from database import get_session
from models import FoodItem
from services import extract_nutrition_label

router = APIRouter()

@router.get("/")
def list_foods(session: Session = Depends(get_session)):
    return session.exec(select(FoodItem).order_by(FoodItem.created_at.desc())).all()

@router.get("/{food_id}")
def get_food(food_id: str, session: Session = Depends(get_session)):
    item = session.get(FoodItem, food_id)
    if not item:
        raise HTTPException(404, "Food item not found")
    return item

@router.post("/scan")
def scan_label(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
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

    item = FoodItem(**extracted)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item