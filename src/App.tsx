import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './components/HomePage'
import ShelterSearch from './components/ShelterSearch'
import AIGuide from './components/AIGuide'
import EvacuationSimulation from './components/EvacuationSimulation'

type Page = 'home' | 'search' | 'guide' | 'risk' | 'simulation'

// URL <-> Page 매핑
const pageToPath: Record<Page, string> = {
  home: '/',
  search: '/search',
  guide: '/guide',
  risk: '/risk',
  simulation: '/simulation',
}
const pathToPage = (pathname: string): Page => {
  switch (pathname) {
    case '/': return 'home'
    case '/search': return 'search'
    case '/guide': return 'guide'
    case '/risk': return 'risk'
    case '/simulation': return 'simulation'
    default: return 'home'
  }
}

export default function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Header가 기대하는 onNavigate 형태 유지
  const handleNavigate = (page: string) => {
    const p = (page as Page)
    navigate(pageToPath[p] ?? '/')
  }

  const currentPage: Page = pathToPage(pathname)

  return (
    <div className="min-h-screen bg-gray-50">
      {currentPage !== 'search' && (
        <Header currentPage={currentPage} onNavigate={handleNavigate} />
      )}

      <Routes>
        <Route path="/" element={<HomePage onNavigate={handleNavigate} />} />
        <Route path="/search" element={<ShelterSearch onNavigate={handleNavigate} />} />
        <Route path="/guide" element={<AIGuide />} />
        <Route path="/simulation" element={<EvacuationSimulation />} />
        {/* 존재하지 않는 경로는 홈으로 */}
        <Route path="*" element={<HomePage onNavigate={handleNavigate} />} />
      </Routes>
    </div>
  )
}
