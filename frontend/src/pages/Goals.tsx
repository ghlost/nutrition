import { useState, useEffect } from 'react'
import { goalsApi } from '../lib/api'
import { Target, Save } from 'lucide-react'

export default function GoalsPage() {
  const [goals, setGoals] = useState({ calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65 })
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    goalsApi.get()
      .then(g => {
        if (g) setGoals({
          calories:  g.calories,
          protein_g: g.protein_g,
          carbs_g:   g.carbs_g,
          fat_g:     g.fat_g
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    await goalsApi.set(goals)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const fields = [
    { key: 'calories',  label: 'Daily Calories', unit: 'kcal', color: 'text-orange-500' },
    { key: 'protein_g', label: 'Protein',         unit: 'g',    color: 'text-blue-500'   },
    { key: 'carbs_g',   label: 'Carbohydrates',   unit: 'g',    color: 'text-yellow-500' },
    { key: 'fat_g',     label: 'Fat',             unit: 'g',    color: 'text-purple-500' },
  ] as const

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
  )

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <Target size={20} className="text-emerald-600" />
        <h2 className="text-lg font-semibold text-gray-900">Daily Goals</h2>
      </div>

      <div className="space-y-4">
        {fields.map(({ key, label, unit, color }) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">{label}</label>
              <span className={`text-sm font-semibold ${color}`}>
                {goals[key]} {unit}
              </span>
            </div>
            <input
              type="range"
              min={key === 'calories' ? 1000 : 20}
              max={key === 'calories' ? 4000 : 300}
              step={key === 'calories' ? 50 : 5}
              value={goals[key]}
              onChange={e => setGoals(g => ({ ...g, [key]: Number(e.target.value) }))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{key === 'calories' ? '1000 kcal' : '20g'}</span>
              <span>{key === 'calories' ? '4000 kcal' : '300g'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Macro split</p>
        <div className="flex gap-2 mt-2">
          {[
            { label: 'Protein', kcal: goals.protein_g * 4,  color: 'bg-blue-400'   },
            { label: 'Carbs',   kcal: goals.carbs_g * 4,    color: 'bg-yellow-400' },
            { label: 'Fat',     kcal: goals.fat_g * 9,      color: 'bg-purple-400' },
          ].map(({ label, kcal, color }) => {
            const pct = Math.round(kcal / goals.calories * 100)
            return (
              <div key={label} className="flex-1 text-center">
                <div className={`h-2 rounded-full ${color} mb-1`} style={{ opacity: 0.8 }} />
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xs font-semibold text-gray-700">{pct}%</p>
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={save}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition-colors"
      >
        <Save size={18} />
        {saved ? 'Saved!' : 'Save Goals'}
      </button>
    </div>
  )
}