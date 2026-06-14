import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Users, Shield, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';

export default function DestinyScreen() {
  const { hasNode, setActiveTab } = useGameStore();
  
  // Real-time Countdown Timer (24-hour resetting cycle for urgency)
  const [timeLeft, setTimeLeft] = useState({ hours: 14, minutes: 22, seconds: 45 });
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { hours: prev.hours, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 23, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Live registration activity feed simulation
  const [feed, setFeed] = useState([
    { id: 55891, sponsor: 55555, time: '2 mins ago', type: 'Activated Node' },
    { id: 55892, sponsor: 55712, time: '5 mins ago', type: 'Joined Free' },
    { id: 55893, sponsor: 55589, time: '7 mins ago', type: 'Activated Node' },
  ]);

  useEffect(() => {
    const feedInterval = setInterval(() => {
      const randomNode = Math.floor(Math.random() * 1000) + 56000;
      const randomSponsor = Math.floor(Math.random() * 500) + 55555;
      const isActivation = Math.random() > 0.4;
      const newItem = {
        id: randomNode,
        sponsor: randomSponsor,
        time: 'Just now',
        type: isActivation ? 'Activated Node' : 'Joined Free'
      };
      setFeed(prev => [newItem, prev[0], prev[1]].slice(0, 3));
    }, 8000);
    return () => clearInterval(feedInterval);
  }, []);

  return (
    <div className="page page-destiny" style={{ paddingBottom: '120px' }}>
      {/* Background Glow */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 10%, rgba(163,255,18,0.08) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '20px 12px 40px', textAlign: 'center' }}>
          {/* URGENCY ALERT BANNER */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 8, 
              background: 'rgba(239, 83, 80, 0.15)', 
              border: '1px solid rgba(239, 83, 80, 0.4)', 
              borderRadius: '30px', 
              padding: '6px 16px', 
              marginBottom: '24px' 
            }}
          >
            <AlertTriangle size={12} color="#EF5350" />
            <span style={{ fontSize: '9px', color: '#EF5350', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Urgent: Next Pool Cycle Lock-in Ending Soon
            </span>
          </motion.div>

          {/* MAIN HERO TITLE */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ fontSize: 'clamp(24px, 4vw, 44px)', fontWeight: 950, lineHeight: 1.1, letterSpacing: '-1px', marginBottom: '14px', color: '#fff' }}
          >
            Claim Financial Freedom <br />
            <span style={{ color: 'var(--neon-lime)' }}>Forever</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', maxWidth: '560px', margin: '0 auto 24px', lineHeight: 1.5 }}
          >
            Build a global decentralized node team starting for <strong>FREE</strong>. <br />
            Invite 10 friends, duplicate the network, and secure lifetime BNB yields on-chain.
          </motion.p>

          {/* COUNTDOWN TIMER BOX */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              maxWidth: '380px',
              margin: '0 auto 32px',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(163,255,18,0.2)',
              borderRadius: '16px',
              padding: '12px 18px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
          >
            <div style={{ fontSize: '9px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>
              TIME REMAINING FOR CURRENT CYCLE
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
              {[
                { label: 'HOURS', val: timeLeft.hours },
                { label: 'MINUTES', val: timeLeft.minutes },
                { label: 'SECONDS', val: timeLeft.seconds }
              ].map((t, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>
                    {t.val.toString().padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: '7px', color: 'var(--neon-lime)', fontWeight: 800, marginTop: '2px' }}>
                    {t.label}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* VIDEO EMBED CONTAINER */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{
              maxWidth: '680px',
              margin: '0 auto 40px',
              borderRadius: '18px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '8px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '12px' }}>
              <iframe
                src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&mute=1"
                title="NFEGlobal Financial Destiny Video Presentation"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </motion.div>

          {/* HERO CTA BUTTONS */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '48px' }}>
            <motion.button
              onClick={() => setActiveTab('mine')}
              className="giant-btn"
              style={{
                maxWidth: '320px',
                height: '48px',
                fontSize: '13px',
                background: 'linear-gradient(135deg, var(--neon-lime), #7BFF00)',
                color: '#000',
                boxShadow: '0 0 20px rgba(163,255,18,0.35)'
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {hasNode ? '🚀 UPGRADE ACTIVE NODE' : '⚡ ACTIVATE NODE NOW'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* THE DESTINY FORMULA: REFER 10 NETWORK EFFECT */}
      <section style={{ padding: '40px 12px', background: 'rgba(255, 255, 255, 0.01)', borderTop: '1px solid rgba(255, 255, 255, 0.03)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '9px', fontWeight: 900, color: 'var(--neon-lime)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>◈ THE POWER OF DUPLICATION</span>
          <h2 style={{ fontSize: '22px', fontWeight: 900, marginTop: '6px', color: '#fff' }}>
            Refer 10 & See Destiny Come True
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', maxWidth: '480px', margin: '8px auto 0', lineHeight: 1.5 }}>
            By sharing your node referral link with 10 free users, you unlock exponential team structures that pay lifetime BNB rewards.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '480px', margin: '0 auto' }}>
          {/* Direct Level 1 */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(163,255,18,0.2)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '9px', color: 'var(--neon-lime)', fontWeight: 900, background: 'rgba(163,255,18,0.1)', padding: '2px 8px', borderRadius: '3px' }}>
                LEVEL 1
              </span>
              <Users size={16} color="var(--neon-lime)" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>Direct Referrals</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Invite <strong>10 friends</strong> to secure slots. You earn 10% direct commission + 1.5% network yield on all upgrades.
            </p>
          </div>

          {/* Depth Level 2-10 */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '9px', color: '#4FC3F7', fontWeight: 900, background: 'rgba(79,195,247,0.1)', padding: '2px 8px', borderRadius: '3px' }}>
                LEVELS 2–10
              </span>
              <TrendingUp size={16} color="#4FC3F7" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>Matrix Duplication</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              When those 10 invite 10 of their own, your network duplicates to <strong>100 users</strong>, then <strong>1,000</strong>, and down to 10 levels.
            </p>
          </div>

          {/* Ultimate Target */}
          <div style={{ background: 'linear-gradient(135deg, rgba(163,255,18,0.05) 0%, rgba(0,0,0,0) 100%)', border: '1px solid rgba(163,255,18,0.25)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '9px', color: '#FFB74D', fontWeight: 900, background: 'rgba(255,183,77,0.1)', padding: '2px 8px', borderRadius: '3px' }}>
                DESTINY
              </span>
              <Shield size={16} color="#FFB74D" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>Financial Freedom</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Yielding 1.5% layer commissions across 10 levels of upgrades creates compounding passive returns direct to your smart wallet.
            </p>
          </div>
        </div>
      </section>

      {/* LIVE EVENT FEED */}
      <section style={{ padding: '40px 12px' }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '20px', padding: '18px 16px', maxWidth: '480px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 900, textAlign: 'center', marginBottom: '16px', color: '#fff', letterSpacing: '1px' }}>
            ⚡ LIVE PROTOCOL ACTIVITY
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {feed.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff' }}>Node #{item.id}</span>
                  <span style={{ fontSize: '9px', color: '#666', marginLeft: '6px' }}>Sponsor #{item.sponsor}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: item.type.includes('Activated') ? 'var(--neon-lime)' : '#aaa' }}>
                    {item.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STICKY REGISTER ACTION */}
      <section style={{ padding: '60px 12px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 950, marginBottom: '12px', color: '#fff' }}>
          See Your Destiny Come True Today
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', maxWidth: '400px', margin: '0 auto 24px', lineHeight: 1.5 }}>
          Free slots fill up with matrix spillovers from upstream builders. Guarantee your placement immediately.
        </p>
        <button
          onClick={() => setActiveTab('mine')}
          className="giant-btn"
          style={{
            maxWidth: '320px',
            height: '48px',
            fontSize: '13px',
            background: 'linear-gradient(135deg, var(--neon-lime), #7BFF00)',
            color: '#000',
            boxShadow: '0 0 20px rgba(163,255,18,0.35)'
          }}
        >
          🚀 REGISTER AND ACTIVATE NODE
        </button>
      </section>
    </div>
  );
}
