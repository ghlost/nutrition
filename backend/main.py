import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.security import HTTPBearer
from database import create_db
from routers import diary, foods, recipes, goals, weight, food_photo, auth, user_recipes

app = FastAPI(title="Nutrition App", redirect_slashes=False)
app.swagger_ui_init_oauth = {}

origins = [
    "http://localhost:5173",
    "https://nutrition-aby2.onrender.com",
    "https://nutrition-vercel-eta.vercel.app",
    os.getenv("FRONTEND_URL", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in origins if o],  # filter empty strings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Nutrition App",
        version="1.0.0",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
        }
    }
    for path in openapi_schema["paths"].values():
        for method in path.values():
            if "security" in method:
                method["security"] = [{"BearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema

@app.on_event("startup")
def on_startup():
    create_db()

@app.get("/")
def root():
    return {"status": "ok", "message": "Nutrition API is running"}

app.openapi = custom_openapi

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(foods.router, prefix="/api/foods", tags=["foods"])
app.include_router(recipes.router, prefix="/api/recipes", tags=["recipes"])
app.include_router(diary.router, prefix="/api/diary", tags=["diary"])
app.include_router(goals.router, prefix="/api/goals", tags=["goals"])
app.include_router(weight.router, prefix="/api/weight", tags=["weight"])
app.include_router(food_photo.router, prefix="/api/food-photo", tags=["food-photo"])
app.include_router(user_recipes.router, prefix="/api/my-recipes", tags=["my-recipes"])