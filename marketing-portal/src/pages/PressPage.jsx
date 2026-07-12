import { motion } from 'framer-motion'
import { Download, ExternalLink } from 'lucide-react'
import { GlowCard } from '../components/UI.jsx'

const BRAND_COLORS = [
  { name: 'Neon Lime',   hex: '#CBFF01', usage: 'Primary CTA, highlights' },
  { name: 'Neon Cyan',   hex: '#4FFFFF', usage: 'Matrix, secondary accents' },
  { name: 'Neon Pink',   hex: '#FF6BFF', usage: 'Level income, gradients' },
  { name: 'Neon Orange', hex: '#FF9F43', usage: 'Global pool, warnings' },
  { name: 'Deep Black',  hex: '#030509', usage: 'Background base' },
  { name: 'Card Dark',   hex: '#0A0E16', usage: 'Card surfaces' },
]

const MEDIA_ASSETS = [
  { type: 'Logo Pack',       format: 'SVG + PNG', size: '480 KB', icon: '🖼️', desc: 'Full logo set — light, dark, monochrome, icon-only' },
  { type: 'Brand Guide',     format: 'PDF',       size: '2.4 MB', icon: '📄', desc: 'Typography, spacing, usage rules, do\'s and don\'ts' },
  { type: 'Social Banners',  format: 'PNG',       size: '1.8 MB', icon: '🖼️', desc: 'Twitter, Telegram, YouTube-optimized banners' },
  { type: 'Protocol Charts', format: 'PNG + SVG', size: '960 KB', icon: '📊', desc: 'Income distribution diagrams and matrix visuals' },
  { type: 'Whitepaper',      format: 'PDF',       size: '5.1 MB', icon: '📋', desc: 'Full technical and economic protocol whitepaper' },
  { type: 'Media Kit',       format: 'ZIP',       size: '12 MB',  icon: '📦', desc: 'Everything above bundled in one download' },
]

const FACTS = [
  { label: 'Founded',       value: '2024' },
  { label: 'Blockchain',    value: 'BNB Smart Chain' },
  { label: 'Contract',      value: 'Audited & Verified' },
  { label: 'Token',         value: '$AIPCORE' },
  { label: 'Income Streams', value: '4 On-chain' },
  { label: 'Matrix Depth',   value: '18 Levels' },
  { label: 'Active Nodes',   value: '12,400+' },
  { label: 'Protocol Volume', value: '2,800+ BNB' },
]

const SOCIAL = [
  { name: 'Telegram Channel', handle: '@aipcore',     href: 'https://t.me/aipcore',        icon: '✈️' },
  { name: 'Telegram Group',   handle: '@aipcorechat', href: 'https://t.me/aipcorechat',    icon: '💬' },
  { name: 'Twitter / X',      handle: '@aipcore',     href: 'https://twitter.com/aipcore', icon: '𝕏' },
  { name: 'Website',          handle: 'aipcore.online', href: 'https://aipcore.online',    icon: '🌐' },
]

export default function PressPage() {
  return (
    <main style={{ paddingTop: 104 }}>

      {/* Hero */}
      <section className="section" style={{ textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 10%, rgba(255,107,255,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <div className="section-label">📰 PRESS & MEDIA</div>
            <h1 className="section-title">Press Kit &<br /><span className="text-pink">Brand Assets</span></h1>
            <p className="section-desc" style={{ margin: '0 auto' }}>
              All media resources for journalists, influencers, and partners. 
              Please read our brand guidelines before use.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quick Facts */}
      <section style={{ paddingBottom: 80 }}>
        <div className="container">
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>◈ Quick Facts</div>
          <div className="grid-4" style={{ gap: 16 }}>
            {FACTS.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <div className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1.5, marginBottom: 6 }}>{f.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{f.value}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Colors */}
      <section style={{ paddingBottom: 80 }}>
        <div className="container">
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 24 }}>◈ Brand Colors</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {BRAND_COLORS.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <div style={{ width: 160 }}>
                  <div style={{
                    height: 80, borderRadius: 14, marginBottom: 12,
                    background: c.hex,
                    border: c.hex === '#030509' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    boxShadow: `0 0 24px ${c.hex}40`,
                  }} />
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 3 }}>{c.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--neon-lime)', fontFamily: 'monospace', marginBottom: 4 }}>{c.hex}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{c.usage}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Media Downloads */}
      <section className="section" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', paddingTop: 60 }}>
        <div className="container">
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◈ Media Assets</div>
          <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 40 }}>Download Resources</h2>
          <div className="grid-3" style={{ gap: 20 }}>
            {MEDIA_ASSETS.map((asset, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.09 }}>
                <GlowCard color="#FF6BFF" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{asset.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{asset.type}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{asset.format} · {asset.size}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, flex: 1 }}>{asset.desc}</p>
                  <button style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(255,107,255,0.1)', border: '1px solid rgba(255,107,255,0.3)',
                    color: '#FF6BFF', fontSize: 12, fontWeight: 800, transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,255,0.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,107,255,0.1)' }}
                  >
                    <Download size={14} /> Download
                  </button>
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social / Contact */}
      <section className="section">
        <div className="container">
          <div className="grid-2" style={{ gap: 48, alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 8 }}>◈ OFFICIAL CHANNELS</div>
              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 24 }}>Connect & Follow</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SOCIAL.map((s, i) => (
                  <a key={i} href={s.href} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, transition: 'all 0.2s', color: '#fff' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(203,255,1,0.3)'; e.currentTarget.style.background = 'rgba(203,255,1,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  >
                    <span style={{ fontSize: 22, width: 32, textAlign: 'center' }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--neon-lime)', fontWeight: 700 }}>{s.handle}</div>
                    </div>
                    <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                  </a>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 8 }}>◈ PRESS ENQUIRIES</div>
              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 16 }}>Get in Touch</h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
                For partnership proposals, media features, interview requests or exchange listing enquiries, 
                please reach out via Telegram or email.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Media & Press', value: 'press@aipcore.online' },
                  { label: 'Partnerships', value: 'partners@aipcore.online' },
                  { label: 'Support', value: 'support@aipcore.online' },
                ].map((c, i) => (
                  <div key={i} style={{ padding: '12px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--neon-lime)' }}>{c.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
