import os
from sqlmodel import SQLModel, create_engine, Session

# Use /tmp on Render (ephemeral but fine for solo use), or a persistent disk
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nutrition.db")
print(f"Using database: {DATABASE_URL}")
engine = create_engine(DATABASE_URL, echo=False)

def create_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session