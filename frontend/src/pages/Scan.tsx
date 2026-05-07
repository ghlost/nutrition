import { useState, useRef } from 'react'
import { foodsApi, recipesApi } from '../lib/api'
import { Camera, Upload, Loader2, CheckCircle, ChevronRight } from 'lucide-react'

type Mode = 'label' | 'recipe'
type State = 'idle' | 'preview' | 'scanning' | 'done' | 'error'

export default function ScanPage({ onScanned }: { onScanned: () => void }) {
  const [mode, setMode] = useState<Mode>('label')
  const [state, setState] = useState<State>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    setState('preview')
    setResult(null)
    setError(null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function scan() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setState('scanning')
    setError(null)
    try {
      const res = mode === 'label'
        ? await foodsApi.scan(file)
        : await recipesApi.scan(file)
      setResult(res)
      setState('done')
    } catch (e: any) {
      setError(e.message || 'Scan failed')
      setState('error')
    }
  }

  function reset() {
    setState('idle')
    setPreview(null)
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Scan</h2>

      {/* Mode toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {(['label', 'recipe'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); reset() }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize
              ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {m === 'label' ? '🏷️ Nutrition Label' : '📋 Recipe'}
          </button>
        ))}
      </div>

      {/* Upload area */}
      {state === 'idle' && (
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

      {/* Preview */}
      {(state === 'preview' || state === 'scanning' || state === 'error') && preview && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-gray-200">
            <img src={preview} alt="Preview" className="w-full object-contain max-h-72" />
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
            <p className="font-semibold text-gray-900">{result.name}</p>
            {result.brand && <p className="text-sm text-gray-500">{result.brand}</p>}

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
    </div>
  )
}