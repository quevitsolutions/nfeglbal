import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import { blockchain } from '../services/blockchain.js';
import { CONTRACTS } from '../config/constants.js';
import { getEthersSigner } from '../utils/ethers-adapter.js';
import { ethers } from 'ethers';
import { config } from '../config/wagmi.js';
import toast from 'react-hot-toast';
import {
  Wallet, TrendingUp, ArrowDownCircle, RefreshCw, Shield,
  ChevronDown, ChevronUp, Zap, Gift, Lock, AlertTriangle, CheckCircle
} from 'lucide-react';

// ── TIER NAMES ──
const TIER_NAMES = [
  'Free Node', 'Bronze I', 'Bronze II', 'Bronze III',
  'Silver I', 'Silver II', 'Silver III',
  'Gold I', 'Gold II', 'Gold III',
  'Platinum I', 'Platinum II', 'Platinum III',
  'Diamond I', 'Diamond II', 'Diamond III',
  'Royal I', 'Royal II'
];

// ── POOL NAMES ──
const POOL_NAMES = ['None', 'Starter Pool', 'Builder Pool', 'Achiever Pool', 'Leader Pool', 'Elite Pool'];

// Error boundary to catch render errors
class ClaimErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#FF4444' }}>
          <div style={{ fontSize: '18px', fontWeight: 900, marginBottom: '12px' }}>⚠️ Claim Page Error</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'pre-wrap', textAlign: 'left', maxWidth: '500px', margin: '0 auto', background: 'rgba(255,0,0,0.1)', padding: '16px', borderRadius: '12px' }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ClaimScreenInner() {
  const {
    nodeId, nodeTier, hasNode, isFreeActive,
    totalEarned, pendingReward, poolClaimable,
    poolQual, walletAddress, bnbBalance
  } = useGameStore();

  const [isClaimingCore, setIsClaimingCore] = useState(false);
  const [isClaimingPool, setIsClaimingPool] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [incomeBreakdown, setIncomeBreakdown] = useState(null);
  const [bnbPrice, setBnbPrice] = useState(650);
  const [recentClaims, setRecentClaims] = useState([]);
  const [vestingData, setVestingData] = useState({
    totalDeposited: 0n, totalClaimed: 0n, vestedClaimable: 0n, unvestedRemaining: 0n, activePositions: 0n
  });
  const [vestingLoading, setVestingLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawingInstant, setIsWithdrawingInstant] = useState(false);
  const [isClaimingVested, setIsClaimingVested] = useState(false);

  const isActive = hasNode || isFreeActive;
  const tierName = TIER_NAMES[nodeTier] || `Tier ${nodeTier}`;
  const poolName = poolQual?.poolName || 'None';
  const pendingNum = parseFloat(pendingReward) || 0;
  const poolNum = parseFloat(poolClaimable) || 0;
  const earnedNum = parseFloat(totalEarned) || 0;
  const totalClaimable = pendingNum + poolNum;
  const totalClaimableUsd = (totalClaimable * bnbPrice).toFixed(2);

  const loadVestingData = useCallback(async () => {
    if (!nodeId || !hasNode) return;
    setVestingLoading(true);
    try {
      const signer = await getEthersSigner(config);
      if (!signer) return;
      const vault = new ethers.Contract(
        CONTRACTS.NFEVESTINGVAULT || "0x9e1655eA63A9A10314B55A3c01bf2e23F28e52D8",
        [
          "function getNodeSummary(uint256 nodeId) view returns (uint256 totalDeposited, uint256 totalClaimed, uint256 vestedClaimable, uint256 unvestedRemaining, uint256 activePositions)"
        ],
        signer
      );
      const summary = await vault.getNodeSummary(nodeId).catch(() => [0n, 0n, 0n, 0n, 0n]);
      setVestingData({
        totalDeposited: summary[0],
        totalClaimed: summary[1],
        vestedClaimable: summary[2],
        unvestedRemaining: summary[3],
        activePositions: summary[4]
      });
    } catch (e) {
      console.error("loadVestingData failed:", e);
    } finally {
      setVestingLoading(false);
    }
  }, [nodeId, hasNode]);

  const handleClaimVested = async () => {
    if (isClaimingVested || vestingData.vestedClaimable === 0n) return;
    setIsClaimingVested(true);
    const toastId = toast.loading('Claiming vested rewards...');
    try {
      const signer = await getEthersSigner(config);
      const vault = new ethers.Contract(
        CONTRACTS.NFEVESTINGVAULT || "0x9e1655eA63A9A10314B55A3c01bf2e23F28e52D8",
        ["function claimVestedRewards(uint256 nodeId) external"],
        signer
      );
      const tx = await vault.claimVestedRewards(nodeId);
      await tx.wait();
      toast.success('Successfully claimed vested rewards!', { id: toastId });
      loadVestingData();
    } catch (e) {
      toast.error(e.reason || e.message || 'Claim failed', { id: toastId });
    } finally {
      setIsClaimingVested(false);
    }
  };

  const handleInstantWithdraw = async () => {
    if (isWithdrawingInstant || !withdrawAmount) return;
    setIsWithdrawingInstant(true);
    const toastId = toast.loading('Executing instant withdrawal with 20% penalty...');
    try {
      const signer = await getEthersSigner(config);
      const vault = new ethers.Contract(
        CONTRACTS.NFEVESTINGVAULT || "0x9e1655eA63A9A10314B55A3c01bf2e23F28e52D8",
        ["function instantWithdraw(uint256 nodeId, uint256 amount) external"],
        signer
      );
      const amountWei = ethers.parseEther(withdrawAmount);
      const tx = await vault.instantWithdraw(nodeId, amountWei);
      await tx.wait();
      toast.success('Instant withdrawal successful!', { id: toastId });
      setWithdrawAmount('');
      loadVestingData();
    } catch (e) {
      toast.error(e.reason || e.message || 'Withdraw failed', { id: toastId });
    } finally {
      setIsWithdrawingInstant(false);
    }
  };

  // Fetch BNB price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/stats/live');
        const data = await res.json();
        if (data.bnbPrice) setBnbPrice(data.bnbPrice);
      } catch (e) {}
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch income breakdown
  const fetchBreakdown = useCallback(async () => {
    if (!walletAddress || !nodeId) return;
    try {
      const data = await blockchain.getFullDashboardData(walletAddress);
      if (data) {
        setIncomeBreakdown({
          total: parseFloat(data.totalEarned || 0),
          referral: 0,
          matrix: 0,
          pool: parseFloat(data.totalPoolEarned || 0),
          pending: parseFloat(data.pendingReward || 0),
        });
        // Also update store with fresh data
        const store = useGameStore.getState();
        store.setNodeData({ nodeId: data.nodeId, tier: data.tier, active: data.nodeActive });
        store.updateChainData({
          totalEarned: parseFloat(data.totalEarned || 0),
          pendingReward: parseFloat(data.pendingReward || 0),
          poolClaimable: parseFloat(data.poolClaimable || 0),
          poolName: data.poolName || 'None',
          totalDeposited: parseFloat(data.totalDeposited || 0),
          isPoolQualified: Boolean(data.isPoolQualified),
          totalPoolEarned: parseFloat(data.totalPoolEarned || 0),
          totalPoolClaimed: parseFloat(data.totalPoolClaimed || 0),
          remainingCap: parseFloat(data.remainingCap || 0),
          lifetimeCap: parseFloat(data.lifetimeCap || 0),
          missingDirects: data.missingDirects || 0,
          missingTier: data.missingTier || 0,
          missingTeam: data.missingTeam || 0,
        });
      }
    } catch (e) { console.error('fetchBreakdown error:', e); }
  }, [walletAddress, nodeId]);

  useEffect(() => {
    fetchBreakdown();
    if (hasNode && nodeId) {
      loadVestingData();
    }
  }, [fetchBreakdown, loadVestingData, hasNode, nodeId]);

  // Refresh all data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchBreakdown(),
        loadVestingData()
      ]);
      toast.success('Data refreshed!', { duration: 2000 });
    } catch (e) {
      toast.error('Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Claim core rewards (withdraw)
  const handleClaimCore = async () => {
    if (isClaimingCore || pendingNum <= 0) return;
    setIsClaimingCore(true);
    const tid = toast.loading('Claiming core rewards...');
    try {
      await blockchain.claimRewards();
      toast.success(`✅ Claimed ${pendingNum.toFixed(4)} BNB from Core!`, { id: tid, duration: 5000 });
      setRecentClaims(prev => [
        { type: 'Core', amount: pendingReward, time: new Date() },
        ...prev.slice(0, 4)
      ]);
      // Refresh data
      setTimeout(() => handleRefresh(), 2000);
    } catch (err) {
      const msg = err.message?.includes('user rejected') ? 'Transaction cancelled' :
                  err.message?.includes('nothing to claim') ? 'No rewards to claim' :
                  'Claim failed — try again';
      toast.error(msg, { id: tid });
    } finally {
      setIsClaimingCore(false);
    }
  };

  // Claim pool rewards
  const handleClaimPool = async () => {
    if (isClaimingPool || poolNum <= 0 || !nodeId) return;
    setIsClaimingPool(true);
    const tid = toast.loading('Claiming pool rewards...');
    try {
      await blockchain.claimPool(nodeId);
      toast.success(`✅ Claimed ${poolNum.toFixed(4)} BNB from Pool!`, { id: tid, duration: 5000 });
      setRecentClaims(prev => [
        { type: 'Pool', amount: poolClaimable, time: new Date() },
        ...prev.slice(0, 4)
      ]);
      setTimeout(() => handleRefresh(), 2000);
    } catch (err) {
      const msg = err.message?.includes('user rejected') ? 'Transaction cancelled' :
                  err.message?.includes('nothing') ? 'No pool rewards to claim' :
                  'Pool claim failed — try again';
      toast.error(msg, { id: tid });
    } finally {
      setIsClaimingPool(false);
    }
  };

  // ── NOT ACTIVE STATE ──
  if (!isActive) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{
          background: 'rgba(255,200,50,0.05)',
          border: '1px solid rgba(255,200,50,0.15)',
          borderRadius: '20px',
          padding: '40px 24px',
          maxWidth: '400px',
          margin: '0 auto'
        }}>
          <Lock size={48} style={{ color: '#FFC72C', marginBottom: '16px' }} />
          <div style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>
            Node Required
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
            Activate your AIPCore node to start earning BNB rewards from referrals, matrix spillover, and global pools.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 950, letterSpacing: '-0.5px' }}>
            💰 Claim Rewards
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
            Node #{nodeId} · {tierName}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '8px 12px',
            cursor: 'pointer',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: 'Outfit'
          }}
        >
          <RefreshCw size={14} style={{
            animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
          }} />
          {isRefreshing ? 'SYNCING...' : 'REFRESH'}
        </button>
      </div>

      {/* ═══ TOTAL CLAIMABLE CARD ═══ */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,200,50,0.08) 0%, rgba(255,140,0,0.05) 100%)',
        border: '1px solid rgba(255,200,50,0.2)',
        borderRadius: '20px',
        padding: '24px',
        textAlign: 'center',
        marginBottom: '16px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
          width: '200px', height: '200px',
          background: 'radial-gradient(circle, rgba(255,200,50,0.1) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: '8px' }}>
          TOTAL CLAIMABLE
        </div>
        <div style={{ fontSize: '36px', fontWeight: 950, color: '#FFC72C', letterSpacing: '-1px' }}>
          {totalClaimable.toFixed(4)}
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginLeft: '6px' }}>BNB</span>
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginTop: '4px' }}>
          ≈ ${totalClaimableUsd} USD
        </div>

        {/* BNB Balance */}
        <div style={{
          marginTop: '16px', padding: '8px 16px',
          background: 'rgba(0,0,0,0.2)', borderRadius: '10px',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.5)'
        }}>
          <Wallet size={12} />
          Wallet: {parseFloat(bnbBalance || 0).toFixed(4)} BNB
        </div>
      </div>

      {/* ═══ CLAIM BUTTONS ROW ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>

        {/* Core Claim */}
        <button
          onClick={handleClaimCore}
          disabled={isClaimingCore || pendingNum <= 0}
          style={{
            background: pendingNum > 0
              ? 'linear-gradient(135deg, #FFC72C, #FF8C00)'
              : 'rgba(255,255,255,0.03)',
            border: pendingNum > 0
              ? 'none'
              : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '20px 16px',
            cursor: pendingNum > 0 ? 'pointer' : 'default',
            color: pendingNum > 0 ? '#000' : 'rgba(255,255,255,0.3)',
            fontFamily: 'Outfit',
            textAlign: 'center',
            transition: 'all 0.2s ease',
            opacity: isClaimingCore ? 0.7 : 1
          }}
        >
          <ArrowDownCircle size={22} style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '18px', fontWeight: 950 }}>
            {pendingNum.toFixed(4)}
          </div>
          <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1px', marginTop: '4px', opacity: 0.7 }}>
            CORE REWARDS
          </div>
          <div style={{
            marginTop: '10px', padding: '6px 14px',
            background: pendingNum > 0 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.05)',
            borderRadius: '8px', fontSize: '10px', fontWeight: 900,
            letterSpacing: '0.5px'
          }}>
            {isClaimingCore ? '⏳ CLAIMING...' : pendingNum > 0 ? '⚡ CLAIM' : 'NO REWARDS'}
          </div>
        </button>

        {/* Pool Claim */}
        <button
          onClick={handleClaimPool}
          disabled={isClaimingPool || poolNum <= 0}
          style={{
            background: poolNum > 0
              ? 'linear-gradient(135deg, #4FC3F7, #2196F3)'
              : 'rgba(255,255,255,0.03)',
            border: poolNum > 0
              ? 'none'
              : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '20px 16px',
            cursor: poolNum > 0 ? 'pointer' : 'default',
            color: poolNum > 0 ? '#000' : 'rgba(255,255,255,0.3)',
            fontFamily: 'Outfit',
            textAlign: 'center',
            transition: 'all 0.2s ease',
            opacity: isClaimingPool ? 0.7 : 1
          }}
        >
          <Gift size={22} style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '18px', fontWeight: 950 }}>
            {poolNum.toFixed(4)}
          </div>
          <div style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '1px', marginTop: '4px', opacity: 0.7 }}>
            POOL REWARDS
          </div>
          <div style={{
            marginTop: '10px', padding: '6px 14px',
            background: poolNum > 0 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.05)',
            borderRadius: '8px', fontSize: '10px', fontWeight: 900,
            letterSpacing: '0.5px'
          }}>
            {isClaimingPool ? '⏳ CLAIMING...' : poolNum > 0 ? '🎁 CLAIM' : 'NO REWARDS'}
          </div>
        </button>
      </div>

      {/* ═══ LIFETIME EARNINGS CARD ═══ */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '16px'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} style={{ color: '#4FC3F7' }} />
            Lifetime Earnings
          </div>
          <div style={{ fontSize: '16px', fontWeight: 950, color: '#A3FF12' }}>
            {earnedNum.toFixed(4)} BNB
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Total Earned', value: `${earnedNum.toFixed(3)}`, color: '#A3FF12' },
            { label: 'Pool Claimed', value: `${(parseFloat(poolQual?.totalPoolClaimed) || 0).toFixed(3)}`, color: '#4FC3F7' },
            { label: 'USD Value', value: `$${(earnedNum * bnbPrice).toFixed(0)}`, color: '#FFC72C' },
          ].map((item, i) => (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '10px',
              padding: '12px 8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 950, color: item.color }}>
                {item.value}
              </div>
              <div style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px', marginTop: '4px' }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ POOL STATUS CARD ═══ */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '16px'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={16} style={{ color: '#FFC72C' }} />
            Pool Status
          </div>
          <div style={{
            background: poolQual?.isPoolQualified
              ? 'rgba(163,255,18,0.1)'
              : 'rgba(255,100,50,0.1)',
            border: `1px solid ${poolQual?.isPoolQualified ? 'rgba(163,255,18,0.3)' : 'rgba(255,100,50,0.3)'}`,
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '9px',
            fontWeight: 900,
            color: poolQual?.isPoolQualified ? '#A3FF12' : '#FF6B35',
            letterSpacing: '0.5px'
          }}>
            {poolQual?.isPoolQualified ? '✅ QUALIFIED' : '⚠️ NOT QUALIFIED'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Current Pool', value: poolName, color: '#4FC3F7' },
            { label: 'Your Tier', value: tierName, color: '#FFC72C' },
            { label: 'Lifetime Cap', value: `${(parseFloat(poolQual?.lifetimeCap) || 0).toFixed(2)} BNB`, color: '#A3FF12' },
            { label: 'Remaining Cap', value: `${(parseFloat(poolQual?.remainingCap) || 0).toFixed(2)} BNB`, color: '#FF6B35' },
          ].map((item, i) => (
            <div key={i} style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 950, color: item.color }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Missing requirements */}
        {!poolQual?.isPoolQualified && (poolQual?.missingDirects > 0 || poolQual?.missingTier > 0 || poolQual?.missingTeam > 0) && (
          <div style={{
            marginTop: '12px',
            background: 'rgba(255,100,50,0.05)',
            border: '1px solid rgba(255,100,50,0.15)',
            borderRadius: '10px',
            padding: '12px'
          }}>
            <div style={{ fontSize: '10px', fontWeight: 900, color: '#FF6B35', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={12} /> REQUIREMENTS TO QUALIFY
            </div>
            {poolQual?.missingDirects > 0 && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                • Need {poolQual.missingDirects} more direct referrals
              </div>
            )}
            {poolQual?.missingTier > 0 && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                • Need Tier {poolQual.missingTier} (currently Tier {nodeTier})
              </div>
            )}
            {poolQual?.missingTeam > 0 && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                • Need {poolQual.missingTeam} more team members
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ INCOME BREAKDOWN (EXPANDABLE) ═══ */}
      <button
        onClick={() => setShowBreakdown(!showBreakdown)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '16px 20px',
          cursor: 'pointer',
          color: '#fff',
          fontFamily: 'Outfit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: showBreakdown ? '0' : '16px',
          borderBottomLeftRadius: showBreakdown ? 0 : '16px',
          borderBottomRightRadius: showBreakdown ? 0 : '16px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
          📊 Income Breakdown
        </span>
        {showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      <AnimatePresence>
        {showBreakdown && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderTop: 'none',
              borderBottomLeftRadius: '16px',
              borderBottomRightRadius: '16px',
              marginBottom: '16px'
            }}
          >
            <div style={{ padding: '16px 20px' }}>
              {incomeBreakdown ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Direct Referral Income', value: incomeBreakdown.referral, icon: '🤝', color: '#A3FF12' },
                    { label: 'Matrix Spillover Income', value: incomeBreakdown.matrix, icon: '🔗', color: '#4FC3F7' },
                    { label: 'Pool Distribution', value: incomeBreakdown.pool, icon: '🏆', color: '#FFC72C' },
                    { label: 'Pending (Unclaimed)', value: incomeBreakdown.pending, icon: '⏳', color: '#FF6B35' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>{item.icon}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                          {item.label}
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 950, color: item.color }}>
                        {(item.value || 0).toFixed(4)} BNB
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.3)', padding: '20px' }}>
                  Loading breakdown...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ VESTING VAULT PANEL ═══ */}
      {hasNode && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '16px',
          fontFamily: 'Outfit, sans-serif'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>💎</span> Vesting Vault
          </div>

          {vestingLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
              Loading Vault data from BSC...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>TOTAL DEPOSITED</div>
                  <div style={{ fontSize: '14px', fontWeight: 950, color: '#fff', marginTop: '4px' }}>
                    {parseFloat(ethers.formatEther(vestingData.totalDeposited)).toFixed(4)} BNB
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>TOTAL CLAIMED</div>
                  <div style={{ fontSize: '14px', fontWeight: 950, color: '#fff', marginTop: '4px' }}>
                    {parseFloat(ethers.formatEther(vestingData.totalClaimed)).toFixed(4)} BNB
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '9px', color: '#A3FF12', fontWeight: 800 }}>VESTED (0% FEE)</div>
                  <div style={{ fontSize: '14px', fontWeight: 950, color: '#A3FF12', marginTop: '4px' }}>
                    {parseFloat(ethers.formatEther(vestingData.vestedClaimable)).toFixed(4)} BNB
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '9px', color: '#FFB74D', fontWeight: 800 }}>UNVESTED REMAINING</div>
                  <div style={{ fontSize: '14px', fontWeight: 950, color: '#FFB74D', marginTop: '4px' }}>
                    {parseFloat(ethers.formatEther(vestingData.unvestedRemaining)).toFixed(4)} BNB
                  </div>
                </div>
              </div>

              {/* Claim Vested Button */}
              <button
                onClick={handleClaimVested}
                disabled={isClaimingVested || vestingData.vestedClaimable === 0n}
                style={{
                  background: vestingData.vestedClaimable > 0n ? 'var(--neon-lime)' : 'rgba(255,255,255,0.03)',
                  color: vestingData.vestedClaimable > 0n ? '#000' : 'rgba(255,255,255,0.2)',
                  border: vestingData.vestedClaimable > 0n ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px', padding: '12px', fontSize: '12px', fontWeight: 900,
                  cursor: vestingData.vestedClaimable > 0n ? 'pointer' : 'not-allowed', width: '100%',
                  fontFamily: 'Outfit', transition: 'all 0.2s ease'
                }}
              >
                {isClaimingVested ? '⏳ CLAIMING...' : 'Claim Vested Rewards (0% Fee)'}
              </button>

              {/* Instant Withdrawal Box */}
              <div style={{
                background: 'rgba(255,82,82,0.02)',
                border: '1px solid rgba(255,82,82,0.15)',
                borderRadius: '12px',
                padding: '14px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 900, color: '#FF5252', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={12} /> Instant Withdrawal (20% Penalty Tax)
                </div>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4', marginBottom: '12px' }}>
                  Bypasses the linear vesting schedule to withdraw locked rewards immediately. Deducts a 20% penalty split back into the ecosystem pools.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Amount in BNB"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    style={{
                      flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px', padding: '10px 12px', color: '#fff', fontSize: '12px', outline: 'none',
                      fontFamily: 'Outfit'
                    }}
                  />
                  <button
                    onClick={handleInstantWithdraw}
                    disabled={isWithdrawingInstant || !withdrawAmount}
                    style={{
                      background: withdrawAmount ? '#FF5252' : 'rgba(255,255,255,0.05)',
                      color: withdrawAmount ? '#fff' : 'rgba(255,255,255,0.2)',
                      border: 'none', borderRadius: '10px',
                      padding: '10px 16px', fontSize: '12px', fontWeight: 900,
                      cursor: withdrawAmount ? 'pointer' : 'not-allowed',
                      fontFamily: 'Outfit', transition: 'all 0.2s ease'
                    }}
                  >
                    {isWithdrawingInstant ? '⏳...' : 'Withdraw'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ RECENT CLAIMS ═══ */}
      {recentClaims.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 900, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={14} style={{ color: '#A3FF12' }} />
            Recent Claims
          </div>
          {recentClaims.map((c, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < recentClaims.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '8px', fontWeight: 900, letterSpacing: '0.5px',
                  background: c.type === 'Core' ? 'rgba(255,200,50,0.15)' : 'rgba(79,195,247,0.15)',
                  color: c.type === 'Core' ? '#FFC72C' : '#4FC3F7',
                  padding: '3px 8px', borderRadius: '6px'
                }}>
                  {c.type.toUpperCase()}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#A3FF12' }}>
                  +{c.amount.toFixed(4)} BNB
                </span>
              </div>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                {c.time.toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ═══ INFO FOOTER ═══ */}
      <div style={{
        textAlign: 'center',
        fontSize: '10px',
        color: 'rgba(255,255,255,0.25)',
        lineHeight: 1.6,
        padding: '8px 16px'
      }}>
        Core rewards come from direct referral and matrix spillover income.
        Pool rewards are distributed from the global reward pool based on your tier and qualification.
        <br />Claims require a small BNB gas fee (~$0.03).
      </div>
    </div>
  );
}

export default function ClaimScreen() {
  return (
    <ClaimErrorBoundary>
      <ClaimScreenInner />
    </ClaimErrorBoundary>
  );
}
