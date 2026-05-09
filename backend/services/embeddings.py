import chromadb
import os
from chromadb.utils import embedding_functions

# Persistent local storage — survives server restarts
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

embedding_fn = embedding_functions.DefaultEmbeddingFunction()

collection = chroma_client.get_or_create_collection(
    name="recipes",
    embedding_function=embedding_fn,
    metadata={"heuristic": "cosine"}
)


def recipe_to_text(recipe: dict) -> str:
    """Convert a recipe into a rich text blob for embedding."""
    parts = [recipe.get("name", "")]

    if recipe.get("tags"):
        tags = recipe["tags"] if isinstance(recipe["tags"], list) else []
        parts.append("Tags: " + ", ".join(tags))

    if recipe.get("servings"):
        parts.append(f"Servings: {recipe['servings']}")

    total_time = (recipe.get("prep_time_min") or 0) + (recipe.get("cook_time_min") or 0)
    if total_time:
        parts.append(f"Total time: {total_time} minutes")

    if recipe.get("calories_per_serving"):
        parts.append(f"Calories per serving: {recipe['calories_per_serving']}")

    if recipe.get("protein_per_serving_g"):
        parts.append(f"Protein: {recipe['protein_per_serving_g']}g per serving")

    if recipe.get("ingredients"):
        ingredients = recipe["ingredients"]
        names = [i.get("ingredient", "") for i in ingredients if i.get("ingredient")]
        parts.append("Ingredients: " + ", ".join(names))

    if recipe.get("instructions"):
        instructions = recipe["instructions"]
        if isinstance(instructions, list):
            parts.append("Instructions: " + " ".join(instructions[:3]))  # first 3 steps

    return " | ".join(filter(None, parts))


def index_recipe(recipe_id: str, recipe: dict):
    """Add or update a recipe in the vector store."""
    text = recipe_to_text(recipe)
    collection.upsert(
        ids=[recipe_id],
        documents=[text],
        metadatas=[{"name": recipe.get("name", ""), "recipe_id": recipe_id}]
    )


def search_recipes(query: str, n_results: int = 5) -> list[str]:
    """Returns a list of recipe IDs ranked by semantic similarity."""
    total = collection.count()
    if total == 0:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(n_results, total)
    )

    return results["ids"][0] if results["ids"] else []


def delete_recipe(recipe_id: str):
    """Remove a recipe from the vector store."""
    try:
        collection.delete(ids=[recipe_id])
    except Exception:
        pass