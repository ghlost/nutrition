import { useState } from 'react'
import { foodsApi } from '../lib/api'
import type { FoodItem } from '../lib/api'
import { X, Save } from 'lucide-react'

export default function EditFoodModal({
  item,
  onSave,
  onClose
}: {
  item: FoodItem
  onSave: (updated: FoodItem) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name:             item.name,
    brand:            item.brand ?? '',
    serving_size:     item.serving_size,
    calories:         item.calories,
    protein_g:        item.protein_g,
    carbs_g:          item.carbs_g,
    fat_g:            item.fat_g,
    fiber_g:          item.fiber_g ?? '',
    sugar_g:          item.sugar_g ?? '',
    sodium_mg:        item.sodium_mg ?? '',
    saturated_fat_g:  item.saturated_fat_g ?? '',
    cholesterol_mg:   item.cholesterol_mg ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function field(
    key: keyof typeof form,
    label: string,
    type: 'text' | 'number' = 'number',
    required = false
  ) {
    return (
      <div key={key}>
        <label className="text-xs text-gray-500 mb-1 block">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors"
        />
      </div>
    )
  }

  async function save() {
    if (!form.name || !form.serving_size) {
      setError('Name and serving size are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await foodsApi.update(item.id, {
        ...form,
        brand:           form.brand || null,
        fiber_g:         form.fiber_g !== '' ? Number(form.fiber_g) : null,
        sugar_g:         form.sugar_g !== '' ? Number(form.sugar_g) : null,
        sodium_mg:       form.sodium_mg !== '' ? Number(form.sodium_mg) : null,
        saturated_fat_g: form.saturated_fat_g !== '' ? Number(form.saturated_fat_g) : null,
        cholesterol_mg:  form.cholesterol_mg !== '' ? Number(form.cholesterol_mg) : null,
      })
      onSave(updated)
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
          <h3 className="font-semibold text-gray-900">Edit Food Item</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field('name',         'Name',         'text', true)}
            {field('brand',        'Brand',        'text')}
            {field('serving_size', 'Serving Size', 'text', true)}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">
            Macros (per serving)
          </p>
          <div className="grid grid-cols-2 gap-3">
            {field('calories',  'Calories (kcal)', 'number', true)}
            {field('protein_g', 'Protein (g)',     'number', true)}
            {field('carbs_g',   'Carbs (g)',       'number', true)}
            {field('fat_g',     'Fat (g)',         'number', true)}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">
            Additional (optional)
          </p>
          <div className="grid grid-cols-2 gap-3">
            {field('fiber_g',        'Fiber (g)')}
            {field('sugar_g',        'Sugar (g)')}
            {field('sodium_mg',      'Sodium (mg)')}
            {field('saturated_fat_g','Saturated Fat (g)')}
            {field('cholesterol_mg', 'Cholesterol (mg)')}
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