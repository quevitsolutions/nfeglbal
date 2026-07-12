import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { formatNumber } from '../utils/format.js';
import toast from 'react-hot-toast';
import { openLink } from '../utils/openLink.js';

export default function TaskScreen() {
  const { tasks, claimTaskAction, setActiveTab, fetchTasksData, directRefs } = useGameStore();
  const [claimingId, setClaimingId] = useState(null);

  // Refresh tasks whenever the screen is opened
  useEffect(() => {
    fetchTasksData();
  }, [fetchTasksData]);

  const handleClaim = async (task) => {
    if (task.is_completed || claimingId) return;
    
    if (task.url) {
      openLink(task.url);
      // Adding a small mandatory delay to simulate they actually checked the link
      setClaimingId(task.id);
      toast('Verifying task...', { icon: '⏳', duration: 2000 });
      setTimeout(async () => {
        try {
          await claimTaskAction(task.id);
          toast.success(`+${formatNumber(task.reward)} COINS EARNED! 🔥`);
        } catch (err) {
          toast.error(err.message || 'Task claim failed');
        } finally {
          setClaimingId(null);
        }
      }, 2000);
      return;
    }

    setClaimingId(task.id);
    try {
      await claimTaskAction(task.id);
      toast.success(`+${formatNumber(task.reward)} COINS EARNED! 🔥`);
    } catch (err) {
      toast.error(err.message || 'Task claim failed');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="sub-page page-tasks" style={{ paddingBottom: '20px' }}>
      <div style={{ padding: '10px 0 20px', display: 'flex', alignItems: 'center' }}>
        <button 
          onClick={() => setActiveTab('earn')}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
        >←</button>
        <h2 style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: 900 }}>EARN COINS</h2>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: '48px', marginBottom: 8 }}>💎</div>
        <p style={{ fontSize: '12px', color: '#FFB74D', fontWeight: 700 }}>COMPLETE TASKS & UNLOCK REWARDS</p>
      </div>

      {/* --- NODE ACTIVATION MILESTONES --- */}
      <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '24px 0 16px', color: '#A3FF12', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🚀</span> NODE ACTIVATION MILESTONES
      </h3>
      <div className="flex-column" style={{ gap: 12, marginBottom: 40 }}>
        {[
          { threshold: 1,  reward: 500,    label: 'Starter Sponsor' },
          { threshold: 3,  reward: 2000,   label: 'Squad Leader' },
          { threshold: 5,  reward: 5000,   label: 'Team Legend' },
          { threshold: 10, reward: 20000,  label: 'AIPCore Ambassador' },
          { threshold: 20, reward: 50000,  label: 'Whale Sponsor' },
          { threshold: 50, reward: 500000, label: 'Global Visionary' },
        ].map((m) => {
          const { activatedRefs, claimedMilestones, claimMilestoneAction } = useGameStore.getState();
          const isClaimed = (claimedMilestones || []).includes(m.threshold);
          const canClaim = activatedRefs >= m.threshold && !isClaimed;
          const progress = Math.min((activatedRefs / m.threshold) * 100, 100);

          return (
            <div key={m.threshold} className="partner-card" style={{ 
              padding: '16px', border: canClaim ? '1px solid var(--neon-lime)' : '1px solid rgba(255,255,255,0.05)',
              background: isClaimed ? 'rgba(163,255,18,0.05)' : 'var(--bg-card)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ 
                    width: 40, height: 40, borderRadius: 10, background: 'rgba(163,255,18,0.1)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 
                  }}>
                    {m.threshold >= 10 ? '👑' : '🤝'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--neon-lime)', fontWeight: 700 }}>+{formatNumber(m.reward)} $AIPCORE</div>
                  </div>
                </div>

                {isClaimed ? (
                  <span style={{ color: 'var(--neon-lime)', fontWeight: 900, fontSize: 12 }}>CLAIMED ✓</span>
                ) : (
                  <button
                    onClick={async () => {
                      if (!canClaim) {
                        toast.error(`You need ${m.threshold} friends with Activated Nodes!`);
                        return;
                      }
                      try {
                        setClaimingId(`m-${m.threshold}`);
                        await useGameStore.getState().claimMilestoneAction(m.threshold);
                        toast.success(`Milestone Claimed! +${formatNumber(m.reward)} AIPCore`);
                        fetchTasksData(); // and refresh user data in store
                      } catch (err) {
                        toast.error(err.message);
                      } finally {
                        setClaimingId(null);
                      }
                    }}
                    disabled={claimingId === `m-${m.threshold}`}
                    style={{
                      background: canClaim ? 'var(--neon-lime)' : 'rgba(255,255,255,0.05)',
                      color: canClaim ? '#000' : 'rgba(255,255,255,0.3)',
                      border: 'none', padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 900,
                      cursor: canClaim ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {claimingId === `m-${m.threshold}` ? '...' : (canClaim ? 'CLAIM' : 'LOCKED')}
                  </button>
                )}
              </div>

              {/* Progress Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: '#4FC3F7', marginBottom: 4 }}>
                <span>{activatedRefs} / {m.threshold} Activated Friends</span>
                <span>{Math.floor(progress)}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', width: `${progress}%`, 
                  background: isClaimed ? 'var(--neon-lime)' : 'linear-gradient(90deg, #4FC3F7, var(--neon-lime))',
                  transition: 'width 0.5s ease-out'
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '24px 0 16px', color: '#FFD700' }}>GLOBAL TASKS</h3>

      <div className="flex-column" style={{ gap: 12, paddingBottom: 60 }}>
        {!Array.isArray(tasks) || tasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#A3FF12', fontSize: 13, padding: '20px' }}>
            No active tasks available right now.
          </div>
        ) : (
          tasks.map(task => {
            const done = task.is_completed;
            const isClaiming = claimingId === task.id;

            let targetCount = 0;
            let currentCount = 0;
            let locked = false;

            if (task.type === 'referral_count') {
              const match = task.name.match(/\d+/);
              targetCount = match ? parseInt(match[0]) : 0;
              currentCount = directRefs || 0;
              if (currentCount < targetCount) locked = true;
            }

            return (
              <div key={task.id} className="partner-card" style={{ gap: 16, padding: 16, flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ 
                    width: '44px', height: '44px', 
                    background: 'rgba(255,255,255,0.05)', 
                    borderRadius: '10px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px'
                  }}>
                    {task.icon}
                  </div>
                  <div className="flex-column" style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: 800 }}>{task.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--neon-lime)', fontWeight: 700 }}>+{formatNumber(task.reward)}</span>
                  </div>
                  {done ? (
                    <span style={{ color: 'var(--neon-lime)', fontWeight: 900, fontSize: '18px' }}>✓</span>
                  ) : (
                    <button 
                      onClick={() => {
                        if (locked) toast.error(`You need ${targetCount} direct referrals to claim this!`);
                        else handleClaim(task);
                      }}
                      disabled={isClaiming || locked}
                      style={{ 
                        background: isClaiming || locked ? 'rgba(255,255,255,0.1)' : 'var(--neon-lime)', 
                        color: isClaiming || locked ? '#FF5252' : '#000', border: 'none',
                        padding: '6px 14px', borderRadius: '40px', fontSize: '11px', fontWeight: 900,
                        cursor: isClaiming || locked ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isClaiming ? 'WAIT' : (locked ? 'LOCKED' : (task.type === 'social' ? 'JOIN' : 'CLAIM'))}
                    </button>
                  )}
                </div>
                
                {/* Visual Progress Bar for Referral Tasks */}
                {task.type === 'referral_count' && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#4FC3F7', marginBottom: 6 }}>
                      <span>{Math.min(currentCount, targetCount)} / {targetCount} Peers Recruited</span>
                      <span>{targetCount > 0 ? Math.floor(Math.min((currentCount / targetCount) * 100, 100)) : 0}%</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        background: done ? 'var(--neon-lime)' : 'linear-gradient(90deg, #FF9500, var(--neon-lime))',
                        width: `${targetCount > 0 ? Math.min((currentCount / targetCount) * 100, 100) : 0}%`,
                        transition: 'width 0.5s ease-out'
                      }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
