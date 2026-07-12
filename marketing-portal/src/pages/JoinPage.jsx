import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExternalLink, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { ParticleField } from '../components/UI.jsx'

const APP_URL = import.meta.env.VITE_APP_URL || 'https://aipcore.online'

const STEPS = [
  { step: '01', icon: '🔗', title: 'Get Your Referral Link', desc: 'Your unique link is generated when you activate your node. Share it to earn 10% from every referral.' },
  { step: '02', icon: '💼', title: 'Activate a Node on BSC', desc: 'Connect your BSC wallet, pay the one-time activation fee and your node goes live instantly.' },
  { step: '03', icon: '⛏️', title: 'Start Mining $AIPCORE', desc: 'Your node auto-mines $AIPCORE tokens every hour — 100 coins/hr at Tier 1, scaling to 200+/hr.' },
  { step: '04', icon: '💰', title: 'Earn BNB Passively', desc: 'All 4 income streams run on autopilot. Referrals, matrix, level and global pool — all on-chain.' },
]

const FAQS = [
  { q: 'How much does node activation cost?', a: 'The minimum activation cost starts at ~0.05 BNB for Tier 1. This is a one-time payment directly to the audited smart contract.' },
  { q: 'Is there a referral code I need?', a: 'Yes — use your sponsor\'s referral link when you join. If you reached this page via a referral link, their Node ID is pre-filled automatically.' },
  { q: 'Which wallet should I use?', a: 'Any BSC-compatible wallet works — MetaMask, Trust Wallet, or any WalletConnect-supported wallet.' },
  { q: 'How do I withdraw my earnings?', a: 'All earnings are on-chain and can be withdrawn directly from the app at any time. No lock-up periods.' },
  { q: 'Is the smart contract audited?', a: 'Yes. The AIPCore Core smart contract is deployed on BSC Mainnet and has been independently audited. Contract address is publicly verifiable on BscScan.' },
  { q: 'Can I have multiple nodes?', a: 'Each wallet address can hold one node. You can use multiple wallets, each with its own separate node.' },
]

export default function JoinPage() {
  const { ref } = useParams()
  const [copied, setCopied] = useState(false)

  // Compute synchronously so the href is never empty on first render
  const referralLink = useMemo(
    () => (ref ? `${APP_URL}?ref=${ref}` : APP_URL),
    [ref]
  )

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success('Referral link copied!')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <main style={{ paddingTop: 104 }}>

      {/* Hero */}
      <section style={{ position: 'relative', paddingTop: 60, paddingBottom: 80, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(203,255,1,0.09) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <ParticleField count={30} />
        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            {ref && (
              <div className="section-label" style={{ marginBottom: 20 }}>
                🔗 REFERRED BY NODE #{ref}
              </div>
            )}
            <h1 className="section-title">
              Activate Your<br />
              <span className="neon-text text-lime">Mining Node</span>
            </h1>
            <p className="section-desc" style={{ margin: '0 auto 36px' }}>
              One activation. Four income streams. 18 levels deep.<br />Passive BNB rewards 24/7 — fully on-chain.
            </p>

            {/* Main CTA */}
            <motion.a
              href={referralLink}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
              style={{ fontSize: 18, padding: '20px 52px', display: 'inline-flex', marginBottom: 16 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              ⚡ Open AIPCore Core App <ExternalLink size={18} />
            </motion.a>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 32 }}>
              Opens on BNB Smart Chain · MetaMask / WalletConnect
            </p>

            {/* Referral link copy box */}
            {ref && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                style={{ maxWidth: 520, margin: '0 auto' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1.5, marginBottom: 10 }}>
                  YOUR REFERRAL LINK (SHARE THIS)
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(203,255,1,0.05)', border: '1px solid rgba(203,255,1,0.25)',
                  borderRadius: 14, padding: '12px 16px',
                }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {referralLink}
                  </span>
                  <button onClick={handleCopy} style={{
                    flexShrink: 0, background: 'rgba(203,255,1,0.12)', border: '1px solid rgba(203,255,1,0.3)',
                    borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 800, color: 'var(--neon-lime)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                  }}>
                    {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* 4 Steps */}
      <section style={{ paddingBottom: 80 }}>
        <div className="container">
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 36, textAlign: 'center' }}>
            ◈ HOW TO GET STARTED
          </div>
          <div className="grid-4">
            {STEPS.map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                <div style={{ textAlign: 'center', padding: '0 8px' }}>
                  <div style={{
                    width: 68, height: 68, borderRadius: 20, margin: '0 auto 18px',
                    background: 'rgba(203,255,1,0.08)', border: '1px solid rgba(203,255,1,0.25)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 24 }}>{s.icon}</span>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--neon-lime)', letterSpacing: 2, marginBottom: 8 }}>{s.step}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, fontWeight: 500 }}>{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Income Preview */}
      <section style={{ paddingBottom: 80 }}>
        <div className="container">
          <div className="card" style={{ maxWidth: 640, margin: '0 auto', background: 'linear-gradient(135deg, rgba(203,255,1,0.05) 0%, rgba(203,255,1,0.01) 100%)', borderColor: 'rgba(203,255,1,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--neon-lime)', letterSpacing: 2, marginBottom: 20 }}>⚡ INCOME STREAMS AT A GLANCE</div>
            {[
              { icon: '💰', label: 'Sponsor / Referral',  value: '10% BNB',  sub: 'Per referral · lifetime' },
              { icon: '🔷', label: 'Binary Matrix',        value: '70% share', sub: 'All network volume' },
              { icon: '⬡', label: 'Level Income',         value: '~15%',      sub: 'On tier unlock events' },
              { icon: '🏊', label: 'Global Reward Pool',   value: '5%',        sub: 'For qualified nodes' },
            ].map((row, i, arr) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <span style={{ fontSize: 22 }}>{row.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{row.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{row.sub}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--neon-lime)' }}>{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ paddingBottom: 100 }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="section-label">❓ FAQs</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900 }}>Common Questions</h2>
          </div>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQS.map((faq, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
                <div className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, color: '#fff' }}>
                    Q: {faq.q}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, fontWeight: 500 }}>
                    {faq.a}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Final CTA */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ textAlign: 'center', marginTop: 64 }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, marginBottom: 16 }}>
              Still have questions?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 32 }}>
              Join our Telegram community — 12,000+ members ready to help.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="https://t.me/aipcore" target="_blank" rel="noreferrer" className="btn-primary" style={{ fontSize: 15, animation: 'none' }}>
                ✈️ Join Telegram
              </a>
              <a href={referralLink} target="_blank" rel="noreferrer" className="btn-outline" style={{ fontSize: 15 }}>
                Open App <ExternalLink size={14} />
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
