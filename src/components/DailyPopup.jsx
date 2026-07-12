import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import { formatNumber } from '../utils/format.js';
import toast from 'react-hot-toast';

// Matches the backend DAILY_REWARDS table exactly
const STREAK_REWARDS = [100, 200, 300, 400, 500, 600, 700, 1000, 2000, 5000];

export default function DailyPopup() {
  const { streak, setShowDailyPopup, hasNode, claimDailyReward, lastClaimDate } = useGameStore();
  
  // They can claim if it's been 24 hrs since the last claim, or if no last claim exists
  const isClaimable = !lastClaimDate || (Date.now() - lastClaimDate >= 24 * 60 * 60 * 1000);

  const handleClaim = async () => {
    if (!isClaimable) return;
    
    try {
      const res = await claimDailyReward();
      // BUG FIX: Use claimed_day from backend (which day was just claimed, 1-10)
      const claimedDay = res.claimed_day || (res.daily_streak === 0 ? 10 : res.daily_streak);
      toast.success(`🔥 DAY ${claimedDay} STREAK! +${res.reward} $AIPCORE COINS CLAIMED!`, { duration: 4000 });
      setShowDailyPopup(false);
      
      if (!hasNode) {
        setTimeout(() => {
          toast('Activate an AIPCore Node to earn real BNB, 10x more coins, and massive pool rewards!', {
            icon: '💎',
            duration: 6000,
            style: { border: '1px solid var(--neon-lime)' }
          });
        }, 500);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to claim daily reward');
    }
  };

  // Calculate hours left from lastClaimDate
  const hoursLeft = lastClaimDate ? Math.max(0, Math.ceil(24 - (Date.now() - lastClaimDate) / (1000 * 60 * 60))) : 0;

  return (
    <AnimatePresence>
      <div className="dialogue-glass-wrap">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="dialogue-glass-card"
        >
          {/* Header Icon */}
          <div style={{
            width: '72px', height: '72px',
            background: 'rgba(163, 255, 18, 0.1)',
            borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px',
            marginBottom: '20px',
            border: '1px solid rgba(163, 255, 18, 0.2)'
          }}>🔥</div>

          <div className="modal-title" style={{ textAlign: 'center' }}>DAILY REWARD</div>
          <div className="modal-sub" style={{ marginBottom: '32px' }}>
            LOG IN DAILY TO GROW YOUR MINING RESERVE
          </div>
          
          {!hasNode && (
            <div style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)', padding: '12px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 900, color: '#FF9500' }}>⭐ FREE OPERATIVE</span>
              <p style={{ fontSize: '10px', color: '#FF5252', marginTop: '4px', lineHeight: 1.4, fontWeight: 700 }}>
                You're on a free trial mining 10 coins/hr. <strong>Upgrade to an Active Node</strong> to earn real <strong>BNB</strong>, mine at <strong>10x speed</strong>, and unlock ecosystem rewards!
              </p>
            </div>
          )}

          {/* Streak Grid */}
          <div className="streak-grid-aipcore" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '24px' }}>
            {STREAK_REWARDS.map((reward, i) => {
              const day = i + 1;
              // streak is stored as 0-9 in DB. Display as 1-10.
              // isPast: this day has already been claimed in the current cycle
              const isPast = day <= streak;
              // isToday: the next claimable day
              const isToday = isClaimable && day === streak + 1;
              // Special: if streak=0 and claimable, Day 1 is today (start of new/reset cycle)
              
              return (
                <div key={day} className={`day-box ${isToday ? 'active' : ''}`} style={{
                  background: isPast ? 'rgba(79, 195, 247, 0.1)' : isToday ? 'rgba(163, 255, 18, 0.1)' : 'rgba(255,255,255,0.02)',
                  borderColor: isPast ? '#4FC3F7' : isToday ? 'var(--neon-lime)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isPast ? '#4FC3F7' : isToday ? 'var(--neon-lime)' : 'rgba(255,255,255,0.05)'}`,
                  padding: '12px 6px',
                  opacity: (isPast || isToday) ? 1 : 0.5,
                  textAlign: 'center',
                  borderRadius: '12px',
                  position: 'relative'
                }}>
                  {day === 10 && <div style={{ position: 'absolute', top: -6, right: -4, fontSize: 10 }}>🏆</div>}
                  <span className="d-num" style={{ fontSize: '9px', display: 'block', color: isPast ? '#4FC3F7' : isToday ? 'var(--neon-lime)' : 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 800 }}>
                    {isPast ? '✓' : `DAY ${day}`}
                  </span>
                  <span className="d-val" style={{ fontSize: day === 10 ? '11px' : '13px', fontWeight: 900, color: day === 10 ? '#FFD700' : '#FFF' }}>
                    {reward >= 1000 ? `${reward/1000}K` : reward}
                  </span>
                </div>
              );
            })}
          </div>

          <button 
            className={isClaimable ? "giant-btn shimmer-btn" : "giant-btn"} 
            onClick={isClaimable ? handleClaim : () => setShowDailyPopup(false)}
            style={{ 
              background: isClaimable ? 'var(--neon-lime)' : 'rgba(255,255,255,0.05)', 
              color: isClaimable ? '#000' : 'rgba(255,255,255,0.4)', 
              borderRadius: '16px',
              fontSize: '16px',
              fontWeight: 900,
              padding: '18px',
              width: '100%',
              boxShadow: isClaimable ? '0 0 20px rgba(163, 255, 18, 0.3)' : 'none',
              cursor: 'pointer',
              border: isClaimable ? 'none' : '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {isClaimable 
              ? `CLAIM DAY ${streak + 1} REWARD 🔥` 
              : `COME BACK IN ${hoursLeft}H ⏳`}
          </button>

          <button 
            onClick={() => setShowDailyPopup(false)}
            style={{ 
              marginTop: '16px', 
              background: 'none', 
              border: 'none', 
              color: '#4FC3F7', 
              fontSize: '12px', 
              fontWeight: 800, 
              cursor: 'pointer',
              letterSpacing: '1px'
            }}
          >
            DISMISS
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
