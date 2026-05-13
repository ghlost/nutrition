import { useState, useEffect } from 'react'
import { summaryApi, todayLocalDate, weightApi } from '../lib/api'
import type { WeekSummary, WeightEntry } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Scale, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'

function toMonday(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

function toDateString(d: Date) {
  return d.toISOString().split('T')[0]
}

function formatDay(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type Macro = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'

const MACRO_CONFIG: Record<Macro, { label: string; color: string; unit: string }> = {
  calories:  { label: 'Calories', color: '#f97316', unit: 'kcal' },
  protein_g: { label: 'Protein',  color: '#3b82f6', unit: 'g'    },
  carbs_g:   { label: 'Carbs',    color: '#eab308', unit: 'g'    },
  fat_g:     { label: 'Fat',      color: '#a855f7', unit: 'g'    },
}

export default function ProgressPage() {
  const [weekStart, setWeekStart]     = useState(() => toDateString(toMonday(new Date())))
  const [summary, setSummary]         = useState<WeekSummary | null>(null)
  const [activeMacro, setActiveMacro] = useState<Macro>('calories')
  const [weights, setWeights]         = useState<WeightEntry[]>([])
  const [loadingWeek, setLoadingWeek] = useState(true)
  const [showLogWeight, setShowLogWeight] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [noteInput, setNoteInput]     = useState('')
  const [logging, setLogging]         = useState(false)

  useEffect(() => {
    weightApi.list()
      .then(all => setWeights(all ?? []))
      .catch(() => setWeights([]))
  }, [])

  useEffect(() => {
    setLoadingWeek(true)
    summaryApi.week(weekStart)
      .then(data => setSummary(data ?? null))
      .catch(() => setSummary(null))
      .finally(() => setLoadingWeek(false))
  }, [weekStart])

  function shiftWeek(dir: number) {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + dir * 7)
    setWeekStart(toDateString(d))
  }

  const isCurrentWeek = weekStart === toDateString(toMonday(new Date(todayLocalDate() + 'T12:00:00')))

  async function logWeight() {
    const w = parseFloat(weightInput)
    if (!w || w < 50 || w > 700) return
    setLogging(true)
    try {
      const entry = await weightApi.log({
        weight_lbs: w,
        note: noteInput.trim() || null,
        date: todayLocalDate()
      })
      setWeights(prev => [entry, ...prev])
      setWeightInput('')
      setNoteInput('')
      setShowLogWeight(false)
    } finally {
      setLogging(false)
    }
  }

  async function deleteWeight(id: string) {
    await weightApi.delete(id)
    setWeights(prev => prev.filter(w => w.id !== id))
  }

  const chartData = summary?.days.map(d => ({
    day: formatDay(d.date),
    value: Math.round(d.totals[activeMacro]),
    logged: d.logged
  })) ?? []

  const goal = summary?.goals?.[activeMacro] ?? null
  const avg  = summary?.averages?.[activeMacro] ?? null
  const cfg  = MACRO_CONFIG[activeMacro]

  return (
    <div className="p-4 space-y-5 pb-8">
      <h2 className="text-lg font-semibold text-gray-900">Progress</h2>

      {/* Week nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => shiftWeek(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            {isCurrentWeek ? 'This Week' : 'Week of'}
          </p>
          <p className="text-xs text-gray-400">
            {formatDate(weekStart)} — {formatDate(
              toDateString(new Date(new Date(weekStart + 'T12:00:00').setDate(new Date(weekStart + 'T12:00:00').getDate() + 6)))
            )}
          </p>
        </div>
        <button
          onClick={() => shiftWeek(1)}
          disabled={isCurrentWeek}
          className="p-2 rounded-xl hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Macro selector */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(MACRO_CONFIG) as [Macro, typeof cfg][]).map(([key, { label, color }]) => (
          <button
            key={key}
            onClick={() => setActiveMacro(key)}
            className={`py-2 rounded-xl text-xs font-medium transition-colors border
              ${activeMacro === key
                ? 'text-white border-transparent'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            style={activeMacro === key ? { background: color, borderColor: color } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        {loadingWeek ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            Loading...
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">{cfg.label} this week</p>
              {avg !== null && (
                <p className="text-xs text-gray-400">
                  avg <span className="font-semibold" style={{ color: cfg.color }}>
                    {Math.round(avg)}{cfg.unit}
                  </span>
                </p>
              )}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={28}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  formatter={(value) => {
                    const v = typeof value === 'number' ? value : 0
                    return [`${v}${cfg.unit}`, cfg.label] as [string, string]
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #e5e7eb' }}
                  cursor={{ fill: '#f9fafb' }}
                />
                {goal && (
                  <ReferenceLine
                    y={goal}
                    stroke={cfg.color}
                    strokeDasharray="4 3"
                    strokeOpacity={0.5}
                  />
                )}
                <Bar
                  dataKey="value"
                  fill={cfg.color}
                  fillOpacity={0.85}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            {goal && (
              <p className="text-xs text-gray-400 text-center mt-1">
                Dashed line = your {cfg.label.toLowerCase()} goal ({goal}{cfg.unit})
              </p>
            )}
          </>
        )}
      </div>

      {/* Weekly averages summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(MACRO_CONFIG) as [Macro, typeof cfg][]).map(([key, { label, color, unit }]) => {
            const avg = summary.averages[key]
            const g   = summary.goals?.[key] ?? null
            const pct = g ? Math.round(avg / g * 100) : null
            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xs text-gray-500 mb-1">{label} avg/day</p>
                <p className="text-lg font-bold" style={{ color }}>
                  {Math.round(avg)}<span className="text-xs font-normal text-gray-400">{unit}</span>
                </p>
                {pct !== null && (
                  <p className="text-xs text-gray-400 mt-0.5">{pct}% of goal</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Weight tracker */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-emerald-600" />
            <h3 className="font-medium text-gray-900">Weight Log</h3>
          </div>
          <button
            onClick={() => setShowLogWeight(v => !v)}
            className="flex items-center gap-1 text-emerald-600 text-sm font-medium hover:text-emerald-700"
          >
            <Plus size={16} /> Log weight
          </button>
        </div>

        {/* Log weight form */}
        {showLogWeight && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  min="50"
                  max="700"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                  placeholder="175.5"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Note (optional)</label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="Morning, after workout…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
              </div>
            </div>
            <button
              onClick={logWeight}
              disabled={!weightInput || logging}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              {logging ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}

        {/* Weight history */}
        {weights.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <p className="text-gray-400 text-sm">No weight entries yet</p>
            <p className="text-gray-400 text-xs mt-1">Log your weight to track trends over time</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {weights.slice(0, 10).map((entry, i) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < weights.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-semibold text-gray-900">
                      {entry.weight_lbs} lbs
                    </span>
                    {i < weights.length - 1 && (() => {
                      const diff = entry.weight_lbs - weights[i + 1].weight_lbs
                      return diff !== 0 ? (
                        <span className={`text-xs font-medium ${diff < 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)} lbs
                        </span>
                      ) : null
                    })()}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
                    {entry.note && (
                      <span className="text-xs text-gray-400">· {entry.note}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteWeight(entry.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {weights.length > 10 && (
              <p className="text-center text-xs text-gray-400 py-3">
                Showing 10 most recent entries
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}