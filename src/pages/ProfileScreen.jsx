import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import { useContract } from '../hooks/useContract.js';
import { shortAddr } from '../utils/format.js';
import { useNativePrice } from '../hooks/useNativePrice.js';
import { Shield, Coins, Users, Award, ExternalLink, RefreshCw, Copy, Check, Bell, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import TelegramShareCard from '../components/TelegramShareCard.jsx';
import TelegramBindModal from '../components/TelegramBindModal.jsx';

export default function ProfileScreen() {
  const {
    walletAddress, nodeId, nodeTier, hasNode,
    teamSize, directRefs, bnbBalance,
    withdrawableBalance, upgradeVaultBalance, totalEarned
  } = useGameStore();

  const { loadNodeData } = useContract();
  const nativePrice = useNativePrice();
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  const usdValue = (bnb) => {
    const val = parseFloat(bnb || 0);
    return nativePrice > 0 ? `≈ $${(val * nativePrice).toFixed(2)}` : '';
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadNodeData(walletAddress);
      toast.success('Stats refreshed from blockchain! ⬡');
    } catch (e) {
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyWallet = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      toast.success('Wallet address copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Determine user rank and active badges
  const rank = hasNode ? (nodeTier >= 10 ? 'Gold Operator' : nodeTier >= 5 ? 'Silver Operator' : 'Bronze Operator') : 'Guest Operator';
  const rankColor = hasNode ? (nodeTier >= 10 ? '#FFD700' : nodeTier >= 5 ? '#C0C0C0' : '#CD7F32') : '#718096';

  const badges = [
    { id: 'early', name: 'Pre-Launch Pioneer', icon: '🚀', desc: 'Registered during Free Pre-Launch', active: true },
    { id: 'node', name: 'Node Operator', icon: '⬡', desc: 'Owns active AIPCore Node', active: hasNode },
    { id: 'recruiter', name: 'Super Recruiter', icon: '🔥', desc: 'Has 10+ direct referrals', active: directRefs >= 10 },
    { id: 'leader', name: 'Network Builder', icon: '👑', desc: 'Has 50+ total team members', active: teamSize >= 50 },
    { id: 'silver', name: 'Elite Tier', icon: '💎', desc: 'Reached Node Tier 5 or higher', active: nodeTier >= 5 },
  ];

  return (
    <div style={{ padding: '0 16px', paddingBottom: 'calc(var(--tabbar-h, 80px) + 24px)', fontFamily: 'Outfit, sans-serif', color: '#fff' }}>
      
      {/* Profile Header Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(32,34,37,0.8) 0%, rgba(20,22,25,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '24px',
        padding: '24px 20px',
        textAlign: 'center',
        position: 'relative',
        marginBottom: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
          width: '250px', height: '250px',
          background: `radial-gradient(circle, ${rankColor}15 0%, transparent 70%)`,
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'absolute', top: '16px', right: '16px' }}>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '50%', width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Profile Avatar */}
        <div style={{
          width: '84px', height: '84px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #202225 0%, #12131a 100%)',
          border: `3px solid ${rankColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '38px', margin: '0 auto 16px',
          boxShadow: `0 0 20px ${rankColor}30`
        }}>
          {hasNode ? '⬡' : '👤'}
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: 950, marginBottom: '6px' }}>
          {hasNode ? `Operator #${nodeId}` : 'Guest Operator'}
        </h3>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', padding: '6px 14px', cursor: 'pointer'
        }} onClick={handleCopyWallet}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
            {shortAddr(walletAddress)}
          </span>
          {copied ? <Check size={12} color="#A3FF12" /> : <Copy size={12} color="rgba(255,255,255,0.4)" />}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px'
        }}>
          <span style={{
            background: `${rankColor}15`, border: `1px solid ${rankColor}40`,
            color: rankColor, fontSize: '10px', fontWeight: 900,
            padding: '4px 10px', borderRadius: '20px', letterSpacing: '0.5px'
          }}>
            {rank.toUpperCase()}
          </span>
          <span style={{
            background: 'rgba(163,255,18,0.1)', border: '1px solid rgba(163,255,18,0.2)',
            color: '#A3FF12', fontSize: '10px', fontWeight: 900,
            padding: '4px 10px', borderRadius: '20px'
          }}>
            TIER {nodeTier}
          </span>
        </div>
      </div>

      {/* Network Stats Grid */}
      <h4 style={{ fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
        📊 NETWORK TELEMETRY
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        {[
          { icon: <Users size={16} color="#A3FF12" />, value: teamSize || 0, label: 'Total Team' },
          { icon: <Shield size={16} color="#00F2FE" />, value: directRefs || 0, label: 'Direct Referrals' }
        ].map((s, idx) => (
          <div key={idx} style={{
            background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '18px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px'
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 950 }}>{s.value}</div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', fontWeight: 800, letterSpacing: '0.5px', marginTop: '2px' }}>
                {s.label.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Financial Details */}
      <h4 style={{ fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
        💰 FINANCIAL TELEMETRY
      </h4>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
        marginBottom: '20px'
      }}>
        {[
          { label: 'Wallet Balance', value: bnbBalance, color: '#A3FF12' },
          { label: 'Withdrawable Vault', value: withdrawableBalance, color: '#00F2FE' },
          { label: 'Upgrade Lock Vault', value: upgradeVaultBalance, color: '#FFD700' },
          { label: 'Lifetime Earnings', value: totalEarned, color: '#A12CFF' }
        ].map((f, idx) => (
          <div key={idx} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingBottom: idx < 3 ? '14px' : '0',
            borderBottom: idx < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none'
          }}>
            <div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>{f.label}</span>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 800, marginTop: '2px' }}>
                {usdValue(f.value)}
              </div>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 950, color: f.color }}>
              {parseFloat(f.value || 0).toFixed(4)} BNB
            </span>
          </div>
        ))}
      </div>

      {/* Collectibles / Achievements Grid */}
      <h4 style={{ fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
        🏷️ COLLECTIBLE BADGES ({badges.filter(b => b.active).length} / {badges.length})
      </h4>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px'
      }}>
        {badges.map((b) => (
          <div key={b.id} style={{
            background: 'var(--bg-card)',
            border: b.active ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.03)',
            borderRadius: '16px',
            padding: '14px 10px',
            textAlign: 'center',
            opacity: b.active ? 1 : 0.25,
            transition: 'all 0.3s ease',
            position: 'relative'
          }}>
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>{b.icon}</div>
            <div style={{ fontSize: '9px', fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {b.name}
            </div>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', lineHeight: 1.3 }}>
              {b.desc}
            </div>
            {b.active && (
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#A3FF12', boxShadow: '0 0 6px #A3FF12'
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Telegram Payout Alert Trigger Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,136,204,0.12) 0%, rgba(0,168,255,0.06) 100%)',
        border: '1px solid rgba(0, 136, 204, 0.3)',
        borderRadius: '20px', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        margin: '20px 0 16px', gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #0088cc, #00a8ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 12px rgba(0,136,204,0.3)'
          }}>
            <Bell size={22} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff' }}>Telegram Payout Alerts</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
              Receive instant alerts on referral & matrix earnings
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowTelegramModal(true)}
          style={{
            background: '#0088cc', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '10px 16px',
            fontSize: '12px', fontWeight: 900, cursor: 'pointer',
            whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,136,204,0.3)'
          }}
        >
          Manage Alerts
        </button>
      </div>

      {/* Telegram Referral Sharing Card */}
      <div style={{ marginTop: '16px' }}>
        <TelegramShareCard userNodeId={nodeId} walletAddress={walletAddress} />
      </div>

      {/* Telegram Binding Modal */}
      <TelegramBindModal isOpen={showTelegramModal} onClose={() => setShowTelegramModal(false)} />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
