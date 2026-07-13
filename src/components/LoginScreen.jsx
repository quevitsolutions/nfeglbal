import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import {
  Shield, ExternalLink, Copy, Check, ChevronDown, ChevronUp,
  Users, Zap, TrendingUp, ArrowRight, Gift, Globe, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import EbookModal from './EbookModal.jsx';

// ── COUNTDOWN TIMER TO JULY 19, 2026 ──────────────────────────────────────
const FREE_DEADLINE = new Date('2026-07-19T00:00:00Z').getTime();

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());

  function getTimeLeft() {
    const diff = FREE_DEADLINE - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      expired: false
    };
  }

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (timeLeft.expired) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '18px', fontWeight: 900, color: '#FF4444' }}>⏰ PRE-LAUNCH REGISTRATION WINDOW HAS CLOSED</div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>Registration now costs $0.70 in BNB</div>
      </div>
    );
  }

  return (
    <div className="countdown-container">
      {[
        { val: timeLeft.days, label: 'DAYS' },
        { val: timeLeft.hours, label: 'HOURS' },
        { val: timeLeft.minutes, label: 'MINS' },
        { val: timeLeft.seconds, label: 'SECS' }
      ].map((item, i) => (
        <div className="countdown-unit" key={i}>
          <div className="countdown-value">{String(item.val).padStart(2, '0')}</div>
          <div className="countdown-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── SOCIAL PROOF TICKER ───────────────────────────────────────────────────
function SocialProofTicker({ stats }) {
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/activity/recent');
        const data = await res.json();
        if (data.activity?.length > 0) {
          setActivity(data.activity);
        }
      } catch (e) {
        // Use synthetic activity as fallback
      }
    };
    fetchActivity();
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  // Generate display items (real or synthetic)
  const tickerItems = useMemo(() => {
    if (activity.length > 0) {
      return activity.map((a, i) => ({
        text: `${a.wallet} just registered`,
        time: a.timeAgo,
        key: i
      }));
    }
    // Synthetic items to show while loading
    return [
      { text: '0x7c3...f2e1 just registered', time: '2 min ago', key: 's1' },
      { text: '0xa4b...8d3c registered via referral', time: '5 min ago', key: 's2' },
      { text: '0x1f9...e7a2 secured position #847', time: '8 min ago', key: 's3' },
      { text: '0xd2c...4b9f joined the network', time: '12 min ago', key: 's4' },
      { text: '0x8e5...a1c3 registered', time: '15 min ago', key: 's5' },
      { text: '0x3b7...d6f8 locked matrix position', time: '18 min ago', key: 's6' },
    ];
  }, [activity]);

  // Double the items for seamless infinite scroll
  const doubled = [...tickerItems, ...tickerItems];

  return (
    <div className="ticker-strip">
      <div className="ticker-track">
        {doubled.map((item, i) => (
          <div className="ticker-item" key={i}>
            <span className="ticker-dot" />
            <span>{item.text}</span>
            <span style={{ color: 'rgba(255,200,50,0.6)', fontSize: '10px' }}>• {item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── LIVE STATS BAR ────────────────────────────────────────────────────────
function LiveStatsBar({ stats }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '12px',
      maxWidth: '600px',
      margin: '0 auto 32px',
      padding: '0 16px'
    }}>
      <div className="stat-card-viral">
        <div className="stat-value">{stats.totalNodes.toLocaleString()}</div>
        <div className="stat-label">Total Nodes</div>
      </div>
      <div className="stat-card-viral">
        <div className="stat-value">{stats.registrations24h.toLocaleString()}</div>
        <div className="stat-label">New Today</div>
      </div>
      <div className="stat-card-viral">
        <div className="stat-value">${stats.bnbPrice.toFixed(0)}</div>
        <div className="stat-label">BNB Price</div>
      </div>
    </div>
  );
}

// ── FAQ ACCORDION ─────────────────────────────────────────────────────────
function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState(null);

  const faqs = [
    {
      q: "Why is registration open right now?",
      a: "We're in a 30-day pre-launch team building phase. During this period, registration costs $0 so you can secure your position in the global matrix and start building your team — completely with zero risk. After July 19th, registration will be $0.70 in BNB."
    },
    {
      q: "What do I need to register?",
      a: "Just a crypto wallet (MetaMask or Trust Wallet) with a tiny amount of BNB for gas fees (less than $0.05). That's it — no registration fee during the pre-launch period."
    },
    {
      q: "How do I earn BNB?",
      a: "After the pre-launch period, when your referrals upgrade to paid tiers, you earn real BNB rewards through the 18-level deep matrix system. Direct sponsor rewards, layer rewards, and matrix matching rewards — all paid instantly on-chain."
    },
    {
      q: "What happens after the pre-launch period ends?",
      a: "New users will need to pay $0.70 in BNB to register. Your early position is locked permanently — the earlier you join, the more network depth you build before the paid launch activates full earnings."
    },
    {
      q: "Is this safe? Can I verify the smart contracts?",
      a: "100% transparent. All smart contracts are verified and open-source on BscScan. Every transaction is recorded on the Binance Smart Chain. No middleman, no hidden fees, no centralized control."
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {faqs.map((faq, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={idx}
            style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,200,50,0.08)',
              borderRadius: '14px',
              overflow: 'hidden',
              transition: 'all 0.3s ease'
            }}
          >
            <button
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '16px 20px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#FFF',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 900, color: isOpen ? '#FFC72C' : '#FFF', letterSpacing: '0.3px' }}>{faq.q}</span>
              {isOpen ? <ChevronUp size={16} color="#FFC72C" /> : <ChevronDown size={16} color="rgba(255,255,255,0.4)" />}
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div style={{
                    padding: '0 20px 16px',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.6)',
                    lineHeight: 1.6,
                    borderTop: '1px solid rgba(255,200,50,0.05)'
                  }}>
                    {faq.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ── CONTRACTS TRUST SECTION ───────────────────────────────────────────────
const CONTRACTS = [
  { name: 'AIPCore Core Engine', address: '0xE82239361FBE54731CFF90D8c2036a33743fFd4d', icon: '⚙️' },
  { name: 'Reward Pool', address: '0x1705D309122269BF1265761725424123a4672846', icon: '🏆' },
  { name: 'Governance', address: '0x0E5205B42dAA21fc4E1B6f10ae937f9974287555', icon: '⚖️' },
  { name: 'Vesting Vault', address: '0x9e1655eA63A9A10314B55A3c01bf2e23F28e52D8', icon: '💎' },
];

function ContractsTrust() {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (address, id) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    toast.success('Address copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="contracts-trust-grid">
      {CONTRACTS.map((c, i) => (
        <div key={i} style={{
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,200,50,0.08)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{c.icon}</span>
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#FFF' }}>{c.name}</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '10px',
            padding: '8px 12px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#FFC72C', fontWeight: 700 }}>
              {c.address.slice(0, 8)}...{c.address.slice(-6)}
            </span>
            <button
              onClick={() => handleCopy(c.address, i)}
              style={{ background: 'transparent', border: 'none', color: copiedId === i ? '#A3FF12' : 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex' }}
            >
              {copiedId === i ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <a
            href={`https://bscscan.com/address/${c.address}#code`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontSize: '10px', fontWeight: 800, color: '#FFC72C', textDecoration: 'none',
              background: 'rgba(255,200,50,0.05)', border: '1px solid rgba(255,200,50,0.15)',
              borderRadius: '10px', padding: '8px 12px', transition: 'all 0.2s'
            }}
          >
            <span>VIEW ON BSCSCAN</span>
            <ExternalLink size={10} />
          </a>
        </div>
      ))}
    </div>
  );
}

// ── FLOATING PARTICLES BACKGROUND ─────────────────────────────────────────
function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 15}s`,
      duration: `${10 + Math.random() * 20}s`,
      size: `${2 + Math.random() * 3}px`,
      key: i
    })), []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {particles.map(p => (
        <div
          key={p.key}
          className="particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration
          }}
        />
      ))}
    </div>
  );
}

// ── SHARE / VIRAL SECTION ─────────────────────────────────────────────────
function ViralShareSection() {
  const [copied, setCopied] = useState(false);

  // Get referral URL from current page (uses URL params if present)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://aipcore.com';
  const shareUrl = `${baseUrl}?ref=1`; // Default ref=1 (master node) for non-connected visitors
  const shareText = `🚀 AIPCore registration is open for the next 30 days! Secure your position in the global matrix network before it costs $0.70. Join now 👇\n${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied! Share with friends.');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '12px',
      maxWidth: '500px',
      margin: '0 auto',
      padding: '0 16px'
    }}>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noreferrer"
        className="share-btn share-whatsapp"
      >
        💬 WhatsApp
      </a>
      <a
        href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noreferrer"
        className="share-btn share-telegram"
      >
        ✈️ Telegram
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noreferrer"
        className="share-btn share-twitter"
      >
        🐦 Twitter / X
      </a>
      <button onClick={handleCopy} className="share-btn share-copy">
        {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
      </button>
    </div>
  );
}

// ── INCOME POTENTIAL CALCULATOR ──────────────────────────────────────────
function IncomePotentialWidget() {
  const [referrals, setReferrals] = useState(5);

  // Simplified calculation based on tier structure
  // Each direct referral at Tier 1 ($5) = ~$2.50 sponsor reward
  // Matrix depth multiplies earnings
  const directEarnings = referrals * 2.5;
  const matrixEarnings = referrals * referrals * 0.5; // network effect
  const totalPotential = directEarnings + matrixEarnings;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,200,50,0.04) 0%, rgba(0,0,0,0.3) 100%)',
      border: '1px solid rgba(255,200,50,0.12)',
      borderRadius: '20px',
      padding: '28px 24px',
      maxWidth: '500px',
      margin: '0 auto',
      width: '100%'
    }}>
      <div style={{ fontSize: '10px', fontWeight: 900, color: '#FFC72C', letterSpacing: '2px', marginBottom: '20px', textAlign: 'center' }}>
        💰 EARNING POTENTIAL CALCULATOR
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>How many friends will you invite?</span>
          <span style={{ fontSize: '16px', fontWeight: 950, color: '#FFC72C' }}>{referrals}</span>
        </div>
        <input
          type="range"
          min="1"
          max="50"
          value={referrals}
          onChange={(e) => setReferrals(parseInt(e.target.value))}
          style={{
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            background: 'rgba(255,255,255,0.1)',
            outline: 'none',
            appearance: 'none',
            cursor: 'pointer'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
          <span>1 friend</span>
          <span>50 friends</span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        marginTop: '16px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 950, color: '#A3FF12' }}>${directEarnings.toFixed(1)}</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>DIRECT</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 950, color: '#4FC3F7' }}>${matrixEarnings.toFixed(1)}</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>MATRIX</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: 950, color: '#FFC72C' }}>${totalPotential.toFixed(1)}</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>TOTAL</div>
        </div>
      </div>

      <div style={{
        marginTop: '16px',
        fontSize: '9px',
        color: 'rgba(255,255,255,0.3)',
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        *Estimates based on Tier 1 activations. Actual earnings depend on network activity.
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  MAIN LANDING SCREEN — VIRAL FREE REGISTRATION
// ══════════════════════════════════════════════════════════════════════════
export default function LoginScreen({ onConnect }) {
  const { connect } = useConnect();
  const hasInjectedProvider = typeof window !== 'undefined' && !!window.ethereum;
  const [showEbookModal, setShowEbookModal] = useState(false);

  // Live stats from backend
  const [stats, setStats] = useState({
    totalNodes: 0,
    registrations24h: 0,
    totalBnbDistributed: 0,
    bnbPrice: 600
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats/live');
        const data = await res.json();
        setStats(prev => ({
          totalNodes: data.totalNodes || prev.totalNodes,
          registrations24h: data.registrations24h || prev.registrations24h,
          totalBnbDistributed: data.totalBnbDistributed || prev.totalBnbDistributed,
          bnbPrice: data.bnbPrice || prev.bnbPrice
        }));
      } catch (e) { /* API not available, use defaults */ }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Wallet connect handler
  const handleConnectAction = () => {
    try { localStorage.removeItem('aipcore_disconnected'); } catch(e) {}
    if (hasInjectedProvider) connect({ connector: injected() });
    else onConnect();
  };

  return (
    <div className="landing-container" style={{
      height: '100%',
      width: '100%',
      background: '#020305',
      color: '#FFF',
      fontFamily: 'Outfit, sans-serif',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch'
    }}>
      {/* Floating particles background */}
      <FloatingParticles />

      {/* Background gradient */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,200,50,0.06) 0%, transparent 60%)'
      }} />

      {/* ═══ STICKY HEADER ═══ */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(2,3,5,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,200,50,0.08)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #FFC72C, #FFB800)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 950, color: '#000'
          }}>A</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 950, letterSpacing: '0.5px' }}>AIPCORE</div>
            <div style={{ fontSize: '8px', fontWeight: 800, color: '#FFC72C', letterSpacing: '2px' }}>PRE-LAUNCH</div>
          </div>
        </div>
        <button
          onClick={handleConnectAction}
          style={{
            background: 'linear-gradient(135deg, #FFC72C, #FFB800)',
            border: 'none', borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '11px', fontWeight: 900,
            color: '#000', cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif',
            letterSpacing: '0.5px'
          }}
        >
          CONNECT WALLET
        </button>
      </header>

      {/* ═══ URGENCY BANNER ═══ */}
      <div style={{ padding: '12px 16px', zIndex: 5, position: 'relative' }}>
        <div className="urgency-banner">
          <div style={{ fontSize: '12px', fontWeight: 900, color: '#FF6B35' }}>
            🔥 PRE-LAUNCH: REGISTRATION WINDOW CLOSING SOON
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
            After July 19th, new registrations will cost $0.70 in BNB
          </div>
        </div>
      </div>

      {/* ═══ HERO SECTION ═══ */}
      <section className="landing-section" style={{ textAlign: 'center', paddingTop: '40px', position: 'relative', zIndex: 5 }}>
        {/* LIVE badge */}
        <div style={{ marginBottom: '20px' }}>
          <span className="live-badge">
            <span className="live-dot" />
            LIVE ON BSC MAINNET
          </span>
        </div>

        {/* Main headline */}
        <h1 style={{
          fontSize: 'clamp(28px, 6vw, 56px)',
          fontWeight: 950,
          lineHeight: 1.1,
          marginBottom: '16px',
          letterSpacing: '-0.5px'
        }}>
          SECURE YOUR <br />
          <span style={{
            background: 'linear-gradient(135deg, #FFC72C 0%, #FFD700 50%, #FF8C00 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            MATRIX POSITION
          </span>
          <br />
          <span style={{ fontSize: 'clamp(18px, 3.5vw, 32px)', color: 'rgba(255,255,255,0.7)' }}>
            IN THE GLOBAL NETWORK
          </span>
        </h1>

        <p style={{
          fontSize: '14px',
          color: 'rgba(255,255,255,0.5)',
          maxWidth: '520px',
          margin: '0 auto 32px',
          lineHeight: 1.6
        }}>
          For the next <strong style={{ color: '#FFC72C' }}>30 days only</strong>, registration is completely open.
          Lock your matrix position now — after July 19th, it costs $0.70.
        </p>

        {/* Countdown Timer */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '3px', marginBottom: '12px' }}>
            PRE-LAUNCH WINDOW ENDS IN
          </div>
          <CountdownTimer />
        </div>

        {/* CTA Button and eBook Button */}
        <div style={{ marginTop: '32px', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleConnectAction} className="cta-register-free">
            <Zap size={20} />
            REGISTER NOW
            <ArrowRight size={18} />
          </button>
          
          <button
            onClick={() => setShowEbookModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: 800,
              color: '#FFF',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'Outfit, sans-serif',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
          >
            📖 Read Strategy eBook
          </button>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px' }}>
          Only BNB gas fee required (~$0.03) • No registration fee during pre-launch
        </div>

        {/* Live Stats */}
        <LiveStatsBar stats={stats} />
      </section>

      {/* ═══ SOCIAL PROOF TICKER ═══ */}
      <SocialProofTicker stats={stats} />

      {/* ═══ HOW IT WORKS — 3 STEPS ═══ */}
      <section className="landing-section" style={{ position: 'relative', zIndex: 5 }}>
        <div className="landing-section-title">
          HOW IT <span style={{ color: '#FFC72C' }}>WORKS</span>
        </div>
        <div className="landing-section-sub">
          Three simple steps to secure your position and start building your team
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          <div className="step-card">
            <div className="step-number">1</div>
            <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '8px' }}>Connect Wallet</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Connect your MetaMask or Trust Wallet to the Binance Smart Chain network. Takes 10 seconds.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '8px' }}>Register Node</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Create your node for <strong style={{ color: '#A3FF12' }}>$0 during pre-launch</strong>. Only a tiny gas fee (~$0.03 in BNB) is needed.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h3 style={{ fontSize: '15px', fontWeight: 900, marginBottom: '8px' }}>Share & Build Team</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Share your referral link. Every friend who joins locks into your network — earn BNB when they activate.
            </p>
          </div>
        </div>

        {/* CTA after steps */}
        <div style={{ textAlign: 'center', marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleConnectAction} className="cta-register-free" style={{ fontSize: '14px', padding: '16px 40px' }}>
            GET STARTED — SECURE POSITION
          </button>
          
          <button
            onClick={() => setShowEbookModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 24px',
              fontSize: '12px',
              fontWeight: 800,
              color: '#FFF',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'Outfit, sans-serif',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
          >
            📖 Read Strategy eBook
          </button>
        </div>
      </section>

      {/* ═══ WHY REGISTER NOW ═══ */}
      <section className="landing-section" style={{ position: 'relative', zIndex: 5 }}>
        <div className="landing-section-title">
          WHY REGISTER <span style={{ color: '#FFC72C' }}>NOW?</span>
        </div>
        <div className="landing-section-sub">
          Early birds get the biggest advantage in network marketing
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
          {[
            { icon: <Gift size={24} />, title: 'Secure Spot Immediately', desc: 'Secure your registration during pre-launch. After July 19th it\'s $0.70.', color: '#A3FF12' },
            { icon: <Users size={24} />, title: 'Lock Your Position', desc: 'Your spot in the 18-level matrix is permanent. Earlier position = more depth below you.', color: '#4FC3F7' },
            { icon: <TrendingUp size={24} />, title: 'Build Team Before Launch', desc: 'Use the pre-launch window to recruit. When paid tiers activate, your entire team generates earnings.', color: '#FFC72C' },
            { icon: <Lock size={24} />, title: '100% On-Chain', desc: 'Every transaction on verified BSC smart contracts. No middleman, no hidden fees.', color: '#FF6B6B' },
          ].map((item, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -4 }}
              style={{
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,200,50,0.08)',
                borderRadius: '18px',
                padding: '24px 20px',
                textAlign: 'center',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ color: item.color, marginBottom: '12px' }}>{item.icon}</div>
              <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '8px' }}>{item.title}</h3>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ INCOME CALCULATOR ═══ */}
      <section className="landing-section" style={{ position: 'relative', zIndex: 5 }}>
        <div className="landing-section-title">
          EARNING <span style={{ color: '#FFC72C' }}>POTENTIAL</span>
        </div>
        <div className="landing-section-sub">
          See how much you could earn by inviting friends to the network
        </div>
        <IncomePotentialWidget />
      </section>

      {/* ═══ VIRAL SHARE SECTION ═══ */}
      <section className="landing-section" style={{ position: 'relative', zIndex: 5 }}>
        <div className="landing-section-title">
          SPREAD THE <span style={{ color: '#FFC72C' }}>WORD</span>
        </div>
        <div className="landing-section-sub">
          Share the registration link with your network before the deadline
        </div>
        <ViralShareSection />
      </section>

      {/* ═══ TRUST & CONTRACTS ═══ */}
      <section className="landing-section" style={{ position: 'relative', zIndex: 5 }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,200,50,0.05)', border: '1px solid rgba(255,200,50,0.15)', borderRadius: '30px', padding: '4px 12px', marginBottom: '16px' }}>
            <Shield size={12} color="#FFC72C" />
            <span style={{ fontSize: '9px', fontWeight: 900, color: '#FFC72C', letterSpacing: '1px' }}>VERIFIED & AUDITABLE</span>
          </div>
          <div className="landing-section-title" style={{ marginBottom: '8px' }}>
            SMART <span style={{ color: '#FFC72C' }}>CONTRACTS</span>
          </div>
          <div className="landing-section-sub">
            All operations happen on verified, open-source BSC smart contracts
          </div>
        </div>
        <ContractsTrust />
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="landing-section" style={{ position: 'relative', zIndex: 5 }}>
        <div className="landing-section-title">
          FREQUENTLY <span style={{ color: '#FFC72C' }}>ASKED</span>
        </div>
        <div className="landing-section-sub">
          Everything you need to know about the pre-launch registration
        </div>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <FaqAccordion />
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="landing-section" style={{ textAlign: 'center', position: 'relative', zIndex: 5, paddingBottom: '80px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,200,50,0.06) 0%, rgba(0,0,0,0.4) 100%)',
          border: '1px solid rgba(255,200,50,0.15)',
          borderRadius: '24px',
          padding: '48px 24px',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚀</div>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 950, marginBottom: '12px' }}>
            DON'T MISS THE <span style={{ color: '#FFC72C' }}>PRE-LAUNCH WINDOW</span>
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px', lineHeight: 1.6 }}>
            Registration is open right now. After the pre-launch period, it costs $0.70.
            Secure your position in the global matrix network today.
          </p>
          <CountdownTimer />
          <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleConnectAction} className="cta-register-free">
              <Zap size={20} />
              REGISTER NOW
            </button>
            <button
              onClick={() => setShowEbookModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 28px',
                fontSize: '13px',
                fontWeight: 800,
                color: '#FFF',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Outfit, sans-serif',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
            >
              📖 Read Strategy eBook
            </button>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '12px' }}>
            Requires MetaMask or Trust Wallet • BNB Smart Chain
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        borderTop: '1px solid rgba(255,200,50,0.06)',
        padding: '24px 20px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 5
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #FFC72C, #FFB800)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 950, color: '#000' }}>A</div>
          <span style={{ fontSize: '13px', fontWeight: 900 }}>AIPCORE</span>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
          Powered by Binance Smart Chain • All rights reserved © 2026
        </div>
      </footer>

      {/* Strategy eBook Modal */}
      <EbookModal isOpen={showEbookModal} onClose={() => setShowEbookModal(false)} />
    </div>
  );
}
