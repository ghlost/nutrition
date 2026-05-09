import { useState, useEffect } from 'react'
import { recipesApi } from '../lib/api'
import type { Recipe } from '../lib/api'
import { Pencil, ChevronDown, ChevronUp, Clock, Users, Flame, Search } from 'lucide-react'
import EditRecipeModal from '../components/EditRecipeModal'

function RecipeCard({ recipe, onEdit }: { 
    recipe: Recipe
    onEdit: (recipe: Recipe) => void 
  }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{recipe.name}</p>

          {/* Tags */}
          {recipe.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {recipe.tags.map(t => (
                <span key={t} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Quick stats */}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {recipe.calories_per_serving && (
              <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                <Flame size={12} />
                {recipe.calories_per_serving} kcal
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Users size={12} />
                {recipe.servings} servings
              </span>
            )}
            {(recipe.prep_time_min || recipe.cook_time_min) && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={12} />
                {(recipe.prep_time_min ?? 0) + (recipe.cook_time_min ?? 0)} min
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 mt-1">
          <button
            onClick={e => { e.stopPropagation(); onEdit(recipe) }}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Pencil size={15} />
          </button>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">

          {/* Macro bar */}
          {(recipe.protein_per_serving_g || recipe.carbs_per_serving_g || recipe.fat_per_serving_g) && (
            <div className="px-4 py-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Protein', value: recipe.protein_per_serving_g, unit: 'g', color: 'text-blue-500', bg: 'bg-blue-50' },
                { label: 'Carbs',   value: recipe.carbs_per_serving_g,   unit: 'g', color: 'text-yellow-600', bg: 'bg-yellow-50' },
                { label: 'Fat',     value: recipe.fat_per_serving_g,     unit: 'g', color: 'text-purple-500', bg: 'bg-purple-50' },
              ].map(({ label, value, unit, color, bg }) => value != null && (
                <div key={label} className={`${bg} rounded-xl p-2.5 text-center`}>
                  <p className={`text-sm font-bold ${color}`}>{value}{unit}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Ingredients */}
          {recipe.ingredients?.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Ingredients
              </p>
              <ul className="space-y-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="text-emerald-600 font-medium shrink-0">
                      {ing.quantity}{ing.unit ? ` ${ing.unit}` : ''}
                    </span>
                    <span className="text-gray-700">{ing.ingredient}</span>
                    {ing.notes && (
                      <span className="text-gray-400 text-xs">({ing.notes})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructions */}
          {recipe.instructions?.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Instructions
              </p>
              <ol className="space-y-3">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-medium mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-gray-700 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Recipe[] | null>(null)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)

  useEffect(() => {
    recipesApi.list()
      .then(setRecipes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Replace the existing query input onChange with:
  async function handleSearch(q: string) {
    setQuery(q)
    if (!q.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    try {
      const results = await recipesApi.search(q)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  function handleRecipeSaved(updated: Recipe) {
    setRecipes(prev => prev.map(r => r.id === updated.id ? updated : r))
    setEditingRecipe(null)
  }

  // Replace `filtered` with:
  const displayed = searchResults ?? recipes

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
      Loading recipes...
    </div>
  )

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Recipes</h2>

      {/* Search */}
      {recipes.length > 0 && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or tag..."
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
          />
        </div>
      )}

      {/* Empty state */}
      {recipes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="text-4xl">📋</div>
          <p className="font-medium text-gray-700">No recipes yet</p>
          <p className="text-sm text-gray-400 max-w-xs">
            Go to the Scan tab and take a photo of a recipe to add it to your library.
          </p>
        </div>
      )}

      {searching && (
        <p className="text-xs text-center text-gray-400 animate-pulse">
          Searching...
        </p>
      )}

      {/* No search results */}
      {recipes.length > 0 && displayed.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No recipes match "{query}"
        </div>
      )}

      {/* Recipe list */}
      {displayed.map(recipe => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onEdit={setEditingRecipe}
        />
      ))}

      {editingRecipe && (
        <EditRecipeModal
          recipe={editingRecipe}
          onSave={handleRecipeSaved}
          onClose={() => setEditingRecipe(null)}
        />
      )}
    </div>
  )
}