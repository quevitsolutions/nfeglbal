import { Link } from 'react-router-dom'
import { ExternalLink, Twitter, Send, Globe } from 'lucide-react'

const FOOTER_LINKS = {
  'Product': [
    { label: 'Features',   to: '/features' },
    { label: 'Earnings',   to: '/earnings' },
    { label: 'Roadmap',    to: '/roadmap' },
    { label: 'Launch App', href: 'https://aipcore.online' },
  ],
  'Community': [
    { label: 'Telegram Channel', href: 'https://t.me/aipcore' },
    { label: 'Telegram Group',   href: 'https://t.me/aipcorechat' },
    { label: 'Twitter / X',      href: 'https://twitter.com/aipcore' },
  ],
  'Resources': [
    { label: 'Press Kit',     to: '/press' },
    { label: 'Smart Contract', href: 'https://bscscan.com' },
    { label: 'Whitepaper',    href: '#' },
    { label: 'Audit Report',  href: '#' },
  ],
}

export default function Footer() {
  return (
    <footer style={{
      background: 'rgba(3,5,9,0.98)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '72px 24px 36px',
    }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 64 }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #CBFF01, #4FFFFF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: 18, color: '#000'
              }}>A</div>
              <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: -0.5 }}>
                AIPCore <span style={{ color: 'var(--neon-lime)' }}>CORE</span>
              </span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 280, fontWeight: 500, marginBottom: 24 }}>
              The next-generation AI-powered Web3 community protocol. 
              Building the decentralized future, one node at a time.
            </p>
            {/* Social icons */}
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { icon: <Send size={16} />, href: 'https://t.me/aipcore', label: 'Telegram' },
                { icon: <Twitter size={16} />, href: 'https://twitter.com/aipcore', label: 'Twitter' },
                { icon: <Globe size={16} />, href: 'https://aipcore.online', label: 'Website' },
              ].map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}
                  style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.7)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(203,255,1,0.4)'; e.currentTarget.style.color = '#CBFF01'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--neon-lime)', letterSpacing: 2, marginBottom: 20, textTransform: 'uppercase' }}>
                {section}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {links.map(link => (
                  link.href
                    ? <a key={link.label} href={link.href} target="_blank" rel="noreferrer"
                        style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        {link.label} {link.label === 'Launch App' && <ExternalLink size={12} />}
                      </a>
                    : <Link key={link.label} to={link.to}
                        style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, transition: 'color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        {link.label}
                      </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
            © 2025 AIPCore Core Protocol. All rights reserved. Built on BNB Smart Chain.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="badge" style={{ background: 'rgba(203,255,1,0.08)', color: 'var(--neon-lime)', border: '1px solid rgba(203,255,1,0.2)' }}>
              🟢 BSC MAINNET
            </span>
            <span className="badge" style={{ background: 'rgba(79,255,255,0.08)', color: 'var(--neon-cyan)', border: '1px solid rgba(79,255,255,0.2)' }}>
              ✓ AUDITED
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          footer > div > div:first-child { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 560px) {
          footer > div > div:first-child { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  )
}
