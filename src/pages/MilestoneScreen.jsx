import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { useGameStore } from '../store/gameStore.js';
import { CONTRACTS } from '../config/constants.js';
import { getEthersSigner } from '../utils/ethers-adapter.js';
import { config } from '../config/wagmi.js';
import toast from 'react-hot-toast';
import { Award, Users, TrendingUp, Lock, Coins, Activity, Info, Sparkles, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

const FOUNDER_POOL_ABI = [
  "function isQualified(uint256 nodeId, uint8 poolId) view returns (bool)",
  "function totalClaimed(uint256 nodeId, uint8 poolId) view returns (uint256)",
  "function remainingAccrued(uint256 nodeId, uint8 poolId) view returns (uint256)",
  "function claim(uint256 nodeId, uint8 poolId) external",
  "function freeReferralsCount(uint256 nodeId) view returns (uint256)",
  "function starterFoundersReferred(uint256 nodeId) view returns (uint256)",
  "function convertedReferrals(uint256 nodeId) view returns (uint256)",
  "function totalReceived() view returns (uint256)",
  "function totalDistributed() view returns (uint256)"
];

const poolConfigs = [
  { id: 1, label: 'Starter Founder Pool', pct: '20%' },
  { id: 2, label: 'Fast Activator Pool', pct: '20%' },
  { id: 3, label: 'Starter Builder Pool', pct: '20%' },
  { id: 4, label: 'Conversion Builder T1', pct: '4%' },
  { id: 5, label: 'Conversion Builder T2', pct: '4%' },
  { id: 6, label: 'Conversion Builder T3', pct: '4%' },
  { id: 7, label: 'Conversion Builder T4', pct: '4%' },
  { id: 8, label: 'Conversion Builder T5', pct: '4%' },
  { id: 9, label: 'Free Recruiter Pool', pct: '20%' }
];

export default function MilestoneScreen() {
  const { nodeId, hasNode } = useGameStore();
  const [poolsData, setPoolsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // User Stats & Global Stats
  const [stats, setStats] = useState({
    freeRefs: 0n,
    starterFounders: 0n,
    convertedRefs: 0n,
    totalReceived: 0n,
    totalDistributed: 0n
  });

  const loadPoolsData = async () => {
    if (!nodeId || !hasNode) {
      setPoolsData(poolConfigs.map(p => ({ ...p, qualified: false, claimed: 0n, accrued: 0n })));
      return;
    }
    setLoading(true);
    try {
      const signer = await getEthersSigner(config);
      if (!signer) return;

      const founderPool = new ethers.Contract(
        CONTRACTS.FOUNDERPOOL || "0x5C352a36987D0F556429e975AAfe1efE2735fa32",
        FOUNDER_POOL_ABI,
        signer
      );

      const [freeRefs, starterFounders, convertedRefs, totalRec, totalDist] = await Promise.all([
        founderPool.freeReferralsCount(nodeId).catch(() => 0n),
        founderPool.starterFoundersReferred(nodeId).catch(() => 0n),
        founderPool.convertedReferrals(nodeId).catch(() => 0n),
        founderPool.totalReceived().catch(() => 0n),
        founderPool.totalDistributed().catch(() => 0n)
      ]);

      setStats({
        freeRefs,
        starterFounders,
        convertedRefs,
        totalReceived: totalRec,
        totalDistributed: totalDist
      });

      const data = await Promise.all(poolConfigs.map(async (p) => {
        const [qualified, claimed, accrued] = await Promise.all([
          founderPool.isQualified(nodeId, p.id).catch(() => false),
          founderPool.totalClaimed(nodeId, p.id).catch(() => 0n),
          founderPool.remainingAccrued(nodeId, p.id).catch(() => 0n)
        ]);
        return { ...p, qualified, claimed, accrued };
      }));

      setPoolsData(data);
    } catch (e) {
      console.error("loadPoolsData failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPoolsData();
  }, [nodeId, hasNode]);

  const handleClaim = async (poolId) => {
    if (actionLoading) return;
    setActionLoading(true);
    const toastId = toast.loading(`Claiming rewards from Pool #${poolId}...`);
    try {
      const signer = await getEthersSigner(config);
      const founderPool = new ethers.Contract(
        CONTRACTS.FOUNDERPOOL || "0x5C352a36987D0F556429e975AAfe1efE2735fa32",
        FOUNDER_POOL_ABI,
        signer
      );
      const tx = await founderPool.claim(nodeId, poolId);
      await tx.wait();
      toast.success(`Successfully claimed rewards!`, { id: toastId });
      loadPoolsData();
    } catch (e) {
      toast.error(e.reason || e.message || 'Claim transaction failed', { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const getMilestoneDetails = (poolId) => {
    const fRefs = Number(stats.freeRefs);
    const sFounders = Number(stats.starterFounders);
    const cRefs = Number(stats.convertedRefs);

    switch (poolId) {
      case 1:
        return {
          desc: "Refer 5 members who activate on their registration day.",
          progress: sFounders,
          target: 5,
          unit: "Starters",
          capText: "Capped at 1x Tier 1 cost"
        };
      case 2:
        return {
          desc: "Upgrade to Tier 5 within 24 hours of joining.",
          progress: null,
          target: null,
          unit: "",
          capText: "Capped at 2x Tier 5 cost"
        };
      case 3:
        return {
          desc: "Refer 10 members who activate on their registration day (within 30 days).",
          progress: sFounders,
          target: 10,
          unit: "Starters",
          capText: "Capped at 1x Tier 1 cost per Starter"
        };
      case 4:
        return {
          desc: "Refer 10 converted referrals (users who upgraded to paid tiers).",
          progress: cRefs,
          target: 10,
          unit: "Conversions",
          capText: "Capped at 2x Tier 1 cost"
        };
      case 5:
        return {
          desc: "Refer 20 converted referrals (users who upgraded to paid tiers).",
          progress: cRefs,
          target: 20,
          unit: "Conversions",
          capText: "Capped at 2x Tier 1 cost"
        };
      case 6:
        return {
          desc: "Refer 50 converted referrals (users who upgraded to paid tiers).",
          progress: cRefs,
          target: 50,
          unit: "Conversions",
          capText: "Capped at 2x Tier 1 cost"
        };
      case 7:
        return {
          desc: "Refer 100 converted referrals (users who upgraded to paid tiers).",
          progress: cRefs,
          target: 100,
          unit: "Conversions",
          capText: "Capped at 2x Tier 1 cost"
        };
      case 8:
        return {
          desc: "Refer 200 converted referrals (users who upgraded to paid tiers).",
          progress: cRefs,
          target: 200,
          unit: "Conversions",
          capText: "Capped at 2x Tier 1 cost"
        };
      case 9:
        return {
          desc: "Refer 50 Free Trial Nodes into the network.",
          progress: fRefs,
          target: 50,
          unit: "Free Nodes",
          capText: "Capped at 1x total fees generated"
        };
      default:
        return { desc: "", progress: 0, target: 0, unit: "", capText: "" };
    }
  };

  const getGradientForPool = (id) => {
    if (id === 1 || id === 3) return 'linear-gradient(135deg, rgba(239,141,50,0.12) 0%, rgba(239,141,50,0.02) 100%)'; // Orange/Starter
    if (id === 2) return 'linear-gradient(135deg, rgba(79,195,247,0.12) 0%, rgba(79,195,247,0.02) 100%)'; // Blue/Fast
    if (id >= 4 && id <= 8) return 'linear-gradient(135deg, rgba(163,255,18,0.12) 0%, rgba(163,255,18,0.02) 100%)'; // Neon/Conversion
    return 'linear-gradient(135deg, rgba(155,81,255,0.12) 0%, rgba(155,81,255,0.02) 100%)'; // Purple/Free
  };

  const getBorderColorForPool = (id, qual) => {
    if (!qual) return 'rgba(255,255,255,0.04)';
    if (id === 1 || id === 3) return 'rgba(239,141,50,0.4)';
    if (id === 2) return 'rgba(79,195,247,0.4)';
    if (id >= 4 && id <= 8) return 'rgba(163,255,18,0.4)';
    return 'rgba(155,81,255,0.4)';
  };

  return (
    <div className="sub-page page-milestones" style={{ paddingBottom: '20px', fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ padding: '20px 16px' }}>
        {!hasNode && (
          <div style={{
            background: 'rgba(255, 183, 77, 0.08)',
            border: '1px solid rgba(255, 183, 77, 0.25)',
            borderRadius: 14,
            padding: '12px 16px',
            fontSize: '12px',
            color: '#FFB74D',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
            lineHeight: 1.4
          }}>
            <span>⚠️</span>
            <span><strong>View-Only Mode:</strong> No active Node ID detected. Activate a Node to qualify for the 9 premium pools, track duplication milestones, and claim distribution yield.</span>
          </div>
        )}
        
        {/* GLOBAL STATS HEADER CARD */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: 24, padding: '20px 18px',
          marginBottom: 24, position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: 'radial-gradient(circle, rgba(163,255,18,0.1) 0%, transparent 70%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'rgba(163,255,18,0.1)', padding: 10, borderRadius: 14 }}>
              <Award size={22} color="var(--neon-lime)" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 950, color: '#fff', letterSpacing: '-0.5px' }}>Milestone Dashboard</h1>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Track your progression and claim platform yield</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 16, padding: '12px 14px' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>POOL INFLOW</span>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 4 }}>
                {parseFloat(ethers.formatEther(stats.totalReceived)).toFixed(3)} BNB
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 16, padding: '12px 14px' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>DISTRIBUTED</span>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--neon-lime)', marginTop: 4 }}>
                {parseFloat(ethers.formatEther(stats.totalDistributed)).toFixed(3)} BNB
              </div>
            </div>
          </div>
        </div>

        {/* YOUR RECRUITING METRICS */}
        <div style={{
          background: 'rgba(5, 8, 15, 0.4)', border: '1px solid rgba(255,255,255,0.03)',
          borderRadius: 20, padding: 14, marginBottom: 24
        }}>
          <h3 style={{ fontSize: 11, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={12} color="var(--neon-lime)" /> Your Qualifying Stats
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'CONVERSIONS', val: Number(stats.convertedRefs), icon: <Sparkles size={11} color="var(--neon-lime)" /> },
              { label: 'STARTER FNDRS', val: Number(stats.starterFounders), icon: <Users size={11} color="#EF8D32" /> },
              { label: 'FREE TRIAL', val: Number(stats.freeRefs), icon: <TrendingUp size={11} color="#9B51FF" /> }
            ].map((stat, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 10, textAlign: 'center', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                  {stat.icon}
                  <span style={{ fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.4)' }}>{stat.label}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 950, color: '#fff' }}>{stat.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* POOLS LIST CARD GRID */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid var(--neon-lime)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            Syncing Milestones...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {poolsData.map((pool) => {
              const ms = getMilestoneDetails(pool.id);
              const hasAccrued = pool.accrued > 0n;
              
              return (
                <motion.div
                  key={pool.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: getGradientForPool(pool.id),
                    border: `1px solid ${getBorderColorForPool(pool.id, pool.qualified)}`,
                    borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
                    boxShadow: pool.qualified ? '0 10px 30px rgba(0,0,0,0.15)' : 'none',
                    position: 'relative', overflow: 'hidden'
                  }}
                >
                  {/* Glowing tag for Qualified */}
                  {pool.qualified && (
                    <div style={{
                      position: 'absolute', top: 0, right: 0, background: 'var(--neon-lime)',
                      color: '#000', fontSize: 8, fontWeight: 900, padding: '4px 10px',
                      borderBottomLeftRadius: 10, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4
                    }}>
                      <CheckCircle2 size={8} /> ACTIVE SHARE
                    </div>
                  )}

                  {/* Header Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{pool.label}</span>
                        <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--neon-lime)', opacity: 0.8 }}>({pool.pct} share)</span>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {ms.capText}
                      </span>
                    </div>
                  </div>

                  {/* Details Description */}
                  {ms.desc && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <Info size={12} style={{ flexShrink: 0, marginTop: 1, color: 'rgba(255,255,255,0.3)' }} />
                      <span>{ms.desc}</span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {ms.target !== null && (
                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                        <span>MILESTONE PROGRESS</span>
                        <span style={{ color: pool.qualified ? 'var(--neon-lime)' : '#fff' }}>
                          {ms.progress} / {ms.target} {ms.unit}
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          background: pool.qualified ? 'linear-gradient(90deg, var(--neon-lime), #7BFF00)' : 'linear-gradient(90deg, #FF9100, #EF8D32)',
                          width: `${Math.min(100, (ms.progress / ms.target) * 100)}%`,
                          transition: 'width 0.3s ease-out'
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Ledger Stats Row */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: '10px 12px',
                    border: '1px solid rgba(255,255,255,0.01)'
                  }}>
                    <div>
                      <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>ACCRUED REWARD</div>
                      <div style={{ fontSize: 13, fontWeight: 950, color: hasAccrued ? 'var(--neon-lime)' : '#fff', marginTop: 2 }}>
                        {parseFloat(ethers.formatEther(pool.accrued)).toFixed(5)} BNB
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }}>LIFETIME CLAIMED</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                        {parseFloat(ethers.formatEther(pool.claimed)).toFixed(4)} BNB
                      </div>
                    </div>
                  </div>

                  {/* Claim Button */}
                  <button
                    onClick={() => handleClaim(pool.id)}
                    disabled={actionLoading || !pool.qualified || !hasAccrued}
                    style={{
                      background: (pool.qualified && hasAccrued) ? 'linear-gradient(135deg, var(--neon-lime), #7BFF00)' : 'rgba(255,255,255,0.03)',
                      color: (pool.qualified && hasAccrued) ? '#000' : 'rgba(255,255,255,0.2)',
                      border: 'none', borderRadius: 14, height: 40, fontSize: 12, fontWeight: 900,
                      cursor: (pool.qualified && hasAccrued) ? 'pointer' : 'not-allowed',
                      boxShadow: (pool.qualified && hasAccrued) ? '0 4px 15px rgba(163,255,18,0.25)' : 'none',
                      transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    {!pool.qualified ? (
                      <>
                        <Lock size={12} />
                        <span>Locked</span>
                      </>
                    ) : !hasAccrued ? (
                      <span>Waiting for Inflow</span>
                    ) : (
                      <>
                        <Coins size={12} />
                        <span>Claim {parseFloat(ethers.formatEther(pool.accrued)).toFixed(4)} BNB</span>
                      </>
                    )}
                  </button>

                </motion.div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
