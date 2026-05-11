from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import WeightEntry, User
from auth import get_current_user

router = APIRouter()

@router.get("/")
def list_entries(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    return session.exec(
        select(WeightEntry)
        .where(WeightEntry.user_id == current_user.id)
        .order_by(WeightEntry.date.desc())
    ).all()

@router.post("/")
def log_weight(
    entry: WeightEntry,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    entry.user_id = current_user.id
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
    entry = session.get(WeightEntry, entry_id)
    if not entry or entry.user_id != current_user.id:
        raise HTTPException(404, "Entry not found")
    session.delete(entry)
    session.commit()
    return {"deleted": entry_id}