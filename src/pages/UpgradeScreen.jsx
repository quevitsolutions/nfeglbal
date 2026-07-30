import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import { useContract } from '../hooks/useContract.js';
import { useNativePrice, useNativeTokenSymbol } from '../hooks/useNativePrice.js';
import { ethers } from 'ethers';
import { CONTRACTS, RPC_NODES } from '../config/constants.js';
import { AIPCORE_ABI } from '../config/abi.js';
import toast from 'react-hot-toast';

// ABI extension for treasury view helper
const TREASURY_ABI = [
  "function getPendingUpgradeRewards(uint256 nodeId) view returns (uint256)"
];

// Tier colour palette — T1 (lime) → T18 (red)
const TIER_COLORS = [
  '#A3FF12','#B4FF3A','#FFD700','#FFC107','#FF9800',
  '#FF7043','#FF5252','#F44336','#E91E63','#AB47BC',
  '#7E57C2','#5C6BC0','#42A5F5','#26C6DA','#26A69A',
  '#66BB6A','#8BC34A','#CDDC39'
];

const TIER_USD_COSTS = [5, 5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480, 40960, 81920, 163840, 327680];

// 18 tiers mapping
const TIERS = Array.from({ length: 18 }, (_, i) => ({
  tier:    i + 1,
  usdCost: TIER_USD_COSTS[i],
  depth:   i === 17 ? 'UNLIMITED MATRIX DEPTH' : `LAYER ${i + 1} SPILLOVER`,
  color:   TIER_COLORS[i],
}));

// Hexagonal tier badge
function TierHex({ tier, color, size = 52, active, next }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: active ? `${color}22` : next ? `${color}15` : 'rgba(255,255,255,0.04)',
      border: `2px solid ${active ? color : next ? color + '88' : 'rgba(255,255,255,0.1)'}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      boxShadow: active ? `0 0 12px ${color}50` : next ? `0 0 8px ${color}30` : 'none',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: size * 0.32, fontWeight: 900, color: active ? color : next ? color : 'rgba(255,255,255,0.35)', lineHeight: 1 }}>T{tier}</span>
      <span style={{ fontSize: size * 0.16, color: active ? color : 'rgba(255,255,255,0.25)', fontWeight: 700 }}>TIER</span>
    </div>
  );
}

export default function UpgradeScreen() {
  const { nodeTier, nodeId, setActiveTab } = useGameStore();
  const { unlockTier, createNode, createNodeWithSponsorAddress, treasuryUnlockTier, selfUpgrade } = useContract();
  const nativePrice = useNativePrice();
  const nativeSymbol = useNativeTokenSymbol();

  const [tierCosts, setTierCosts] = useState(new Array(18).fill('0.00'));
  const [isLoading, setIsLoading] = useState(false);
  const [pendingBnb, setPendingBnb] = useState('0');
  const [isTreasury, setIsTreasury] = useState(false);
  const [treasuryAvailableBnb, setTreasuryAvailableBnb] = useState('0');
  const [sponsorInput, setSponsorInput] = useState('');
  // Treasury & vault stats
  const [vaultStats, setVaultStats] = useState({
    withdrawable: '0', upgradeVault: '0', lifetimeRewards: '0',
    lifetimeDeposits: '0', lifetimeUsed: '0', autoUpgrades: 0,
    manualUpgrades: 0, totalTreasury: '0', daysActive: 0,
    totalContribution: '0', totalEarned: '0'
  });
  const [incomeHistory, setIncomeHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const { referrerId } = useGameStore.getState();
    if (referrerId) {
      setSponsorInput(String(referrerId));
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_NODES[0]);
        const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, provider);
        const costsRaw = await core.getTierCosts().catch(() => null);
        if (costsRaw) setTierCosts(costsRaw.map(c => ethers.formatEther(c)));

        if (nodeId) {
          const [pending, isEnrolled, balances, nodeStats, income] = await Promise.all([
            core.getPendingUpgradeRewards(nodeId).catch(() => 0n),
            core.isTreasuryNode(nodeId).catch(() => false),
            core.accountBalances(nodeId).catch(() => null),
            core.getNodeStats(nodeId).catch(() => null),
            core.getIncome(nodeId, 20).catch(() => []),
          ]);

          setPendingBnb(ethers.formatEther(pending));
          setIsTreasury(isEnrolled);

          if (balances) {
            setVaultStats({
              withdrawable:    ethers.formatEther(balances[0]),
              upgradeVault:    ethers.formatEther(balances[1]),
              lifetimeRewards: ethers.formatEther(balances[2]),
              lifetimeDeposits:ethers.formatEther(balances[3]),
              lifetimeUsed:    ethers.formatEther(balances[4]),
              autoUpgrades:    Number(balances[5]),
              manualUpgrades:  Number(balances[6]),
              totalTreasury:   ethers.formatEther(balances[7]),
              daysActive:      nodeStats ? Number(nodeStats[5]) : 0,
              totalContribution: nodeStats ? ethers.formatEther(nodeStats[4]) : '0',
              totalEarned:     nodeStats ? ethers.formatEther(nodeStats[3]) : '0',
            });
            setTreasuryAvailableBnb(ethers.formatEther(balances[1]));
          }

          if (income && income.length > 0) {
            setIncomeHistory(income.map(item => ({
              id: Number(item.id),
              layer: Number(item.layer),
              amount: ethers.formatEther(item.amount),
              time: Number(item.time),
              isMissed: item.isMissed,
              rewardType: Number(item.rewardType),
              tier: Number(item.tier),
            })));
          }
        }
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, [nodeId]);

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      const refVal = sponsorInput.trim();
      let effectiveSponsor = 55555;
      let useSponsorAddress = false;
      let sponsorAddress = "";

      if (refVal) {
        try {
          if (refVal.startsWith('0x') && refVal.length === 42) {
            const refId = await blockchain.core.nodeId(refVal).catch(() => 0n);
            if (refId && Number(refId) > 0) {
              effectiveSponsor = Number(refId);
            } else {
              useSponsorAddress = true;
              sponsorAddress = refVal;
            }
          } else if (Number(refVal) > 0) {
            effectiveSponsor = Number(refVal);
          }
        } catch (e) {
          console.warn("Referrer ID lookup failed, using fallback:", e);
        }
      }

      if (useSponsorAddress && sponsorAddress) {
        await createNodeWithSponsorAddress(sponsorAddress, 1);
      } else {
        await createNode(effectiveSponsor);
      }
    } catch (err) {
      toast.error(err?.message || 'Registration failed');
    }
    setIsLoading(false);
  };

  const handleLevelUp = async (targetTier) => {
    if (!nodeId) return toast.error("Connect wallet first!");
    if (targetTier > 18) return toast.error("Max tier reached!");
    setIsLoading(true);
    if (targetTier === (nodeTier || 0) + 1) {
      await selfUpgrade();
    } else {
      await unlockTier(nodeId, targetTier);
    }
    setIsLoading(false);
  };

  const handleTreasuryLevelUp = async () => {
    if (!nodeId) return toast.error("Connect wallet first!");
    setIsLoading(true);
    try {
      const newTier = await treasuryUnlockTier(nodeId);
      if (newTier) {
        const provider = new ethers.JsonRpcProvider(RPC_NODES[0]);
        const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, provider);
        const balance = await core.getTreasuryBalance().catch(() => [0n, 0n, 0n]);
        setTreasuryAvailableBnb(ethers.formatEther(balance[2]));
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const usdLabel = (bnb) => nativePrice > 0 ? `≈ $${(parseFloat(bnb || 0) * nativePrice).toFixed(2)}` : '';

  const currentTier    = nodeTier || 0;
  const activeTiers    = TIERS.filter(t => nodeId && t.tier <= currentTier);
  const nextTier       = nodeId ? TIERS.find(t => t.tier === currentTier + 1) : null;
  const lockedTiers    = TIERS.filter(t => t.tier > (nextTier ? nextTier.tier : currentTier));

  return (
    <div className="sub-page page-upgrade" style={{ paddingBottom: 'calc(var(--tabbar-h, 80px) + 24px)' }}>

      {/* ── Header ── */}
      <div style={{ padding: '10px 0 20px', display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setActiveTab('dash')}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>←</button>
        <h2 style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: 900, letterSpacing: 1 }}>NODE TIERS</h2>
      </div>

      {/* ── Registration CTA (not yet activated) ── */}
      {!nodeId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '8px 0' }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>
              ACTIVATE YOUR NODE
            </h1>
            <p style={{ fontSize: 12, color: '#FFB74D', fontWeight: 600, lineHeight: 1.6, maxWidth: 290, margin: '0 auto' }}>
              Register on-chain to unlock all 18 tiers, earn real {nativeSymbol} and access the full AIPCore matrix ecosystem.
            </p>
          </motion.div>

          {/* Tier 0 preview */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: 'linear-gradient(135deg, rgba(163,255,18,0.12) 0%, rgba(163,255,18,0.03) 100%)', border: '1px solid rgba(163,255,18,0.35)', borderRadius: 24, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <TierHex tier={0} color={TIER_COLORS[0]} size={56} next />
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>TIER 0 — ACTIVE NODE</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#A3FF12', marginTop: 3 }}>Matrix Level 1 Unlocked · Spillover Eligible</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { icon: '🚀', label: 'Matrix Spillover', sub: 'Active' },
                { icon: '💰', label: `${nativeSymbol} Rewards`, sub: 'On-chain' },
                { icon: '🏆', label: 'Pool Access', sub: 'Global' },
              ].map((b, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18 }}>{b.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', marginTop: 4 }}>{b.label}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{b.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: '16px', textAlign: 'left' }}>
              <label style={{ fontSize: '10px', fontWeight: 900, color: '#A3FF12', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                SPONSOR ID OR ADDRESS
              </label>
              <input
                type="text"
                placeholder="Enter Sponsor ID or Wallet Address (default: 55555)"
                value={sponsorInput}
                onChange={(e) => setSponsorInput(e.target.value)}
                style={{
                  background: 'rgba(32, 34, 37, 0.8)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: '13px',
                  fontFamily: 'Outfit, sans-serif',
                  outline: 'none',
                  width: '100%',
                  fontWeight: 600
                }}
              />
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginTop: '6px', fontWeight: 700 }}>
                {sponsorInput.trim() ? (
                  sponsorInput.trim().startsWith('0x') && sponsorInput.trim().length === 42 ? (
                    "✨ Sponsor Address detected."
                  ) : Number(sponsorInput.trim()) > 0 ? (
                    "✨ Sponsor ID #" + sponsorInput.trim() + " detected."
                  ) : (
                    "⚠️ Invalid format. Will fallback to Sponsor #55555 (Platform)."
                  )
                ) : (
                  "ℹ️ Empty. Will default to Sponsor #55555 (Platform)."
                )}
              </div>
            </div>

            <button className="giant-btn" onClick={handleRegister} disabled={isLoading}
              style={{ background: 'var(--neon-lime)', color: '#000', width: '100%', height: 'auto', padding: '14px 20px', borderRadius: 16, letterSpacing: 0.5, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 900 }}>ACTIVATE NODE (~$1)</span>
              <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                ~$1 Registration Fee (On-Chain)
              </span>
            </button>
          </motion.div>

          {/* All 18 tiers preview grid */}
          <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, marginBottom: 8 }}>ALL 18 TIERS AVAILABLE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {TIERS.map((t, i) => (
              <div key={t.tier} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${t.color}30`, borderRadius: 14, padding: '10px 8px', textAlign: 'center', opacity: 0.7 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: t.color }}>T{t.tier}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{t.depth}</div>
                <div style={{ fontSize: 8, color: '#4FC3F7', marginTop: 2 }}>{parseFloat(tierCosts[i] || 0).toFixed(3)} {nativeSymbol}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Activated: Current Level Hero ── */}
      {nodeId && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: 'linear-gradient(135deg, rgba(163,255,18,0.1) 0%, rgba(163,255,18,0.03) 100%)', border: '1px solid rgba(163,255,18,0.2)', borderRadius: 24, padding: '18px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#4FC3F7', letterSpacing: 2 }}>ACTIVE PROTOCOL LEVEL</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--neon-lime)', lineHeight: 1.1, marginTop: 4 }}>
                TIER {currentTier} <span style={{ fontSize: 14 }}>ACTIVE</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
                NODE ID: #{nodeId}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#FF5252', letterSpacing: 2 }}>MATRIX REACH</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 4 }}>LAYER {currentTier}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#FFD700', marginTop: 3 }}>SPILLOVER ACTIVE</div>
            </div>
          </motion.div>

          {/* ── TREASURY & VAULT STATS SECTION ── */}
          <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 900, color: '#FFD700', letterSpacing: 3 }}>
            🏦 TREASURY &amp; VAULT STATS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'UPGRADE VAULT', value: `${parseFloat(vaultStats.upgradeVault).toFixed(5)} BNB`, sub: 'Auto-Upgrade Funds', color: '#FFD700', icon: '🏦' },
              { label: 'WITHDRAWABLE', value: `${parseFloat(vaultStats.withdrawable).toFixed(5)} BNB`, sub: 'Core Rewards', color: '#A3FF12', icon: '💸' },
              { label: 'LIFETIME REWARDS', value: `${parseFloat(vaultStats.lifetimeRewards).toFixed(4)} BNB`, sub: `≈ $${(parseFloat(vaultStats.lifetimeRewards) * (nativePrice || 650)).toFixed(0)}`, color: '#4FC3F7', icon: '💰' },
              { label: 'TOTAL CONTRIBUTED', value: `${parseFloat(vaultStats.totalContribution).toFixed(4)} BNB`, sub: 'Deposited into system', color: '#FF7043', icon: '📥' },
              { label: 'AUTO UPGRADES', value: vaultStats.autoUpgrades, sub: 'Via treasury', color: '#AB47BC', icon: '⚡' },
              { label: 'MANUAL UPGRADES', value: vaultStats.manualUpgrades, sub: 'Self-funded', color: '#26C6DA', icon: '🔧' },
              { label: 'DAYS ACTIVE', value: vaultStats.daysActive, sub: 'On-chain age', color: '#66BB6A', icon: '📅' },
              { label: 'TREASURY GENERATED', value: `${parseFloat(vaultStats.totalTreasury).toFixed(4)} BNB`, sub: 'Lifetime via treasury', color: '#FFB74D', icon: '🏛️' },
            ].map((stat, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${stat.color}20`,
                borderRadius: 16, padding: '14px 12px',
              }}>
                <div style={{ fontSize: 16, marginBottom: 6 }}>{stat.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', marginTop: 2 }}>{stat.label}</div>
                {stat.sub && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{stat.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── INCOME HISTORY ── */}
          {incomeHistory.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setShowHistory(h => !h)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
                  padding: '12px 16px', cursor: 'pointer', color: '#fff',
                  fontFamily: 'Outfit', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', fontSize: 12, fontWeight: 900,
                  borderBottomLeftRadius: showHistory ? 0 : 14,
                  borderBottomRightRadius: showHistory ? 0 : 14,
                }}
              >
                <span>📊 Income History (Last {incomeHistory.length})</span>
                <span style={{ fontSize: 10, opacity: 0.5 }}>{showHistory ? '▲ HIDE' : '▼ SHOW'}</span>
              </button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden', background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none',
                      borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}
                  >
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
                      {incomeHistory.map((item, i) => {
                        const typeLabels = ['', 'Direct', 'Matrix', 'Pool', 'Treasury', 'Missed'];
                        const typeColors = ['', '#A3FF12', '#4FC3F7', '#FFD700', '#FF9800', '#FF5252'];
                        const label = item.isMissed ? 'Missed' : (typeLabels[item.rewardType] || 'Reward');
                        const color = item.isMissed ? '#FF5252' : (typeColors[item.rewardType] || '#A3FF12');
                        const date = item.time > 0 ? new Date(item.time * 1000).toLocaleDateString() : 'N/A';
                        return (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: 10,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 6,
                                background: `${color}15`, color: color, letterSpacing: '0.5px'
                              }}>{label.toUpperCase()}</span>
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>L{item.layer} · {date}</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 900, color: item.isMissed ? '#FF5252' : '#A3FF12' }}>
                              {item.isMissed ? '-' : '+'}{parseFloat(item.amount).toFixed(5)} BNB
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Income protection alert ── */}
          <motion.div
            animate={{ x: [0, -2, 2, -2, 0] }}
            transition={{ duration: 0.5, delay: 2, repeat: Infinity, repeatDelay: 5 }}
            style={{ background: 'rgba(255,59,48,0.08)', border: '1.5px solid rgba(255,59,48,0.35)', borderRadius: 18, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#FF5252', marginBottom: 2 }}>STOP MISSING INCOME!</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                You only earn from team members at or <span style={{ color: 'var(--neon-lime)' }}>below your tier</span>. Upgrade to capture 100% of your downline rewards!
              </div>
            </div>
          </motion.div>

          {/* ── Treasury Pending Rewards Banner ── */}
          {parseFloat(pendingBnb) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0, boxShadow: ['0 0 20px #FFD70040', '0 0 40px #FFD70080', '0 0 20px #FFD70040'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(255,152,0,0.08) 100%)',
                border: '2px solid rgba(255,215,0,0.5)', borderRadius: 22, padding: '18px 20px', marginBottom: 20
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 36 }}>🏦</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#FFD700', letterSpacing: 2, marginBottom: 4 }}>TREASURY REWARDS WAITING FOR YOU</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                    {parseFloat(pendingBnb).toFixed(5)} <span style={{ fontSize: 13, color: '#FFD700' }}>{nativeSymbol}</span>
                  </div>
                  {nativePrice > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#FFB74D', marginTop: 3 }}>
                      ≈ ${(parseFloat(pendingBnb) * nativePrice).toFixed(2)} USD locked in contract
                    </div>
                  )}
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginTop: 6, lineHeight: 1.5 }}>
                    Upgrade your tier to automatically receive these {nativeSymbol} rewards
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── NEXT UPGRADE featured card ── */}
          {nextTier && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--neon-lime)', letterSpacing: 3, marginBottom: 10 }}>⚡ NEXT UPGRADE</div>
              <motion.div
                animate={{ boxShadow: [`0 0 15px ${nextTier.color}25`, `0 0 35px ${nextTier.color}45`, `0 0 15px ${nextTier.color}25`] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                style={{ background: `linear-gradient(135deg, ${nextTier.color}12 0%, ${nextTier.color}04 100%)`, border: `2px solid ${nextTier.color}60`, borderRadius: 24, padding: 20 }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <TierHex tier={nextTier.tier} color={nextTier.color} size={60} next />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>TIER {nextTier.tier}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: nextTier.color, marginTop: 2 }}>NODE UPGRADE</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 4 }}>
                      Unlocks {nextTier.depth} in matrix
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'SPILLOVER DEPTH', val: `Layer ${nextTier.tier}` },
                    { label: 'UPGRADE COST',    val: `${parseFloat(tierCosts[nextTier.tier - 1] || 0).toFixed(3)} ${nativeSymbol}`, sub: usdLabel(tierCosts[nextTier.tier - 1]) },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{s.val}</div>
                      {s.sub && <div style={{ fontSize: 10, color: '#4FC3F7', fontWeight: 700, marginTop: 2 }}>{s.sub}</div>}
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', fontWeight: 800, marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {isTreasury ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Status card */}
                    <div style={{ background: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.25)', borderRadius: 16, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#FFD700', letterSpacing: 1 }}>🎯 TREASURY FUNDING ACTIVE</span>
                        <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(255,215,0,0.15)', borderRadius: 6, color: '#FFD700', fontWeight: 900 }}>ENROLLED</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                        <span>Available Treasury:</span>
                        <span style={{ fontWeight: 800, color: '#fff' }}>{parseFloat(treasuryAvailableBnb).toFixed(4)} {nativeSymbol}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 4 }}>
                        <span>Upgrade Cost:</span>
                        <span style={{ fontWeight: 800, color: '#fff' }}>{parseFloat(tierCosts[nextTier.tier - 1] || 0).toFixed(4)} {nativeSymbol}</span>
                      </div>
                    </div>

                    {parseFloat(treasuryAvailableBnb) >= parseFloat(tierCosts[nextTier.tier - 1] || 0) ? (
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={handleTreasuryLevelUp}
                        disabled={isLoading}
                        style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                          color: '#000',
                          border: 'none',
                          borderRadius: 14,
                          padding: '16px',
                          fontSize: 15,
                          fontWeight: 900,
                          cursor: 'pointer',
                          letterSpacing: 0.5,
                          boxShadow: '0 0 15px rgba(255, 215, 0, 0.4)'
                        }}>
                        {isLoading ? '⟳ PROCESSING...' : `⚡ FREE UPGRADE FROM TREASURY`}
                      </motion.button>
                    ) : (
                      <div style={{
                        padding: '14px',
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px dashed rgba(255,255,255,0.15)',
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.5)',
                        lineHeight: 1.5
                      }}>
                        ⚠️ Treasury balance is insufficient to cover this upgrade. It will auto-upgrade as soon as contract gets new funds, or you can self-fund with {nativeSymbol} below.
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>OR SELF FUND</span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                    </div>

                    <button
                      onClick={() => handleLevelUp(nextTier.tier)}
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 14,
                        padding: '12px',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: '0.2s'
                      }}>
                      {isLoading ? '⟳ PROCESSING...' : `Self-Fund: Pay ${parseFloat(tierCosts[nextTier.tier - 1] || 0).toFixed(3)} ${nativeSymbol}`}
                    </button>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleLevelUp(nextTier.tier)}
                    disabled={isLoading}
                    style={{ width: '100%', background: nextTier.color, color: '#000', border: 'none', borderRadius: 14, padding: '16px', fontSize: 15, fontWeight: 900, cursor: 'pointer', letterSpacing: 0.5 }}>
                    {isLoading ? '⟳ PROCESSING...' : `⬆ UPGRADE TO TIER ${nextTier.tier}`}
                  </motion.button>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* ── UNIFIED 18 TIERS SHOP GRID ── */}
          {
            <>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#FFC72C', letterSpacing: 3, marginBottom: 14 }}>
                🛍️ NODE SHOP / COLLECTIBLES (18 TIERS)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                {TIERS.map((t, idx) => {
                  const isActive = nodeId && t.tier <= currentTier;
                  const isNext = nodeId ? t.tier === currentTier + 1 : t.tier === 1;
                  const isLocked = t.tier > (nodeId ? currentTier + 1 : 1);
                  
                  const emojis = {
                    1: '🐍', 2: '🧁', 3: '🐰', 4: '🍦', 5: '🍭', 6: '🧪',
                    7: '🎭', 8: '🎨', 9: '🛸', 10: '🍌', 11: '🪐', 12: '🎩',
                    13: '🎮', 14: '🎄', 15: '🔮', 16: '🦖', 17: '🔥', 18: '👑'
                  };
                  const emoji = emojis[t.tier] || '⬡';

                  const handleCardClick = () => {
                    if (isActive) {
                      toast.success(`Tier ${t.tier} is already active!`);
                    } else if (isNext) {
                      handleLevelUp(t.tier);
                    } else {
                      toast.error(`Please upgrade to Tier ${t.tier - 1} first!`);
                    }
                  };

                  return (
                    <motion.div
                      key={t.tier}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCardClick}
                      style={{
                        background: isActive ? 'rgba(163,255,18,0.04)' : 'rgba(255,255,255,0.03)',
                        border: isActive 
                          ? '1px solid rgba(163,255,18,0.25)' 
                          : isNext 
                            ? '1px solid rgba(255,199,44,0.3)' 
                            : '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '16px',
                        padding: '16px 10px',
                        textAlign: 'center',
                        position: 'relative',
                        cursor: 'pointer',
                        opacity: isActive ? 1 : isNext ? 0.95 : 0.4,
                        boxShadow: isActive ? '0 0 10px rgba(163,255,18,0.05)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {/* Active green dot or lock badge */}
                      {isActive ? (
                        <div style={{
                          position: 'absolute', top: '8px', right: '8px',
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: '#A3FF12', boxShadow: '0 0 6px #A3FF12'
                        }} />
                      ) : isNext ? (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '9px' }}>⚡</div>
                      ) : (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '9px', opacity: 0.5 }}>🔒</div>
                      )}

                      {/* Graphic emoji */}
                      <div style={{ fontSize: '32px', marginBottom: '8px', filter: isActive ? 'none' : 'grayscale(30%)' }}>
                        {emoji}
                      </div>

                      {/* Tier Label */}
                      <div style={{ fontSize: '11px', fontWeight: 900, color: isActive ? '#A3FF12' : '#fff' }}>
                        Tier {t.tier}
                      </div>

                      {/* Price Badge */}
                      <div style={{
                        background: 'rgba(32,34,37,0.8)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '10px',
                        padding: '3px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        marginTop: '8px',
                        maxWidth: '90%'
                      }}>
                        <span style={{ fontSize: '9px' }}>⭐️</span>
                        <span style={{ fontSize: '9px', fontWeight: 900, color: '#FFD700', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {isActive ? 'OWNED' : parseFloat(tierCosts[t.tier - 1] || 0).toFixed(2)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          }

          {/* Max tier reached */}
          {currentTier >= 18 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '40px 20px', background: 'linear-gradient(135deg, rgba(163,255,18,0.1), transparent)', border: '1px solid rgba(163,255,18,0.3)', borderRadius: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--neon-lime)', marginBottom: 6 }}>MAX TIER ACHIEVED!</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>You have unlocked all 18 tiers. Spillover coverage maximized.</div>
            </motion.div>
          )}


        </>
      )}
    </div>
  );
}
