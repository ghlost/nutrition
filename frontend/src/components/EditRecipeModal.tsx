import { useState } from 'react'
import { recipesApi } from '../lib/api'
import type { Recipe, RecipeIngredient } from '../lib/api'
import { X, Save, Plus, Trash2, GripVertical } from 'lucide-react'

type IngredientRow = {
  key: string
  quantity: number | null
  unit: string | null
  ingredient: string
  notes: string | null
}

function uid() { return Math.random().toString(36).slice(2) }

export default function EditRecipeModal({
  recipe,
  onSave,
  onClose
}: {
  recipe: Recipe
  onSave: (updated: Recipe) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name:                  recipe.name,
    servings:              recipe.servings ?? '',
    prep_time_min:         recipe.prep_time_min ?? '',
    cook_time_min:         recipe.cook_time_min ?? '',
    calories_per_serving:  recipe.calories_per_serving ?? '',
    protein_per_serving_g: recipe.protein_per_serving_g ?? '',
    carbs_per_serving_g:   recipe.carbs_per_serving_g ?? '',
    fat_per_serving_g:     recipe.fat_per_serving_g ?? '',
  })

  const [tags, setTags]           = useState<string[]>(recipe.tags ?? [])
  const [tagInput, setTagInput]   = useState('')

  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    (recipe.ingredients ?? []).map(i => ({
      key:        uid(),
      quantity:   i.quantity,
      unit:       i.unit,
      ingredient: i.ingredient,
      notes:      i.notes,
    }))
  )

  const [instructions, setInstructions] = useState<{ key: string; text: string }[]>(
    (recipe.instructions ?? []).map(t => ({ key: uid(), text: t }))
  )

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [tab, setTab]       = useState<'details' | 'ingredients' | 'instructions'>('details')

  // ── Ingredient helpers ────────────────────────────────────────────
  function addIngredient() {
    setIngredients(prev => [...prev, {
      key: uid(),
      quantity: null,
      unit: null,
      ingredient: '',
      notes: null
    } satisfies IngredientRow])
  }

  function updateIngredient(key: string, field: keyof IngredientRow, value: string) {
    setIngredients(prev => prev.map(i => {
      if (i.key !== key) return i
      if (field === 'quantity') return { ...i, quantity: value === '' ? null : Number(value) }
      return { ...i, [field]: value || null }
    }))
  }

  function removeIngredient(key: string) {
    setIngredients(prev => prev.filter(i => i.key !== key))
  }

  // ── Instruction helpers ───────────────────────────────────────────
  function addStep() {
    setInstructions(prev => [...prev, { key: uid(), text: '' }])
  }

  function updateStep(key: string, text: string) {
    setInstructions(prev => prev.map(s => s.key === key ? { ...s, text } : s))
  }

  function removeStep(key: string) {
    setInstructions(prev => prev.filter(s => s.key !== key))
  }

  function moveStep(key: string, dir: -1 | 1) {
    setInstructions(prev => {
      const idx = prev.findIndex(s => s.key === key)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  // ── Tag helpers ───────────────────────────────────────────────────
  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  // ── Save ──────────────────────────────────────────────────────────
  async function save() {
    if (!form.name) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const updated = await recipesApi.update(recipe.id, {
        name:                  form.name,
        servings:              form.servings !== '' ? Number(form.servings) : undefined,
        prep_time_min:         form.prep_time_min !== '' ? Number(form.prep_time_min) : undefined,
        cook_time_min:         form.cook_time_min !== '' ? Number(form.cook_time_min) : undefined,
        calories_per_serving:  form.calories_per_serving !== '' ? Number(form.calories_per_serving) : undefined,
        protein_per_serving_g: form.protein_per_serving_g !== '' ? Number(form.protein_per_serving_g) : undefined,
        carbs_per_serving_g:   form.carbs_per_serving_g !== '' ? Number(form.carbs_per_serving_g) : undefined,
        fat_per_serving_g:     form.fat_per_serving_g !== '' ? Number(form.fat_per_serving_g) : undefined,
        tags,
        instructions: instructions.map(s => s.text).filter(Boolean),
        ingredients: ingredients
          .filter(i => i.ingredient)
          .map(({ key, ...rest }) => rest) as unknown as RecipeIngredient[],
        })
      onSave({ ...recipe, ...updated, tags, instructions: instructions.map(s => s.text), ingredients: recipe.ingredients })
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Edit Recipe</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex bg-gray-50 mx-4 mt-3 rounded-xl p-1 shrink-0">
          {(['details', 'ingredients', 'instructions'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize
                ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t}
              {t === 'ingredients'  && ` (${ingredients.length})`}
              {t === 'instructions' && ` (${instructions.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* ── Details tab ── */}
          {tab === 'details' && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Name<span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {([
                  ['servings',      'Servings'],
                  ['prep_time_min', 'Prep (min)'],
                  ['cook_time_min', 'Cook (min)'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                    <input
                      type="number"
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                ))}
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">
                Nutrition per serving
              </p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['calories_per_serving',  'Calories (kcal)'],
                  ['protein_per_serving_g', 'Protein (g)'],
                  ['carbs_per_serving_g',   'Carbs (g)'],
                  ['fat_per_serving_g',     'Fat (g)'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                    <input
                      type="number"
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                ))}
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-1 rounded-full">
                    {t}
                    <button onClick={() => setTags(prev => prev.filter(x => x !== t))}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag()}
                  placeholder="Add tag and press Enter..."
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
                <button
                  onClick={addTag}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </>
          )}

          {/* ── Ingredients tab ── */}
          {tab === 'ingredients' && (
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div key={ing.key} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                  <span className="text-xs text-gray-400 w-5 text-center shrink-0">{i + 1}</span>
                  <input
                    type="number"
                    step="0.25"
                    value={ing.quantity ?? ''}
                    onChange={e => updateIngredient(ing.key, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-400 bg-white text-center"
                  />
                  <input
                    type="text"
                    value={ing.unit ?? ''}
                    onChange={e => updateIngredient(ing.key, 'unit', e.target.value)}
                    placeholder="Unit"
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-400 bg-white"
                  />
                  <input
                    type="text"
                    value={ing.ingredient}
                    onChange={e => updateIngredient(ing.key, 'ingredient', e.target.value)}
                    placeholder="Ingredient"
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-400 bg-white"
                  />
                  <input
                    type="text"
                    value={ing.notes ?? ''}
                    onChange={e => updateIngredient(ing.key, 'notes', e.target.value)}
                    placeholder="Notes"
                    className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-400 bg-white"
                  />
                  <button
                    onClick={() => removeIngredient(ing.key)}
                    className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                onClick={addIngredient}
                className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-emerald-400 text-sm text-gray-500 hover:text-emerald-600 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus size={15} /> Add ingredient
              </button>
            </div>
          )}

          {/* ── Instructions tab ── */}
          {tab === 'instructions' && (
            <div className="space-y-2">
              {instructions.map((step, i) => (
                <div key={step.key} className="flex items-start gap-2">
                  <div className="flex flex-col items-center gap-1 pt-2 shrink-0">
                    <button
                      onClick={() => moveStep(step.key, -1)}
                      disabled={i === 0}
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                    >
                      <GripVertical size={14} className="rotate-90" />
                    </button>
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    <button
                      onClick={() => moveStep(step.key, 1)}
                      disabled={i === instructions.length - 1}
                      className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                    >
                      <GripVertical size={14} className="-rotate-90" />
                    </button>
                  </div>
                  <textarea
                    value={step.text}
                    onChange={e => updateStep(step.key, e.target.value)}
                    placeholder={`Step ${i + 1}...`}
                    rows={2}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400 resize-none"
                  />
                  <button
                    onClick={() => removeStep(step.key)}
                    className="p-1.5 mt-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                onClick={addStep}
                className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-emerald-400 text-sm text-gray-500 hover:text-emerald-600 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus size={15} /> Add step
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={save}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}