import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { GlowCard, SectionHeader } from '../components/UI.jsx'

const FEATURES = [
  {
    icon: '⬡', color: '#CBFF01',
    title: 'Mining Node Activation',
    badge: 'CORE FEATURE',
    desc: 'Activate your decentralized mining node with a single BNB transaction on BSC. Your node starts generating $NFEGLOBAL tokens immediately at 100 coins/hour, upgrading to 200/hr on Tier 2.',
    points: ['100–200 🪙/hr mining rate', 'Offline passive generation', '18 upgrade tiers', 'Instant activation'],
  },
  {
    icon: '💰', color: '#FF9F43',
    title: 'Sponsor / Referral Income',
    badge: '10% — LIFETIME',
    desc: 'Earn 10% of every BNB paid by your direct referrals — at registration AND every time they upgrade any of their 18 tiers. One referral = a lifetime income stream.',
    points: ['10% on registration', '10% on all 18 upgrades', 'Instant smart-contract payout', 'No cap on referrals'],
  },
  {
    icon: '🔷', color: '#4FFFFF',
    title: 'Binary Matrix Income',
    badge: '70% — LARGEST POOL',
    desc: '70% of every registration and upgrade flows through the binary matrix to eligible upline nodes. The deeper your matrix, the more volume flows — automatically distributed by the smart contract.',
    points: ['70% of all protocol volume', 'Matches qualifying upline tiers', '18 matrix levels deep', 'Zero manual claims needed'],
  },
  {
    icon: '⬡', color: '#FF6BFF',
    title: 'Level / Tier Income',
    badge: '~15% — TIER UNLOCKS',
    desc: 'Approximately 15% of all network volume is distributed as level income when qualified uplines match the tier being unlocked. Upgrading yourself earns more from deeper network upgrades.',
    points: ['~15% of all volume', 'Triggered on tier events', 'Rewards tier progression', 'Stacks with matrix income'],
  },
  {
    icon: '🏊', color: '#FF9F43',
    title: 'Global Reward Pool',
    badge: '5% — PROTOCOL SHARE',
    desc: '5% of all protocol volume flows into the Global Reward Pool. Qualified nodes meeting team size, tier, and direct count requirements earn an automatic share distributed on-chain.',
    points: ['5% of total volume', 'Qualification-based access', 'Auto smart-contract payout', 'Claim any time on-chain'],
  },
  {
    icon: '🤝', color: '#4FC3F7',
    title: 'AI Host & Virtual Events',
    badge: 'ECOSYSTEM',
    desc: 'Participate in AI-hosted virtual summits, networking halls, and community events inside the NFEGlobal Core Metaverse — exclusive to active node holders.',
    points: ['AI avatar interaction', 'Live virtual halls', 'Community summits', 'Exclusive node-holder access'],
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Connect Your Wallet', desc: 'Connect MetaMask or any WalletConnect-compatible BSC wallet to the app.', color: '#CBFF01' },
  { step: '02', title: 'Activate Mining Node', desc: 'Pay the one-time BNB activation fee to the audited smart contract.', color: '#4FFFFF' },
  { step: '03', title: 'Mine $NFEGLOBAL 24/7', desc: 'Your node auto-mines $NFEGLOBAL tokens every hour — online or offline.', color: '#FF6BFF' },
  { step: '04', title: 'Earn BNB Passively', desc: 'All 4 income streams run automatically. Withdraw anytime on-chain.', color: '#FF9F43' },
]

export default function FeaturesPage() {
  return (
    <main style={{ paddingTop: 104 }}>

      {/* Hero */}
      <section className="section" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: '50%', background: 'radial-gradient(ellipse, rgba(203,255,1,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="section-label">◈ PROTOCOL FEATURES</div>
            <h1 className="section-title">Everything You Need to<br /><span className="text-lime">Earn in Web3</span></h1>
            <p className="section-desc" style={{ margin: '0 auto 40px' }}>
              NFEGlobal Core combines AI-powered community tools with a bulletproof DeFi income engine — all on BNB Smart Chain.
            </p>
            <Link to="/join" className="btn-primary" style={{ fontSize: 15 }}>
              Activate Your Node ⚡
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="grid-3" style={{ gap: 24 }}>
            {FEATURES.map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}>
                <GlowCard color={f.color} style={{ height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                      background: `${f.color}12`, border: `1px solid ${f.color}35`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>{f.icon}</div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 900, color: f.color, letterSpacing: 2, marginBottom: 4 }}>{f.badge}</div>
                      <h3 style={{ fontSize: 16, fontWeight: 800 }}>{f.title}</h3>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, fontWeight: 500, marginBottom: 16 }}>{f.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {f.points.map((pt, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                        <span style={{ color: f.color, fontSize: 14 }}>✓</span> {pt}
                      </div>
                    ))}
                  </div>
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section" style={{ background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <SectionHeader label="HOW IT WORKS" title="Up & Running in Minutes" desc="Four simple steps to activate all income streams on the NFEGlobal Core protocol." center />
          <div className="grid-4">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                <div style={{ textAlign: 'center', padding: '8px' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 18, margin: '0 auto 20px',
                    background: `${step.color}12`, border: `2px solid ${step.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 900, color: step.color,
                  }}>{step.step}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>{step.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, fontWeight: 500 }}>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 className="section-title">Ready to Start?</h2>
          <p className="section-desc" style={{ margin: '0 auto 36px' }}>All features activate the moment your node is live on-chain.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/join" className="btn-primary" style={{ fontSize: 16, padding: '16px 40px' }}>Activate Now ⚡</Link>
            <Link to="/earnings" className="btn-outline">View Earnings <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>
    </main>
  )
}
