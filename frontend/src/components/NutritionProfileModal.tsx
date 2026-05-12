import { useState } from 'react'
import { myRecipesApi } from '../lib/api'
import type { RecipeWithProfile } from '../lib/api'
import { X, Save, Trash2, Info } from 'lucide-react'

export default function NutritionProfileModal({
  recipe,
  onSave,
  onClose
}: {
  recipe: RecipeWithProfile
  onSave: (updated: RecipeWithProfile) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    calories_per_serving:  recipe.has_user_profile ? (recipe.calories_per_serving ?? '')  : '',
    protein_per_serving_g: recipe.has_user_profile ? (recipe.protein_per_serving_g ?? '') : '',
    carbs_per_serving_g:   recipe.has_user_profile ? (recipe.carbs_per_serving_g ?? '')   : '',
    fat_per_serving_g:     recipe.has_user_profile ? (recipe.fat_per_serving_g ?? '')     : '',
    servings_override:     recipe.has_user_profile ? (recipe.servings ?? '')              : '',
    custom_name:           recipe.has_user_profile ? (recipe.name ?? '')                  : '',
    notes:                 recipe.user_notes ?? '',
  })
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        calories_per_serving:  form.calories_per_serving  !== '' ? Number(form.calories_per_serving)  : undefined,
        protein_per_serving_g: form.protein_per_serving_g !== '' ? Number(form.protein_per_serving_g) : undefined,
        carbs_per_serving_g:   form.carbs_per_serving_g   !== '' ? Number(form.carbs_per_serving_g)   : undefined,
        fat_per_serving_g:     form.fat_per_serving_g     !== '' ? Number(form.fat_per_serving_g)     : undefined,
        servings_override:     form.servings_override     !== '' ? Number(form.servings_override)     : undefined,
        custom_name:           form.custom_name.trim()    || undefined,
        notes:                 form.notes.trim()          || undefined,
      }
      const updated = await myRecipesApi.saveNutrition(recipe.id, payload)
      onSave(updated)
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function removeProfile() {
    setDeleting(true)
    try {
      await myRecipesApi.deleteNutrition(recipe.id)
      // Return recipe without profile
      onSave({ ...recipe, has_user_profile: false, user_profile_id: null, user_notes: null })
    } catch (e: any) {
      setError(e.message || 'Failed to remove')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">My Nutrition Values</h3>
            <p className="text-xs text-gray-400 mt-0.5">{recipe.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Info banner */}
          <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              These values are personal to you and override the shared recipe nutrition.
              Leave a field blank to use the original value.
            </p>
          </div>

          {/* Custom name */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Custom name (optional)</label>
            <input
              type="text"
              value={form.custom_name}
              onChange={e => setForm(f => ({ ...f, custom_name: e.target.value }))}
              placeholder={recipe.name}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
          </div>

          {/* Servings */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">My serving count</label>
            <input
              type="number"
              value={form.servings_override}
              onChange={e => setForm(f => ({ ...f, servings_override: e.target.value }))}
              placeholder={recipe.servings?.toString() ?? 'e.g. 4'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Nutrition per serving
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'calories_per_serving',  label: 'Calories (kcal)', placeholder: recipe.calories_per_serving?.toString()  ?? '' },
              { key: 'protein_per_serving_g', label: 'Protein (g)',     placeholder: recipe.protein_per_serving_g?.toString() ?? '' },
              { key: 'carbs_per_serving_g',   label: 'Carbs (g)',       placeholder: recipe.carbs_per_serving_g?.toString()   ?? '' },
              { key: 'fat_per_serving_g',     label: 'Fat (g)',         placeholder: recipe.fat_per_serving_g?.toString()     ?? '' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  type="number"
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder || 'Not set'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
              </div>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Personal notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. I use less oil, reduces fat by ~5g per serving"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <button
            onClick={save}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save My Values'}
          </button>

          {recipe.has_user_profile && (
            <button
              onClick={removeProfile}
              disabled={deleting}
              className="w-full flex items-center justify-center gap-2 border border-red-200 hover:bg-red-50 disabled:opacity-50 text-red-500 font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              <Trash2 size={15} />
              {deleting ? 'Removing...' : 'Remove my customizations'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}