from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_db
from routers import diary, foods, recipes, goals

app = FastAPI(title="Nutrition App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db()

@app.get("/")
def root():
    return {"status": "ok", "message": "Nutrition API is running"}

app.include_router(foods.router,   prefix="/api/foods",   tags=["foods"])
app.include_router(recipes.router, prefix="/api/recipes", tags=["recipes"])
app.include_router(diary.router,   prefix="/api/diary",   tags=["diary"])
app.include_router(goals.router,   prefix="/api/goals",   tags=["goals"])