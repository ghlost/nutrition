from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session
from pydantic import BaseModel
from database import get_session
from services import run_food_scan_step1, run_food_scan_step2
from typing import Optional
from models import FoodItem

router = APIRouter()

class AnswersPayload(BaseModel):
    identified: dict
    questions:  list
    answers:    dict

class SaveEstimatePayload(BaseModel):
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    serving_size: str = "1 serving (estimated from photo)"

@router.post("/scan")
def scan_food_photo(
    file: UploadFile = File(...),
    description: Optional[str] = Form(None)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")

    image_bytes = file.file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image too large. Max 10MB.")

    try:
        result = run_food_scan_step1(image_bytes, description=description)
        return result
    except Exception as e:
        raise HTTPException(422, f"Could not analyze food photo: {str(e)}")


@router.post("/estimate")
def estimate_food(payload: AnswersPayload):
    """Step 2 — estimate macros after user answers questions."""
    try:
        result = run_food_scan_step2(
            payload.identified,
            payload.questions,
            payload.answers
        )
        return result
    except Exception as e:
        raise HTTPException(422, f"Could not estimate nutrition: {str(e)}")
    
@router.post("/save")
def save_estimate(
    payload: SaveEstimatePayload,
    session: Session = Depends(get_session)
):
    item = FoodItem(
        name=payload.name,
        serving_size=payload.serving_size,
        calories=payload.calories,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        source="photo_estimate",
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item