import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Users, Target, TrendingUp, Share2, Gift, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';
import { shareOnTelegram, triggerHaptic } from '../utils/telegram.js';
import { useContract } from '../hooks/useContract.js';
import toast from 'react-hot-toast';
import EbookModal from '../components/EbookModal.jsx';
import IncomeCalcMini from '../components/IncomeCalcMini.jsx';

// ── READY-MADE PROMOTION TEMPLATES ──────────────────────────────────────────
const PROMO_TEMPLATES = [
  {
    id: 'urgency',
    label: '🔥 Urgency',
    emoji: '🔥',
    text: (link) => `🔥 AIPCore is offering $0 registration for a LIMITED time only!\n\n✅ $0 registration (normally $0.70)\n✅ Secure your position in the 18-level deep matrix\n✅ Build your team before the paid launch\n\n⏰ Pre-launch period ends July 19th!\n\n👉 Register now: ${link}`,
  },
  {
    id: 'opportunity',
    label: '💰 Opportunity',
    emoji: '💰',
    text: (link) => `💰 Imagine earning BNB passively from an 18-level matrix system...\n\nAIPCore is in PRE-LAUNCH and registration costs $0 right now!\n\n🔐 100% on-chain smart contracts\n📊 Verified on BscScan\n💎 Position locks permanently\n\nDon't miss this window 👇\n${link}`,
  },
  {
    id: 'simple',
    label: '⚡ Quick',
    emoji: '⚡',
    text: (link) => `⚡ BSC crypto opportunity!\n\nAIPCore — register for $0, build your team, earn BNB.\n\nNo investment needed. Just connect wallet + tiny gas fee.\n\nJoin now: ${link}`,
  },
  {
    id: 'team',
    label: '👥 Team',
    emoji: '👥',
    text: (link) => `👥 I'm building my AIPCore team and need YOU!\n\n🆓 Registration is open during pre-launch\n🏆 18-level deep earning matrix\n💎 Lock your position now — it's permanent\n🔥 Only until July 19th!\n\nJoin my team 👇\n${link}`,
  },
  {
    id: 'fomo',
    label: '⏰ FOMO',
    emoji: '⏰',
    text: (link) => `⏰ LAST CHANCE — AIPCore pre-launch registration closing soon!\n\nAfter July 19th, registration costs $0.70 in BNB.\n\nRight now it's $0. Zero. Open.\n\nEvery day you wait = positions filled above you.\n\nSecure yours NOW 👇\n${link}`,
  }
];

// ── COUNTDOWN COMPONENT ─────────────────────────────────────────────────────
const FREE_DEADLINE = new Date('2026-07-19T00:00:00Z').getTime();

function MiniCountdown() {
  const [timeLeft, setTimeLeft] = useState(calc());
  function calc() {
    const diff = FREE_DEADLINE - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, mins: 0, expired: true };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff / 3600000) % 24),
      mins: Math.floor((diff / 60000) % 60),
      expired: false
    };
  }
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(calc()), 60000);
    return () => clearInterval(t);
  }, []);

  if (timeLeft.expired) return <span style={{ color: '#FF5252', fontWeight: 900 }}>FREE PERIOD ENDED</span>;
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      {[
        { val: timeLeft.days, lbl: 'DAYS' },
        { val: timeLeft.hours, lbl: 'HRS' },
        { val: timeLeft.mins, lbl: 'MIN' }
      ].map((u, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '20px', fontWeight: 950, color: '#FFC72C',
            background: 'rgba(255,200,50,0.06)', border: '1px solid rgba(255,200,50,0.15)',
            borderRadius: '10px', padding: '6px 12px', minWidth: '44px',
            fontVariantNumeric: 'tabular-nums'
          }}>{String(u.val).padStart(2, '0')}</div>
          <div style={{ fontSize: '7px', fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: '1.5px', marginTop: '3px' }}>{u.lbl}</div>
        </div>
      ))}
    </div>
  );
}

const TIER_USD_COSTS = [5, 5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480, 40960, 81920, 163840, 327680];
const LVL_VESTING_DAYS = [5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90];

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PreLaunchScreen() {
  const { walletAddress, nodeId, nodeTier, directRefs, teamSize, globalStats, isConnected } = useGameStore();
  const { fetchTeamCounts, fetchLevelWiseTeamStats } = useContract();

  const [levelStats, setLevelStats] = useState(null);
  const [levelCounts, setLevelCounts] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [activePromo, setActivePromo] = useState('urgency');
  const [copied, setCopied] = useState(false);
  const [copiedPromo, setCopiedPromo] = useState(false);
  const [expandedSection, setExpandedSection] = useState({ stats: true, share: true, promos: false, tracker: true, calculator: false });
  const [showEbookModal, setShowEbookModal] = useState(false);

  const refToken = nodeId || walletAddress;
  const inviteLink = walletAddress ? `${window.location.origin}/?ref=${refToken}` : '';

  // Fetch on-chain level data
  useEffect(() => {
    if (isConnected && nodeId) {
      setLoadingStats(true);
      Promise.all([
        fetchTeamCounts(nodeId).then(setLevelCounts).catch(() => {}),
        fetchLevelWiseTeamStats(nodeId).then(setLevelStats).catch(() => {})
      ]).finally(() => setLoadingStats(false));
    }
  }, [isConnected, nodeId]);

  // Compute free referral stats
  const freeStats = useMemo(() => {
    const levels = [];
    let totalFree = 0;
    let totalPaid = 0;
    for (let i = 0; i < 10; i++) {
      const free = levelStats?.freeUsers?.[i] || 0;
      const paid = levelStats?.paidUsers?.[i] || 0;
      const team = levelStats?.teamSize?.[i] || (levelCounts[i] || 0);
      levels.push({ level: i + 1, free, paid, total: free + paid || team });
      totalFree += free;
      totalPaid += paid;
    }
    return { levels, totalFree, totalPaid, totalTeam: totalFree + totalPaid };
  }, [levelStats, levelCounts]);

  const { totalAccumulatedEarn, totalPerDayEarn } = useMemo(() => {
    let totalAcc = 0;
    let totalPer = 0;
    freeStats.levels.forEach(lv => {
      const total = lv.free + lv.paid;
      const costUsd = TIER_USD_COSTS[lv.level - 1] || 5;
      const earnPer = costUsd * 0.70;
      const accumulatedEarn = total * earnPer;
      const vDays = LVL_VESTING_DAYS[lv.level - 1] || 5;
      const perDayEarn = accumulatedEarn / vDays;
      totalAcc += accumulatedEarn;
      totalPer += perDayEarn;
    });
    return { totalAccumulatedEarn: totalAcc, totalPerDayEarn: totalPer };
  }, [freeStats]);

  const directFreeCount = freeStats.levels[0]?.free || 0;
  const GOAL = 10;
  const progressPct = Math.min(100, (directFreeCount / GOAL) * 100);
  const goalReached = directFreeCount >= GOAL;

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast.success('Referral link copied! 🔗');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyPromo = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedPromo(true);
      toast.success('Promotion text copied! 📋');
      setTimeout(() => setCopiedPromo(false), 2500);
    });
  };

  const selectedPromo = PROMO_TEMPLATES.find(p => p.id === activePromo);
  const promoText = selectedPromo?.text(inviteLink) || '';

  const shareUrl = encodeURIComponent(inviteLink);
  const shareText = encodeURIComponent(promoText);

  const toggleSection = (key) => setExpandedSection(p => ({ ...p, [key]: !p[key] }));

  // ── CARD STYLE ────────────────────────────────────────────────────────────
  const cardStyle = {
    background: 'var(--bg-card)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '16px',
    overflow: 'hidden'
  };

  const cardHeaderStyle = (isOpen) => ({
    padding: '16px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    background: isOpen ? 'rgba(255,200,50,0.03)' : 'transparent',
    transition: 'background 0.2s'
  });

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', paddingBottom: 'calc(var(--tabbar-h, 80px) + 24px)' }}>

      {/* ═══ HERO BANNER ═══ */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,200,50,0.08) 0%, rgba(163,255,18,0.05) 50%, rgba(161,44,255,0.06) 100%)',
        border: '1px solid rgba(255,200,50,0.15)',
        borderRadius: '22px',
        padding: '24px 20px',
        textAlign: 'center',
        marginBottom: '16px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(255,200,50,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.3)', borderRadius: '20px', padding: '3px 10px', fontSize: '9px', fontWeight: 900, color: '#FF4444', letterSpacing: '1px', marginBottom: '12px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FF4444', animation: 'pulse 1.5s ease-in-out infinite' }} /> LIVE PRE-LAUNCH
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 950, color: '#fff', marginBottom: '6px' }}>
            🚀 Build Your Team — Secure Spots
          </h2>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, maxWidth: '340px', margin: '0 auto 16px' }}>
            Invite at least <strong style={{ color: '#FFC72C' }}>10 members</strong> during pre-launch to qualify for enhanced launch rewards. Every referral strengthens your matrix position.
          </p>

          <MiniCountdown />
          
          <button
            onClick={() => setShowEbookModal(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              borderRadius: '12px',
              padding: '10px 20px',
              fontSize: '11px',
              fontWeight: 900,
              marginTop: '20px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              outline: 'none',
              fontFamily: 'Outfit, sans-serif'
            }}
          >
            📖 Read Strategy eBook
          </button>
        </div>
      </div>

      {/* ═══ REFERRAL GOAL TRACKER ═══ */}
      <div style={cardStyle}>
        <div onClick={() => toggleSection('tracker')} style={cardHeaderStyle(expandedSection.tracker)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Target size={16} color="#FFC72C" />
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px' }}>
              🎯 REFERRAL GOAL
            </span>
          </div>
          {expandedSection.tracker ? <ChevronUp size={14} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.4)" />}
        </div>
        {expandedSection.tracker && (
          <div style={{ padding: '0 18px 18px' }}>
            {/* Progress ring */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
              <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" fill="none"
                    stroke={goalReached ? '#A3FF12' : '#FFC72C'}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${progressPct * 2.136} 213.6`}
                    transform="rotate(-90 40 40)"
                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '18px', fontWeight: 950, color: goalReached ? '#A3FF12' : '#FFC72C' }}>{directFreeCount}</span>
                  <span style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.35)' }}>/ {GOAL}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>
                  {goalReached ? '🏆 Goal Reached!' : `${GOAL - directFreeCount} more to go!`}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                  {goalReached
                    ? 'You\'ve qualified for enhanced launch rewards. Keep building for maximum matrix depth!'
                    : `Invite ${GOAL - directFreeCount} more members using your link below to reach the pre-launch goal.`
                  }
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', height: '10px', borderRadius: '5px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{
                width: `${progressPct}%`,
                height: '100%',
                borderRadius: '5px',
                background: goalReached
                  ? 'linear-gradient(90deg, #A3FF12, #7CFC00)'
                  : 'linear-gradient(90deg, #FFC72C, #FFB800)',
                transition: 'width 0.8s ease',
                boxShadow: goalReached ? '0 0 12px rgba(163,255,18,0.4)' : '0 0 12px rgba(255,200,50,0.3)'
              }} />
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { val: directFreeCount, label: 'Directs', color: '#A12CFF' },
                { val: freeStats.totalFree, label: 'Team Members', color: '#FFC72C' },
                { val: freeStats.totalTeam, label: 'Total Structure', color: '#A3FF12' }
              ].map((s, i) => (
                <div key={i} style={{
                  background: 'rgba(32,34,37,0.5)', borderRadius: '12px', padding: '10px',
                  textAlign: 'center', border: '1px solid rgba(255,255,255,0.03)'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 950, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', marginTop: '2px' }}>{s.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ TELEGRAM STYLE: INVITE FRIENDS CARD ═══ */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(32,34,37,0.85) 0%, rgba(20,22,25,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '24px',
        padding: '24px 20px',
        textAlign: 'center',
        position: 'relative',
        marginBottom: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        overflow: 'hidden'
      }}>
        {/* Large Alien Emoji Header */}
        <div style={{ fontSize: '42px', marginBottom: '12px' }}>👽</div>
        
        <h3 style={{ fontSize: '18px', fontWeight: 950, color: '#fff', marginBottom: '4px' }}>
          Invite Friends
        </h3>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '18px', lineHeight: 1.4 }}>
          Earn extra matrix slot points & lock spillover positions.
        </p>

        {/* Big White Telegram Button with Green Reward Pill */}
        <button
          onClick={handleCopyLink}
          style={{
            width: '100%',
            background: '#fff',
            color: '#000',
            border: 'none',
            borderRadius: '16px',
            padding: '14px 20px',
            fontSize: '13px',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(255,255,255,0.05)',
            marginBottom: '18px'
          }}
        >
          <span>{copied ? 'Copied!' : 'Invite'}</span>
          <span style={{
            background: '#A3FF12',
            color: '#000',
            fontSize: '10px',
            fontWeight: 900,
            borderRadius: '12px',
            padding: '3px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            +2 ⭐️
          </span>
        </button>

        {/* Custom referral input details for copy fallback */}
        <div style={{
          background: 'rgba(32,34,37,0.5)',
          borderRadius: '14px',
          padding: '10px 14px',
          border: '1px solid rgba(255,255,255,0.04)',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.8px', marginBottom: '4px' }}>YOUR INVITE LINK</div>
          <div style={{ fontSize: '10px', color: '#FFC72C', fontWeight: 700, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {inviteLink || 'Connect wallet...'}
          </div>
        </div>
      </div>

      {/* ═══ SOCIAL CHANNELS SHARE ═══ */}
      <div style={cardStyle}>
        <div onClick={() => toggleSection('share')} style={cardHeaderStyle(expandedSection.share)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Share2 size={16} color="#A3FF12" />
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px' }}>
              📣 SHARE VIA SOCIAL NETWORKS
            </span>
          </div>
          {expandedSection.share ? <ChevronUp size={14} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.4)" />}
        </div>
        {expandedSection.share && (
          <div style={{ padding: '0 18px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, background: '#25D366', color: '#fff', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', border: 'none' }}>
                <span style={{ fontSize: '16px' }}>💬</span> WhatsApp
              </a>
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  shareOnTelegram(inviteLink, promoText);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, background: '#0088cc', color: '#fff', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s', border: 'none' }}>
                <span style={{ fontSize: '16px' }}>✈️</span> Telegram
              </button>
              <a href={`https://twitter.com/intent/tweet?text=${shareText}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, background: '#1DA1F2', color: '#fff', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s', border: 'none' }}>
                <span style={{ fontSize: '16px' }}>🐦</span> Twitter / X
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, background: '#1877F2', color: '#fff', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s', border: 'none' }}>
                <span style={{ fontSize: '16px' }}>📘</span> Facebook
              </a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, background: '#0077B5', color: '#fff', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s', border: 'none' }}>
                <span style={{ fontSize: '16px' }}>💼</span> LinkedIn
              </a>
              <a href={`mailto:?subject=${encodeURIComponent('Join AIPCore — FREE Registration!')}&body=${shareText}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, background: 'rgba(255,255,255,0.08)', color: '#fff', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '16px' }}>📧</span> Email
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ═══ READY-MADE PROMOTIONS ═══ */}
      <div style={cardStyle}>
        <div onClick={() => toggleSection('promos')} style={cardHeaderStyle(expandedSection.promos)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Gift size={16} color="#A12CFF" />
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px' }}>
              ✍️ READY-MADE PROMOTIONS
            </span>
          </div>
          {expandedSection.promos ? <ChevronUp size={14} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.4)" />}
        </div>
        {expandedSection.promos && (
          <div style={{ padding: '0 18px 18px' }}>
            {/* Template selector */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none', marginBottom: '12px' }}>
              {PROMO_TEMPLATES.map(p => (
                <button key={p.id} onClick={() => setActivePromo(p.id)} style={{
                  background: activePromo === p.id ? 'rgba(161,44,255,0.15)' : 'rgba(255,255,255,0.03)',
                  border: activePromo === p.id ? '1px solid rgba(161,44,255,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px', padding: '6px 14px', fontSize: '11px', fontWeight: 800,
                  color: activePromo === p.id ? '#D8B4FE' : '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.2s', fontFamily: 'Outfit, sans-serif'
                }}>
                  {p.emoji} {p.label.split(' ')[1]}
                </button>
              ))}
            </div>

            {/* Preview box */}
            <div style={{
              background: 'rgba(32,34,37,0.5)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px', padding: '14px', marginBottom: '12px', position: 'relative'
            }}>
              <div style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', marginBottom: '8px' }}>PREVIEW</div>
              <pre style={{
                fontSize: '11px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                fontFamily: 'Outfit, sans-serif', maxHeight: '200px', overflowY: 'auto'
              }}>
                {promoText}
              </pre>
            </div>

            {/* Copy & Share actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button onClick={() => handleCopyPromo(promoText)} style={{
                background: copiedPromo ? '#A3FF12' : 'rgba(255,255,255,0.06)',
                color: copiedPromo ? '#000' : '#fff',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                padding: '12px', fontSize: '11px', fontWeight: 900, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s'
              }}>
                {copiedPromo ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Text</>}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(promoText)}`} target="_blank" rel="noreferrer" style={{
                background: '#25D366', color: '#fff', border: 'none', borderRadius: '12px',
                padding: '12px', fontSize: '11px', fontWeight: 900, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                textDecoration: 'none', fontFamily: 'Outfit, sans-serif'
              }}>
                💬 Send via WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ═══ USER STATS LEVEL-WISE ═══ */}
      <div style={cardStyle}>
        <div onClick={() => toggleSection('stats')} style={cardHeaderStyle(expandedSection.stats)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={16} color="#4FC3F7" />
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px' }}>
              📊 TEAM STATS (10 LEVELS)
            </span>
          </div>
          {expandedSection.stats ? <ChevronUp size={14} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.4)" />}
        </div>
        {expandedSection.stats && (
          <div style={{ padding: '0 18px 18px' }}>
            {loadingStats ? (
              <div style={{ textAlign: 'center', padding: '30px 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Loading on-chain stats...</div>
            ) : (
              <>
                {/* Summary bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', padding: '10px 14px', background: 'rgba(32,34,37,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>TOTAL MEMBERS</div>
                    <div style={{ fontSize: '16px', fontWeight: 950, color: '#A12CFF' }}>{freeStats.totalFree}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>TOTAL PAID</div>
                    <div style={{ fontSize: '16px', fontWeight: 950, color: '#A3FF12' }}>{freeStats.totalPaid}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>CONVERSION</div>
                    <div style={{ fontSize: '16px', fontWeight: 950, color: '#FFC72C' }}>
                      {freeStats.totalTeam > 0 ? ((freeStats.totalPaid / freeStats.totalTeam) * 100).toFixed(0) : 0}%
                    </div>
                  </div>
                </div>

                {/* Earning Projection Summary Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px', padding: '10px 14px', background: 'linear-gradient(135deg, rgba(163,255,18,0.06) 0%, rgba(255,200,50,0.03) 100%)', borderRadius: '12px', border: '1px solid rgba(163,255,18,0.15)' }}>
                  <div>
                    <div style={{ fontSize: '8px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>ESTIMATED TOTAL YIELD</div>
                    <div style={{ fontSize: '15px', fontWeight: 955, color: '#A3FF12', marginTop: '2px' }}>${totalAccumulatedEarn.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '8px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>ESTIMATED DAILY PAYOUT</div>
                    <div style={{ fontSize: '15px', fontWeight: 955, color: '#FFC72C', marginTop: '2px' }}>${totalPerDayEarn.toFixed(2)}/day</div>
                  </div>
                </div>

                {/* Level rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {freeStats.levels.map(lv => {
                    const total = lv.free + lv.paid;
                    const freePct = total > 0 ? (lv.free / total) * 100 : 0;
                    const paidPct = total > 0 ? (lv.paid / total) * 100 : 0;
                    const hasMembers = total > 0;

                    const costUsd = TIER_USD_COSTS[lv.level - 1] || 5;
                    const earnPer = costUsd * 0.70;
                    const accumulatedEarn = total * earnPer;
                    const vDays = LVL_VESTING_DAYS[lv.level - 1] || 5;
                    const perDayEarn = accumulatedEarn / vDays;

                    return (
                      <div key={lv.level} style={{
                        background: hasMembers ? 'rgba(32,34,37,0.4)' : 'rgba(32,34,37,0.2)',
                        padding: '10px 14px', borderRadius: '12px',
                        border: lv.level === 1 ? '1px solid rgba(255,200,50,0.15)' : '1px solid rgba(255,255,255,0.03)',
                        opacity: hasMembers ? 1 : 0.5,
                        transition: 'opacity 0.3s'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: total > 0 ? '6px' : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              background: hasMembers ? '#A3FF12' : 'rgba(255,255,255,0.1)',
                              boxShadow: hasMembers ? '0 0 6px #A3FF12' : 'none'
                            }} />
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff' }}>
                              L{lv.level} {lv.level === 1 ? '(Direct)' : ''}
                            </span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#b9bbbe', fontWeight: 700 }}>
                            <span style={{ color: '#A12CFF' }}>{lv.free}R</span>
                            {' · '}
                            <span style={{ color: '#A3FF12' }}>{lv.paid}U</span>
                            {' · '}
                            {total} total
                          </span>
                        </div>
                        {total > 0 && (
                          <>
                            <div style={{ width: '100%', height: '6px', borderRadius: '3px', display: 'flex', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', marginBottom: '8px' }}>
                              <div style={{ width: `${paidPct}%`, height: '100%', background: '#A3FF12', transition: 'width 0.5s' }} />
                              <div style={{ width: `${freePct}%`, height: '100%', background: '#A12CFF', transition: 'width 0.5s' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                              <span style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px' }}>
                                💰 EST. YIELD:
                              </span>
                              <span style={{ fontSize: '10px', fontWeight: 900, color: '#A3FF12', fontFamily: 'monospace' }}>
                                ${accumulatedEarn.toFixed(2)} total (${perDayEarn.toFixed(2)}/day for {vDays}d)
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>
                    <span style={{ width: '10px', height: '4px', borderRadius: '2px', background: '#A3FF12' }} /> UPGRADED
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>
                    <span style={{ width: '10px', height: '4px', borderRadius: '2px', background: '#A12CFF' }} /> REGISTERED
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══ INCOME SIMULATOR ═══ */}
      <div style={cardStyle}>
        <div onClick={() => toggleSection('calculator')} style={cardHeaderStyle(expandedSection.calculator)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '15px' }}>🧮</span>
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px' }}>
              🧮 MATRIX INCOME SIMULATOR
            </span>
          </div>
          {expandedSection.calculator ? <ChevronUp size={14} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.4)" />}
        </div>
        {expandedSection.calculator && (
          <div style={{ padding: '0 18px 18px' }}>
            <IncomeCalcMini nodeTier={nodeTier} />
          </div>
        )}
      </div>

      {/* ═══ TIPS CARD ═══ */}
      <div style={{
        ...cardStyle,
        background: 'linear-gradient(135deg, rgba(163,255,18,0.04), rgba(161,44,255,0.04))',
        border: '1px solid rgba(163,255,18,0.1)',
        padding: '18px'
      }}>
        <h4 style={{ fontSize: '12px', fontWeight: 900, color: '#A3FF12', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          💡 VIRAL GROWTH TIPS
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { icon: '🎯', text: 'Share your link in crypto groups and DeFi communities' },
            { icon: '📱', text: 'Post on social media daily — consistency builds momentum' },
            { icon: '🤝', text: 'Help new members understand the $0 opportunity' },
            { icon: '⏰', text: 'Create urgency — the free window closes July 19th' },
            { icon: '📊', text: 'Track your 10-level tree and celebrate milestones' },
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{tip.icon}</span>
              <span>{tip.text}</span>
            </div>
          ))}
        </div>
      </div>

      <EbookModal isOpen={showEbookModal} onClose={() => setShowEbookModal(false)} />

    </div>
  );
}
