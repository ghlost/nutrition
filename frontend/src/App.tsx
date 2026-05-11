import { useState, useEffect } from 'react'
import { UtensilsCrossed, BookOpen, Camera, Target, TrendingUp, LogOut } from 'lucide-react'
import { auth } from './lib/api'
import LoginPage from './pages/Login'
import DiaryPage from './pages/Diary'
import ScanPage from './pages/Scan'
import RecipesPage from './pages/Recipes'
import GoalsPage from './pages/Goals'
import ProgressPage from './pages/Progress'

type Page = 'diary' | 'scan' | 'recipes' | 'goals' | 'progress'
const PAGES: Page[] = ['diary', 'scan', 'recipes', 'goals', 'progress']

function getPageFromPath(): Page {
  const slug = window.location.pathname.replace('/', '').toLowerCase() as Page
  return PAGES.includes(slug) ? slug : 'diary'
}

export default function App() {
  const [page, setPage]           = useState<Page>(getPageFromPath)
  const [isAuthed, setIsAuthed]   = useState(auth.isLoggedIn())
  const user                      = auth.getUser()

  useEffect(() => {
    const onPop = () => setPage(getPageFromPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function navigate(p: Page) {
    if (p === page) return
    window.history.pushState(null, '', `/${p}`)
    setPage(p)
  }

  function handleAuth() {
    setIsAuthed(true)
    window.history.pushState(null, '', '/diary')
    setPage('diary')
  }

  function handleLogout() {
    auth.clear()
    setIsAuthed(false)
    window.history.pushState(null, '', '/')
  }

  if (!isAuthed) {
    return <LoginPage onAuth={handleAuth} />
  }

  const nav = [
    { id: 'diary',    label: 'Diary',    icon: UtensilsCrossed },
    { id: 'scan',     label: 'Scan',     icon: Camera },
    { id: 'recipes',  label: 'Recipes',  icon: BookOpen },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'goals',    label: 'Goals',    icon: Target },
  ] as const

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-2xl mx-auto">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">NutriScan</h1>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-gray-400">@{user.username}</span>
          )}
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {page === 'diary'    && <DiaryPage />}
        {page === 'scan'     && <ScanPage onScanned={() => navigate('diary')} />}
        {page === 'recipes'  && <RecipesPage />}
        {page === 'goals'    && <GoalsPage />}
        {page === 'progress' && <ProgressPage />}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white border-t border-gray-200 flex">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => navigate(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors
              ${page === id ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}