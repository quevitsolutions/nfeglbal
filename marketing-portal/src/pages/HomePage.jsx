import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, ExternalLink, Shield, Zap, Users, TrendingUp } from 'lucide-react'
import { AnimatedCounter, GlowCard, ParticleField } from '../components/UI.jsx'

const STATS = [
  { label: 'Active Miners',    end: 12489, format: v => v.toLocaleString(), suffix: '+' },
  { label: 'Protocol Volume',  end: 2841,  format: v => v.toLocaleString(), suffix: ' BNB' },
  { label: 'Income Streams',   end: 4,     format: v => v, suffix: ' Types' },
  { label: 'Matrix Levels',    end: 18,    format: v => v, suffix: ' Deep' },
]

const HIGHLIGHTS = [
  { icon: <Zap size={22} color="#CBFF01" />, color: '#CBFF01', title: 'Instant Activation', desc: 'One BNB payment on BSC activates your node and starts mining immediately — no waiting.' },
  { icon: <TrendingUp size={22} color="#4FFFFF" />, color: '#4FFFFF', title: '4 Income Streams', desc: 'Earn simultaneously from Sponsor, Binary Matrix, Level Income and Global Pool rewards.' },
  { icon: <Users size={22} color="#FF6BFF" />, color: '#FF6BFF', title: 'Community First', desc: '100% of protocol revenue is distributed back to node operators — zero platform extraction.' },
  { icon: <Shield size={22} color="#FF9F43" />, color: '#FF9F43', title: 'Audited Smart Contract', desc: 'Fully on-chain, transparent and immutable. No admin keys, no rug risk. Code is law.' },
]

const INCOME_BREAKDOWN = [
  { color: '#4FFFFF', label: 'Binary Matrix',    pct: '70%', width: '70%' },
  { color: '#FF6BFF', label: 'Level Income',     pct: '~15%', width: '15%' },
  { color: '#CBFF01', label: 'Sponsor Referral', pct: '10%', width: '10%' },
  { color: '#FF9F43', label: 'Global Pool',      pct: '5%', width: '5%' },
]

export default function HomePage() {
  return (
    <main style={{ paddingTop: 104 }}>

      {/* ═══ HERO ═══ */}
      <section style={{ position: 'relative', minHeight: '92vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        {/* BG glows */}
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '55%', height: '70%', background: 'radial-gradient(ellipse, rgba(203,255,1,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '55%', height: '70%', background: 'radial-gradient(ellipse, rgba(79,255,255,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <ParticleField count={40} />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="grid-2" style={{ gap: 64, alignItems: 'center' }}>
            {/* Left */}
            <div>
              <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="section-label">🌐 AI · WEB3 · COMMUNITY</div>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}
                style={{ fontSize: 'clamp(42px, 5.5vw, 76px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.04em', marginBottom: 24 }}>
                The Future of<br />
                <span className="gradient-text">AI-Powered</span><br />
                Web3 Communities
              </motion.h1>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}
                style={{ fontSize: 18, color: 'var(--text-muted)', lineHeight: 1.7, fontWeight: 500, marginBottom: 36, maxWidth: 460 }}>
                Activate your Mining Node on BSC and earn from 4 simultaneous income streams — 
                Sponsor Referral, Binary Matrix, Level Income & Global Pool. 18 levels deep. 100% on-chain.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <Link to="/join" className="btn-primary" style={{ fontSize: 16, padding: '16px 36px' }}>
                  Activate Node ⚡
                </Link>
                <Link to="/earnings" className="btn-outline" style={{ fontSize: 15 }}>
                  See Earnings <ArrowRight size={16} />
                </Link>
              </motion.div>

              {/* Trust bar */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
                style={{ marginTop: 40, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {['✓ Audited Contract', '✓ BSC Mainnet', '✓ 12,000+ Nodes', '✓ No Admin Keys'].map(t => (
                  <span key={t} style={{ fontSize: 12, color: 'rgba(203,255,1,0.7)', fontWeight: 700 }}>{t}</span>
                ))}
              </motion.div>
            </div>

            {/* Right — hero visual */}
            <motion.div className="hero-diagram" initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.8 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 460 }}>
              {/* Orbiting ring */}
              <div style={{
                position: 'absolute', width: 360, height: 360, borderRadius: '50%',
                border: '1px solid rgba(203,255,1,0.15)',
                animation: 'spin 20s linear infinite',
              }}>
                {[0, 90, 180, 270].map((deg, i) => (
                  <div key={i} style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: 12, height: 12, borderRadius: '50%',
                    background: ['#CBFF01', '#4FFFFF', '#FF6BFF', '#FF9F43'][i],
                    transform: `rotate(${deg}deg) translateX(180px) translateY(-50%)`,
                    boxShadow: `0 0 12px ${ ['#CBFF01', '#4FFFFF', '#FF6BFF', '#FF9F43'][i]}`,
                  }} />
                ))}
              </div>
              {/* Inner ring */}
              <div style={{
                position: 'absolute', width: 240, height: 240, borderRadius: '50%',
                border: '1px dashed rgba(79,255,255,0.2)',
                animation: 'spin 12s linear infinite reverse',
              }} />
              {/* Center orb */}
              <div style={{
                width: 140, height: 140, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, rgba(203,255,1,0.5), rgba(79,255,255,0.3) 50%, rgba(255,107,255,0.1) 100%)',
                boxShadow: '0 0 60px rgba(203,255,1,0.4), 0 0 120px rgba(79,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 52, animation: 'float 4s ease-in-out infinite',
                position: 'relative', zIndex: 2,
              }}>
                ⬡
              </div>
              {/* Stat tags */}
              {[
                { label: '70% Matrix', top: '8%', right: '0%', color: '#4FFFFF' },
                { label: '10% Sponsor', top: '75%', right: '2%', color: '#CBFF01' },
                { label: '18 Levels', top: '42%', left: '-5%', color: '#FF6BFF' },
                { label: '5% Pool', top: '15%', left: '5%', color: '#FF9F43' },
              ].map(tag => (
                <div key={tag.label} style={{
                  position: 'absolute', ...(tag.top ? { top: tag.top } : {}),
                  ...(tag.right ? { right: tag.right } : {}), ...(tag.left ? { left: tag.left } : {}),
                  background: 'rgba(10,14,22,0.9)', border: `1px solid ${tag.color}40`,
                  borderRadius: 40, padding: '6px 14px', fontSize: 12, fontWeight: 900,
                  color: tag.color, backdropFilter: 'blur(8px)',
                }}>
                  {tag.label}
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        <style>{`
          @media (max-width: 860px) {
            .hero-grid { grid-template-columns: 1fr !important; }
            .hero-diagram { transform: scale(0.7); transform-origin: left center; }
          }
          @media (max-width: 480px) {
            .hero-diagram { transform: scale(0.6); transform-origin: center center; margin: 0 auto; }
          }
        `}</style>
      </section>

      {/* ═══ LIVE STATS ═══ */}
      <section style={{ padding: '0 0 80px', position: 'relative' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2, borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {STATS.map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                style={{ padding: '36px 24px', textAlign: 'center', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <div style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 900, color: 'var(--neon-lime)', lineHeight: 1, marginBottom: 8 }}>
                  <AnimatedCounter end={s.end} format={s.format} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HIGHLIGHTS ═══ */}
      <section className="section">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 60 }}>
            <div className="section-label">◈ WHY NFEGlobal CORE</div>
            <h2 className="section-title">Built Different,<br />Built for <span className="text-lime">You</span></h2>
            <p className="section-desc" style={{ margin: '0 auto' }}>
              A protocol designed from the ground up to maximize community earnings 
              while maintaining full on-chain transparency.
            </p>
          </motion.div>

          <div className="grid-2" style={{ gap: 20 }}>
            {HIGHLIGHTS.map((h, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5 }}>
                <GlowCard color={h.color} style={{ height: '100%' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14, marginBottom: 20,
                    background: `${h.color}12`, border: `1px solid ${h.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 20px ${h.color}15`,
                  }}>
                    {h.icon}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{h.title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, fontWeight: 500 }}>{h.desc}</p>
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DISTRIBUTION BAR ═══ */}
      <section className="section" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div className="grid-2" style={{ gap: 64, alignItems: 'center' }}>
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="section-label">◈ 100% DISTRIBUTED</div>
              <h2 className="section-title" style={{ fontSize: 'clamp(30px, 4vw, 52px)' }}>
                Every BNB Goes<br />Back to the <span className="text-lime">Community</span>
              </h2>
              <p className="section-desc">
                Zero platform fees. 100% of all protocol volume is split across 4 income streams 
                and distributed directly to node operators via smart contract.
              </p>
              <Link to="/earnings" className="btn-primary" style={{ marginTop: 32, display: 'inline-flex', animation: 'none' }}>
                See Full Breakdown <ArrowRight size={16} />
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 20 }}>
                  REVENUE DISTRIBUTION
                </div>
                {/* Stacked bar */}
                <div style={{ display: 'flex', height: 16, borderRadius: 10, overflow: 'hidden', gap: 3, marginBottom: 28 }}>
                  {INCOME_BREAKDOWN.map((b, i) => (
                    <motion.div key={i}
                      initial={{ width: 0 }} whileInView={{ width: b.width }}
                      viewport={{ once: true }} transition={{ delay: i * 0.15, duration: 0.8 }}
                      style={{ background: b.color, borderRadius: i === 0 ? '10px 0 0 10px' : i === 3 ? '0 10px 10px 0' : 0, minWidth: 4 }} />
                  ))}
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {INCOME_BREAKDOWN.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 4, background: b.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{b.label}</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: b.color }}>{b.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ CTA BANNER ═══ */}
      <section className="section">
        <div className="container">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
            style={{
              position: 'relative', overflow: 'hidden', borderRadius: 28,
              background: 'linear-gradient(135deg, rgba(203,255,1,0.08) 0%, rgba(79,255,255,0.04) 50%, rgba(255,107,255,0.06) 100%)',
              border: '1px solid rgba(203,255,1,0.2)',
              padding: '64px 48px', textAlign: 'center',
            }}>
            <ParticleField count={20} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--neon-lime)', letterSpacing: 3, marginBottom: 16 }}>
                🚀 JOIN THE MOVEMENT
              </div>
              <h2 style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 20 }}>
                Ready to Activate<br />Your Mining Node?
              </h2>
              <p style={{ fontSize: 17, color: 'var(--text-muted)', maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.7 }}>
                One activation unlocks all 4 income streams. Start earning passive BNB and mining $NFEGLOBAL tokens 24/7.
              </p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/join" className="btn-primary" style={{ fontSize: 16, padding: '18px 44px' }}>
                  Get Started Now ⚡
                </Link>
                <a href="https://nfeglobal.online" target="_blank" rel="noreferrer" className="btn-outline" style={{ fontSize: 15 }}>
                  Open App <ExternalLink size={15} />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

    </main>
  )
}
