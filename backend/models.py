from sqlmodel import SQLModel, Field
from typing import Optional
import uuid, datetime

def new_id() -> str:
    return str(uuid.uuid4())

def now() -> str:
    return datetime.datetime.utcnow().isoformat()


class FoodItem(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    name: str
    brand: Optional[str] = None
    serving_size: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    saturated_fat_g: Optional[float] = None
    trans_fat_g: Optional[float] = None
    cholesterol_mg: Optional[float] = None
    source: str = "label_scan"  # "label_scan" | "manual"
    created_at: str = Field(default_factory=now)


class Recipe(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    name: str
    servings: Optional[int] = None
    prep_time_min: Optional[int] = None
    cook_time_min: Optional[int] = None
    instructions: str  # JSON array stored as string
    calories_per_serving: Optional[float] = None
    protein_per_serving_g: Optional[float] = None
    carbs_per_serving_g: Optional[float] = None
    fat_per_serving_g: Optional[float] = None
    tags: Optional[str] = None  # JSON array stored as string
    source: str = "screenshot"  # "screenshot" | "manual"
    created_at: str = Field(default_factory=now)


class RecipeIngredient(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    recipe_id: str = Field(foreign_key="recipe.id")
    quantity: float
    unit: Optional[str] = None
    ingredient: str
    notes: Optional[str] = None


class DiaryEntry(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    date: str  # YYYY-MM-DD
    meal_slot: str  # breakfast | lunch | dinner | snack
    item_type: str  # "food" | "recipe"
    food_item_id: Optional[str] = Field(default=None, foreign_key="fooditem.id")
    recipe_id: Optional[str] = Field(default=None, foreign_key="recipe.id")
    servings: float = 1.0
    created_at: str = Field(default_factory=now)


class DailyGoal(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    effective_date: str = Field(default_factory=lambda: datetime.date.today().isoformat())