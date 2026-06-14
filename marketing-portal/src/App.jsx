import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import HomePage from './pages/HomePage.jsx'
import FeaturesPage from './pages/FeaturesPage.jsx'
import EarningsPage from './pages/EarningsPage.jsx'
import RoadmapPage from './pages/RoadmapPage.jsx'
import PressPage from './pages/PressPage.jsx'
import JoinPage from './pages/JoinPage.jsx'
import AcademyPage from './pages/AcademyPage.jsx'
import AssetsPage from './pages/AssetsPage.jsx'
import AIAgentPage from './pages/AIAgentPage.jsx'
import PlayPage from './pages/PlayPage.jsx'
import FunnelPage from './pages/FunnelPage.jsx'
import TickerBar from './components/TickerBar.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{
        style: { background: '#0D1117', color: '#fff', border: '1px solid rgba(203,255,1,0.3)', fontFamily: 'Outfit, sans-serif' }
      }} />
      <Navbar />
      <TickerBar />
      <Routes>
        <Route path="/"          element={<HomePage />} />
        <Route path="/features"  element={<FeaturesPage />} />
        <Route path="/earnings"  element={<EarningsPage />} />
        <Route path="/roadmap"   element={<RoadmapPage />} />
        <Route path="/press"     element={<PressPage />} />
        <Route path="/academy"   element={<AcademyPage />} />
        <Route path="/assets"    element={<AssetsPage />} />
        <Route path="/ai-agent"  element={<AIAgentPage />} />
        <Route path="/play"      element={<PlayPage />} />
        <Route path="/join"      element={<JoinPage />} />
        <Route path="/join/:ref" element={<JoinPage />} />
        <Route path="/destiny"   element={<FunnelPage />} />
        <Route path="/funnel"    element={<FunnelPage />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}
