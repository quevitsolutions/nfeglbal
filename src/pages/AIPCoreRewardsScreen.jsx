import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import toast from 'react-hot-toast';

const NFT_BADGES = [
  { id: 'attendance', name: 'Attendance NFT', icon: '🎟️', description: 'Proof of webinar attendance', rarity: 'Common', color: '#4FC3F7', earned: true, earnedDate: 'May 2026' },
  { id: 'vip', name: 'VIP Access NFT', icon: '👑', description: 'Unlocks exclusive VIP halls', rarity: 'Rare', color: '#FFD700', earned: false, requirement: 'Attend 5 webinars' },
  { id: 'creator', name: 'Creator NFT', icon: '🎨', description: 'Issued to course instructors', rarity: 'Epic', color: '#CE93D8', earned: false, requirement: 'Publish a course' },
  { id: 'achievement', name: 'Achievement NFT', icon: '🏆', description: 'Milestone rewards badge', rarity: 'Legendary', color: '#FF6B6B', earned: false, requirement: 'Reach Tier 5 node' },
  { id: 'governance', name: 'DAO Delegate NFT', icon: '🏛️', description: 'Active DAO voter badge', rarity: 'Rare', color: '#A3FF12', earned: false, requirement: 'Vote on 3 proposals' },
];

const REWARD_HISTORY = [
  { type: 'BNB Reward', amount: '0.024 BNB', date: 'Today', icon: '💰', color: '#FFD700' },
  { type: 'Webinar Reward', amount: '0.005 BNB', date: 'Yesterday', icon: '🎙️', color: '#4FC3F7' },
  { type: 'Referral Commission', amount: '0.008 BNB', date: '2 days ago', icon: '🔗', color: '#A3FF12' },
  { type: 'Daily Streak', amount: '0.002 BNB', date: '3 days ago', icon: '🔥', color: '#FF6B6B' },
  { type: 'NFT Badge Drop', amount: 'Attendance NFT', date: '1 week ago', icon: '🏅', color: '#CE93D8' },
];

const LEADERBOARD = [
  { rank: 1, addr: '0x8f2...', earned: '4.2 BNB', nfts: 8, tier: 5, you: false },
  { rank: 2, addr: '0xa91...', earned: '3.8 BNB', nfts: 7, tier: 5, you: false },
  { rank: 3, addr: '0x3c4...', earned: '3.1 BNB', nfts: 6, tier: 4, you: false },
  { rank: 4, addr: '0xf7b...', earned: '2.4 BNB', nfts: 5, tier: 4, you: true },
  { rank: 5, addr: '0x1d2...', earned: '1.9 BNB', nfts: 4, tier: 3, you: false },
];

const RARITY_COLOR = { Common: '#4FC3F7', Rare: '#A3FF12', Epic: '#CE93D8', Legendary: '#FFD700' };

export default function AIPCoreRewardsScreen({ onBack }) {
  const { hasNode, nodeTier, localReward, poolClaimable } = useGameStore();
  const [tab, setTab] = useState('overview');
  const [claimingBnb, setClaimingBnb] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState(null);

  const [bnbReward] = useState(0.024);
  const [aipcoreReward] = useState(localReward || 0);

  const handleClaimBnb = async () => {
    if (!hasNode) return toast.error('🔒 Activate your node to claim BNB rewards', { duration: 4000 });
    setClaimingBnb(true);
    await new Promise(r => setTimeout(r, 2000));
    setClaimingBnb(false);
    setClaimedAmount(bnbReward);
    toast.success(`💰 ${bnbReward} BNB claimed to your wallet!`, { duration: 5000, icon: '🎉' });
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 18, width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 900 }}>🏆 AIPCore Rewards Arena</h1>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>BNB Rewards · NFT Badges · Referral Income</div>
        </div>
      </div>

      {/* Reward Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        {/* BNB Card */}
        <div style={{
          borderRadius: 18, padding: 16,
          background: 'linear-gradient(135deg, rgba(123,52,30,0.6), rgba(13,17,23,0.95))',
          border: '1px solid rgba(255,215,0,0.3)',
        }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>💰</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#FFD700' }}>{bnbReward} BNB</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Claimable BNB</div>
          <button onClick={handleClaimBnb} disabled={claimingBnb || !hasNode}
            style={{ width: '100%', padding: '9px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 900, cursor: hasNode ? 'pointer' : 'not-allowed',
              background: hasNode ? '#FFD700' : 'rgba(255,255,255,0.05)', color: hasNode ? '#000' : 'rgba(255,255,255,0.3)' }}>
            {claimingBnb ? '...' : claimedAmount ? '✅ Claimed' : 'Claim BNB'}
          </button>
        </div>

        {/* Matrix Level Card */}
        <div style={{
          borderRadius: 18, padding: 16,
          background: 'linear-gradient(135deg, rgba(27,67,50,0.6), rgba(13,17,23,0.95))',
          border: '1px solid rgba(163,255,18,0.3)',
        }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🕸️</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#A3FF12' }}>TIER {nodeTier || 1}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Active Matrix Level</div>
          <div style={{ width: '100%', padding: '9px', borderRadius: 10, background: 'rgba(163,255,18,0.1)', textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#A3FF12' }}>
            100% On-Chain 🔗
          </div>
        </div>
      </div>

      {/* Pool Reward if available */}
      {poolClaimable > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          style={{ borderRadius: 16, padding: 16, marginBottom: 16, background: 'linear-gradient(135deg, rgba(21,101,192,0.5), rgba(13,17,23,0.95))', border: '1px solid rgba(79,195,247,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#4FC3F7' }}>🌊 Pool Reward</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{poolClaimable} BNB</div>
          </div>
          <button style={{ background: '#4FC3F7', border: 'none', color: '#000', padding: '10px 18px', borderRadius: 12, fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>Claim Pool</button>
        </motion.div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['overview', 'nfts', 'leaderboard'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800,
              background: tab === t ? '#A3FF12' : 'rgba(255,255,255,0.05)', color: tab === t ? '#000' : 'rgba(255,255,255,0.5)' }}>
            {t === 'overview' ? '📊 Overview' : t === 'nfts' ? '🏅 NFTs' : '🏆 Ranks'}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <>
          {/* Reward Streams */}
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 12 }}>💎 Active Reward Streams</div>
            {[
              { name: 'Direct Referrals', rate: '10% instant BNB payout', active: hasNode, icon: '🔗' },
              { name: 'Layer Yield Commissions', rate: '1.5% BNB downline per layer (10 layers)', active: hasNode, icon: '⚙️' },
              { name: 'DAO Voting Power', rate: '1 vote per Node ID', active: hasNode, icon: '🗳️' },
              { name: 'Matrix Cascade Yield', rate: '70% BNB binary payload', active: hasNode, icon: '🕸️' },
              { name: 'NFT Holder Bonus', rate: '+5% passive', active: false, icon: '🏅' },
              { name: 'Pool Staking', rate: 'Variable BNB APR', active: hasNode, icon: '🌊' },
            ].map((stream) => (
              <div key={stream.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{stream.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: stream.active ? '#fff' : 'rgba(255,255,255,0.3)' }}>{stream.name}</div>
                    <div style={{ fontSize: 10, color: stream.active ? '#A3FF12' : 'rgba(255,255,255,0.2)', fontWeight: 700 }}>{stream.rate}</div>
                  </div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 8,
                  background: stream.active ? 'rgba(163,255,18,0.1)' : 'rgba(255,255,255,0.05)',
                  color: stream.active ? '#A3FF12' : 'rgba(255,255,255,0.3)' }}>
                  {stream.active ? '● ACTIVE' : '🔒 LOCKED'}
                </span>
              </div>
            ))}
          </div>

          {/* Recent History */}
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 12 }}>📜 Recent Earnings</div>
            {REWARD_HISTORY.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < REWARD_HISTORY.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{item.type}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{item.date}</div>
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 900, color: item.color }}>{item.amount}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* NFTs TAB */}
      {tab === 'nfts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {NFT_BADGES.map((nft, i) => (
            <motion.div key={nft.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              style={{
                background: 'rgba(22,27,34,0.95)', borderRadius: 16, padding: 14, overflow: 'hidden',
                border: nft.earned ? `1px solid ${nft.color}60` : '1px solid rgba(255,255,255,0.05)',
                boxShadow: nft.earned ? `0 0 16px ${nft.color}20` : 'none',
              }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: nft.earned ? `${nft.color}20` : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, border: `1px solid ${nft.earned ? nft.color + '40' : 'rgba(255,255,255,0.06)'}`, filter: nft.earned ? 'none' : 'grayscale(1) opacity(0.4)' }}>
                  {nft.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: nft.earned ? '#fff' : 'rgba(255,255,255,0.4)' }}>{nft.name}</span>
                    <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 6, background: `${RARITY_COLOR[nft.rarity]}20`, color: RARITY_COLOR[nft.rarity] }}>{nft.rarity}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{nft.description}</div>
                  {nft.earned ? (
                    <div style={{ fontSize: 10, color: nft.color, fontWeight: 800 }}>✓ Earned {nft.earnedDate} · On-chain</div>
                  ) : (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>🔒 {nft.requirement}</div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* LEADERBOARD TAB */}
      {tab === 'leaderboard' && (
        <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>🏆 Top Earners This Month</div>
          </div>
          {LEADERBOARD.map((entry, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: entry.you ? 'rgba(163,255,18,0.06)' : 'transparent',
              borderBottom: i < LEADERBOARD.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: i < 3 ? ['rgba(255,215,0,0.2)', 'rgba(192,192,192,0.2)', 'rgba(205,127,50,0.2)'][i] : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i < 3 ? 14 : 11, fontWeight: 900, color: i < 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][i] : 'rgba(255,255,255,0.4)' }}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : entry.rank}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: entry.you ? '#A3FF12' : '#fff' }}>{entry.addr}{entry.you ? ' (You)' : ''}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>T{entry.tier} · {entry.nfts} NFTs</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#FFD700' }}>{entry.earned}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
