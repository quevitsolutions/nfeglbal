import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Users, Shield, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { ParticleField } from '../components/UI.jsx';

const APP_URL = import.meta.env.VITE_APP_URL || 'https://aipcore.online';

export default function FunnelPage() {
  const [copied, setCopied] = useState(false);
  
  // Real-time Countdown Timer (24-hour resetting cycle for urgency)
  const [timeLeft, setTimeLeft] = useState({ hours: 14, minutes: 22, seconds: 45 });
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { hours: prev.hours, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 23, minutes: 59, seconds: 59 }; // reset
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
    return () => feedInterval.clearInterval;
  }, []);

  return (
    <main style={{ paddingTop: 104, overflowX: 'hidden' }}>
      {/* Background Glow */}
      <div style={{ position: 'relative', width: '100%', minHeight: '80vh', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 10%, rgba(163,255,18,0.08) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <ParticleField count={40} />

        <div className="container" style={{ position: 'relative', zIndex: 1, padding: '40px 16px 80px', textAlign: 'center' }}>
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
              padding: '8px 20px', 
              marginBottom: '32px' 
            }}
          >
            <AlertTriangle size={14} color="#EF5350" />
            <span style={{ fontSize: '11px', color: '#EF5350', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Urgent: Next Pool Cycle Lock-in Ending Soon
            </span>
          </motion.div>

          {/* MAIN HERO TITLE */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="section-title" 
            style={{ fontSize: 'clamp(32px, 5vw, 64px)', fontWeight: 950, lineHeight: 1.05, letterSpacing: '-1.5px', marginBottom: '18px' }}
          >
            Claim Financial Freedom <br />
            <span className="neon-text text-lime">Forever</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ fontSize: 'clamp(14px, 2vw, 18px)', color: 'var(--text-muted)', maxWidth: '680px', margin: '0 auto 36px', lineHeight: 1.6 }}
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
              maxWidth: '480px',
              margin: '0 auto 40px',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(163,255,18,0.2)',
              borderRadius: '20px',
              padding: '16px 24px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
              TIME REMAINING FOR CURRENT CYCLE
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
              {[
                { label: 'HOURS', val: timeLeft.hours },
                { label: 'MINUTES', val: timeLeft.minutes },
                { label: 'SECONDS', val: timeLeft.seconds }
              ].map((t, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>
                    {t.val.toString().padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: '8px', color: 'var(--neon-lime)', fontWeight: 800, marginTop: '2px' }}>
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
              maxWidth: '800px',
              margin: '0 auto 64px',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '12px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '16px' }}>
              <iframe
                src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&mute=1"
                title="AIPCore Financial Destiny Video Presentation"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </motion.div>

          {/* HERO CTA BUTTONS */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '64px' }}>
            <motion.a
              href={APP_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
              style={{ fontSize: '18px', padding: '18px 48px', textTransform: 'uppercase', letterSpacing: '1px' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              🔒 SECURE MY POSITION <ExternalLink size={16} style={{ marginLeft: '6px' }} />
            </motion.a>
          </div>
        </div>
      </div>

      {/* THE DESTINY FORMULA: REFER 10 NETWORK EFFECT */}
      <section style={{ padding: '80px 0', background: 'rgba(255, 255, 255, 0.01)', borderTop: '1px solid rgba(255, 255, 255, 0.03)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="section-label" style={{ color: 'var(--neon-lime)' }}>◈ THE POWER OF DUPLICATION</span>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, marginTop: '8px' }}>
              Refer 10 & See Destiny Come True
            </h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '12px auto 0' }}>
              By simply sharing your node referral link with 10 people for free, you unlock exponential team structures that pay lifetime BNB rewards.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Direct Level 1 */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(163,255,18,0.2)', borderRadius: '18px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '10px', color: 'var(--neon-lime)', fontWeight: 900, background: 'rgba(163,255,18,0.1)', padding: '3px 10px', borderRadius: '4px' }}>
                  LEVEL 1
                </span>
                <Users size={20} color="var(--neon-lime)" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>Direct Referrals</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Invite <strong>10 friends</strong> to secure slots. You earn 10% direct commission + 1.5% network yield on all upgrades.
              </p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>Node Capacity:</span>
                <span style={{ fontSize: '11px', color: '#fff', fontWeight: 800 }}>10 Users</span>
              </div>
            </div>

            {/* Depth Level 2-10 */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '10px', color: '#4FC3F7', fontWeight: 900, background: 'rgba(79,195,247,0.1)', padding: '3px 10px', borderRadius: '4px' }}>
                  LEVELS 2–10
                </span>
                <TrendingUp size={20} color="#4FC3F7" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>Matrix Duplication</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                When those 10 invite 10 of their own, your network duplicates to <strong>100 users</strong>, then <strong>1,000</strong>, and down to 10 levels.
              </p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>Commission Yield:</span>
                <span style={{ fontSize: '11px', color: '#4FC3F7', fontWeight: 800 }}>1.5% per Node Tier</span>
              </div>
            </div>

            {/* Ultimate Target */}
            <div style={{ background: 'linear-gradient(135deg, rgba(163,255,18,0.05) 0%, rgba(0,0,0,0) 100%)', border: '1px solid rgba(163,255,18,0.25)', borderRadius: '18px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '10px', color: '#FFB74D', fontWeight: 900, background: 'rgba(255,183,77,0.1)', padding: '3px 10px', borderRadius: '4px' }}>
                  DESTINY
                </span>
                <Shield size={20} color="#FFB74D" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>Financial Freedom</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Yielding 1.5% layer commissions across 10 levels of upgrades creates compounding passive returns direct to your smart wallet.
              </p>
              <div style={{ borderTop: '1px solid rgba(163,255,18,0.15)', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--neon-lime)', fontWeight: 800 }}>Destiny Projection:</span>
                <span style={{ fontSize: '11px', color: '#fff', fontWeight: 900 }}>120,000+ BNB Potential</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE EVENT FEED & TRUST */}
      <section style={{ padding: '80px 0' }}>
        <div className="container" style={{ maxWidth: '640px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '24px', padding: '24px 32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 900, textAlign: 'center', marginBottom: '20px', color: '#fff' }}>
              ⚡ LIVE PROTOCOL ACTIVITY
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {feed.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>Node #{item.id}</span>
                    <span style={{ fontSize: '11px', color: '#666', marginLeft: '8px' }}>Sponsor #{item.sponsor}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: item.type.includes('Activated') ? 'var(--neon-lime)' : '#aaa' }}>
                      {item.type}
                    </span>
                    <span style={{ fontSize: '10px', color: '#444' }}>{item.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                🔒 Audited Smart Contracts · 100% On-Chain Execution
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION (STICKY INCENTIVE) */}
      <section style={{ padding: '100px 0', background: 'linear-gradient(0deg, rgba(163,255,18,0.05) 0%, transparent 100%)', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 950, marginBottom: '16px' }}>
            See Your Destiny Come True Today
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '560px', margin: '0 auto 36px', lineHeight: 1.6 }}>
            Free slots fill up with matrix spillovers from upstream builders. Guarantee your placement immediately.
          </p>
          <motion.a
            href={APP_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
            style={{ fontSize: '16px', padding: '16px 44px' }}
            whileHover={{ scale: 1.05 }}
          >
            🚀 REGISTER AND ACTIVATE NODE
          </motion.a>
        </div>
      </section>
    </main>
  );
}
