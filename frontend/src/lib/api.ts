const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface FoodItem {
  id: string
  name: string
  brand: string | null
  serving_size: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
  saturated_fat_g: number | null
  trans_fat_g: number | null
  cholesterol_mg: number | null
  source: string
  created_at: string
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  quantity: number
  unit: string | null
  ingredient: string
  notes: string | null
}

export interface Recipe {
  id: string
  name: string
  servings: number | null
  prep_time_min: number | null
  cook_time_min: number | null
  instructions: string[]
  calories_per_serving: number | null
  protein_per_serving_g: number | null
  carbs_per_serving_g: number | null
  fat_per_serving_g: number | null
  tags: string[]
  ingredients: RecipeIngredient[]
  source: string
  created_at: string
}

export interface DiaryEntry {
  id: string
  date: string
  meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  item_type: 'food' | 'recipe'
  food_item_id: string | null
  recipe_id: string | null
  servings: number
  created_at: string
  // computed fields
  name?: string
  brand?: string | null
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

export interface DailyGoal {
  id: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  effective_date: string
}

export interface DiarySummary {
  date: string
  slots: Record<string, DiaryEntry[]>
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  goals: DailyGoal | null
  progress: { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }
}

export interface WeightEntry {
  id: string
  weight_lbs: number
  note: string | null
  date: string
  created_at: string
}

export interface WeekDay {
  date: string
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  logged: boolean
}

export interface WeekSummary {
  days: WeekDay[]
  goals: DailyGoal | null
  averages: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
}

// ── Foods ────────────────────────────────────────────────────────────────────

export const foodsApi = {
  list:   () => request<FoodItem[]>('/foods'),
  get:    (id: string) => request<FoodItem>(`/foods/${id}`),
  update: (id: string, updates: Partial<FoodItem>) =>
    request<FoodItem>(`/foods/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
      headers: { 'Content-Type': 'application/json' }
    }),
  scan: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<FoodItem>('/foods/scan', { method: 'POST', body: form })
  }
}

// ── Recipes ──────────────────────────────────────────────────────────────────

export const recipesApi = {
  list:     () => request<Recipe[]>('/recipes'),
  get:      (id: string) => request<Recipe>(`/recipes/${id}`),
  search:   (q: string) => request<Recipe[]>(`/recipes/search?q=${encodeURIComponent(q)}`),
  update:   (id: string, updates: Partial<Recipe>) =>
    request<Recipe>(`/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
      headers: { 'Content-Type': 'application/json' }
    }),
  scan: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<Recipe>('/recipes/scan', { method: 'POST', body: form })
  },
  fromUrl: (url: string) => request<Recipe>('/recipes/url', {
    method: 'POST',
    body: JSON.stringify({ url }),
    headers: { 'Content-Type': 'application/json' }
  })
}

// ── Diary ────────────────────────────────────────────────────────────────────

export const diaryApi = {
  getDay: (date: string) => request<DiarySummary>(`/diary/${date}`),
  addEntry: (entry: Omit<DiaryEntry, 'id' | 'created_at' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>) =>
    request<DiaryEntry>('/diary', { method: 'POST', body: JSON.stringify(entry), headers: { 'Content-Type': 'application/json' } }),
  deleteEntry: (id: string) => request<{ deleted: string }>(`/diary/${id}`, { method: 'DELETE' })
}

// ── Goals ────────────────────────────────────────────────────────────────────

export const goalsApi = {
  get: () => request<DailyGoal>('/goals'),
  set: (goal: Omit<DailyGoal, 'id' | 'effective_date'>) =>
    request<DailyGoal>('/goals', { method: 'POST', body: JSON.stringify(goal), headers: { 'Content-Type': 'application/json' } })
}

// ── Week ────────────────────────────────────────────────────────────────────

export const summaryApi = {
  week: (startDate: string) => request<WeekSummary>(`/diary/week/${startDate}`)
}

// ── Weight ────────────────────────────────────────────────────────────────────

export const weightApi = {
  list: () => request<WeightEntry[]>('/weight'),
  log: (entry: Omit<WeightEntry, 'id' | 'created_at'>) =>
    request<WeightEntry>('/weight', {
      method: 'POST',
      body: JSON.stringify(entry),
      headers: { 'Content-Type': 'application/json' }
    }),
  delete: (id: string) => request<{ deleted: string }>(`/weight/${id}`, { method: 'DELETE' })
}
