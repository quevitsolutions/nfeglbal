import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Award, Activity, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';
import axios from 'axios';

export default function AnalyticsScreen() {
  const { walletAddress } = useGameStore();
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!walletAddress) return;

    const fetchAnalytics = async () => {
      try {
        const [sumRes, chartRes] = await Promise.all([
          axios.get(`/api/rewards/summary/${walletAddress}`),
          axios.get(`/api/rewards/chart/${walletAddress}`)
        ]);
        setSummary(sumRes.data);
        setChartData(chartRes.data);
      } catch (err) {
        setError('Failed to query active reward analytics.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [walletAddress]);

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

  const { totalEarnedBnb, totalEarnedUsd, totalMissedBnb, breakdown } = summary;
  const maxCategory = Math.max(breakdown.referral, breakdown.layer, breakdown.matrix, breakdown.milestonePools) || 1;

  const categories = [
    { name: 'Direct Referrals', val: breakdown.referral, color: '#FF7043', label: '10%' },
    { name: 'Layer Yield', val: breakdown.layer, color: '#4FC3F7', label: '15%' },
    { name: 'Matrix Cascade', val: breakdown.matrix, color: 'var(--neon-lime)', label: '70%' },
    { name: 'Milestone Pools', val: breakdown.milestonePools, color: 'var(--amber-gold)', label: '5%' }
  ];

  return (
    <div className="sub-page" style={{ padding: '0 16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(255,255,255,0.03)',
          borderRadius: 20,
          padding: 16,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: 1 }}>TOTAL EARNED</span>
          <div style={{ fontSize: 24, fontWeight: 950, color: '#fff', marginTop: 4 }}>
            {parseFloat(totalEarnedBnb).toFixed(4)} <span style={{ fontSize: 12, color: 'var(--neon-lime)' }}>BNB</span>
          </div>
          <span style={{ fontSize: 11, color: '#4FC3F7', fontWeight: 700 }}>≈ ${parseFloat(totalEarnedUsd).toFixed(2)}</span>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(255,255,255,0.03)',
          borderRadius: 20,
          padding: 16,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 800, letterSpacing: 1 }}>MISSED REWARDS</span>
          <div style={{ fontSize: 24, fontWeight: 950, color: '#FF5252', marginTop: 4 }}>
            {parseFloat(totalMissedBnb).toFixed(4)} <span style={{ fontSize: 12, color: '#FF5252' }}>BNB</span>
          </div>
          <span style={{ fontSize: 11, color: '#FF8A8A', fontWeight: 700 }}>Due to low Node Tier</span>
        </div>
      </div>

      {/* Categories breakdown */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(255,255,255,0.03)',
        borderRadius: 20,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={18} color="var(--neon-lime)" />
          <h3 style={{ fontSize: 14, fontWeight: 900 }}>EARNINGS BY STREAM</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {categories.map(cat => {
            const pct = (cat.val / maxCategory) * 100;
            return (
              <div key={cat.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ fontWeight: 800 }}>{cat.name} <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>({cat.label})</span></span>
                  <span style={{ fontWeight: 900, color: cat.color }}>{cat.val.toFixed(4)} BNB</span>
                </div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{ height: '100%', background: cat.color, borderRadius: 3 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical charts list */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(255,255,255,0.03)',
        borderRadius: 20,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Activity size={18} color="var(--neon-lime)" />
          <h3 style={{ fontSize: 14, fontWeight: 900 }}>DAILY STATEMENTS (PAST 30 DAYS)</h3>
        </div>

        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)', fontSize: 12 }}>
            No earnings logs recorded in the past 30 days.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
            {chartData.map(day => (
              <div key={day.date} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.02)',
                borderRadius: 8,
                fontSize: 12
              }}>
                <span style={{ fontWeight: 700, color: 'var(--text-dim)' }}>{day.date}</span>
                <span style={{ fontWeight: 900, color: '#fff' }}>
                  +{day.bnb.toFixed(4)} BNB <span style={{ fontSize: 9, color: '#4FC3F7', fontWeight: 600 }}>(${day.usd.toFixed(2)})</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
