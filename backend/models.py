from sqlmodel import SQLModel, Field
from typing import Optional
import uuid, datetime

def new_id() -> str:
    return str(uuid.uuid4())

def now() -> str:
    return datetime.datetime.utcnow().isoformat()


class FoodItem(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    created_by: str = Field(default="system")     # ← new
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
    source: str = "label_scan"
    created_at: str = Field(default_factory=now)


class Recipe(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    created_by: str = Field(default="system")     # ← new
    name: str
    servings: Optional[int] = None
    prep_time_min: Optional[int] = None
    cook_time_min: Optional[int] = None
    instructions: str
    calories_per_serving: Optional[float] = None
    protein_per_serving_g: Optional[float] = None
    carbs_per_serving_g: Optional[float] = None
    fat_per_serving_g: Optional[float] = None
    tags: Optional[str] = None
    source: str = "screenshot"
    created_at: str = Field(default_factory=now)


class RecipeIngredient(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    recipe_id: str = Field(foreign_key="recipe.id")
    quantity: Optional[float] = None
    unit: Optional[str] = None
    ingredient: str
    notes: Optional[str] = None


class DiaryEntry(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    user_id: str = Field(index=True)              # ← new
    date: str
    meal_slot: str
    item_type: str
    food_item_id: Optional[str] = Field(default=None, foreign_key="fooditem.id")
    recipe_id: Optional[str] = Field(default=None, foreign_key="recipe.id")
    servings: float = 1.0
    created_at: str = Field(default_factory=now)


class DailyGoal(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    user_id: str = Field(index=True)              # ← new
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    effective_date: str = Field(default_factory=lambda: datetime.date.today().isoformat())


class WeightEntry(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    user_id: str = Field(index=True)              # ← new
    weight_lbs: float
    note: Optional[str] = None
    date: str = Field(default_factory=lambda: datetime.date.today().isoformat())
    created_at: str = Field(default_factory=now)
    
class User(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    email: str = Field(unique=True, index=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    created_at: str = Field(default_factory=now)