import { useState, useEffect, useCallback } from 'react'
import { diaryApi, foodsApi, recipesApi, myRecipesApi, weightApi } from '../lib/api'
import type { DiarySummary, FoodItem, Recipe, DiaryEntry, RecipeWithProfile, WeightEntry } from '../lib/api'
import { Scale, Plus, Trash2, ChevronLeft, ChevronRight, X, Search } from 'lucide-react'

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const SLOT_EMOJI: Record<MealSlot, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎'
}

function toDateString(d: Date) {
  return d.toISOString().split('T')[0]
}

function MacroRing({ label, value, goal, color, showUnit }: {
  label: string; value: number; goal: number | null; color: string, showUnit?: boolean
}) {
  const pct = goal ? Math.min(value / goal, 1) : 0
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = pct * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#f3f4f6" strokeWidth="7" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-700">{Math.round(value)} {showUnit && 'g'}</span>
        </div>
      </div>
      <span className="text-xs text-gray-500">{label}</span>
      {goal && <span className="text-xs text-gray-400">/ {goal} {showUnit && 'g'}</span>}
    </div>
  )
}

function AddFoodModal({ slot, onAdd, onClose }: {
    slot: MealSlot
    onAdd: (item: FoodItem | Recipe, type: 'food' | 'recipe', servings: number) => Promise<void>
    onClose: () => void
  }) {
    const [tab, setTab]               = useState<'food' | 'recipe'>('food')
    const [query, setQuery]           = useState('')
    const [foods, setFoods]           = useState<FoodItem[]>([])
    const [recipes, setRecipes]       = useState<RecipeWithProfile[]>([])
    const [searching, setSearching]   = useState(false)
    const [servings, setServings]     = useState<Record<string, number>>({})
    const [adding, setAdding]         = useState<string | null>(null)

    // Load all on mount
    useEffect(() => {
      foodsApi.list().then(d => setFoods(d ?? [])).catch(() => {})
      myRecipesApi.list().then(d => setRecipes(d ?? [])).catch(() => {})
    }, [])

    // Live search
    useEffect(() => {
      if (!query.trim()) {
        // Reset to full list
        foodsApi.list().then(d => setFoods(d ?? [])).catch(() => {})
        myRecipesApi.list().then(d => setRecipes(d ?? [])).catch(() => {})
        return
      }

      const timer = setTimeout(async () => {
        setSearching(true)
        try {
          if (tab === 'food') {
            const results = await foodsApi.search(query)
            setFoods(results ?? [])
          } else {
            // Semantic search for recipes
            const results = await recipesApi.search(query)
            setRecipes((results ?? []) as RecipeWithProfile[])
          }
        } catch {
          // keep current list on error
        } finally {
          setSearching(false)
        }
      }, 400) // debounce 400ms

      return () => clearTimeout(timer)
    }, [query, tab])

    async function handleAdd(item: FoodItem | Recipe, type: 'food' | 'recipe') {
      setAdding(item.id)
      await onAdd(item, type, servings[item.id] ?? 1)
      setAdding(null)
    }

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 capitalize">
              Add to {SLOT_EMOJI[slot]} {slot}
            </h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-50 mx-4 mt-3 rounded-xl p-1 shrink-0">
            {(['food', 'recipe'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setQuery('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize
                  ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                {t === 'food' ? '🏷️ Foods' : '📋 Recipes'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-4 pt-3 shrink-0">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={tab === 'food'
                  ? 'Search all foods by name or brand...'
                  : 'Search recipes semantically...'
                }
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
              />
              {searching && (
                <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
              )}
            </div>
            {tab === 'recipe' && query && (
              <p className="text-xs text-gray-400 mt-1 px-1">
                Semantic search — try "high protein quick dinner" or "vegetarian pasta"
              </p>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">

            {/* Foods tab */}
            {tab === 'food' && (
              foods.length === 0
                ? <p className="text-center text-gray-400 text-sm py-8">
                    {query ? `No foods matching "${query}"` : 'No foods scanned yet. Use the Scan tab to add food items.'}
                  </p>
                : foods.map(food => (
                  <div key={food.id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{food.name}</p>
                      {food.brand && <p className="text-xs text-gray-400">{food.brand}</p>}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {food.calories} kcal · {food.protein_g}g protein · {food.serving_size}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={servings[food.id] ?? 1}
                        onChange={e => setServings(s => ({ ...s, [food.id]: Number(e.target.value) }))}
                        className="w-14 text-center text-sm border border-gray-200 rounded-lg py-1 bg-white"
                      />
                      <button
                        onClick={() => handleAdd(food, 'food')}
                        disabled={adding === food.id}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg p-1.5 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))
            )}

            {/* Recipes tab */}
            {tab === 'recipe' && (
              recipes.length === 0
                ? <p className="text-center text-gray-400 text-sm py-8">
                    {query ? `No recipes matching "${query}"` : 'No recipes yet. Use the Scan tab to add recipes.'}
                  </p>
                : recipes.map(recipe => (
                  <div key={recipe.id} className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-gray-900 text-sm truncate">{recipe.name}</p>
                        {(recipe as RecipeWithProfile).has_user_profile && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0">
                            my values
                          </span>
                        )}
                      </div>
                      {recipe.calories_per_serving && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {recipe.calories_per_serving} kcal / serving
                          {recipe.protein_per_serving_g && ` · ${recipe.protein_per_serving_g}g protein`}
                        </p>
                      )}
                      {recipe.tags?.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {recipe.tags.slice(0, 3).map(t => (
                            <span key={t} className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={servings[recipe.id] ?? 1}
                        onChange={e => setServings(s => ({ ...s, [recipe.id]: Number(e.target.value) }))}
                        className="w-14 text-center text-sm border border-gray-200 rounded-lg py-1 bg-white"
                      />
                      <button
                        onClick={() => handleAdd(recipe, 'recipe')}
                        disabled={adding === recipe.id}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg p-1.5 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    )
  }

export default function DiaryPage() {
  const [date, setDate] = useState(toDateString(new Date()))
  const [summary, setSummary] = useState<DiarySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalSlot, setModalSlot] = useState<MealSlot | null>(null)
  const [weights, setWeights]             = useState<WeightEntry[]>([])
  const [showLogWeight, setShowLogWeight] = useState(false)
  const [weightInput, setWeightInput]     = useState('')
  const [noteInput, setNoteInput]         = useState('')
  const [loggingWeight, setLoggingWeight] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    name: string
    timer: ReturnType<typeof setTimeout>
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await diaryApi.getDay(date)
      setSummary(data)
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  // Weight load — handle null/empty
  useEffect(() => {
    weightApi.list()
      .then(all => setWeights((all ?? []).filter(w => w.date === date)))
      .catch(() => setWeights([]))
  }, [date])

  function shiftDate(days: number) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setDate(toDateString(d))
  }

  async function handleAdd(item: FoodItem | Recipe, type: 'food' | 'recipe', servings: number) {
    if (!modalSlot) return
    await diaryApi.addEntry({
      date,
      meal_slot: modalSlot,
      item_type: type,
      food_item_id: type === 'food' ? item.id : null,
      recipe_id: type === 'recipe' ? item.id : null,
      servings,
    })
    await load()
  }

  function handleDelete(id: string, name: string) {
    // If there's already a pending delete, fire it immediately
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer)
      diaryApi.deleteEntry(pendingDelete.id).then(load)
    }

    const timer = setTimeout(async () => {
      await diaryApi.deleteEntry(id)
      await load()
      setPendingDelete(null)
    }, 4000)

    setPendingDelete({ id, name, timer })
  }

  function undoDelete() {
    if (!pendingDelete) return
    clearTimeout(pendingDelete.timer)
    setPendingDelete(null)
  }

  async function logWeight() {
    const w = parseFloat(weightInput)
    if (!w || w < 50 || w > 700) return
    setLoggingWeight(true)
    try {
      const entry = await weightApi.log({
        weight_lbs: w,
        note: noteInput.trim() || null,
        date
      })
      setWeights(prev => [entry, ...prev])
      setWeightInput('')
      setNoteInput('')
      setShowLogWeight(false)
    } finally {
      setLoggingWeight(false)
    }
  }

  async function deleteWeight(id: string) {
    await weightApi.delete(id)
    setWeights(prev => prev.filter(w => w.id !== id))
  }

  const isToday = date === toDateString(new Date())

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
      Loading diary...
    </div>
  )

  const totals = summary?.totals
  const goals  = summary?.goals ?? null

  return (
    <div className="p-4 space-y-4">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => shiftDate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <div className="text-center">
          <p className="font-semibold text-gray-900">
            {isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
          </p>
          <p className="text-xs text-gray-400">
            {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => shiftDate(1)}
          disabled={isToday}
          className="p-2 rounded-xl hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Macro rings */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex justify-around">
          <MacroRing label="Calories" value={totals?.calories ?? 0} goal={goals?.calories ?? null}  color="#f97316" />
          <MacroRing label="Protein" value={totals?.protein_g ?? 0} goal={goals?.protein_g ?? null} color="#3b82f6" showUnit={true} />
          <MacroRing label="Carbs" value={totals?.carbs_g ?? 0} goal={goals?.carbs_g ?? null} color="#eab308" showUnit={true} />
          <MacroRing label="Fat" value={totals?.fat_g ?? 0} goal={goals?.fat_g ?? null} color="#a855f7" showUnit={true} />
        </div>
        {!goals && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Set goals in the Goals tab to see progress
          </p>
        )}
      </div>

      {/* Meal slots */}
      {SLOTS.map(slot => {
        const entries: DiaryEntry[] = summary?.slots?.[slot] ?? []
        const slotCals = entries.reduce((sum, e) => sum + (e.calories ?? 0), 0)

        return (
          <div key={slot} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span>{SLOT_EMOJI[slot]}</span>
                <span className="font-medium text-gray-900 capitalize">{slot}</span>
                {slotCals > 0 && (
                  <span className="text-xs text-gray-400">{Math.round(slotCals)} kcal</span>
                )}
              </div>
              <button
                onClick={() => setModalSlot(slot)}
                className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                <Plus size={16} /> Add
              </button>
            </div>

            {entries.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-4">Nothing logged yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {entries.map(entry => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-opacity
                      ${pendingDelete?.id === entry.id ? 'opacity-40' : 'opacity-100'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {entry.name ?? 'Unknown'}
                        {entry.brand && <span className="text-gray-400 font-normal"> · {entry.brand}</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {entry.servings} serving{entry.servings !== 1 ? 's' : ''} ·{' '}
                        {Math.round(entry.calories ?? 0)} kcal ·{' '}
                        P: {Math.round(entry.protein_g ?? 0)}g ·{' '}
                        C: {Math.round(entry.carbs_g ?? 0)}g ·{' '}
                        F: {Math.round(entry.fat_g ?? 0)}g
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id, entry.name ?? 'item')}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Weight log */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-emerald-600" />
            <span className="font-medium text-gray-900">Weight</span>
            {weights.length > 0 && (
              <span className="text-xs text-gray-400">{weights[0].weight_lbs} lbs</span>
            )}
          </div>
          <button
            onClick={() => setShowLogWeight(v => !v)}
            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
          >
            <Plus size={16} /> Log
          </button>
        </div>

        {showLogWeight && (
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                min="50"
                max="700"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                placeholder="175.5 lbs"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
              <input
                type="text"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="Note (optional)"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <button
              onClick={logWeight}
              disabled={!weightInput || loggingWeight}
              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              {loggingWeight ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}

        {weights.length === 0 && !showLogWeight && (
          <p className="text-center text-xs text-gray-400 py-4">No weight logged today</p>
        )}

        {weights.map((entry, i) => (
          <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 ${i < weights.length - 1 ? 'border-b border-gray-50' : ''}`}>
            <div className="flex-1">
              <span className="text-sm font-semibold text-gray-900">{entry.weight_lbs} lbs</span>
              {entry.note && <span className="text-xs text-gray-400 ml-2">· {entry.note}</span>}
            </div>
            <button
              onClick={() => deleteWeight(entry.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Undo toast */}
      {pendingDelete && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-50">
          <div className="bg-gray-900 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                Removed {pendingDelete.name}
              </p>
              <div className="mt-1.5 h-0.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{
                    animation: 'shrink 4s linear forwards'
                  }}
                />
              </div>
            </div>
            <button
              onClick={undoDelete}
              className="shrink-0 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors px-1"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* Add food modal */}
      {modalSlot && (
        <AddFoodModal
          slot={modalSlot}
          onAdd={handleAdd}
          onClose={() => setModalSlot(null)}
        />
      )}
    </div>
  )
}