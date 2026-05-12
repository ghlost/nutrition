const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'


// Token management
export const auth = {
  getToken: () => localStorage.getItem('auth_token'),
  setToken: (token: string) => localStorage.setItem('auth_token', token),
  getUser:  () => {
    const u = localStorage.getItem('auth_user')
    return u ? JSON.parse(u) : null
  },
  setUser:  (user: object) => localStorage.setItem('auth_user', JSON.stringify(user)),
  clear:    () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  },
  isLoggedIn: () => !!localStorage.getItem('auth_token'),
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = auth.getToken()

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  })

  if (res.status === 401) {
    auth.clear()
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  // Return null for 404s on GET requests instead of throwing
  if (res.status === 404 && (!options?.method || options.method === 'GET')) {
    console.log('null');
    return null as T
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  // Handle empty responses
  const text = await res.text()
  if (!text) return null as T
  return JSON.parse(text)
}

// Auth API
export interface AuthUser {
  id: string
  email: string
  username: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export const authApi = {
  register: (email: string, username: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
      headers: { 'Content-Type': 'application/json' }
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' }
    }),
  me: () => request<AuthUser>('/auth/me'),
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

export interface FoodIdentified {
  foods: {
    name: string
    preparation: string
    estimated_portion: string
    confidence: 'high' | 'medium' | 'low'
  }[]
  meal_type: string
  visible_plate_size: string
  complexity: string
  notes: string
}

export interface ScanQuestion {
  id: string
  question: string
  type: 'single' | 'multiple' | 'number' | 'boolean'
  options: string[] | null
  purpose: string
}

export interface FoodScanStep1 {
  identified:  FoodIdentified
  questions:   ScanQuestion[]
  description: string | null
}

export interface FoodEstimateItem {
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  portion_used: string
}

export interface FoodEstimateResult {
  items:             FoodEstimateItem[]
  totals:            { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  calorie_range:     { low: number; high: number }
  confidence:        'high' | 'medium' | 'low'
  confidence_reason: string
  assumptions:       string[]
  critic_issues:     string[]
  approved:          boolean
}

export interface UserRecipeNutrition {
  id: string
  user_id: string
  recipe_id: string
  calories_per_serving: number | null
  protein_per_serving_g: number | null
  carbs_per_serving_g: number | null
  fat_per_serving_g: number | null
  servings_override: number | null
  custom_name: string | null
  notes: string | null
}

export interface RecipeWithProfile extends Recipe {
  has_user_profile: boolean
  user_profile_id: string | null
  user_notes: string | null
}


// ── Foods ────────────────────────────────────────────────────────────────────

export const foodsApi = {
  list:   () => request<FoodItem[]>('/foods/'),
  get:    (id: string) => request<FoodItem>(`/foods/${id}`),
  search: (q: string) => request<FoodItem[]>(`/foods/search?q=${encodeURIComponent(q)}`),
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

export const foodPhotoApi = {
  scan: (file: File, description?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (description) form.append('description', description)
    return request<FoodScanStep1>('/food-photo/scan', { method: 'POST', body: form })
  },
  estimate: (identified: FoodIdentified, questions: ScanQuestion[], answers: Record<string, string | string[]>) =>
    request<FoodEstimateResult>('/food-photo/estimate', {
      method: 'POST',
      body: JSON.stringify({ identified, questions, answers }),
      headers: { 'Content-Type': 'application/json' }
    }),
  save: (name: string, totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number }) =>
    request<FoodItem>('/food-photo/save', {
      method: 'POST',
      body: JSON.stringify({
        name,
        calories:  totals.calories,
        protein_g: totals.protein_g,
        carbs_g:   totals.carbs_g,
        fat_g:     totals.fat_g,
      }),
      headers: { 'Content-Type': 'application/json' }
    })
}

// ── Recipes ──────────────────────────────────────────────────────────────────

export const recipesApi = {
  list:     () => request<Recipe[]>('/recipes/'),
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

export const myRecipesApi = {
  list:   () => request<RecipeWithProfile[]>('/my-recipes/'),
  get:    (id: string) => request<RecipeWithProfile>(`/my-recipes/${id}`),
  saveNutrition: (recipeId: string, profile: Partial<UserRecipeNutrition>) =>
    request<RecipeWithProfile>(`/my-recipes/${recipeId}/nutrition`, {
      method: 'POST',
      body: JSON.stringify(profile),
      headers: { 'Content-Type': 'application/json' }
    }),
  deleteNutrition: (recipeId: string) =>
    request<{ deleted: string }>(`/my-recipes/${recipeId}/nutrition`, {
      method: 'DELETE'
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
  get: () => request<DailyGoal>('/goals/'),
  set: (goal: Omit<DailyGoal, 'id' | 'effective_date'>) =>
    request<DailyGoal>('/goals/', { method: 'POST', body: JSON.stringify(goal), headers: { 'Content-Type': 'application/json' } })
}

// ── Week ────────────────────────────────────────────────────────────────────

export const summaryApi = {
  week: (startDate: string) => request<WeekSummary>(`/diary/week/${startDate}`)
}

// ── Weight ────────────────────────────────────────────────────────────────────

export const weightApi = {
  list: () => request<WeightEntry[]>('/weight/'),
  log: (entry: Omit<WeightEntry, 'id' | 'created_at'>) =>
    request<WeightEntry>('/weight/', {
      method: 'POST',
      body: JSON.stringify(entry),
      headers: { 'Content-Type': 'application/json' }
    }),
  delete: (id: string) => request<{ deleted: string }>(`/weight/${id}`, { method: 'DELETE' })
}
