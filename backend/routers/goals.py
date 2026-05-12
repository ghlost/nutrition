from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import DailyGoal, User
import datetime
from auth import get_current_user

router = APIRouter()

@router.get("/")
def get_goals(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    today = datetime.date.today().isoformat()
    goals = session.exec(
        select(DailyGoal)
        .where(DailyGoal.user_id == current_user.id)
        .where(DailyGoal.effective_date <= today)
        .order_by(DailyGoal.effective_date.desc())
    ).first()
    return goals  # returns null if none — not 404

@router.post("/")
def set_goals(
    goal: DailyGoal,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    goal.user_id = current_user.id
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal