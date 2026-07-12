import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ExternalLink } from 'lucide-react'

const NAV_LINKS = [
  { label: 'Features',  to: '/features' },
  { label: 'Earnings',  to: '/earnings' },
  { label: 'Destiny 🌌', to: '/destiny' },
  { label: 'Academy',   to: '/academy' },
  { label: 'Play (Free)', to: '/play' },
  { label: 'Assets',    to: '/assets' },
  { label: 'AI Agent',  to: '/ai-agent' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <>
      <motion.nav
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          padding: '0 24px',
          background: scrolled
            ? 'rgba(3,5,9,0.92)'
            : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{
          maxWidth: 1240, margin: '0 auto',
          display: 'flex', alignItems: 'center', height: 70, gap: 32
        }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #CBFF01, #4FFFFF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 16, color: '#000'
            }}>A</div>
            <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5 }}>
              AIPCore <span style={{ color: 'var(--neon-lime)' }}>CORE</span>
            </span>
          </Link>

          {/* Desktop Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }} className="desktop-nav">
            {NAV_LINKS.map(link => (
              <Link key={link.to} to={link.to} style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                color: pathname === link.to ? 'var(--neon-lime)' : 'rgba(255,255,255,0.75)',
                background: pathname === link.to ? 'rgba(203,255,1,0.08)' : 'transparent',
                transition: 'all 0.2s',
              }}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
            <a href="https://aipcore.online" target="_blank" rel="noreferrer"
              className="btn-outline" style={{ padding: '9px 18px', fontSize: 13 }}>
              Launch App <ExternalLink size={13} />
            </a>
            <Link to="/join" className="btn-primary" style={{ padding: '10px 22px', fontSize: 13, animation: 'none' }}>
              Join Now ⚡
            </Link>
            {/* Mobile menu btn */}
            <button onClick={() => setMenuOpen(v => !v)} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: 8, color: '#fff', display: 'none'
            }} id="menu-toggle">
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ duration: 0.28 }}
            style={{
              position: 'fixed', top: 70, right: 0, bottom: 0, width: 260,
              background: 'rgba(6,9,16,0.98)', backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255,255,255,0.08)', zIndex: 999,
              padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 8
            }}
          >
            {NAV_LINKS.map(link => (
              <Link key={link.to} to={link.to} style={{
                padding: '14px 16px', borderRadius: 12, fontSize: 15, fontWeight: 700,
                color: pathname === link.to ? 'var(--neon-lime)' : '#fff',
                background: pathname === link.to ? 'rgba(203,255,1,0.08)' : 'transparent',
              }}>
                {link.label}
              </Link>
            ))}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/join" className="btn-primary" style={{ animation: 'none' }}>Join Now ⚡</Link>
              <a href="https://aipcore.online" target="_blank" rel="noreferrer" className="btn-outline">
                Launch App <ExternalLink size={14} />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          #menu-toggle { display: flex !important; }
        }
      `}</style>
    </>
  )
}
