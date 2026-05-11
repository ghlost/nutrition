import { useState, useRef } from 'react'
import type { FoodScanStep1, FoodEstimateResult, ScanQuestion } from '../lib/api'
import { foodsApi, recipesApi, foodPhotoApi, diaryApi } from '../lib/api'
import { Pencil, Camera, Upload, Loader2, CheckCircle, ChevronRight } from 'lucide-react'
import EditFoodModal from '../components/EditFoodModal'
import EditRecipeModal from '../components/EditRecipeModal'
import type { FoodItem } from '../lib/api'

type Mode = 'label' | 'recipe' | 'url' | 'food'
type State = 'idle' | 'preview' | 'scanning' | 'done' | 'error'

async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // If already small enough, skip compression
      if (img.width <= maxWidth && file.size < 1.5 * 1024 * 1024) {
        resolve(file)
        return
      }

      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          console.log(`Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`)
          resolve(compressed)
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

function QuestionCard({
  question,
  value,
  onChange
}: {
  question: ScanQuestion
  value: string | string[] | undefined
  onChange: (val: string | string[]) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-800 mb-3">{question.question}</p>
      <p className="text-xs text-gray-400 mb-2">{question.purpose}</p>

      {question.type === 'single' && question.options && (
        <div className="space-y-2">
          {question.options.map(opt => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors
                ${value === opt
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === 'multiple' && question.options && (
        <div className="space-y-2">
          {question.options.map(opt => {
            const selected = Array.isArray(value) && value.includes(opt)
            return (
              <button
                key={opt}
                onClick={() => {
                  const current = Array.isArray(value) ? value : []
                  onChange(selected ? current.filter(v => v !== opt) : [...current, opt])
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors
                  ${selected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {question.type === 'number' && (
        <input
          type="number"
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
          placeholder="Enter a number..."
        />
      )}

      {question.type === 'boolean' && (
        <div className="flex gap-2">
          {['Yes', 'No'].map(opt => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors
                ${value === opt
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ScanPage({ onScanned }: { onScanned: () => void }) {
  const [mode, setMode] = useState<Mode>('label')
  const [state, setState] = useState<State>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const compressedFileRef = useRef<File | null>(null)
  const [url, setUrl] = useState('')
  const [editing, setEditing] = useState(false)
  const [foodScan, setFoodScan]     = useState<FoodScanStep1 | null>(null)
  const [answers, setAnswers]       = useState<Record<string, string | string[]>>({})
  const [estimate, setEstimate]     = useState<FoodEstimateResult | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [foodDescription, setFoodDescription] = useState('')
  const [savedFoodItem, setSavedFoodItem] = useState<FoodItem | null>(null)
  const [savingEstimate, setSavingEstimate] = useState(false)
  const [mealSlot, setMealSlot] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch')
  const [logged, setLogged] = useState(false)

  async function scanUrl() {
    if (!url.trim()) return
    setState('scanning')
    setError(null)
    try {
      const res = await recipesApi.fromUrl(url.trim())
      setResult(res)
      setState('done')
    } catch (e: any) {
      setError(e.message || 'Could not extract recipe from URL')
      setState('error')
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Don't block UI — go to preview immediately with original
    // then swap to compressed version silently
    const originalUrl = URL.createObjectURL(file)
    setPreview(originalUrl)
    setState('preview')
    setResult(null)
    setError(null)

    // Compress in background — console log fires here
    const compressed = await compressImage(
      file,
      mode === 'recipe' ? 1600 : 1200,
      mode === 'recipe' ? 0.78 : 0.82
    )
    compressedFileRef.current = compressed

    // Swap preview to compressed version
    URL.revokeObjectURL(originalUrl)
    const compressedUrl = URL.createObjectURL(compressed)
    setPreview(compressedUrl)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function scan() {
    const file = compressedFileRef.current
    if (!file) return
    setState('scanning')
    setError(null)
    try {
      if (mode === 'label') {
        const res = await foodsApi.scan(file)
        setResult(res)
        setState('done')
      } else if (mode === 'recipe') {
        const res = await recipesApi.scan(file)
        setResult(res)
        setState('done')
      } else if (mode === 'food') {
        const res = await foodPhotoApi.scan(file, foodDescription.trim() || undefined)
        setFoodScan(res)
        setState('done')
      }
    } catch (e: any) {
      setError(e.message || 'Scan failed')
      setState('error')
    }
  }

  async function submitAnswers() {
    if (!foodScan) return
    setEstimating(true)
    try {
      const res = await foodPhotoApi.estimate(
        foodScan.identified,
        foodScan.questions,
        answers
      )
      setEstimate(res)
    } catch (e: any) {
      setError(e.message || 'Estimation failed')
    } finally {
      setEstimating(false)
    }
  }

  async function saveAndLog() {
    if (!estimate || !foodScan) return
    setSavingEstimate(true)
    try {
      const name = foodScan.description
        || foodScan.identified.foods.map(f => f.name).join(', ')

      const item = await foodPhotoApi.save(name, estimate.totals)
      setSavedFoodItem(item)

      await diaryApi.addEntry({
        date: new Date().toISOString().split('T')[0],
        meal_slot: mealSlot,
        item_type: 'food',
        food_item_id: item.id,
        recipe_id: null,
        servings: 1,
      })
      setLogged(true)
    } catch (e: any) {
      setError(e.message || 'Failed to log')
    } finally {
      setSavingEstimate(false)
    }
  }

  function reset() {
    setState('idle')
    setPreview(null)
    setResult(null)
    setError(null)
    setEditing(false)
    setFoodScan(null)
    setAnswers({})
    setEstimate(null)
    setFoodDescription('')
    setLogged(false)
    setSavedFoodItem(null)
    compressedFileRef.current = null
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Scan</h2>

      {/* Mode toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {([
          { id: 'label', label: '🏷️ Nutrition Label' },
          { id: 'recipe', label: '📋 Recipe Photo' },
          { id: 'food', label: '📸 Food Photo' },
          // { id: 'url', label: '🔗 Recipe URL' },
        ] as { id: Mode; label: string }[]).map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); reset() }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors
              ${mode === m.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Upload area */}
      {(mode === 'label' || mode === 'recipe' || mode === 'food') && state === 'idle' && (
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-emerald-400 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors bg-white"
        >
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
            <Camera size={28} className="text-emerald-600" />
          </div>
          <div className="text-center">
            <p className="font-medium text-gray-700">Take a photo or upload</p>
            <p className="text-sm text-gray-400 mt-1">
              {mode === 'label' ? 'Point at a nutrition facts label' : 'Screenshot or photo of a recipe'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Upload size={12} />
            JPEG, PNG, WEBP up to 10MB
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* URL scan area */}
      {mode === 'url' && state === 'idle' && (
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm text-gray-500">
              Paste any recipe URL — AllRecipes, NYT Cooking, Serious Eats, etc.
            </p>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && scanUrl()}
              placeholder="https://www.allrecipes.com/recipe/..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 transition-colors"
            />
            <button
              onClick={scanUrl}
              disabled={!url.trim()}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              Extract Recipe
            </button>
          </div>
        </div>
      )}

      {mode === 'url' && state === 'scanning' && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={32} className="animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500">Fetching and extracting recipe...</p>
        </div>
      )}

      {mode === 'url' && state === 'error' && (
        <div className="space-y-3">
          <p className="text-sm text-red-500 text-center">{error}</p>
          <button
            onClick={() => { setState('idle'); setError(null) }}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Preview */}
      {(state === 'preview' || state === 'scanning' || state === 'error') && preview && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            <img src={preview} alt="Preview" className="w-full object-contain max-h-72" />  {/* ← this was missing */}
            {compressedFileRef.current && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                {(compressedFileRef.current.size / 1024).toFixed(0)}KB
              </div>
            )}
            {state === 'scanning' && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="bg-white rounded-xl px-5 py-3 flex items-center gap-3">
                  <Loader2 size={20} className="animate-spin text-emerald-600" />
                  <span className="text-sm font-medium">Scanning with AI...</span>
                </div>
              </div>
            )}
          </div>
          {state !== 'scanning' && (
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Retake
              </button>
              <button
                onClick={scan}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
              >
                {state === 'error' ? 'Try Again' : 'Scan'}
              </button>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
        </div>
      )}

      {/* Result */}
      {state === 'done' && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle size={20} />
            <span className="font-medium">
              {mode === 'label' ? 'Nutrition label extracted!' : 'Recipe extracted!'}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{result.name}</p>
                {result.brand && <p className="text-sm text-gray-500">{result.brand}</p>}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Pencil size={16} />
              </button>
            </div>

            {mode === 'label' ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Calories',    value: result.calories,   unit: 'kcal', color: 'text-orange-500' },
                  { label: 'Protein',     value: result.protein_g,  unit: 'g',    color: 'text-blue-500'   },
                  { label: 'Carbs',       value: result.carbs_g,    unit: 'g',    color: 'text-yellow-500' },
                  { label: 'Fat',         value: result.fat_g,      unit: 'g',    color: 'text-purple-500' },
                ].map(({ label, value, unit, color }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <p className={`text-lg font-bold ${color}`}>{value}{unit}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 text-sm text-gray-600">
                {result.servings && <p>🍽️ {result.servings} servings</p>}
                {result.prep_time_min && <p>⏱️ {result.prep_time_min} min prep</p>}
                {result.calories_per_serving && <p>🔥 {result.calories_per_serving} kcal / serving</p>}
                {result.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.tags.map((t: string) => (
                      <span key={t} className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Scan Another
            </button>
            <button
              onClick={onScanned}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center justify-center gap-1 transition-colors"
            >
              Go to Diary <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* food photo and not scanned or scanning */}
      {mode === 'food' && state !== 'done' && state !== 'scanning' && !estimate && (
        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <span className="text-gray-400 text-sm shrink-0">📝</span>
          <input
            type="text"
            value={foodDescription}
            onChange={e => setFoodDescription(e.target.value)}
            placeholder='Optional: "grilled chicken wings with hot sauce"'
            className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
          />
        </div>
      )}

      {/* Food scan — questions */}
      {mode === 'food' && state === 'done' && foodScan && !estimate && (
        <div className="space-y-4">
          {/* Identified foods */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Identified foods
            </p>
            <div className="space-y-2">
              {foodScan.identified.foods.map((food, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{food.name}</p>
                    <p className="text-xs text-gray-400">
                      {food.preparation} · {food.estimated_portion}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${food.confidence === 'high'   ? 'bg-emerald-50 text-emerald-700' :
                      food.confidence === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                                                    'bg-red-50 text-red-600'}`}>
                    {food.confidence}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Follow-up questions */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">
              A few questions to improve accuracy:
            </p>
            {foodScan.questions.map(q => (
              <QuestionCard
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={val => setAnswers(prev => ({ ...prev, [q.id]: val }))}
              />
            ))}
          </div>

          <button
            onClick={submitAnswers}
            disabled={estimating}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {estimating
              ? <><Loader2 size={18} className="animate-spin" /> Estimating...</>
              : 'Get Calorie Estimate'
            }
          </button>

          <button onClick={reset} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">
            Retake photo
          </button>
        </div>
      )}

      {/* Food scan — estimate result */}
      {mode === 'food' && estimate && (
        <div className="space-y-4">
          {/* Confidence banner */}
          <div className={`rounded-2xl p-4 flex items-start gap-3
            ${estimate.confidence === 'high'   ? 'bg-emerald-50 border border-emerald-200' :
              estimate.confidence === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
                                                'bg-orange-50 border border-orange-200'}`}>
            <div className="flex-1">
              <p className={`text-sm font-semibold
                ${estimate.confidence === 'high'   ? 'text-emerald-800' :
                  estimate.confidence === 'medium' ? 'text-yellow-800' :
                                                    'text-orange-800'}`}>
                {estimate.confidence === 'high' ? '✓ High confidence estimate' :
                estimate.confidence === 'medium' ? '~ Medium confidence estimate' :
                '⚠ Low confidence estimate'}
              </p>
              <p className={`text-xs mt-0.5
                ${estimate.confidence === 'high'   ? 'text-emerald-700' :
                  estimate.confidence === 'medium' ? 'text-yellow-700' :
                                                    'text-orange-700'}`}>
                {estimate.confidence_reason}
              </p>
            </div>
          </div>

          {/* Calorie range */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">Estimated calories</p>
            <p className="text-4xl font-bold text-orange-500">
              {estimate.totals.calories}
              <span className="text-lg font-normal text-gray-400 ml-1">kcal</span>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Range: {estimate.calorie_range.low}–{estimate.calorie_range.high} kcal
            </p>

            {/* Macro breakdown */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { label: 'Protein', value: estimate.totals.protein_g, unit: 'g', color: 'text-blue-500', bg: 'bg-blue-50' },
                { label: 'Carbs',   value: estimate.totals.carbs_g,   unit: 'g', color: 'text-yellow-600', bg: 'bg-yellow-50' },
                { label: 'Fat',     value: estimate.totals.fat_g,     unit: 'g', color: 'text-purple-500', bg: 'bg-purple-50' },
              ].map(({ label, value, unit, color, bg }) => (
                <div key={label} className={`${bg} rounded-xl p-2.5`}>
                  <p className={`text-base font-bold ${color}`}>{value}{unit}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Per item breakdown */}
          {estimate.items.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">
                Breakdown
              </p>
              {estimate.items.map((item, i) => (
                <div key={i} className={`px-4 py-2.5 flex items-center justify-between
                  ${i < estimate.items.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div>
                    <p className="text-sm text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.portion_used}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-700">{item.calories} kcal</p>
                </div>
              ))}
            </div>
          )}

          {/* Assumptions */}
          {estimate.assumptions.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Assumptions made</p>
              <ul className="space-y-1">
                {estimate.assumptions.map((a, i) => (
                  <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                    <span className="text-gray-400 shrink-0">·</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!logged ? (
            <div className="space-y-3">
              {/* Meal slot picker */}
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xs text-gray-500 mb-2">Log to which meal?</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(slot => (
                    <button
                      key={slot}
                      onClick={() => setMealSlot(slot)}
                      className={`py-2 rounded-xl text-xs font-medium capitalize transition-colors border
                        ${mealSlot === slot
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                      {slot === 'breakfast' ? '🌅' :
                      slot === 'lunch'     ? '☀️' :
                      slot === 'dinner'    ? '🌙' : '🍎'} {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
                >
                  Discard
                </button>
                <button
                  onClick={saveAndLog}
                  disabled={savingEstimate}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  {savingEstimate
                    ? <><Loader2 size={16} className="animate-spin" /> Logging...</>
                    : <><CheckCircle size={16} /> Log to Diary</>
                  }
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <CheckCircle size={24} className="text-emerald-600 mx-auto mb-2" />
                <p className="font-medium text-emerald-800">Logged to {mealSlot}!</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {estimate.totals.calories} kcal added to today's diary
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
                >
                  Scan Another
                </button>
                <button
                  onClick={onScanned}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                >
                  View Diary <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {editing && mode === 'label' && result && (
        <EditFoodModal
          item={result}
          onSave={updated => { setResult(updated); setEditing(false) }}
          onClose={() => setEditing(false)}
        />
      )}

      {editing && (mode === 'recipe' || mode === 'url') && result && (
        <EditRecipeModal
          recipe={result}
          onSave={updated => { setResult(updated); setEditing(false) }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}