from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import DailyGoal
import datetime

router = APIRouter()

@router.get("/")
def get_goals(session: Session = Depends(get_session)):
    today = datetime.date.today().isoformat()
    goals = session.exec(
        select(DailyGoal)
        .where(DailyGoal.effective_date <= today)
        .order_by(DailyGoal.effective_date.desc())
    ).first()
    if not goals:
        raise HTTPException(404, "No goals set yet")
    return goals

@router.post("/")
def set_goals(goal: DailyGoal, session: Session = Depends(get_session)):
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal