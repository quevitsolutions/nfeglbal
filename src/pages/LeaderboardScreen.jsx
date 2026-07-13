import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, ShieldAlert, Award, Star } from 'lucide-react';
import axios from 'axios';

export default function LeaderboardScreen() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get('/api/leaderboard');
        console.log("Leaderboard API response:", res.data);
        setLeaders(res.data);
      } catch (err) {
        console.error("Leaderboard fetch error:", err);
        setError('Failed to load leaderboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          style={{ width: 40, height: 40, border: '4px solid rgba(0, 242, 254, 0.1)', borderTopColor: 'var(--neon-lime)', borderRadius: '50%' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', textAlign: 'center' }}>
        <ShieldAlert size={48} color="#FF5252" style={{ marginBottom: 16 }} />
        <p style={{ color: '#FF8A8A', fontWeight: 700 }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="sub-page" style={{ padding: '0 16px 20px' }}>
      {/* Header card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(161,44,255,0.1) 0%, rgba(0,242,254,0.05) 100%)',
        border: '1px solid rgba(0, 242, 254, 0.15)',
        borderRadius: 24,
        padding: '24px 20px',
        textAlign: 'center',
        marginBottom: 20,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
      }}>
        <Crown size={40} color="var(--amber-gold)" style={{ marginBottom: 12, filter: 'drop-shadow(0 0 8px var(--amber-gold))' }} />
        <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8, letterSpacing: '-0.02em' }}>GLOBAL LEADERBOARD</h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          Top Node Operators ranked by their direct active referrals and matrix propagation.
        </p>
        <div style={{ fontSize: 11, color: 'var(--neon-lime)', marginTop: 10, fontWeight: 800, letterSpacing: '1px' }}>
          TOTAL DETECTED NODES: {leaders.length}
        </div>
      </div>

      {/* Leaderboard list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {leaders.map((leader, index) => {
          const isTop3 = index < 3;
          const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
          const rankIcon = isTop3 ? <Award size={20} color={medalColors[index]} /> : <Star size={14} color="#718096" />;

          return (
            <motion.div
              key={leader.nodeId}
              whileHover={{ scale: 1.02, x: 4 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: isTop3 
                  ? `linear-gradient(90deg, rgba(13,18,36,0.8) 0%, rgba(13,18,36,0.4) 100%)`
                  : 'var(--bg-card)',
                border: isTop3 
                  ? `1px solid ${medalColors[index]}40`
                  : '1px solid rgba(255,255,255,0.03)',
                borderRadius: 16,
                boxShadow: isTop3 ? `0 4px 15px ${medalColors[index]}10` : 'none',
                transition: 'border 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Rank badge */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: isTop3 ? `${medalColors[index]}20` : 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 14,
                  color: isTop3 ? medalColors[index] : '#718096'
                }}>
                  {index + 1}
                </div>

                {/* Node details */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 900, fontSize: 15 }}>NODE #{leader.nodeId}</span>
                    {rankIcon}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                    {leader.walletAddress.slice(0, 6)}...{leader.walletAddress.slice(-4)}
                  </span>
                </div>
              </div>

              {/* Stats column */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-main)' }}>
                  {leader.activatedRefs} Refs
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginTop: 2, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <span style={{ color: 'var(--neon-lime)' }}>{leader.paidRefs || 0} Paid</span>
                  <span>/</span>
                  <span style={{ color: '#D8B4FE' }}>{leader.freeRefs || 0} Free</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  {leader.totalEarned.toFixed(2)} BNB
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
