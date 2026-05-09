import { useState } from 'react'
import { recipesApi } from '../lib/api'
import type { Recipe } from '../lib/api'
import { X, Save, Plus } from 'lucide-react'

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
  const [tags, setTags]       = useState<string[]>(recipe.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function numField(key: keyof typeof form, label: string, required = false) {
    return (
      <div key={key}>
        <label className="text-xs text-gray-500 mb-1 block">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <input
          type="number"
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors"
        />
      </div>
    )
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

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
      })
      onSave({ ...recipe, ...updated, tags })
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Edit Recipe</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
            {numField('servings',      'Servings')}
            {numField('prep_time_min', 'Prep (min)')}
            {numField('cook_time_min', 'Cook (min)')}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">
            Nutrition (per serving)
          </p>
          <div className="grid grid-cols-2 gap-3">
            {numField('calories_per_serving',  'Calories (kcal)')}
            {numField('protein_per_serving_g', 'Protein (g)')}
            {numField('carbs_per_serving_g',   'Carbs (g)')}
            {numField('fat_per_serving_g',     'Fat (g)')}
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
              placeholder="Add tag..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
            <button
              onClick={addTag}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

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