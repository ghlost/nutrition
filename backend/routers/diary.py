from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from auth import get_current_user
from models import DiaryEntry, FoodItem, Recipe, DailyGoal, UserRecipeNutrition, User
import datetime

router = APIRouter()

def compute_nutrition(entry: DiaryEntry, session: Session) -> dict:
    s = entry.servings
    if entry.item_type == "food" and entry.food_item_id:
        food = session.get(FoodItem, entry.food_item_id)
        if food:
            return {
                "name":      food.name,
                "brand":     food.brand,
                "calories":  (food.calories or 0) * s,
                "protein_g": (food.protein_g or 0) * s,
                "carbs_g":   (food.carbs_g or 0) * s,
                "fat_g":     (food.fat_g or 0) * s,
            }

    if entry.item_type == "recipe" and entry.recipe_id:
        recipe = session.get(Recipe, entry.recipe_id)
        if recipe:
            # Check for user nutrition profile first
            profile = session.exec(
                select(UserRecipeNutrition)
                .where(UserRecipeNutrition.recipe_id == entry.recipe_id)
                .where(UserRecipeNutrition.user_id == entry.user_id)
            ).first()

            # Use profile values if set, fall back to global
            calories  = (profile.calories_per_serving  if profile and profile.calories_per_serving  is not None else recipe.calories_per_serving)  or 0
            protein   = (profile.protein_per_serving_g if profile and profile.protein_per_serving_g is not None else recipe.protein_per_serving_g) or 0
            carbs     = (profile.carbs_per_serving_g   if profile and profile.carbs_per_serving_g   is not None else recipe.carbs_per_serving_g)   or 0
            fat       = (profile.fat_per_serving_g     if profile and profile.fat_per_serving_g     is not None else recipe.fat_per_serving_g)     or 0
            name      = (profile.custom_name if profile and profile.custom_name else recipe.name)

            return {
                "name":      name,
                "brand":     None,
                "calories":  calories * s,
                "protein_g": protein * s,
                "carbs_g":   carbs * s,
                "fat_g":     fat * s,
            }

    return {"name": "Unknown", "brand": None, "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}

@router.get("/{date}")
def get_diary(
    date: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    entries = session.exec(
        select(DiaryEntry)
        .where(DiaryEntry.date == date)
        .where(DiaryEntry.user_id == current_user.id)  # ← filter by user
    ).all()

    slots = {"breakfast": [], "lunch": [], "dinner": [], "snack": []}
    totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}

    for entry in entries:
        nutrition = compute_nutrition(entry, session)
        for k in totals:
            totals[k] += nutrition[k]
        slots[entry.meal_slot].append({**entry.dict(), **nutrition})

    # Get current goals
    today = datetime.date.today().isoformat()
    goal = session.exec(
        select(DailyGoal)
        .where(DailyGoal.effective_date <= today)
        .order_by(DailyGoal.effective_date.desc())
    ).first()

    return {
        "date": date,
        "slots": slots,
        "totals": totals,
        "goals": goal.dict() if goal else None,
        "progress": {
            k: round(totals[k] / getattr(goal, k) * 100) if goal and getattr(goal, k) else None
            for k in ["calories", "protein_g", "carbs_g", "fat_g"]
        }
    }

@router.get("/week/{start_date}")
def get_week(
    start_date: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Returns 7 days of diary totals starting from start_date (YYYY-MM-DD)"""
    import datetime as dt

    start = dt.date.fromisoformat(start_date)
    days = [(start + dt.timedelta(days=i)).isoformat() for i in range(7)]

    # Get current goals
    goal = session.exec(
        select(DailyGoal)
        .where(DailyGoal.effective_date <= start_date)
        .order_by(DailyGoal.effective_date.desc())
    ).first()

    week = []
    for date in days:
        entries = session.exec(
            select(DiaryEntry).where(DiaryEntry.date == date).where(DiaryEntry.user_id == current_user.id)
        ).all()

        totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
        for entry in entries:
            nutrition = compute_nutrition(entry, session)
            for k in totals:
                totals[k] += nutrition[k]

        week.append({
            "date": date,
            "totals": totals,
            "logged": len(entries) > 0
        })

    return {
        "days": week,
        "goals": goal.dict() if goal else None,
        "averages": {
            k: round(
                sum(d["totals"][k] for d in week if d["logged"]) /
                max(sum(1 for d in week if d["logged"]), 1),
                1
            )
            for k in ["calories", "protein_g", "carbs_g", "fat_g"]
        }
    }

@router.post("/")
def add_entry(
    entry: DiaryEntry,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    entry.user_id = current_user.id  # ← always set from token, never trust client
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry

@router.delete("/{entry_id}")
def delete_entry(
    entry_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    entry = session.get(DiaryEntry, entry_id)
    if not entry or entry.user_id != current_user.id:  # ← ownership check
        raise HTTPException(404, "Entry not found")
    session.delete(entry)
    session.commit()
    return {"deleted": entry_id}