"""
Creates user_test account and attributes all existing data to them.
Run once after adding auth: python scripts/migrate_add_users.py
"""
import sys
sys.path.append(".")

from sqlmodel import Session, select
from database import engine, create_db
from models import User, DiaryEntry, DailyGoal, WeightEntry, FoodItem, Recipe
from auth import hash_password

create_db()

with Session(engine) as session:
    # Create user_test if not exists
    existing = session.exec(select(User).where(User.username == "user_test")).first()
    if not existing:
        user = User(
            id="user_test",
            email="test@nutriscan.app",
            username="user_test",
            hashed_password=hash_password("testpassword123"),
        )
        session.add(user)
        session.commit()
        print("Created user_test (password: testpassword123)")
    else:
        print("user_test already exists")
        user = existing

    # Attribute all existing private data to user_test
    for entry in session.exec(select(DiaryEntry)).all():
        if not entry.user_id:
            entry.user_id = user.id
            session.add(entry)

    for goal in session.exec(select(DailyGoal)).all():
        if not goal.user_id:
            goal.user_id = user.id
            session.add(goal)

    for w in session.exec(select(WeightEntry)).all():
        if not w.user_id:
            w.user_id = user.id
            session.add(w)

    # Attribute shared data to system
    for food in session.exec(select(FoodItem)).all():
        if not food.created_by:
            food.created_by = "system"
            session.add(food)

    for recipe in session.exec(select(Recipe)).all():
        if not recipe.created_by:
            recipe.created_by = "system"
            session.add(recipe)

    session.commit()
    print("Migration complete")