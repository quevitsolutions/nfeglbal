import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getEthersSigner } from '../utils/ethers-adapter.js';
import { ethers } from 'ethers';
import { config } from '../config/wagmi.js';
import { AIPCORE_ABI } from '../../contracts/abi.js';
import { CONTRACTS } from '../config/constants.js';
import { openLink } from '../utils/openLink.js';
import { useNativePrice, useNativeTokenSymbol } from '../hooks/useNativePrice.js';


const MAX_SESSION = 86400000; // 24h

// ── Inline Income Calculator ────────────────────────────────────────────────────
const LVL_USD_E = [5,5,10,20,40,80,160,320,640,1280,2560,5120,10240,20480,40960,81920,163840,327680];
const TC_E = ['#A3FF12','#B4FF3A','#FFD700','#FFC107','#FF9800','#FF7043','#FF5252','#E91E63','#AB47BC','#7E57C2','#5C6BC0','#42A5F5','#26C6DA','#26A69A','#66BB6A','#8BC34A','#CDDC39','#FF6B35'];
const AIPCore_E = [100,200,200,300,300,300,500,500,500,800,800,800,1200,1200,1200,2000,2000,2500];
function fmtE(n){ if(n>=1e9)return(n/1e9).toFixed(2)+'B'; if(n>=1e6)return(n/1e6).toFixed(2)+'M'; if(n>=1e3)return(n/1e3).toFixed(1)+'K'; return n.toFixed?n.toFixed(2):n; }

function IncomeCalcPanel({ nodeTier }) {
  const currentPrice = useNativePrice();
  const nativeSymbol = useNativeTokenSymbol();
  const [nativePrice, setNativePrice] = useState(600);
  const [myTier, setMyTier]     = useState(Math.max(1, Number(nodeTier)||1));
  const [showTiers, setShowTiers] = useState(false);
  const acc = '#FFB74D';

  useEffect(() => {
    if (currentPrice > 0) {
      setNativePrice(currentPrice);
    }
  }, [currentPrice]);

  const levels = LVL_USD_E.map((costUsd, i) => {
    const lv = i+1, people = Math.pow(2,lv), earnPer = costUsd*0.70, totalEarn = people*earnPer;
    return { lv, people, costUsd, earnPer, totalEarn, locked: lv > myTier };
  });
  const unlocked  = levels.filter(l => !l.locked);
  const totPeople = unlocked.reduce((s,l) => s+l.people, 0);
  const totUsd    = unlocked.reduce((s,l) => s+l.totalEarn, 0);
  const totNative = nativePrice > 0 ? totUsd/nativePrice : 0;

  return (
    <div className="tma-calc-panel">
      {/* Formula */}
      <div style={{ background: '#1e293b', border: '1px solid rgba(255,183,77,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.8 }}>
        <span style={{ color: acc, fontWeight: 900 }}>FORMULA: </span>
        People = <span style={{ color: '#4FC3F7' }}>2<sup>L</sup></span>&nbsp;·&nbsp;
        Earn/person = <span style={{ color: '#A3FF12' }}>Level Cost × 70%</span>&nbsp;·&nbsp;
        Matrix = <span style={{ color: '#FFD700' }}>BINARY</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ background: '#1f2937', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ fontSize: 8, fontWeight: 900, color: '#9ca3af', letterSpacing: 1, marginBottom: 5 }}>{nativeSymbol} PRICE ($)</div>
          <input type="number" value={nativePrice} onChange={e => setNativePrice(Number(e.target.value)||0)} min={0}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontWeight: 900, fontSize: 16, fontFamily: 'monospace' }} />
        </div>
        <div style={{ background: '#1f2937', borderRadius: 12, padding: '10px 14px', border: `1px solid ${TC_E[myTier-1]}` }}>
          <div style={{ fontSize: 8, fontWeight: 900, color: '#9ca3af', letterSpacing: 1, marginBottom: 5 }}>YOUR LEVEL</div>
          <select value={myTier} onChange={e => setMyTier(Number(e.target.value))}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: TC_E[myTier-1], fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
            {LVL_USD_E.map((usd,i) => <option key={i} value={i+1} style={{ background: '#111827' }}>L{i+1} — ${usd}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'MATRIX NODES', val: fmtE(totPeople), color: '#4FC3F7' },
          { label: `EST. ${nativeSymbol}`, val: totNative.toFixed(3), color: '#FFD700' },
          { label: 'EST. USD',     val: '$'+fmtE(totUsd), color: '#A3FF12' },
        ].map((c,i) => (
          <div key={i} style={{ background: '#111827', borderRadius: 12, padding: '10px 6px', textAlign: 'center', border: `1.5px solid ${c.color}60` }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: c.color }}>{c.val}</div>
            <div style={{ fontSize: 7, color: '#9ca3af', fontWeight: 900, marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Level table */}
      <div style={{ fontSize: 10, fontWeight: 900, color: '#4FC3F7', letterSpacing: 1, marginBottom: 8 }}>📊 LEVEL-WISE 70% INCOME</div>
      <div style={{ background: '#030712', borderRadius: 12, overflow: 'hidden', marginBottom: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="tma-calc-grid" style={{ padding: '7px 10px', background: '#1f2937', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {['LVL','PEOPLE','COST $','70% EA','TOTAL $',''].map(h => <span key={h} style={{ fontSize: 7, fontWeight: 900, color: '#d1d5db' }}>{h}</span>)}
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {levels.map(({ lv, people, costUsd, earnPer, totalEarn, locked }) => {
            const color = TC_E[(lv-1)%18];
            return (
              <div key={lv} className="tma-calc-grid" style={{ padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: locked?0.35:1, background: locked?'transparent':`${color}10` }}>
                <span style={{ fontSize: 9, fontWeight: 900, color, background: `${color}25`, borderRadius: 4, padding: '2px 4px', textAlign: 'center' }}>L{lv}</span>
                <span style={{ fontSize: 9, color: '#e5e7eb', fontWeight: 700 }}>{fmtE(people)}</span>
                <span style={{ fontSize: 9, color: '#FFB74D', fontWeight: 800 }}>${costUsd}</span>
                <span style={{ fontSize: 9, color: '#FFD700', fontWeight: 900 }}>${earnPer.toFixed(2)}</span>
                <span style={{ fontSize: 9, color: '#A3FF12', fontWeight: 950 }}>${fmtE(totalEarn)}</span>
                <span style={{ fontSize: 9, textAlign: 'center' }}>{locked?'🔒':'✅'}</span>
              </div>
            );
          })}
          <div className="tma-calc-grid" style={{ padding: '8px 10px', background: 'rgba(255,183,77,0.15)', borderTop: `1.5px solid ${acc}40` }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: acc }}>ALL</span>
            <span style={{ fontSize: 9, color: '#fff', fontWeight: 900 }}>{fmtE(totPeople)}</span>
            <span style={{ fontSize: 9, color: '#888' }}>—</span>
            <span style={{ fontSize: 9, color: '#888' }}>—</span>
            <span style={{ fontSize: 9, color: '#A3FF12', fontWeight: 950 }}>${fmtE(totUsd)}</span>
            <span style={{ fontSize: 8, color: acc, fontWeight: 900 }}>L{myTier}</span>
          </div>
        </div>
      </div>

      {/* Tier comparison toggle */}
      <button onClick={() => setShowTiers(v => !v)}
        style={{ width: '100%', background: '#1f2937', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px', color: '#e5e7eb', fontWeight: 950, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
        🎯 {showTiers?'HIDE':'SHOW'} TIER-WISE COMPARISON
      </button>
      {showTiers && (
        <div style={{ background: '#030712', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="tma-comp-grid" style={{ padding: '7px 10px', background: '#1f2937', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {[`LVL`,`COST $`,`${nativeSymbol}~`,`AIPCore/hr`,`L1 EARN $`].map(h => <span key={h} style={{ fontSize: 7, fontWeight: 900, color: '#d1d5db' }}>{h}</span>)}
          </div>
          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
            {LVL_USD_E.map((costUsd, i) => {
              const color = TC_E[i];
              const l1Earn = 2 * costUsd * 0.70;
              const costNative = nativePrice > 0 ? (costUsd/nativePrice).toFixed(4) : '—';
              return (
                <div key={i} className="tma-comp-grid" style={{ padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: i+1===myTier?`${color}20`:'transparent' }}>
                  <span style={{ fontSize: 9, fontWeight: 900, color, background: `${color}25`, borderRadius: 4, padding: '2px 4px', textAlign: 'center' }}>L{i+1}</span>
                  <span style={{ fontSize: 9, color: '#FFB74D', fontWeight: 800 }}>${costUsd}</span>
                  <span style={{ fontSize: 9, color: '#FFD700', fontWeight: 900 }}>{costNative}</span>
                  <span style={{ fontSize: 9, color: '#4FC3F7', fontWeight: 900 }}>{AIPCore_E[i]}</span>
                  <span style={{ fontSize: 9, color: '#A3FF12', fontWeight: 950 }}>${l1Earn.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ fontSize: 8, color: '#9ca3af', fontWeight: 700, marginTop: 12, textAlign: 'center' }}>⚠️ ESTIMATES ONLY · BINARY MATRIX · 70% DISTRIBUTION · {nativeSymbol} PRICE VARIABLE</div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────

// ── Local mining hook — uses a ref snapshot of claimTime so reset is instant ──
function useLocalMining(lastClaimTime, ratePerHour, isEligible) {
  const [mined, setMined] = useState(0);
  const rafRef = useRef(null);
  const claimTimeRef = useRef(lastClaimTime); // tracks the LATEST claim time without closure lag

  // keep the ref in sync when prop changes (after claim)
  useEffect(() => {
    claimTimeRef.current = lastClaimTime;
    setMined(0); // snap immediately to 0
  }, [lastClaimTime]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!isEligible) { setMined(0); return; }

    const tick = () => {
      const elapsed = (Date.now() - claimTimeRef.current) / 3600000;
      setMined(Math.max(0, elapsed * ratePerHour));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ratePerHour, isEligible]);

  return mined;
}

// ── Registration CTA for non-node users (on-chain) ──
function RegistrationGate({ setActiveTab }) {
  const { referrerId } = useGameStore();
  const [registering, setRegistering] = useState(false);
  const nativeSymbol = useNativeTokenSymbol();

  const handleRegister = async () => {
    if (registering) return;
    setRegistering(true);
    try {
      const signer = await getEthersSigner(config);
      if (!signer) { toast.error('Connect wallet first'); setRegistering(false); return; }
      const contract = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, signer);
      let sponsorNodeId = 55555n;
      if (referrerId) {
        try { const ref = await contract.nodeId(referrerId); if (Number(ref) > 0) sponsorNodeId = ref; } catch { }
      }

      // SELF-HEAL: Check if already registered
      const walletAddress = await signer.getAddress();
      const existingNodeId = await contract.nodeId(walletAddress).catch(() => 0n);
      if (existingNodeId > 0n) {
        toast.success('Node was already registered! Syncing...', { id: 'reg' });
        await api.confirmNode(walletAddress, Number(existingNodeId), 1, "0xsync").catch(() => {});
        useGameStore.setState({ lastBackendSync: null });
        await useGameStore.getState().fetchUserData().catch(() => {});
        setTimeout(() => window.location.reload(), 1500);
        return;
      }
      const cost = await contract.getRegistrationFee().catch(() => 0n);
      
      // Add 5% buffer to prevent insufficient msg.value reverts due to oracle price fluctuations
      const bufferCost = cost > 0n ? (cost * 105n) / 100n : 0n;
      
      toast.loading('Confirm transaction...', { id: 'reg' });
      const tx = await contract.createNode(sponsorNodeId, { value: bufferCost, gasLimit: 3000000 });
      toast.loading(`Tx sent: ${tx.hash.slice(0, 10)}...`, { id: 'reg' });
      await tx.wait();
      toast.success('Node registered! Pull to refresh.', { id: 'reg', duration: 5000 });
    } catch (err) {
      let errMsg = err?.reason || err?.message || 'Failed';
      if (errMsg.toLowerCase().includes('insufficient funds')) {
        errMsg = `Insufficient ${nativeSymbol} balance for transaction & gas.`;
      } else if (errMsg.includes('user rejected')) {
        errMsg = 'Transaction rejected by user.';
      } else {
        errMsg = errMsg.slice(0, 80);
      }
      toast.error(errMsg, { id: 'reg' });
    } finally { setRegistering(false); }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '32px 20px', textAlign: 'center', gap: 20
    }}>
      <div style={{
        width: 100, height: 100, borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(163,255,18,0.15), rgba(163,255,18,0.05))',
        border: '2px solid rgba(163,255,18,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48
      }}>⛏️</div>

      <div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Node Not Activated</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
          You need an active AIPCore node to mine coins. Register on-chain to start earning passive income.
        </p>
      </div>

      {[
        { icon: '💰', text: 'Earn 100–2,000+ coins/hr passively' },
        { icon: '🚀', text: 'Boost up to Tier 18 — max rewards' },
        { icon: '👥', text: 'Referral & team bonuses' },
        { icon: '🌐', text: 'Global reward pool participation' },
      ].map((b, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 16px',
          width: '100%', maxWidth: 320, border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <span style={{ fontSize: 22 }}>{b.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{b.text}</span>
        </div>
      ))}

      <button
        onClick={handleRegister}
        disabled={registering}
        style={{
          width: '100%', maxWidth: 320,
          background: registering ? 'rgba(163,255,18,0.4)' : 'var(--neon-lime)',
          border: 'none', borderRadius: 18, padding: '18px', fontSize: 16, fontWeight: 900,
          color: '#000', cursor: registering ? 'wait' : 'pointer',
          boxShadow: '0 0 30px rgba(163,255,18,0.3)'
        }}>
        {registering ? '⏳ Registering...' : '🚀 REGISTER NODE ON-CHAIN →'}
      </button>

      <button onClick={() => setActiveTab('contracts')}
        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 20px', color: '#FFD700', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
        Learn More →
      </button>
    </div>
  );
}

// ── High-Urgency Alert for Free Users with Progressive Scaling ──
function ActivationAlert({ onAction, daysLeft }) {
  const isCritical = daysLeft <= 3;
  const isHigh = daysLeft <= 10;
  
  // Dynamic styling based on urgency
  const urgencyStyles = {
    bg: isCritical 
      ? 'linear-gradient(90deg, rgba(255, 61, 0, 0.3) 0%, rgba(183, 28, 28, 0.45) 100%)' 
      : (isHigh ? 'linear-gradient(90deg, rgba(255, 112, 67, 0.2) 0%, rgba(255, 61, 0, 0.3) 100%)' : 'linear-gradient(90deg, rgba(255, 112, 67, 0.15) 0%, rgba(255, 112, 67, 0.25) 100%)'),
    border: isCritical ? 'rgba(255, 61, 0, 0.5)' : (isHigh ? 'rgba(255, 112, 67, 0.4)' : 'rgba(255, 112, 67, 0.3)'),
    icon: isCritical ? '🔥' : '⚠️',
    pulse: isCritical ? 0.8 : (isHigh ? 1.5 : 3.0),
    title: isCritical ? 'CRITICAL: NODE EXPIRE SOON' : (isHigh ? 'URGENCY: NODE UNSECURED' : 'NODE STATUS: UNSECURED')
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onAction}
      style={{
        margin: '0 0 20px',
        padding: '12px 16px',
        background: urgencyStyles.bg,
        borderRadius: 16,
        border: `1px solid ${urgencyStyles.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        boxShadow: isCritical ? '0 0 25px rgba(255, 61, 0, 0.2)' : '0 0 15px rgba(255, 61, 0, 0.1)'
      }}
    >
      <motion.div 
        animate={{ scale: isCritical ? [1, 1.3, 1] : [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: urgencyStyles.pulse, repeat: Infinity }}
        style={{ fontSize: 20 }}
      >
        {urgencyStyles.icon}
      </motion.div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: isCritical ? '#FF5252' : '#FF7043', letterSpacing: 1 }}>{urgencyStyles.title}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginTop: 2, lineHeight: 1.4 }}>
          {isCritical ? 'ACTIVATE NOW' : 'Activate Master Node'} to <span style={{ color: '#FF7043' }}>SAVE</span> {Math.floor(daysLeft)} days of $AIPCORE & unlock <span style={{ color: 'var(--neon-lime)' }}>10X SPEED</span> 🚀
        </div>
      </div>
      <div style={{ 
        background: 'var(--neon-lime)', 
        color: '#000', 
        fontSize: 9, 
        fontWeight: 950, 
        padding: '6px 10px', 
        borderRadius: 8,
        boxShadow: '0 0 10px rgba(163, 255, 18, 0.3)'
      }}>
        ACTIVATE
      </div>
    </motion.div>
  );
}

export default function EarnScreen() {
  const {
    walletAddress, localReward, nodeTier, isPremium,
    hasNode, nodeId, lastClaimTime, teamHistory, isHistoryLoading,
    claimMined, setActiveTab, addLocalReward, fetchTeamHistory,
    isFreeActive, createdAt, globalHistory, fetchGlobalHistory,
    initialLoaded, pendingMined, lastSyncTime,
    claimedMilestones, claimSignupBonusAction, miningRate,
    isNewUser, taps, energy, maxEnergy
  } = useGameStore();

  const nativeSymbol = useNativeTokenSymbol();

  const [view, setView] = useState('mining'); // 'mining' | 'history'
  const [historyMode, setHistoryMode] = useState('personal'); // 'personal' | 'global'
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isExploding, setIsExploding] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false); // Prevents double-click
  const [isBonusClaiming, setIsBonusClaiming] = useState(false);
  const [displayReward, setDisplayReward] = useState(localReward);
  const [claimedTasks, setClaimedTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aipcore-tasks') || '[]'); } catch { return []; }
  });
  const [visibleDays, setVisibleDays] = useState(3);
  const [liveRewards, setLiveRewards] = useState([]);
  const latestIncomeRef = useRef(null);
  
  // Floating Tap Score Particles state and click handlers
  const [particles, setParticles] = useState([]);
  
  // Random movement, rotation, and squish/stretch animation state for Shiba Inu character
  const [shibaPos, setShibaPos] = useState({ x: 0, y: 0 });
  const [shibaRotate, setShibaRotate] = useState(0);
  const [shibaScaleX, setShibaScaleX] = useState(1);
  const [shibaScaleY, setShibaScaleY] = useState(1);

  useEffect(() => {
    if (view !== 'mining') return;

    const interval = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.45) {
        // Move character to a random hover offset on the stand
        const maxRangeX = 35; // horizontal offset limit
        const maxRangeY = 15; // vertical offset limit
        setShibaPos({
          x: (Math.random() - 0.5) * maxRangeX * 2,
          y: (Math.random() - 0.5) * maxRangeY * 2
        });
        setShibaRotate((Math.random() - 0.5) * 20); // rotate character slightly
      } else if (roll < 0.75) {
        // Character does a squish-stretch bounce in place
        setShibaScaleY(1.18);
        setShibaScaleX(0.82);
        setTimeout(() => {
          setShibaScaleY(0.88);
          setShibaScaleX(1.12);
          setTimeout(() => {
            setShibaScaleY(1);
            setShibaScaleX(1);
          }, 120);
        }, 120);
      } else {
        // Cute idle tilt/wiggle
        setShibaRotate((Math.random() - 0.5) * 35);
      }
    }, 2200 + Math.random() * 2000); // Random action every 2.2 to 4.2s

    return () => clearInterval(interval);
  }, [view]);
  
  const triggerTap = (e) => {
    if (isExpired) return;
    const state = useGameStore.getState();
    if (state.energy <= 0) {
      toast.error("Out of energy! Recharging...", { id: 'energy-empty' });
      return;
    }

    const res = state.handleTap();
    if (res.status === "LOCKED") {
      toast.error("Tap limit reached! Activate a Node to unlock unlimited taps.", { id: 'tap-locked' });
      return;
    }

    // Interactive physical feedback on tap
    setShibaScaleY(0.78);
    setShibaScaleX(1.22);
    setTimeout(() => {
      setShibaScaleY(1.12);
      setShibaScaleX(0.88);
      setTimeout(() => {
        setShibaScaleY(1);
        setShibaScaleX(1);
      }, 100);
    }, 70);

    // Get touch / click coordinates relative to standard viewport coin layout
    const rect = e.currentTarget.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const id = Date.now() + Math.random();
    
    // Node holders get 10 sparks visual feedback, free players get 1
    const tapValue = hasNode ? 10 : 1;

    setParticles((prev) => [...prev, { id, x, y, value: `+${tapValue}` }]);
    
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 800);
  };


  // Live On-Chain Reward Poller
  useEffect(() => {
    if (!hasNode || !nodeId) return;
    let isMounted = true;

    const pollIncome = async () => {
      try {
        const { blockchain } = await import('../services/blockchain.js');
        const incomes = await blockchain.fetchTeamHistoryOnChain(nodeId, 5);
        if (!isMounted || !incomes || incomes.length === 0) return;

        const latestIdentifier = `${incomes[0].timestamp}_${incomes[0].from_node_id}_${incomes[0].amount_bnb}`;

        // Initialize ref gracefully on first load to prevent flooding
        if (!latestIncomeRef.current) {
          latestIncomeRef.current = latestIdentifier;
          return;
        }

        if (latestIdentifier === latestIncomeRef.current) return; // No new incomes

        // Found new incomes
        let newItems = [];
        for (let i = 0; i < incomes.length; i++) {
          const id = `${incomes[i].timestamp}_${incomes[i].from_node_id}_${incomes[i].amount_bnb}`;
          if (id === latestIncomeRef.current) break;
          newItems.push({ ...incomes[i], uniqueId: id + '_' + Math.random() });
        }

        if (newItems.length > 0) {
          latestIncomeRef.current = latestIdentifier;
          setLiveRewards(prev => [...prev, ...newItems.reverse()]); // Oldest of new items first

          // Autoclear after 3.5 seconds
          setTimeout(() => {
            if (isMounted) {
              setLiveRewards(prev => prev.filter(r => !newItems.find(n => n.uniqueId === r.uniqueId)));
            }
          }, 3500);
        }
      } catch (e) {}
    };

    const interval = setInterval(pollIncome, 20000); // 20s poll
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [hasNode, nodeId]);
  // Keep displayReward in sync with store (animates upward only)
  useEffect(() => {
    setDisplayReward(localReward);
  }, [localReward]);

  // Source of truth: miningRate comes from gameStore logic (10 for Free, 100*2^(tier-1) for Node)
  const ratePerHour = miningRate || 10;
  const displayTier = Number(nodeTier || 1);

  // Bug #3 fix: compute isExpired early so we can zero out rate for expired users
  const daysLeftCalc = (initialLoaded && createdAt)
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 3600000)))
    : 30;
  const isExpired = initialLoaded && !hasNode && daysLeftCalc <= 0;
  const effectiveRate = isExpired ? 0 : ratePerHour;

  const now = Date.now();
  const elapsed = Math.max(0, now - lastClaimTime);
  
  // Calculate totalMined precisely identical to the backend /api/mining/claim
  const diffHours = elapsed / 3600000;
  const cappedHours = Math.min(diffHours, 24);
  const totalMined = isExpired ? 0 : (cappedHours * effectiveRate);
  
  // 24-Hour Cap Warning Levels
  const capPercent = Math.min(100, (diffHours / 24) * 100);
  const isCapReached  = diffHours >= 24;        // 100% — coins being wasted
  const isCapCritical = !isCapReached && diffHours >= 22; // 92%+ — under 2h left
  const isCapWarning  = !isCapCritical && diffHours >= 19.2; // 80%+ — under ~5h left
  const hoursLeft = Math.max(0, 24 - diffHours);

  // Balance is static — shows only what has been claimed
  // totalMined is the pending counter shown separately below the balance

  // Live timer — re-renders every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Bug #3 fix: expired users should see no time remaining
  const timeRemaining = isExpired ? 0 : Math.max(0, MAX_SESSION - elapsed);
  // Bug #2 fix: ring fills for both node owners AND free trial users
  const isActive = hasNode || isFreeActive;
  const maturity = isActive && !isExpired ? Math.min(1, elapsed / MAX_SESSION) : 0;

  const formatTime = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  const onClaim = async () => {
    // Guard: already in-flight OR nothing accrued OR trial expired
    if (isClaiming || totalMined <= 0 || isExpired) return;
    setIsClaiming(true);
    setIsExploding(true);

    try {
      const ok = await claimMined();
      if (ok) {
        toast.success(`🥚 +${Math.floor(totalMined).toLocaleString()} $AIPCORE claimed!`, { 
          duration: 3000,
          style: {
            background: 'var(--bg-card)',
            color: '#fff',
            border: '1px solid var(--neon-lime)',
            fontWeight: 900
          }
        });
        
        // Finalize explosion
        setTimeout(() => setIsExploding(false), 2000);
        
        if (!hasNode) {
          setTimeout(() => {
            toast(`Activate an AIPCore Node to earn real ${nativeSymbol}, 10x more coins, and massive pool rewards!`, {
              icon: '💎',
              duration: 6000,
              style: { border: '1px solid var(--neon-lime)' }
            });
          }, 1200);
        }
      } else {
        toast.error('Claim failed — please try again.', { duration: 4000 });
        setIsExploding(false);
      }
    } catch (err) {
      toast.error(err?.message || 'Claim failed.', { duration: 4000 });
      setIsExploding(false);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleTaskClaim = (task) => {
    if (claimedTasks.includes(task.id)) return;
    openLink(task.url);
    const updated = [...claimedTasks, task.id];
    setClaimedTasks(updated);
    localStorage.setItem('aipcore-tasks', JSON.stringify(updated));
    addLocalReward(task.reward);
  };

  // Progressive Urgency Logic: Hide until day 20, escalate thereafter
  const daysLeft = daysLeftCalc;
  const shouldShowBanner = initialLoaded && !hasNode && daysLeft <= 20 && !isExpired;

  // Daily Urgency Toast Implementation
  useEffect(() => {
    if (!shouldShowBanner) return;
    
    const todayStr = new Date().toDateString();
    const lastAlert = localStorage.getItem('aipcore-last-urgency-toast');
    
    if (lastAlert !== todayStr) {
      setTimeout(() => {
        toast.error(`⚠️ Node trial expires in ${Math.floor(daysLeft)} days! Activate now to secure your $AIPCORE.`, {
          duration: 6000,
          position: 'top-center',
          icon: daysLeft <= 3 ? '🔥' : '⚠️',
          style: {
            background: '#1A0B0B',
            color: '#fff',
            border: `1px solid ${daysLeft <= 3 ? '#FF3D00' : '#FF7043'}`,
            fontWeight: 800,
            fontSize: '13px'
          }
        });
        localStorage.setItem('aipcore-last-urgency-toast', todayStr);
      }, 3000);
    }
  }, [shouldShowBanner, daysLeft]);

  // 24h Cap Toast — fires once per session when user is near the cap
  useEffect(() => {
    if (!initialLoaded || isExpired || totalMined <= 0) return;
    if (!isCapWarning && !isCapCritical && !isCapReached) return;

    const sessionKey = 'aipcore-cap-toast-session';
    if (sessionStorage.getItem(sessionKey)) return; // Already shown this session
    sessionStorage.setItem(sessionKey, '1');

    setTimeout(() => {
      if (isCapReached) {
        toast.error('🚨 DAILY CAP REACHED! New coins are being wasted — CLAIM NOW!', {
          duration: 8000, position: 'top-center',
          style: { background: '#1A0000', border: '1px solid #FF3D00', fontWeight: 900, fontSize: '13px' }
        });
      } else if (isCapCritical) {
        toast.error(`⏰ Under 2 hours left! Claim your ${Math.floor(totalMined).toLocaleString()} $AIPCORE before cap resets!`, {
          duration: 7000, position: 'top-center',
          style: { background: '#1A0000', border: '1px solid #FF5722', fontWeight: 900, fontSize: '13px' }
        });
      } else {
        toast(`⚠️ Mining cap at ${Math.floor(capPercent)}% — claim before the 24h reset!`, {
          duration: 5000, position: 'top-center', icon: '⏱️',
          style: { background: '#1A0F00', border: '1px solid #FF8F00', fontWeight: 800, fontSize: '12px' }
        });
      }
    }, 2000);
  }, [initialLoaded, isCapWarning, isCapCritical, isCapReached]);

  // We no longer use the full-screen RegistrationGate here, 
  // as the "Session Expired" overlay on the mining egg handles the activation nudge better.
  // This ensures users can always see their dashboard and balance.

  return (
    <div className={`page-earn ${view !== 'mining' ? 'solid-bg' : ''}`}>


      {/* ── Tab Switcher Header ── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 6px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 8 }}>
        <div style={{ display: 'flex', background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 4 }}>
          <button
            onClick={() => setView('mining')}
            style={{
              padding: '6px 16px', borderRadius: 10, border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer',
              background: view === 'mining' ? 'var(--neon-lime)' : 'transparent',
              color: view === 'mining' ? '#000' : '#A3FF12',
              transition: 'all 0.2s'
            }}>⛏️ MINING</button>
          <button
            onClick={() => { setView('history'); fetchTeamHistory(); }}
            style={{
              padding: '6px 16px', borderRadius: 10, border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer',
              background: view === 'history' ? '#4FC3F7' : 'transparent',
              color: view === 'history' ? '#000' : '#4FC3F7',
              transition: 'all 0.2s'
            }}>📜 HISTORY</button>
          <button
            onClick={() => setView('calculator')}
            style={{
              padding: '6px 16px', borderRadius: 10, border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer',
              background: view === 'calculator' ? '#FFB74D' : 'transparent',
              color: view === 'calculator' ? '#000' : '#FFB74D',
              transition: 'all 0.2s'
            }}>💰 CALC</button>
        </div>

        <button onClick={() => setActiveTab('tasks')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 8, display: 'flex', alignItems: 'center' }}>
          ✅
        </button>
      </div>

      {/* ── Conditional View Content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: view === 'mining' ? 'visible' : 'auto', WebkitOverflowScrolling: 'touch' }}>
      {view === 'calculator' ? (
        <IncomeCalcPanel nodeTier={nodeTier} />
      ) : view === 'mining' ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Activation Alert (Triggered at Day 20) */}
          {shouldShowBanner && (
            <ActivationAlert 
              daysLeft={daysLeft} 
              onAction={() => setActiveTab('mine')} 
            />
          )}

          {/* ── Immersive RPG Status Bar HUD ── */}
          <div className="tma-rpg-hud" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setActiveTab('dash')}>
            <div className="tma-rpg-level-badge">
              {hasNode ? nodeTier || 1 : '1'}
            </div>
            <div className="tma-rpg-info-bar">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="tma-rpg-username">
                  {hasNode ? `OPERATIVE #${nodeId}` : (nodeId ? `FREE TRIAL AGENT #${nodeId}` : 'FREE TRIAL AGENT')}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 950, color: '#ffd700', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {taps.toLocaleString()} SPARKS
                </span>
              </div>
              <div className="tma-rpg-xp-container">
                <div className="tma-rpg-xp-fill" style={{ width: `${(energy / maxEnergy) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* ── Active Node: Passive Mining Terminal ── */}
          {(hasNode || isFreeActive) && (
            <div className="w-full" style={{ marginBottom: 8, flexShrink: 0 }}>
              <div className="tma-node-portal" style={{ padding: '12px 14px' }}>
                <div className="tma-portal-ring" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: 'var(--neon-lime)', letterSpacing: '1px', display: 'block' }}>⚙️ PASSIVE TERMINAL</span>
                    <span style={{ fontSize: '15px', fontWeight: 950, color: '#fff', marginTop: 2, display: 'block' }}>NODE #{nodeId}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#4FC3F7', letterSpacing: '0.5px', display: 'block' }}>SPEED</span>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff', marginTop: 2, display: 'block' }}>+{ratePerHour} AIPCore/HR</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: 12, padding: '8px', border: '1px solid rgba(255, 255, 255, 0.03)', textAlign: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>ACCUMULATED PASSIVE REWARDS</span>
                  <div style={{ fontSize: '22px', fontWeight: 950, color: 'var(--neon-lime)', marginTop: 2, textShadow: '0 0 15px rgba(163, 255, 18, 0.4)' }}>
                    +{totalMined.toFixed(4)} $AIPCORE
                  </div>
                  {isCapReached ? (
                    <span style={{ fontSize: '8px', color: '#FF3B30', fontWeight: 900, letterSpacing: 0.5 }}>⚠️ MAX LIMIT REACHED (CLAIM NOW)</span>
                  ) : (
                    <span style={{ fontSize: '9px', color: '#4FC3F7', fontWeight: 700 }}>Ends in: {formatTime(timeRemaining)}</span>
                  )}
                </div>

                <motion.button 
                  whileTap={{ scale: 0.96 }}
                  disabled={isClaiming || totalMined <= 0}
                  onClick={onClaim}
                  style={{
                    width: '100%',
                    background: totalMined > 0 ? 'linear-gradient(135deg, var(--neon-lime), #7BFF00)' : 'rgba(255,255,255,0.03)',
                    color: totalMined > 0 ? '#000' : 'rgba(255,255,255,0.15)',
                    border: 'none',
                    borderRadius: 16,
                  padding: '11px',
                    fontSize: '12px',
                    fontWeight: 950,
                    cursor: totalMined > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: totalMined > 0 ? '0 8px 25px rgba(163,255,18,0.35)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {isClaiming ? '⏳ SYNCING REWARDS...' : `🥚 CLAIM PASSIVE YIELD (${totalMined.toFixed(4)})`}
                </motion.button>
              </div>
            </div>
          )}

          {/* ── CENTRAL TAPPING VIEW (Interactive Egg Incubation Deck) ── */}
          <div style={{ flex: 1, minHeight: '200px', maxHeight: '280px', display: 'flex', position: 'relative', width: '100%', alignItems: 'center', justifyContent: 'center', margin: '6px 0' }}>
            
            {/* Left Column Floating Widgets */}
            <div className="tma-floating-panel left">
              <button className="tma-game-widget" onClick={() => setActiveTab('friends')}>
                <div className="tma-widget-circle orange">🏆</div>
                <span className="tma-widget-label">Rating</span>
              </button>
              <button className="tma-game-widget" onClick={() => setActiveTab('team')}>
                <div className="tma-widget-circle blue">🕸️</div>
                <span className="tma-widget-label">Clans</span>
              </button>
            </div>

            {/* Right Column Floating Widgets */}
            <div className="tma-floating-panel right">
              <button className="tma-game-widget" onClick={() => setActiveTab('tasks')}>
                <div className="tma-widget-circle lime">✅</div>
                <span className="tma-widget-label">Quests</span>
              </button>
              <button className="tma-game-widget" onClick={() => setView('calculator')}>
                <div className="tma-widget-circle">📊</div>
                <span className="tma-widget-label">Calc</span>
              </button>
            </div>

            {/* Central Custom Egg Incubator */}
            <div className="tma-egg-incubator">
              <div className="tma-egg-stand" />
              
              <AnimatePresence>
                {isExploding && (
                  <motion.div 
                    initial={{ opacity: 1, scale: 0.8 }} 
                    animate={{ opacity: 0, scale: 2.2 }}
                    style={{ 
                      position: 'absolute', 
                      width: 200, 
                      height: 200, 
                      background: 'radial-gradient(circle, var(--neon-lime) 0%, transparent 70%)', 
                      zIndex: 5, 
                      borderRadius: '50%',
                      pointerEvents: 'none'
                    }} 
                  />
                )}
              </AnimatePresence>

              {/* Floating Multi-touch Score Particles */}
              {particles.map((p) => (
                <span
                  key={p.id}
                  className="score-particle"
                  style={{ left: p.x, top: p.y }}
                >
                  {p.value}
                </span>
              ))}

              <motion.img 
                src="/assets/egg_orange.png?v=3"
                className="tma-incubated-egg"
                onClick={triggerTap}
                onTouchStart={triggerTap}
                animate={{
                  x: shibaPos.x,
                  y: [shibaPos.y, shibaPos.y - 6, shibaPos.y], // Bobbing up and down + random translations
                  rotate: shibaRotate,
                  scaleX: shibaScaleX,
                  scaleY: shibaScaleY
                }}
                transition={{
                  x: { type: 'spring', stiffness: 55, damping: 11 },
                  y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" },
                  rotate: { type: 'spring', stiffness: 50, damping: 10 },
                  scaleX: { type: 'spring', stiffness: 220, damping: 12 },
                  scaleY: { type: 'spring', stiffness: 220, damping: 12 }
                }}
                style={{
                  filter: isExpired ? 'grayscale(1) brightness(0.4)' : 'none',
                  transformOrigin: 'bottom center'
                }}
              />

              {isExpired && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.65)', borderRadius: '50%', textAlign: 'center', padding: 20, zIndex: 15
                }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#FF3B30', marginBottom: 8 }}>TRIAL EXPIRED</span>
                  <button onClick={() => setActiveTab('mine')} style={{ background: 'var(--neon-lime)', border: 'none', padding: '8px 16px', borderRadius: 12, fontSize: 11, fontWeight: 900, color: '#000', cursor: 'pointer' }}>
                    ACTIVATE NODE
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer Stats & Energy Controls ── */}
          <div style={{ flexShrink: 0, padding: '8px 0 4px', background: 'linear-gradient(to top, rgba(5, 8, 15, 0.3) 70%, transparent)' }}>

            {/* ── Total $AIPCORE Balance Strip (above claim buttons) ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(163,255,18,0.07) 100%)',
              border: '1px solid rgba(163,255,18,0.2)',
              borderRadius: 14,
              padding: '7px 14px',
              marginBottom: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>💰</span>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>Total $AIPCORE Balance</div>
                  <div style={{ fontSize: 18, fontWeight: 950, color: 'var(--neon-lime)', lineHeight: 1.1 }}>
                    {Math.floor(localReward).toLocaleString()}
                    <span style={{ fontSize: 10, fontWeight: 900, color: 'rgba(163,255,18,0.6)', marginLeft: 3 }}>$AIPCORE</span>
                  </div>
                </div>
              </div>
              {totalMined > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8 }}>PENDING</div>
                  <div style={{ fontSize: 13, fontWeight: 950, color: '#A3FF12' }}>+{totalMined.toFixed(4)}</div>
                  <div style={{ fontSize: 8, color: '#4FC3F7', fontWeight: 700 }}>$AIPCORE unclaimed</div>
                </div>
              )}
            </div>

            {/* Energy Bar Indicator */}
            <div className="tma-energy-hud">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 13 }}>⚡</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>
                    {energy} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>/ {maxEnergy}</span>
                  </span>
                </div>
                <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--neon-lime)', letterSpacing: 0.5 }}>
                  {hasNode ? '3X BOOST ACTIVE' : `SPEED: ${effectiveRate} $AIPCORE/HR`}
                </span>
              </div>
              <div className="tma-energy-bar">
                <div 
                  className="tma-energy-fill" 
                  style={{ width: `${(energy / maxEnergy) * 100}%` }}
                />
              </div>
            </div>

            {/* Free users: Action Boost & Claim Buttons */}
            {!hasNode && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'stretch' }}>
                <button
                  onClick={() => setActiveTab('mine')}
                  style={{
                    flex: isFreeActive ? 1 : 0.65,
                    background: 'var(--neon-lime)',
                    border: 'none', borderRadius: 16, padding: '12px 10px', cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(163, 255, 18, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 950, color: '#000', letterSpacing: 0.5 }}>⚡ ACTIVATE NODE</span>
                    <span style={{ fontSize: 9, fontWeight: 900, color: 'rgba(0,0,0,0.6)' }}>UNLOCK 10X SPEED & PASSIVE YIELD</span>
                  </div>
                </button>

                {!isFreeActive && (
                  <button
                    onClick={onClaim}
                    disabled={isClaiming || isExpired || totalMined <= 0}
                    style={{
                      flex: 0.35,
                      background: (totalMined > 0 && !isExpired) ? '#4FC3F7' : 'rgba(255,255,255,0.03)',
                      border: 'none', borderRadius: 16, padding: '12px 5px',
                      cursor: (totalMined > 0 && !isExpired) ? 'pointer' : 'not-allowed',
                      opacity: isClaiming ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 950, color: (totalMined > 0 && !isExpired) ? '#000' : 'rgba(255,255,255,0.15)' }}>
                        {isClaiming ? '⏳' : 'CLAIM'}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 900, color: (totalMined > 0 && !isExpired) ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.1)' }}>
                        +{totalMined.toFixed(2)} $AIPCORE
                      </span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

      ) : (
        /* ── HISTORY VIEW ── */
        <div className="tma-history-panel">
          <div className="tma-history-header">
            <div style={{ display: 'flex', background: '#1f2937', borderRadius: 20, padding: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div
                onClick={() => setHistoryMode('personal')}
                style={{
                  padding: '6px 14px', borderRadius: 16, fontSize: 11, fontWeight: 900, cursor: 'pointer',
                  background: historyMode === 'personal' ? 'var(--neon-lime)' : 'transparent',
                  color: historyMode === 'personal' ? '#000' : '#FFB74D'
                }}
              >MY TEAM</div>
              <div
                onClick={() => { setHistoryMode('global'); fetchGlobalHistory(); }}
                style={{
                  padding: '6px 14px', borderRadius: 16, fontSize: 11, fontWeight: 900, cursor: 'pointer',
                  background: historyMode === 'global' ? 'var(--neon-lime)' : 'transparent',
                  color: historyMode === 'global' ? '#000' : '#FFD700'
                }}
              >LIVE FEED 🌍</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  background: '#1f2937',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#A3FF12',
                  borderRadius: 12,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 900,
                  outline: 'none',
                  colorScheme: 'dark'
                }}
              />
              <span style={{ fontSize: 14, color: '#A3FF12', cursor: 'pointer', paddingRight: 8 }} onClick={() => historyMode === 'personal' ? fetchTeamHistory() : fetchGlobalHistory()}>🔄</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isHistoryLoading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4FC3F7' }}>
                Syncing Blockchain Events...
              </motion.div>
            ) : (historyMode === 'personal' ? teamHistory : globalHistory).length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#9ca3af' }}>
                <div style={{ fontSize: 40 }}>💤</div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb' }}>No {historyMode} income found yet.</p>
              </motion.div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {(() => {
                  const sourceHistory = historyMode === 'personal' ? teamHistory : globalHistory;
                  
                  // Filter by selected date and 2 days prior
                  const [sYear, sMonth, sDay] = selectedDate.split('-').map(Number);
                  const targetDate = new Date(sYear, sMonth - 1, sDay);
                  const targetDate1 = new Date(sYear, sMonth - 1, sDay - 1);
                  const targetDate2 = new Date(sYear, sMonth - 1, sDay - 2);
                  
                  const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const allowedDates = [toStr(targetDate), toStr(targetDate1), toStr(targetDate2)];

                  const filteredHistory = sourceHistory.filter(item => {
                    const d = new Date(item.timestamp);
                    return allowedDates.includes(toStr(d));
                  });

                  if (filteredHistory.length === 0) {
                     return (
                       <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px 0', fontSize: 12, fontWeight: 700 }}>
                         No income events between {targetDate2.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} and {targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}.
                       </div>
                     );
                  }

                  const grouped = filteredHistory.reduce((acc, item) => {
                    const dateStr = new Date(item.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    if (!acc[dateStr]) acc[dateStr] = { items: [], totalBnb: 0, totalUsd: 0 };
                    acc[dateStr].items.push(item);
                    if (!item.is_missed) {
                      acc[dateStr].totalBnb += Number(item.amount_bnb || 0);
                      acc[dateStr].totalUsd += Number(item.amount_usd || 0);
                    }
                    return acc;
                  }, {});

                  const sortedDays = Object.entries(grouped);
                  const displayedDays = sortedDays.slice(0, visibleDays);

                  return (
                    <>
                      {displayedDays.map(([dateLabel, group], groupIdx) => (
                        <div key={dateLabel} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {/* Day divider with Totals */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: 4 }}>
                            <div style={{ fontSize: 11, fontWeight: 900, color: '#FF5252', letterSpacing: 1, textTransform: 'uppercase' }}>
                              {dateLabel}
                            </div>
                            <div style={{ background: 'rgba(79,195,247,0.1)', border: '1px solid rgba(79,195,247,0.2)', padding: '2px 8px', borderRadius: 8, display: 'flex', gap: 8 }}>
                              <span style={{ fontSize: 9, fontWeight: 900, color: '#4FC3F7' }}>{group.totalBnb.toFixed(5)} {nativeSymbol}</span>
                              <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', opacity: 0.6 }}>${group.totalUsd.toFixed(2)}</span>
                            </div>
                          </div>

                          {group.items.map((item, idx) => {
                            const getIcon = (type) => {
                              if (item.is_missed) return '⚠️';
                              switch (type) {
                                case 'Referral': return '🤝';
                                case 'Direct Upgrade': return '⚡';
                                case 'Layer Income': return '🪜';
                                case 'Matrix Income': return '🌀';
                                case 'Global Pool': return '🏆';
                                default: return '💰';
                              }
                            };

                            const isMissed = !!item.is_missed;

                            return (
                              <motion.div
                                key={item.id || item.tx_hash || idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: (groupIdx * 0.05) + (idx * 0.02) }}
                                style={{
                                  background: isMissed ? 'rgba(255,59,48,0.05)' : 'rgba(255,255,255,0.03)',
                                  border: isMissed ? '1px solid rgba(255,59,48,0.2)' : '1px solid rgba(255,255,255,0.06)',
                                  borderRadius: 16, padding: '12px 14px',
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{
                                    width: 32, height: 32, borderRadius: 8,
                                    background: isMissed ? 'rgba(255,59,48,0.1)' : 'rgba(163,255,18,0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                                  }}>
                                    {getIcon(item.event_type)}
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ fontSize: 12, fontWeight: 800, color: isMissed ? '#FF3B30' : '#fff' }}>
                                        {item.event_type}
                                      </span>
                                      {isMissed && (
                                        <span style={{ fontSize: 9, background: '#FF3B30', color: '#fff', padding: '2px 5px', borderRadius: 4, fontWeight: 900 }}>MISSED</span>
                                      )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                      {historyMode === 'global' && item.wallet_address && (
                                        <span style={{ fontSize: 10, color: '#FFFFFF', fontWeight: 700 }}>To {item.wallet_address}</span>
                                      )}
                                      {historyMode === 'personal' && item.from_node_id > 0 && (
                                        <span style={{ fontSize: 10, color: '#FFB74D', fontWeight: 600 }}>From #{item.from_node_id}</span>
                                      )}
                                      {item.tier > 0 && (
                                        <span style={{ fontSize: 9, color: 'var(--neon-lime)', opacity: 0.8 }}>Tier {item.tier}</span>
                                      )}
                                      {item.layer > 0 && (
                                        <span style={{ fontSize: 9, color: '#FFD700' }}>Lvl {item.layer}</span>
                                      )}
                                      <span style={{ fontSize: 9, color: '#4FC3F7', fontWeight: 600 }}>
                                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div style={{ textAlign: 'right', minWidth: 90 }}>
                                  <div style={{ fontSize: 13, fontWeight: 900, color: isMissed ? '#FF3B30' : 'var(--neon-lime)', letterSpacing: 0.3 }}>
                                    {isMissed ? '-' : '+'}{Number(item.amount_bnb || 0).toFixed(5)} {nativeSymbol}
                                  </div>
                                  {item.amount_usd != null && (
                                    <div style={{ fontSize: 11, fontWeight: 700, color: isMissed ? 'rgba(255,59,48,0.6)' : '#4FC3F7', marginTop: 2 }}>
                                      ≈ ${Number(item.amount_usd).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ))}

                      {sortedDays.length > visibleDays && (
                        <button
                          onClick={() => setVisibleDays(prev => prev + 7)}
                          style={{
                            width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)',
                            borderRadius: 16, padding: '16px', color: '#4FC3F7', fontSize: 11, fontWeight: 900,
                            letterSpacing: 1, cursor: 'pointer', marginTop: 10, marginBottom: 40
                          }}>
                          LOAD PREVIOUS DAYS ({sortedDays.length - visibleDays} LEFT)
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </AnimatePresence>
          <div style={{ height: 40 }} /> {/* Spacer */}
        </div>
      )}
      </div>{/* end conditional view wrapper */}

      {/* ── Welcome Bonus Modal ── */}
      {/* FIX: Added isNewUser guard — previously showed for ANY user who hadn't claimed,
           meaning returning users who skipped it got permanently blocked by this overlay.
           Fallback: also show for accounts less than 24 hours old (catches new users
           who connected before isNewUser was set in older versions). */}
      {(() => {
        const isVeryNew = createdAt && (Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000);
        const shouldShowBonus = initialLoaded && !claimedMilestones?.includes('signup_bonus') && (isNewUser || isVeryNew);
        return shouldShowBonus;
      })() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
            }}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              style={{
                width: '100%', maxWidth: 320, background: 'linear-gradient(135deg, #1A1A1A 0%, #0D0D0D 100%)',
                borderRadius: 28, border: '1px solid rgba(163,255,18,0.2)', padding: '32px 24px',
                textAlign: 'center', position: 'relative', overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(163,255,18,0.1)'
              }}
            >
              {/* Decorative elements */}
              <div style={{ position: 'absolute', top: -40, right: -40, width: 100, height: 100, background: 'radial-gradient(circle, rgba(163,255,18,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
              
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
              
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: -0.5 }}>Welcome Bonus!</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 24 }}>
                Welcome to AIPCore! Here is a special starter gift to kickstart your mining journey.
              </p>
              
              <div style={{ 
                background: 'rgba(163,255,18,0.05)', borderRadius: 20, padding: '20px 10px', 
                border: '1px dashed rgba(163,255,18,0.2)', marginBottom: 28 
              }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--neon-lime)', letterSpacing: 1.5, marginBottom: 4 }}>YOU RECEIVE</div>
                <div style={{ fontSize: 36, fontWeight: 950, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ color: '#FFD700' }}>$AIPCORE</span> 100
                </div>
              </div>

              <button
                disabled={isBonusClaiming}
                onClick={async () => {
                  if (isBonusClaiming) return;
                  setIsBonusClaiming(true);
                  try {
                    const res = await claimSignupBonusAction();
                    if (res?.success) {
                      toast.success('100 $AIPCORE Bonus Claimed! 🚀', { duration: 4000 });
                    }
                  } catch (err) {
                    toast.error(err.message || 'Failed to claim bonus');
                  } finally {
                    setIsBonusClaiming(false);
                  }
                }}
                style={{
                  width: '100%', background: 'var(--neon-lime)', border: 'none', borderRadius: 16,
                  padding: '16px', fontSize: 13, fontWeight: 950, color: '#000', cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(163,255,18,0.3)', transition: 'transform 0.2s',
                  opacity: isBonusClaiming ? 0.6 : 1
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {isBonusClaiming ? 'CLAIMING...' : 'CLAIM GIFT NOW'}
              </button>
            </motion.div>
          </motion.div>
        )
      }
    </div>
  );
}
