import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────
// CONSTANTS & MOCK DATA
// ─────────────────────────────────────────────────────────

const GIFTS = [
  { id: 1, name: 'Diamond Ring',   emoji: '💍', rarity: 'Legendary', color: '#a78bfa', price: 271  },
  { id: 2, name: 'Golden Star',    emoji: '⭐', rarity: 'Rare',      color: '#fbbf24', price: 276  },
  { id: 3, name: 'Witch Cauldron', emoji: '🧪', rarity: 'Rare',      color: '#34d399', price: 195  },
  { id: 4, name: 'Skull Dome',     emoji: '💀', rarity: 'Uncommon',  color: '#9ca3af', price: 145  },
  { id: 5, name: 'Pacifier',       emoji: '🍼', rarity: 'Common',    color: '#60a5fa', price: 89   },
  { id: 6, name: 'Crystal Ball',   emoji: '🔮', rarity: 'Legendary', color: '#c084fc', price: 512  },
  { id: 7, name: 'Fire Rocket',    emoji: '🚀', rarity: 'Epic',      color: '#f97316', price: 399  },
  { id: 8, name: 'Love Potion',    emoji: '💕', rarity: 'Uncommon',  color: '#f472b6', price: 133  },
  { id: 9, name: 'Trophy Cup',     emoji: '🏆', rarity: 'Epic',      color: '#fbbf24', price: 340  },
  { id: 10, name: 'Magic Wand',    emoji: '🪄', rarity: 'Rare',      color: '#818cf8', price: 210  },
  { id: 11, name: 'Lucky Charm',   emoji: '🍀', rarity: 'Common',    color: '#4ade80', price: 67   },
  { id: 12, name: 'Thunder Bolt',  emoji: '⚡', rarity: 'Epic',      color: '#facc15', price: 450  },
];

const RARITY_COLOR = {
  Common:    '#9ca3af',
  Uncommon:  '#60a5fa',
  Rare:      '#34d399',
  Epic:      '#c084fc',
  Legendary: '#fbbf24',
};

const LEADERBOARD = [
  { rank: 1,  name: 'CryptoKing',   avatar: '👑', stars: 12400, flag: '🇺🇸' },
  { rank: 2,  name: 'MoonWalker',   avatar: '🌙', stars: 9850,  flag: '🇬🇧' },
  { rank: 3,  name: 'DiamondHands', avatar: '💎', stars: 8720,  flag: '🇩🇪' },
  { rank: 4,  name: 'TurboFrog',    avatar: '🐸', stars: 7300,  flag: '🇯🇵' },
  { rank: 5,  name: 'StarHunter',   avatar: '⭐', stars: 6100,  flag: '🇮🇳' },
  { rank: 6,  name: 'NightOwl',     avatar: '🦉', stars: 5800,  flag: '🇫🇷' },
  { rank: 7,  name: 'SilverFox',    avatar: '🦊', stars: 4990,  flag: '🇧🇷' },
  { rank: 8,  name: 'GoldenEagle',  avatar: '🦅', stars: 4200,  flag: '🇨🇳' },
  { rank: 9,  name: 'CometChaser',  avatar: '☄️', stars: 3750,  flag: '🇦🇺' },
  { rank: 10, name: 'You',          avatar: '🐸', stars: 1250,  flag: '🌍', isMe: true },
];

const LIVE_WINS = [
  { user: 'Star★',   reward: '340 ⭐', gift: GIFTS[0] },
  { user: 'MoonX',   reward: '210 ⭐', gift: GIFTS[5] },
  { user: 'King7',   reward: GIFTS[6].emoji + ' ' + GIFTS[6].name, gift: GIFTS[6] },
  { user: 'Turbo',   reward: '89 ⭐',  gift: GIFTS[4] },
  { user: 'Ace99',   reward: GIFTS[2].emoji + ' ' + GIFTS[2].name, gift: GIFTS[2] },
  { user: 'Fox22',   reward: '450 ⭐', gift: GIFTS[11] },
];

const TOURNAMENT_PRIZES = [GIFTS[5], GIFTS[0], GIFTS[8], GIFTS[2], GIFTS[3]];

// ─────────────────────────────────────────────────────────
// UTILITY HOOKS
// ─────────────────────────────────────────────────────────

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calc = () => {
      const diff = targetDate - Date.now();
      if (diff <= 0) return setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  return timeLeft;
}

// ─────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────

function GiftBadge({ gift, size = 40 }) {
  return (
    <div style={{
      width: size, height: size,
      background: `${gift.color}22`,
      border: `1.5px solid ${gift.color}55`,
      borderRadius: size * 0.25,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.48,
      flexShrink: 0,
    }}>
      {gift.emoji}
    </div>
  );
}

function StarBadge({ count }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)',
      borderRadius: 20, padding: '3px 9px', fontSize: 12, fontWeight: 900,
      color: '#fbbf24',
    }}>
      ⭐ {count.toLocaleString()}
    </span>
  );
}

function OverlayWrapper({ onClose, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 2000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        style={{
          width: '100%', maxWidth: 500,
          background: 'linear-gradient(180deg, #111827 0%, #0d1117 100%)',
          borderRadius: '28px 28px 0 0',
          border: '1.5px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '12px 0 32px',
        }}
      >
        {/* Drag pill */}
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 16px' }} />
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// MINI-GAMES
// ─────────────────────────────────────────────────────────

// --- Daily Case ---
function DailyCaseGame({ onClose, onWin }) {
  const [phase, setPhase] = useState('idle'); // idle | spinning | result
  const [result, setResult] = useState(null);
  const PRIZES = [
    { label: '⭐ 50',  stars: 50,  chance: 40 },
    { label: '⭐ 100', stars: 100, chance: 25 },
    { label: GIFTS[4].emoji + ' ' + GIFTS[4].name, stars: 0, gift: GIFTS[4], chance: 15 },
    { label: '⭐ 200', stars: 200, chance: 10 },
    { label: GIFTS[2].emoji + ' ' + GIFTS[2].name, stars: 0, gift: GIFTS[2], chance: 7  },
    { label: '⭐ 500', stars: 500, chance: 2  },
    { label: GIFTS[0].emoji + ' ' + GIFTS[0].name, stars: 0, gift: GIFTS[0], chance: 1  },
  ];

  const open = () => {
    if (phase !== 'idle') return;
    setPhase('spinning');
    setTimeout(() => {
      const rand = Math.random() * 100;
      let cum = 0;
      let picked = PRIZES[0];
      for (const p of PRIZES) { cum += p.chance; if (rand < cum) { picked = p; break; } }
      setResult(picked);
      setPhase('result');
      onWin(picked.stars || 0, picked.gift || null);
    }, 2000);
  };

  return (
    <OverlayWrapper onClose={onClose}>
      <div style={{ padding: '0 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>📦</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Daily Case</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 28 }}>
          Open once per day to win Stars or exclusive NFT gifts
        </p>

        {/* Prize pool grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 28 }}>
          {PRIZES.map((p, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '10px 6px',
              border: `1px solid ${result === p ? '#fbbf24' : 'rgba(255,255,255,0.08)'}`,
              transition: 'all 0.3s',
              transform: result === p ? 'scale(1.08)' : 'scale(1)',
              boxShadow: result === p ? '0 0 20px rgba(251,191,36,0.4)' : 'none',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{p.label.split(' ')[0]}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{p.chance}%</div>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {phase === 'spinning' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ fontSize: 40, marginBottom: 20, animation: 'spin 0.5s linear infinite' }}>
              🎲
            </motion.div>
          )}
          {phase === 'result' && result && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ background: 'rgba(251,191,36,0.1)', border: '1.5px solid rgba(251,191,36,0.4)', borderRadius: 16, padding: '16px', marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>{result.label.split(' ')[0]}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24' }}>
                {result.gift ? `You won: ${result.gift.name}!` : `You won: ${result.label}!`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={phase === 'result' ? onClose : open}
          disabled={phase === 'spinning'}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: phase === 'result' ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #fbbf24, #f97316)',
            color: phase === 'result' ? '#fff' : '#000',
            fontSize: 16, fontWeight: 900, cursor: 'pointer',
          }}
        >
          {phase === 'idle' ? '🎁 Open Case (Free)' : phase === 'spinning' ? '⏳ Opening...' : '✅ Claim & Close'}
        </motion.button>
      </div>
    </OverlayWrapper>
  );
}

// --- Upgrade Game ---
function UpgradeGame({ inventory, onClose, onWin }) {
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | spinning | win | lose
  const [chance] = useState(55);

  const doUpgrade = () => {
    if (!selected || phase !== 'idle') return;
    setPhase('spinning');
    setTimeout(() => {
      const win = Math.random() * 100 < chance;
      setPhase(win ? 'win' : 'lose');
      if (win) {
        const higherIdx = Math.min(selected.id, GIFTS.length - 1);
        onWin(0, GIFTS[higherIdx]);
      }
    }, 2000);
  };

  const upgradedGift = selected ? GIFTS[Math.min(selected.id, GIFTS.length - 1)] : null;

  return (
    <OverlayWrapper onClose={onClose}>
      <div style={{ padding: '0 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 6 }}>⬆️</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Upgrade</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
          Gamble your gift for a better one — {chance}% success rate
        </p>

        {/* Upgrade visual */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>YOUR GIFT</div>
            {selected
              ? <GiftBadge gift={selected} size={72} />
              : <div style={{ width: 72, height: 72, border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'rgba(255,255,255,0.2)' }}>?</div>
            }
          </div>
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontSize: 32 }}
          >⚡</motion.div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>POSSIBLE WIN</div>
            {upgradedGift
              ? <GiftBadge gift={upgradedGift} size={72} />
              : <div style={{ width: 72, height: 72, border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'rgba(255,255,255,0.2)' }}>🎁</div>
            }
          </div>
        </div>

        {/* Inventory selector */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textAlign: 'left', marginBottom: 8, letterSpacing: 1 }}>SELECT FROM INVENTORY</div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 20 }}>
          {inventory.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: '20px 0', width: '100%', textAlign: 'center' }}>
              No gifts in inventory — win some from the Daily Case or Store!
            </div>
          )}
          {inventory.map((g, i) => (
            <motion.div key={i} whileTap={{ scale: 0.92 }} onClick={() => { if (phase === 'idle') setSelected(g); }}
              style={{
                flexShrink: 0, padding: 8, borderRadius: 14,
                border: `2px solid ${selected?.id === g.id ? g.color : 'rgba(255,255,255,0.1)'}`,
                background: selected?.id === g.id ? `${g.color}15` : 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
              }}
            >
              <GiftBadge gift={g} size={48} />
            </motion.div>
          ))}
        </div>

        {/* Result Banner */}
        <AnimatePresence>
          {phase === 'win' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid #4ade80', borderRadius: 14, padding: 14, marginBottom: 16, color: '#4ade80', fontWeight: 900, fontSize: 16 }}>
              🎉 Upgrade Successful! You got {upgradedGift?.name}!
            </motion.div>
          )}
          {phase === 'lose' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 14, padding: 14, marginBottom: 16, color: '#ef4444', fontWeight: 900, fontSize: 16 }}>
              💥 Upgrade Failed! Your gift was lost.
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button whileTap={{ scale: 0.96 }} onClick={phase === 'idle' ? doUpgrade : onClose} disabled={!selected || phase === 'spinning'}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: !selected || phase === 'spinning' ? 'rgba(255,255,255,0.1)' : (phase === 'idle' ? 'linear-gradient(135deg, #a78bfa, #7c3aed)' : 'rgba(255,255,255,0.1)'),
            color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
          }}>
          {phase === 'idle' ? `⬆️ Upgrade (${chance}% chance)` : phase === 'spinning' ? '⏳ Upgrading...' : '✅ Done'}
        </motion.button>
      </div>
    </OverlayWrapper>
  );
}

// --- Roulette ---
function RouletteGame({ onClose, onWin }) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const SLOTS = [
    { label: '⭐ 100', color: '#fbbf24', stars: 100 },
    { label: '⭐ 50',  color: '#60a5fa', stars: 50  },
    { label: '💍 Ring',color: '#a78bfa', stars: 0, gift: GIFTS[0] },
    { label: '⭐ 200', color: '#34d399', stars: 200 },
    { label: '⭐ 25',  color: '#f472b6', stars: 25  },
    { label: '🍀 Luck',color: '#4ade80', stars: 0, gift: GIFTS[10] },
    { label: '⭐ 500', color: '#f97316', stars: 500 },
    { label: '❌ Miss', color: '#6b7280', stars: 0  },
  ];

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    const extraSpins = (5 + Math.floor(Math.random() * 4)) * 360;
    const target = Math.floor(Math.random() * SLOTS.length);
    const finalAngle = extraSpins + target * (360 / SLOTS.length);
    setRotation(prev => prev + finalAngle);
    setTimeout(() => {
      setSpinning(false);
      setResult(SLOTS[target]);
      onWin(SLOTS[target].stars || 0, SLOTS[target].gift || null);
    }, 4000);
  };

  return (
    <OverlayWrapper onClose={onClose}>
      <div style={{ padding: '0 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🎡 Roulette</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>Spin for a chance to win big!</p>

        {/* Roulette Wheel */}
        <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto 24px' }}>
          {/* Pointer */}
          <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', fontSize: 24, zIndex: 10 }}>🔻</div>
          {/* Wheel */}
          <motion.div
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.17, 0.67, 0.1, 0.97] }}
            style={{
              width: '100%', height: '100%', borderRadius: '50%',
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 0 40px rgba(251,191,36,0.2)',
              border: '4px solid rgba(255,255,255,0.15)',
            }}
          >
            {SLOTS.map((s, i) => {
              const angle = (360 / SLOTS.length) * i;
              return (
                <div key={i} style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: '50%', height: '50%',
                  transformOrigin: '0 0',
                  transform: `rotate(${angle}deg) skewY(${90 - 360 / SLOTS.length}deg)`,
                  background: s.color,
                  opacity: 0.9,
                }} />
              );
            })}
            {/* Center circle */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 60, height: 60, borderRadius: '50%',
              background: '#111827', border: '3px solid rgba(255,255,255,0.2)',
              zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}>🐸</div>
          </motion.div>
        </div>

        {/* Slot labels */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
          {SLOTS.map((s, i) => (
            <span key={i} style={{
              background: `${s.color}22`, border: `1px solid ${s.color}66`,
              borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: s.color,
            }}>{s.label}</span>
          ))}
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 14, padding: 14, marginBottom: 16, fontWeight: 900, color: '#fbbf24', fontSize: 16 }}>
              {result.stars > 0 ? `🎉 You won ⭐ ${result.stars}!` : result.gift ? `🎉 You won ${result.gift.emoji} ${result.gift.name}!` : '😢 No luck this time!'}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button whileTap={{ scale: 0.96 }} onClick={result ? onClose : spin} disabled={spinning}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: spinning ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #fbbf24, #f97316)',
            color: '#000', fontSize: 16, fontWeight: 900, cursor: 'pointer',
          }}>
          {spinning ? '⏳ Spinning...' : result ? '✅ Done' : '🎡 Spin the Wheel!'}
        </motion.button>
      </div>
    </OverlayWrapper>
  );
}

// --- Crash Game ---
function CrashGame({ onClose, onWin }) {
  const [phase, setPhase] = useState('betting'); // betting | flying | crashed | cashed
  const [bet, setBet] = useState(100);
  const [multiplier, setMultiplier] = useState(1.00);
  const [crashAt, setCrashAt] = useState(null);
  const [autoCash, setAutoCash] = useState(2.0);
  const intervalRef = useRef(null);

  const start = () => {
    const crash = 1 + Math.random() * 8; // crash between 1x and 9x
    setCrashAt(crash);
    setMultiplier(1.00);
    setPhase('flying');
    intervalRef.current = setInterval(() => {
      setMultiplier(prev => {
        const next = parseFloat((prev + 0.04 + prev * 0.003).toFixed(2));
        if (next >= crash) {
          clearInterval(intervalRef.current);
          setPhase('crashed');
          return crash;
        }
        return next;
      });
    }, 100);
  };

  const cashOut = () => {
    if (phase !== 'flying') return;
    clearInterval(intervalRef.current);
    setPhase('cashed');
    const winnings = Math.floor(bet * multiplier);
    onWin(winnings, null);
  };

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  // Auto cash-out
  useEffect(() => {
    if (phase === 'flying' && multiplier >= autoCash) {
      cashOut();
    }
  }, [multiplier, phase]);

  const rocketX = phase === 'flying' || phase === 'cashed' || phase === 'crashed' ? Math.min(multiplier / 10, 1) * 180 : 0;
  const rocketY = phase === 'flying' || phase === 'cashed' || phase === 'crashed' ? Math.min(multiplier / 10, 1) * -120 : 0;

  return (
    <OverlayWrapper onClose={onClose}>
      <div style={{ padding: '0 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🚀 Crash</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
          Cash out before the rocket crashes — multiplier grows every second!
        </p>

        {/* Crash Chart */}
        <div style={{
          height: 180, background: 'rgba(255,255,255,0.03)', borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16,
          position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
          padding: 16,
        }}>
          {/* Grid lines */}
          {[1, 2, 3, 5, 8].map(m => (
            <div key={m} style={{
              position: 'absolute', bottom: 16 + (m - 1) * 30, left: 0, right: 0,
              borderTop: '1px dashed rgba(255,255,255,0.06)',
            }}>
              <span style={{ position: 'absolute', left: 8, fontSize: 8, color: 'rgba(255,255,255,0.2)', fontWeight: 700 }}>{m}x</span>
            </div>
          ))}

          {/* Multiplier display */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            fontSize: 48, fontWeight: 900,
            color: phase === 'crashed' ? '#ef4444' : phase === 'cashed' ? '#4ade80' : '#fff',
            textShadow: `0 0 30px ${phase === 'crashed' ? '#ef4444' : '#fff'}`,
            transition: 'color 0.2s',
          }}>
            {multiplier.toFixed(2)}x
          </div>

          {/* Rocket */}
          <motion.div
            animate={{ x: rocketX, y: rocketY }}
            transition={{ duration: 0.1 }}
            style={{ fontSize: 32, position: 'absolute', bottom: 16, left: 16 }}
          >
            {phase === 'crashed' ? '💥' : '🚀'}
          </motion.div>

          {/* Status overlay */}
          {phase === 'crashed' && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 900, color: '#ef4444',
            }}>CRASHED @ {crashAt?.toFixed(2)}x</div>
          )}
          {phase === 'cashed' && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(74,222,128,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 900, color: '#4ade80',
            }}>✅ CASHED OUT! +{Math.floor(bet * multiplier)} ⭐</div>
          )}
        </div>

        {/* Bet controls */}
        {phase === 'betting' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 6 }}>BET (⭐)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setBet(Math.max(10, bet - 10))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 900 }}>−</button>
                <span style={{ flex: 1, textAlign: 'center', fontWeight: 900, fontSize: 18 }}>{bet}</span>
                <button onClick={() => setBet(bet + 10)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 900 }}>+</button>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 6 }}>AUTO CASH AT</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setAutoCash(Math.max(1.1, parseFloat((autoCash - 0.1).toFixed(1))))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 900 }}>−</button>
                <span style={{ flex: 1, textAlign: 'center', fontWeight: 900, fontSize: 18 }}>{autoCash}x</span>
                <button onClick={() => setAutoCash(parseFloat((autoCash + 0.1).toFixed(1)))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 900 }}>+</button>
              </div>
            </div>
          </div>
        )}

        <motion.button whileTap={{ scale: 0.96 }}
          onClick={
            phase === 'betting' ? start :
            phase === 'flying' ? cashOut :
            onClose
          }
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer',
            fontSize: 16, fontWeight: 900, color: '#000',
            background: phase === 'flying'
              ? 'linear-gradient(135deg, #4ade80, #16a34a)'
              : phase === 'crashed' || phase === 'cashed'
              ? 'rgba(255,255,255,0.1)'
              : 'linear-gradient(135deg, #f97316, #dc2626)',
          }}>
          {phase === 'betting' ? `🚀 Launch (Bet: ${bet} ⭐)` :
           phase === 'flying' ? `💰 CASH OUT @ ${multiplier.toFixed(2)}x` :
           '✅ Done'}
        </motion.button>
      </div>
    </OverlayWrapper>
  );
}

// --- Arena ---
function ArenaGame({ onClose, onWin }) {
  const [phase, setPhase] = useState('idle'); // idle | battle | result
  const [results, setResults] = useState([]);
  const [won, setWon] = useState(false);
  const [betStars] = useState(100);

  const opponents = [
    { name: 'CryptoKing', avatar: '👑', power: 75 },
    { name: 'MoonWalker', avatar: '🌙', power: 60 },
    { name: 'DiamondHands', avatar: '💎', power: 85 },
  ];

  const battle = () => {
    if (phase !== 'idle') return;
    setPhase('battle');
    setResults([]);
    let delay = 0;
    const myPower = 70;
    let wins = 0;
    opponents.forEach((opp, i) => {
      delay += 600;
      setTimeout(() => {
        const iWin = myPower + Math.random() * 30 > opp.power + Math.random() * 30;
        if (iWin) wins++;
        setResults(prev => [...prev, { opp, iWin }]);
        if (i === opponents.length - 1) {
          setTimeout(() => {
            setPhase('result');
            const finalWin = wins >= 2;
            setWon(finalWin);
            if (finalWin) onWin(betStars * 2, null);
          }, 400);
        }
      }, delay);
    });
  };

  return (
    <OverlayWrapper onClose={onClose}>
      <div style={{ padding: '0 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>⚔️ Arena</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
          Battle 3 opponents — win 2/3 to double your stars!
        </p>

        {/* Player vs Opponents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {opponents.map((opp, i) => {
            const res = results[i];
            return (
              <motion.div key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: res ? (res.iWin ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)') : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${res ? (res.iWin ? '#4ade80' : '#ef4444') : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14, padding: '12px 16px', transition: 'all 0.4s',
                }}>
                <div style={{ fontSize: 28 }}>🐸</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 900 }}>You</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Power: 70 + luck</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: res ? (res.iWin ? '#4ade80' : '#ef4444') : 'rgba(255,255,255,0.3)' }}>
                  {res ? (res.iWin ? '⚔️ WIN' : '💀 LOSS') : 'vs'}
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 900 }}>{opp.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Power: {opp.power}</div>
                </div>
                <div style={{ fontSize: 28 }}>{opp.avatar}</div>
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {phase === 'result' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              style={{
                background: won ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
                border: `1px solid ${won ? '#4ade80' : '#ef4444'}`,
                borderRadius: 14, padding: 16, marginBottom: 16,
                fontSize: 18, fontWeight: 900,
                color: won ? '#4ade80' : '#ef4444',
              }}>
              {won ? `🏆 You Win! +${betStars * 2} ⭐` : '😢 Better luck next time!'}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button whileTap={{ scale: 0.96 }}
          onClick={phase === 'idle' ? battle : onClose}
          disabled={phase === 'battle'}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer',
            fontSize: 16, fontWeight: 900, color: '#000',
            background: phase === 'battle' ? 'rgba(255,255,255,0.1)' : (phase === 'result' ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #f97316, #dc2626)'),
          }}>
          {phase === 'idle' ? `⚔️ Enter Arena (${betStars} ⭐ bet)` : phase === 'battle' ? '⚔️ Battling...' : '✅ Done'}
        </motion.button>
      </div>
    </OverlayWrapper>
  );
}

// --- Frogs (Shell Game) ---
function FrogsGame({ onClose, onWin }) {
  const [phase, setPhase] = useState('showing'); // showing | picking | result
  const [cups, setCups] = useState([0, 1, 2]);
  const [frogPos, setFrogPos] = useState(Math.floor(Math.random() * 3));
  const [shufflePos, setShufflePos] = useState(null);
  const [selected, setSelected] = useState(null);
  const [shuffled, setShuffled] = useState(false);

  useEffect(() => {
    // Show frog then shuffle
    const t1 = setTimeout(() => {
      let shuffleCount = 0;
      const shuffle = setInterval(() => {
        setFrogPos(prev => (prev + 1 + Math.floor(Math.random() * 2)) % 3);
        shuffleCount++;
        if (shuffleCount >= 8) {
          clearInterval(shuffle);
          setShuffled(true);
          setPhase('picking');
        }
      }, 400);
    }, 1500);
    return () => clearTimeout(t1);
  }, []);

  const pick = (idx) => {
    if (phase !== 'picking') return;
    setSelected(idx);
    setPhase('result');
    const win = idx === frogPos;
    onWin(win ? 300 : 0, win ? GIFTS[10] : null);
  };

  return (
    <OverlayWrapper onClose={onClose}>
      <div style={{ padding: '0 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🐸 Frogs</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
          {phase === 'showing' ? 'Watch where the frog hides...'
           : phase === 'picking' ? 'Which cup hides the lucky frog?'
           : selected === frogPos ? '🎉 You found the frog!' : '😢 Wrong cup!'}
        </p>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 24 }}>
          WIN: ⭐ 300 + 🍀 Lucky Charm
        </div>

        {/* Cups */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 32 }}>
          {[0, 1, 2].map(i => {
            const isHere = frogPos === i;
            const reveal = phase === 'result';
            const isSelected = selected === i;
            return (
              <motion.button key={i}
                onClick={() => pick(i)}
                whileTap={{ scale: 0.92 }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  background: reveal && isSelected ? (isHere ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)') : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${reveal && isSelected ? (isHere ? '#4ade80' : '#ef4444') : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 20, padding: '16px 20px', cursor: phase === 'picking' ? 'pointer' : 'default',
                  transition: 'all 0.3s',
                  width: 90,
                }}>
                {/* Cup */}
                <div style={{ fontSize: 40 }}>🍺</div>
                {/* Frog reveal */}
                <AnimatePresence>
                  {((phase === 'showing' && isHere && !shuffled) || (reveal && isHere)) && (
                    <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }}
                      style={{ fontSize: 24 }}>🐸</motion.div>
                  )}
                  {!((phase === 'showing' && isHere && !shuffled) || (reveal && isHere)) && (
                    <div style={{ fontSize: 24, color: 'transparent' }}>🐸</div>
                  )}
                </AnimatePresence>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Cup {i + 1}</div>
              </motion.button>
            );
          })}
        </div>

        {phase === 'result' && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.96 }}
            onClick={onClose}
            style={{
              width: '100%', padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer',
              background: selected === frogPos ? 'linear-gradient(135deg, #4ade80, #16a34a)' : 'rgba(255,255,255,0.1)',
              color: '#000', fontSize: 16, fontWeight: 900,
            }}>
            {selected === frogPos ? '🎉 Collect Reward' : '✅ Try Again Later'}
          </motion.button>
        )}
      </div>
    </OverlayWrapper>
  );
}

// ─────────────────────────────────────────────────────────
// WITHDRAW DRAWER
// ─────────────────────────────────────────────────────────

function WithdrawDrawer({ stars, onClose, onNavigateStore }) {
  const [tab, setTab] = useState('stars');
  const [username, setUsername] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState(100);

  const handleWithdraw = () => {
    if (!username.trim()) { toast.error('Enter your Telegram username first!'); return; }
    if (withdrawAmount > stars) { toast.error('Insufficient star balance!'); return; }
    toast.success(`⭐ ${withdrawAmount} Stars withdrawal request sent to @${username}!`);
    onClose();
  };

  return (
    <OverlayWrapper onClose={onClose}>
      <div style={{ padding: '0 20px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, textAlign: 'center', marginBottom: 16 }}>Withdraw Funds</h2>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {['stars', 'gifts'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: tab === t ? '#fbbf24' : 'transparent',
              color: tab === t ? '#000' : 'rgba(255,255,255,0.5)',
              fontWeight: 900, fontSize: 13, fontFamily: 'Outfit, sans-serif',
              transition: 'all 0.2s',
            }}>
              {t === 'stars' ? '⭐ Stars' : '🎁 Gifts'}
            </button>
          ))}
        </div>

        {tab === 'stars' && (
          <div>
            {/* Balance display */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(249,115,22,0.1))',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 20, padding: '24px', textAlign: 'center', marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>AVAILABLE BALANCE</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>⭐</div>
              <div style={{ fontSize: 36, fontWeight: 900, marginTop: 4 }}>{stars.toLocaleString()}</div>
            </div>

            {/* Username input */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>TELEGRAM USERNAME</div>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '0 14px' }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 6, fontSize: 16, fontWeight: 900 }}>@</span>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value.replace('@', ''))}
                  placeholder="your_username"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: '#fff', fontFamily: 'Outfit, sans-serif', fontWeight: 700,
                    fontSize: 16, padding: '14px 0',
                  }}
                />
              </div>
            </div>

            {/* Amount */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>AMOUNT</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[50, 100, 250, 500].map(a => (
                  <button key={a} onClick={() => setWithdrawAmount(a)}
                    style={{
                      flex: 1, padding: '10px 4px', borderRadius: 12, border: `1px solid ${withdrawAmount === a ? '#fbbf24' : 'rgba(255,255,255,0.1)'}`,
                      background: withdrawAmount === a ? 'rgba(251,191,36,0.15)' : 'transparent',
                      color: withdrawAmount === a ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                      fontWeight: 900, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                    }}>{a}</button>
                ))}
              </div>
            </div>

            <motion.button whileTap={{ scale: 0.97 }} onClick={handleWithdraw}
              style={{
                width: '100%', padding: '17px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #fbbf24, #f97316)',
                color: '#000', fontSize: 16, fontWeight: 900, fontFamily: 'Outfit, sans-serif',
              }}>
              ⭐ Withdraw {withdrawAmount} Stars
            </motion.button>
          </div>
        )}

        {tab === 'gifts' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎁</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Convert Gifts to Stars</div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
              Visit the store to purchase NFT gifts. Once you own a gift, you can sell it for stars or transfer it directly to your Telegram account.
            </p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={onNavigateStore}
              style={{
                padding: '14px 32px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                color: '#fff', fontSize: 15, fontWeight: 900, fontFamily: 'Outfit, sans-serif',
              }}>
              🛍️ Go to Store
            </motion.button>
          </div>
        )}
      </div>
    </OverlayWrapper>
  );
}

// ─────────────────────────────────────────────────────────
// BUY GIFT DIALOG
// ─────────────────────────────────────────────────────────

function BuyGiftDialog({ gift, stars, onClose, onBuy }) {
  const canAfford = stars >= gift.price;

  return (
    <OverlayWrapper onClose={onClose}>
      <div style={{ padding: '0 20px', textAlign: 'center' }}>
        <GiftBadge gift={gift} size={80} />
        <div style={{ marginTop: 16, marginBottom: 4, fontSize: 22, fontWeight: 900 }}>{gift.name}</div>
        <div style={{ display: 'inline-block', background: `${RARITY_COLOR[gift.rarity]}22`, border: `1px solid ${RARITY_COLOR[gift.rarity]}55`, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, color: RARITY_COLOR[gift.rarity], marginBottom: 24 }}>
          {gift.rarity}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Price</span>
            <span style={{ fontWeight: 900, color: '#fbbf24', fontSize: 16 }}>⭐ {gift.price}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Your Balance</span>
            <span style={{ fontWeight: 900, color: canAfford ? '#fff' : '#ef4444', fontSize: 16 }}>⭐ {stars.toLocaleString()}</span>
          </div>
        </div>

        {!canAfford && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 10, marginBottom: 16, fontSize: 13, color: '#ef4444', fontWeight: 700 }}>
            Insufficient Stars — need ⭐ {(gift.price - stars).toLocaleString()} more
          </div>
        )}

        <motion.button whileTap={{ scale: 0.96 }} onClick={canAfford ? onBuy : onClose}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: canAfford ? 'linear-gradient(135deg, #fbbf24, #f97316)' : 'rgba(255,255,255,0.1)',
            color: canAfford ? '#000' : '#fff', fontSize: 16, fontWeight: 900, fontFamily: 'Outfit, sans-serif',
          }}>
          {canAfford ? `🛍️ Buy for ⭐ ${gift.price}` : '✕ Close'}
        </motion.button>
      </div>
    </OverlayWrapper>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN TAB CONTENT COMPONENTS
// ─────────────────────────────────────────────────────────

const GAME_CARDS = [
  { id: 'upgrade',    label: 'Upgrade',      emoji: '⬆️',  color: '#7c3aed', bg: 'linear-gradient(135deg, #4c1d95, #1e1b4b)', desc: 'Level up your gifts' },
  { id: 'roulette',  label: 'Roulette',      emoji: '🎡',  color: '#f97316', bg: 'linear-gradient(135deg, #7c2d12, #1c0a03)', desc: 'Spin for big prizes'  },
  { id: 'crash',     label: 'Crash',         emoji: '🚀',  color: '#ef4444', bg: 'linear-gradient(135deg, #7f1d1d, #0f0a0a)', desc: 'Cash out in time!'   },
  { id: 'arena',     label: 'Arena',         emoji: '⚔️',  color: '#f97316', bg: 'linear-gradient(135deg, #78350f, #0c0600)', desc: 'Battle for glory'    },
  { id: 'frogs',     label: 'Frogs',         emoji: '🐸',  color: '#22c55e', bg: 'linear-gradient(135deg, #14532d, #031a0c)', desc: 'Find the lucky frog' },
];

function GamesTab({ stars, inventory, onWin, onOpenDailyCase }) {
  const [openGame, setOpenGame] = useState(null);
  const liveRef = useRef(null);
  const [liveOffset, setLiveOffset] = useState(0);

  // Auto-scroll live wins ticker
  useEffect(() => {
    const t = setInterval(() => {
      setLiveOffset(prev => {
        const next = prev + 1;
        return next > LIVE_WINS.length * 120 ? 0 : next;
      });
    }, 30);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {/* Live Wins Ticker */}
      <div style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, transform: `translateX(-${liveOffset}px)`, transition: 'none', width: 'max-content' }}>
          {[...LIVE_WINS, ...LIVE_WINS].map((w, i) => (
            <div key={i} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: '6px 12px',
            }}>
              <div style={{ fontSize: 16 }}>{w.gift.emoji}</div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{w.user}</div>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#fbbf24' }}>{w.reward}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Case Banner */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={onOpenDailyCase}
        style={{
          background: 'linear-gradient(135deg, #1a0f3c, #0d0620)',
          border: '1px solid rgba(167,139,250,0.35)',
          borderRadius: 20, padding: '18px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
          position: 'relative', overflow: 'hidden',
        }}>
        {/* Glow effect */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(167,139,250,0.15)', filter: 'blur(20px)' }} />
        <div style={{ fontSize: 44, flexShrink: 0 }}>📦</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 4 }}>Daily Case</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Open for free to win NFT gifts or stars!</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', color: '#fff',
          fontSize: 12, fontWeight: 900, padding: '8px 14px', borderRadius: 12,
          boxShadow: '0 0 15px rgba(124,58,237,0.4)',
        }}>FREE</div>
      </motion.div>

      {/* Game Cards Grid */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 10 }}>MINI-GAMES</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {GAME_CARDS.map(g => (
          <motion.div key={g.id} whileTap={{ scale: 0.95 }}
            onClick={() => setOpenGame(g.id)}
            style={{
              background: g.bg, border: `1px solid ${g.color}30`,
              borderRadius: 18, padding: '18px 14px', cursor: 'pointer',
              position: 'relative', overflow: 'hidden',
              boxShadow: `0 4px 20px ${g.color}15`,
            }}>
            {/* Glow */}
            <div style={{ position: 'absolute', bottom: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${g.color}20`, filter: 'blur(15px)' }} />
            <div style={{ fontSize: 36, marginBottom: 8 }}>{g.emoji}</div>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 3 }}>{g.label}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{g.desc}</div>
            <div style={{ position: 'absolute', top: 12, right: 12, background: `${g.color}22`, border: `1px solid ${g.color}55`, borderRadius: 20, padding: '3px 8px', fontSize: 9, fontWeight: 900, color: g.color }}>PLAY</div>
          </motion.div>
        ))}
      </div>

      {/* Game Overlays */}
      <AnimatePresence>
        {openGame === 'upgrade' && <UpgradeGame inventory={inventory} onClose={() => setOpenGame(null)} onWin={(s, g) => { onWin(s, g); setOpenGame(null); }} />}
        {openGame === 'roulette' && <RouletteGame onClose={() => setOpenGame(null)} onWin={(s, g) => { onWin(s, g); setOpenGame(null); }} />}
        {openGame === 'crash' && <CrashGame onClose={() => setOpenGame(null)} onWin={(s, g) => { onWin(s, g); setOpenGame(null); }} />}
        {openGame === 'arena' && <ArenaGame onClose={() => setOpenGame(null)} onWin={(s, g) => { onWin(s, g); setOpenGame(null); }} />}
        {openGame === 'frogs' && <FrogsGame onClose={() => setOpenGame(null)} onWin={(s, g) => { onWin(s, g); setOpenGame(null); }} />}
      </AnimatePresence>
    </div>
  );
}

function EarnTab({ onOpenDailyCase, onInvite }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {/* Invite Card */}
      <div style={{
        background: 'linear-gradient(135deg, #0c1f3c, #0d1117)',
        border: '1px solid rgba(79,195,247,0.3)',
        borderRadius: 20, padding: '20px', marginBottom: 16,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(79,195,247,0.1)', filter: 'blur(30px)' }} />
        <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Invite Friends</div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 16 }}>
          Invite a friend and earn <strong style={{ color: '#4FC3F7' }}>⭐ 2 Stars</strong> for each new player who joins!
        </p>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onInvite}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #4FC3F7, #0284c7)',
            color: '#000', fontSize: 15, fontWeight: 900, fontFamily: 'Outfit, sans-serif',
          }}>
          📨 Invite to Telegram
        </motion.button>
      </div>

      {/* Daily Case Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0f3c, #0d0620)',
        border: '1px solid rgba(167,139,250,0.3)',
        borderRadius: 20, padding: '20px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(167,139,250,0.1)', filter: 'blur(30px)' }} />
        <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Daily Case</div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 16 }}>
          Open the daily case for free to win <strong style={{ color: '#a78bfa' }}>NFT gifts</strong> or <strong style={{ color: '#fbbf24' }}>Stars</strong> every 24 hours.
        </p>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onOpenDailyCase}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
            color: '#fff', fontSize: 15, fontWeight: 900, fontFamily: 'Outfit, sans-serif',
          }}>
          🎁 Open Free Case
        </motion.button>
      </div>

      {/* Streak Info */}
      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        {[
          { icon: '🎯', label: 'Daily Tasks', desc: 'Complete tasks for bonus stars', color: '#fbbf24' },
          { icon: '🔗', label: 'Referral Links', desc: 'Share & earn passive rewards', color: '#4ade80' },
        ].map((c, i) => (
          <div key={i} style={{
            flex: 1, background: `${c.color}0d`, border: `1px solid ${c.color}25`,
            borderRadius: 16, padding: '14px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4, color: c.color }}>{c.label}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadersTab({ userStars }) {
  const weekEnd = new Date(Date.now() + 5 * 86400000 + 14 * 3600000);
  const { days, hours, minutes, seconds } = useCountdown(weekEnd);
  const myRank = LEADERBOARD.find(l => l.isMe);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {/* Tournament Prize Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1c1008, #0a0602)',
        border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: 20, padding: '16px', marginBottom: 16,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top, rgba(251,191,36,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fbbf24', textAlign: 'center', marginBottom: 12, letterSpacing: 1 }}>🏆 WEEKLY TOURNAMENT — TOP PRIZES</div>
        {/* Featured gifts */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          {TOURNAMENT_PRIZES.map((g, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <GiftBadge gift={g} size={i === 2 ? 52 : 40} />
              {i === 2 && <div style={{ fontSize: 8, fontWeight: 900, color: '#fbbf24', marginTop: 4 }}>1st</div>}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 1.5, marginBottom: 16 }}>
          Top players by total star turnover win exclusive NFT gifts.
          Join the leaderboard and compete for legendary prizes!
        </p>

        {/* Countdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[['Days', days], ['Hours', hours], ['Mins', minutes], ['Secs', seconds]].map(([label, val]) => (
            <div key={label} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>{String(val).padStart(2, '0')}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* My Status Card */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(251,191,36,0.08)', border: '1.5px solid rgba(251,191,36,0.3)',
        borderRadius: 16, padding: '14px 16px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 24 }}>🐸</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>You</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Rank #10 this week</div>
        </div>
        <StarBadge count={userStars} />
      </div>

      {/* Leaderboard List */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 10 }}>LEADERBOARD</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {LEADERBOARD.map(entry => (
          <motion.div key={entry.rank} whileTap={{ scale: 0.98 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: entry.isMe ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${entry.isMe ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 14, padding: '12px 14px',
            }}>
            {/* Rank */}
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: entry.rank === 1 ? '#fbbf24' : entry.rank === 2 ? '#9ca3af' : entry.rank === 3 ? '#cd7f32' : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: entry.rank <= 3 ? 14 : 11, fontWeight: 900,
              color: entry.rank <= 3 ? '#000' : 'rgba(255,255,255,0.5)',
              flexShrink: 0,
            }}>
              {entry.rank <= 3 ? (entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉') : entry.rank}
            </div>
            <div style={{ fontSize: 20 }}>{entry.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 900 }}>{entry.name} {entry.isMe && <span style={{ color: '#fbbf24', fontSize: 11 }}>(You)</span>}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{entry.flag}</div>
            </div>
            <StarBadge count={entry.stars} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function StoreTab({ stars, inventory, onBuy }) {
  const [buyGift, setBuyGift] = useState(null);

  const handleBuy = () => {
    if (!buyGift) return;
    onBuy(buyGift);
    setBuyGift(null);
    toast.success(`🎁 ${buyGift.name} added to your inventory!`);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900 }}>NFT Gift Store</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Spend your stars on exclusive gifts</div>
        </div>
        <StarBadge count={stars} />
      </div>

      {/* Gift Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {GIFTS.map(gift => (
          <motion.div key={gift.id} whileTap={{ scale: 0.93 }}
            onClick={() => setBuyGift(gift)}
            style={{
              background: `${gift.color}0d`, border: `1px solid ${gift.color}30`,
              borderRadius: 16, padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
            {/* Rarity indicator */}
            <div style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: RARITY_COLOR[gift.rarity], boxShadow: `0 0 6px ${RARITY_COLOR[gift.rarity]}` }} />
            <div style={{ fontSize: 32, marginBottom: 6 }}>{gift.emoji}</div>
            <div style={{ fontSize: 11, fontWeight: 900, marginBottom: 3, color: '#fff' }}>{gift.name}</div>
            <div style={{ fontSize: 9, color: RARITY_COLOR[gift.rarity], fontWeight: 700, marginBottom: 6 }}>{gift.rarity}</div>
            <div style={{
              background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 900, color: '#fbbf24',
              display: 'inline-block',
            }}>⭐ {gift.price}</div>
          </motion.div>
        ))}
      </div>

      {/* Buy Dialog */}
      <AnimatePresence>
        {buyGift && (
          <BuyGiftDialog gift={buyGift} stars={stars} onClose={() => setBuyGift(null)} onBuy={handleBuy} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileTab({ stars, inventory, onWithdraw }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {/* Profile Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(124,58,237,0.06))',
        border: '1px solid rgba(167,139,250,0.25)',
        borderRadius: 24, padding: '24px', textAlign: 'center', marginBottom: 20,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top, rgba(167,139,250,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />
        {/* Avatar */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px',
          background: 'linear-gradient(135deg, #7c3aed, #4c1d95)',
          border: '3px solid rgba(167,139,250,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
          boxShadow: '0 0 30px rgba(124,58,237,0.3)',
        }}>🐸</div>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Frog Player</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>Level 7 · Arena Veteran</div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Stars', value: stars.toLocaleString(), icon: '⭐', color: '#fbbf24' },
            { label: 'Gifts', value: inventory.length, icon: '🎁', color: '#a78bfa' },
            { label: 'Games', value: '47', icon: '🕹️', color: '#4FC3F7' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: '12px 8px' }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={onWithdraw}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #fbbf24, #f97316)',
            color: '#000', fontSize: 15, fontWeight: 900, fontFamily: 'Outfit, sans-serif',
          }}>
          💸 Withdraw Funds
        </motion.button>
      </div>

      {/* Inventory */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 12 }}>MY GIFTS ({inventory.length})</div>
      {inventory.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎒</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>No gifts yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Win them from games or buy from the Store</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {inventory.map((g, i) => (
            <div key={i} style={{
              background: `${g.color}0d`, border: `1px solid ${g.color}30`,
              borderRadius: 14, padding: '10px 6px', textAlign: 'center',
            }}>
              <GiftBadge gift={g} size={44} />
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 6, lineHeight: 1.2 }}>{g.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN FROG CASE SCREEN
// ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'games',   icon: '🕹️', label: 'Games'   },
  { id: 'earn',    icon: '🪙', label: 'Earn'    },
  { id: 'leaders', icon: '🏆', label: 'Leaders' },
  { id: 'store',   icon: '🛍️', label: 'Store'   },
  { id: 'profile', icon: '👤', label: 'Profile'  },
];

export default function FrogCaseScreen() {
  const [subTab, setSubTab] = useState('games');
  const [stars, setStars] = useState(1250);
  const [inventory, setInventory] = useState([GIFTS[4], GIFTS[7]]);
  const [showDailyCase, setShowDailyCase] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const handleWin = useCallback((starsWon, gift) => {
    if (starsWon > 0) {
      setStars(prev => prev + starsWon);
      toast.success(`⭐ +${starsWon} Stars added!`, {
        style: { background: '#1a1208', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', fontWeight: 900 },
      });
    }
    if (gift) {
      setInventory(prev => [...prev, gift]);
      toast.success(`🎁 ${gift.emoji} ${gift.name} added to inventory!`);
    }
  }, []);

  const handleBuyGift = (gift) => {
    setStars(prev => prev - gift.price);
    setInventory(prev => [...prev, gift]);
  };

  const handleInvite = () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink('https://t.me/share/url?url=https://t.me/NFEGlobalBot');
    } else {
      toast.success('Share link copied to clipboard!');
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'linear-gradient(180deg, #05080f 0%, #08040e 100%)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(5,8,15,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, boxShadow: '0 0 16px rgba(34,197,94,0.3)',
          }}>🐸</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Frog Case</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>NFT Gift Games</div>
          </div>
        </div>

        {/* Star Balance */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={() => { setStars(s => s + 10); toast.success('⭐ +10 bonus stars!'); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(249,115,22,0.1))',
            border: '1px solid rgba(251,191,36,0.35)',
            borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
          }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#fbbf24' }}>{stars.toLocaleString()}</span>
          <span style={{ fontSize: 16, color: '#4ade80', fontWeight: 900 }}>+</span>
        </motion.button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingTop: 12 }}
          >
            {subTab === 'games' && (
              <GamesTab stars={stars} inventory={inventory} onWin={handleWin} onOpenDailyCase={() => setShowDailyCase(true)} />
            )}
            {subTab === 'earn' && (
              <EarnTab onOpenDailyCase={() => setShowDailyCase(true)} onInvite={handleInvite} />
            )}
            {subTab === 'leaders' && (
              <LeadersTab userStars={stars} />
            )}
            {subTab === 'store' && (
              <StoreTab stars={stars} inventory={inventory} onBuy={handleBuyGift} />
            )}
            {subTab === 'profile' && (
              <ProfileTab stars={stars} inventory={inventory} onWithdraw={() => setShowWithdraw(true)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sub-Tab Bar */}
      <div style={{
        flexShrink: 0,
        background: 'rgba(5,8,15,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center',
        padding: '8px 4px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        zIndex: 100,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              color: subTab === t.id ? '#22c55e' : 'rgba(255,255,255,0.35)',
              transition: 'color 0.18s',
              padding: '4px 0',
              fontFamily: 'Outfit, sans-serif',
            }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.3 }}>{t.label}</span>
            {subTab === t.id && (
              <motion.div layoutId="frog-tab-indicator"
                style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {showDailyCase && (
          <DailyCaseGame
            onClose={() => setShowDailyCase(false)}
            onWin={(s, g) => { handleWin(s, g); setShowDailyCase(false); }}
          />
        )}
        {showWithdraw && (
          <WithdrawDrawer
            stars={stars}
            onClose={() => setShowWithdraw(false)}
            onNavigateStore={() => { setShowWithdraw(false); setSubTab('store'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
