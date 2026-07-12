import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { SectionHeader } from '../components/UI.jsx'

const PHASES = [
  {
    phase: 'Phase 1', label: 'Foundation', status: 'complete', color: '#CBFF01',
    items: [
      { text: 'Smart contract deployment on BSC Mainnet', done: true },
      { text: 'Mining node activation system live', done: true },
      { text: 'Binary matrix income engine', done: true },
      { text: 'Sponsor referral tracking & payouts', done: true },
      { text: 'Level income distribution', done: true },
      { text: 'Global reward pool contract', done: true },
    ]
  },
  {
    phase: 'Phase 2', label: 'Growth', status: 'active', color: '#4FFFFF',
    items: [
      { text: 'Virtual Lobby & Hall (Metaverse UI)', done: true },
      { text: 'AI Host avatar integration', done: true },
      { text: 'AIPCore Academy — education platform', done: true },
      { text: 'AIPCore DAO governance portal', done: false },
      { text: 'Telegram Mini-App launch', done: true },
      { text: 'Community live events system', done: false },
    ]
  },
  {
    phase: 'Phase 3', label: 'Expansion', status: 'upcoming', color: '#FF6BFF',
    items: [
      { text: 'AIPCore Token DEX listing', done: false },
      { text: 'NFT identity & avatar system', done: false },
      { text: 'Cross-chain bridge (ETH / Polygon)', done: false },
      { text: 'Mobile native app (iOS & Android)', done: false },
      { text: 'AIPCore Core DAO full governance', done: false },
      { text: 'Global Marketing & Partnership Drive', done: false },
    ]
  },
  {
    phase: 'Phase 4', label: 'Ecosystem', status: 'upcoming', color: '#FF9F43',
    items: [
      { text: 'AIPCore Pay — merchant payment gateway', done: false },
      { text: 'AI-powered trading signals module', done: false },
      { text: 'Decentralized identity (DID) system', done: false },
      { text: 'AIPCore Core API for third-party integration', done: false },
      { text: 'Web3 social graph protocol', done: false },
      { text: 'Enterprise partnership programme', done: false },
    ]
  },
]

const MILESTONES = [
  { date: 'Q1 2025', label: 'Smart Contract Launch', icon: '🚀', done: true },
  { date: 'Q2 2025', label: 'Metaverse UI Live',     icon: '🌐', done: true },
  { date: 'Q3 2025', label: 'DAO Governance',         icon: '🏛️', done: false },
  { date: 'Q4 2025', label: 'DEX Token Listing',      icon: '📈', done: false },
  { date: 'Q1 2026', label: 'Mobile App Launch',      icon: '📱', done: false },
  { date: 'Q2 2026', label: 'Cross-chain Bridge',     icon: '🔗', done: false },
]

export default function RoadmapPage() {
  return (
    <main style={{ paddingTop: 104 }}>

      {/* Hero */}
      <section className="section" style={{ textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(79,255,255,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <div className="section-label">🗺️ ROADMAP</div>
            <h1 className="section-title">Building the<br /><span style={{ color: 'var(--neon-cyan)' }}>Decentralized Future</span></h1>
            <p className="section-desc" style={{ margin: '0 auto' }}>
              AIPCore Core's development roadmap: from smart contract foundation to a full AI-powered Web3 ecosystem.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Timeline milestones */}
      <section style={{ paddingBottom: 80 }}>
        <div className="container">
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
            {MILESTONES.map((m, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ flex: '0 0 auto', minWidth: 160, textAlign: 'center', padding: '0 12px', position: 'relative' }}>
                {/* Line */}
                {i < MILESTONES.length - 1 && (
                  <div style={{ position: 'absolute', top: 30, left: '60%', right: '-40%', height: 2, background: m.done ? 'rgba(203,255,1,0.4)' : 'rgba(255,255,255,0.08)', zIndex: 0 }} />
                )}
                <div style={{
                  width: 60, height: 60, borderRadius: '50%', margin: '0 auto 14px',
                  background: m.done ? 'rgba(203,255,1,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${m.done ? 'rgba(203,255,1,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, position: 'relative', zIndex: 1,
                  boxShadow: m.done ? '0 0 20px rgba(203,255,1,0.2)' : 'none',
                }}>{m.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 900, color: m.done ? 'var(--neon-lime)' : 'var(--text-muted)', marginBottom: 4 }}>{m.date}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.done ? '#fff' : 'var(--text-muted)' }}>{m.label}</div>
                {m.done && <div style={{ fontSize: 10, color: 'var(--neon-lime)', fontWeight: 800, marginTop: 4 }}>✓ DONE</div>}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Phase Cards */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <SectionHeader label="DEVELOPMENT PHASES" title="Our Four-Phase Journey" desc="Each phase builds on the last, expanding the protocol's capabilities and community reach." />
          <div className="grid-2" style={{ gap: 24 }}>
            {PHASES.map((phase, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                <div className="card" style={{ borderColor: `${phase.color}30`, height: '100%' }}>
                  {/* Phase header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{
                      padding: '6px 14px', borderRadius: 8,
                      background: `${phase.color}15`, border: `1px solid ${phase.color}40`,
                      fontSize: 11, fontWeight: 900, color: phase.color, letterSpacing: 1,
                    }}>{phase.phase}</div>
                    <div style={{ flex: 1, fontSize: 17, fontWeight: 800 }}>{phase.label}</div>
                    <div style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 900, letterSpacing: 1,
                      background: phase.status === 'complete' ? 'rgba(203,255,1,0.1)' : phase.status === 'active' ? 'rgba(79,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                      color: phase.status === 'complete' ? '#CBFF01' : phase.status === 'active' ? '#4FFFFF' : 'var(--text-muted)',
                      border: `1px solid ${phase.status === 'complete' ? 'rgba(203,255,1,0.3)' : phase.status === 'active' ? 'rgba(79,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      {phase.status === 'complete' ? '✓ DONE' : phase.status === 'active' ? '⚡ ACTIVE' : '🔜 UPCOMING'}
                    </div>
                  </div>
                  {/* Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {phase.items.map((item, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ color: item.done ? phase.color : 'var(--text-muted)', fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                          {item.done ? '✓' : '○'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: item.done ? 700 : 500, color: item.done ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)', lineHeight: 1.5 }}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ paddingBottom: 100, textAlign: 'center' }}>
        <div className="container">
          <h2 className="section-title">Be Part of the Journey</h2>
          <p className="section-desc" style={{ margin: '0 auto 36px' }}>Activate your node today and grow with the protocol from the ground up.</p>
          <Link to="/join" className="btn-primary" style={{ fontSize: 16, padding: '16px 44px' }}>Join Now ⚡</Link>
        </div>
      </section>
    </main>
  )
}
