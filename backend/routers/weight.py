from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import WeightEntry

router = APIRouter()

@router.get("/")
def list_entries(session: Session = Depends(get_session)):
    return session.exec(
        select(WeightEntry).order_by(WeightEntry.date.desc())
    ).all()

@router.post("/")
def log_weight(entry: WeightEntry, session: Session = Depends(get_session)):
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry

@router.delete("/{entry_id}")
def delete_entry(entry_id: str, session: Session = Depends(get_session)):
    entry = session.get(WeightEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Entry not found")
    session.delete(entry)
    session.commit()
    return {"deleted": entry_id}