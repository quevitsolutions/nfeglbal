import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Layers, Share2, Crown, ChevronRight, Info, 
  TrendingUp, Users, Target, Activity, ShieldCheck, Copy, Check
} from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';
import { useContract } from '../hooks/useContract.js';
import { formatNumber, formatBNB, shortAddr } from '../utils/format.js';
import { useNativePrice } from '../hooks/useNativePrice.js';
import { CONTRACTS } from '../config/constants.js';
import toast from 'react-hot-toast';

const inputStyle = {
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
};

export default function DashboardScreen() {
  const {
    walletAddress, hasNode, nodeId, nodeActive, nodeTier,
    totalEarned, pendingReward, teamSize, directRefs,
    poolClaimable, poolQual, isConnected,
    bnbBalance, sponsorNodeId,
    withdrawableBalance, upgradeVaultBalance,
    lifetimeRewards, lifetimeVaultDeposits, lifetimeVaultUsed,
    vaultHistory, withdrawBalance, fetchVaultHistory
  } = useGameStore();
  
  const { loadNodeData, claimPool, claimRewards, fetchTeamCounts, registerPool, fetchLevelWiseTeamStats } = useContract();
  const nativePrice = useNativePrice();
  
  const [levelCounts, setLevelCounts] = useState([]);
  const [levelStats, setLevelStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState({});

  const toggleLevelExpand = (lvlIdx) => {
    setExpandedLevels(prev => ({
      ...prev,
      [lvlIdx]: !prev[lvlIdx]
    }));
  };

  const usd = (bnb) => nativePrice > 0 ? (
    <span style={{ fontSize: '11px', fontWeight: 700, color: '#A3FF12', display: 'block', marginTop: '2px' }}>
      ≈ ${(parseFloat(bnb || 0) * nativePrice).toFixed(2)}
    </span>
  ) : null;

  useEffect(() => {
    if (walletAddress) {
      loadNodeData(walletAddress);
      fetchVaultHistory();
    }
  }, [walletAddress, loadNodeData, fetchVaultHistory]);

  useEffect(() => {
    if (isConnected && nodeId) {
      fetchTeamCounts(nodeId).then(setLevelCounts);
      setLoadingStats(true);
      fetchLevelWiseTeamStats(nodeId)
        .then(setLevelStats)
        .catch(err => console.error("Failed to fetch level stats:", err))
        .finally(() => setLoadingStats(false));
    }
  }, [isConnected, nodeId, fetchTeamCounts, fetchLevelWiseTeamStats]);

  const calcDirects = levelCounts.length > 0 ? levelCounts[0] : (directRefs || 0);
  const calcTotal = levelCounts.length > 0 ? levelCounts.reduce((a, b) => a + b, 0) : (teamSize || 0);

  const refToken = nodeId || walletAddress;
  const inviteLink = walletAddress ? `${window.location.origin}/?ref=${refToken}` : 'Connect wallet to get link';
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      toast.success('Referral link copied!', { style: { background: '#202225', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } });
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error('Copy failed'));
  };

  return (
    <div className="sub-page page-dashboard" style={{ padding: '16px', background: '#12131a', minHeight: '100%', overflowY: 'auto', paddingBottom: '30px' }}>
      
      {/* Node status card */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'rgba(32, 34, 37, 0.8)',
          border: `1.5px solid ${hasNode && nodeActive ? '#A3FF12' : '#FF5252'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          color: hasNode && nodeActive ? '#A3FF12' : '#FF5252'
        }}>
          ⬡
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 950, color: '#fff' }}>
            {hasNode ? `NODE #${nodeId}` : 'GUEST OPERATOR'}
          </h3>
          <p style={{ fontSize: '11px', color: '#b9bbbe', marginTop: '2px' }}>
            Wallet: {shortAddr(walletAddress)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '8px', fontWeight: 800, color: '#fff' }}>
            Tier {nodeTier}
          </span>
          <div style={{ fontSize: '10px', color: '#b9bbbe', marginTop: '6px', fontWeight: 700 }}>
            {bnbBalance} BNB
          </div>
        </div>
      </div>

      {/* Copy link card */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '16px'
      }}>
        <h4 style={{ fontSize: '11px', fontWeight: 900, color: '#A3FF12', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
          🔗 REFERRAL LINK (5% Bonus)
        </h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            readOnly
            value={inviteLink}
            style={{
              ...inputStyle,
              background: 'rgba(32, 34, 37, 0.8)',
              border: '1px solid rgba(255,255,255,0.05)',
              textOverflow: 'ellipsis'
            }}
          />
          <button
            onClick={handleCopyLink}
            style={{
              background: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '14px',
              padding: '0 16px',
              cursor: 'pointer',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Vault position & Withdrawable balance */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div>
          <span style={{ fontSize: '10px', color: '#b9bbbe', fontWeight: 800 }}>WITHDRAWABLE BALANCE</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 950, color: '#fff' }}>
              {(withdrawableBalance || 0).toFixed(4)} BNB
            </span>
            {usd(withdrawableBalance)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            onClick={claimRewards}
            style={{
              background: '#A3FF12',
              color: '#000',
              border: 'none',
              borderRadius: '14px',
              padding: '12px',
              fontWeight: 900,
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'Outfit'
            }}
          >
            CLAIM REWARDS
          </button>
          <button
            onClick={() => toast.error('Withdraw only available at maturity')}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              padding: '12px',
              fontWeight: 900,
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'Outfit'
            }}
          >
            WITHDRAW VAULT
          </button>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#b9bbbe', fontWeight: 800, marginBottom: '6px' }}>
            <span>VESTING PROGRESS</span>
            <span>{upgradeVaultBalance > 0 ? 'Active' : 'Empty'}</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: withdrawableBalance > 0 ? '100%' : '0%', height: '100%', background: '#A12CFF' }} />
          </div>
        </div>
      </div>

      {/* SVG distribution chart & Level stats */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        padding: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '16px'
      }}>
        <h4 style={{ fontSize: '11px', fontWeight: 900, color: '#fff', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '16px' }}>
          📊 TEAM DISTRIBUTION CHART
        </h4>
        
        {/* Simple SVG Area Graph */}
        <div style={{ width: '100%', height: '120px', background: 'rgba(32, 34, 37, 0.4)', borderRadius: '16px', overflow: 'hidden', padding: '10px 0' }}>
          <svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="limeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A3FF12" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#A3FF12" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0,80 Q50,40 100,60 T200,30 T300,50 T400,90 L400,100 L0,100 Z"
              fill="url(#limeGrad)"
              stroke="#A3FF12"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Tree level list with stacked ratio referral bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => {
            const hasRealNode = nodeId && Number(nodeId) > 0;
            const paid = hasRealNode && levelStats && levelStats.paidUsers ? (levelStats.paidUsers[level - 1] || 0) : Math.max(0, 10 - level);
            const free = hasRealNode && levelStats && levelStats.freeUsers ? (levelStats.freeUsers[level - 1] || 0) : level * 2;
            const total = paid + free;
            const paidPct = total > 0 ? (paid / total) * 100 : 0;
            const freePct = total > 0 ? (free / total) * 100 : 0;

            return (
              <div key={level} style={{ background: 'rgba(32,34,37,0.4)', padding: '12px 14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>Level {level}</span>
                  <span style={{ fontSize: '11px', color: '#b9bbbe', fontWeight: 800 }}>
                    {total} Refs ({paid} Paid / {free} Free)
                  </span>
                </div>
                
                {/* Segmented referral ratio bar */}
                <div style={{ width: '100%', height: '8px', borderRadius: '4px', display: 'flex', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                  <div style={{ width: `${paidPct}%`, height: '100%', background: '#A3FF12' }} />
                  <div style={{ width: `${freePct}%`, height: '100%', background: '#A12CFF' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
