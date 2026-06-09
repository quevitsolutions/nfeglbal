import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import { openLink } from '../utils/openLink.js';

const MODULES = [
  {
    id: 'live',
    icon: '🎙️',
    name: 'NFEGlobal Live',
    tag: 'LIVE NOW',
    tagColor: '#FF4444',
    desc: 'AI-hosted webinars & live income masterclasses',
    gradient: 'linear-gradient(135deg, #FF4444 0%, #FF6B00 100%)',
    glow: 'rgba(255,68,68,0.3)',
    stat: '1,240 watching',
    statIcon: '👁️',
  },
  {
    id: 'academy',
    icon: '🎓',
    name: 'NFEGlobal Academy',
    tag: 'LEARN',
    tagColor: '#4FC3F7',
    desc: 'AI-powered passive income courses & certifications',
    gradient: 'linear-gradient(135deg, #1565C0 0%, #4FC3F7 100%)',
    glow: 'rgba(79,195,247,0.3)',
    stat: '48 courses',
    statIcon: '📚',
  },
  {
    id: 'dao',
    icon: '🏛️',
    name: 'NFEGlobal DAO Hall',
    tag: 'VOTE',
    tagColor: '#A3FF12',
    desc: 'Community governance, treasury & proposal voting',
    gradient: 'linear-gradient(135deg, #1B4332 0%, #A3FF12 100%)',
    glow: 'rgba(163,255,18,0.3)',
    stat: '3 active proposals',
    statIcon: '🗳️',
  },
  {
    id: 'rewards',
    icon: '🏆',
    name: 'NFEGlobal Rewards Arena',
    tag: 'EARN',
    tagColor: '#FFD700',
    desc: 'BNB rewards, NFT badges & referral commissions',
    gradient: 'linear-gradient(135deg, #7B341E 0%, #FFD700 100%)',
    glow: 'rgba(255,215,0,0.3)',
    stat: '+12.4 BNB distributed',
    statIcon: '💎',
  },
  {
    id: 'community',
    icon: '🌐',
    name: 'NFEGlobal Community Hub',
    tag: 'CONNECT',
    tagColor: '#CE93D8',
    desc: 'Networking lounges, sponsor booths & DAO rooms',
    gradient: 'linear-gradient(135deg, #4A148C 0%, #CE93D8 100%)',
    glow: 'rgba(206,147,216,0.3)',
    stat: '5,820 members',
    statIcon: '👥',
  },
  {
    id: 'ai-host',
    icon: '🤖',
    name: 'NFEGlobal AI Host',
    tag: 'AI POWERED',
    tagColor: '#80CBC4',
    desc: 'AI presenter, moderator & 24/7 support agent',
    gradient: 'linear-gradient(135deg, #004D40 0%, #80CBC4 100%)',
    glow: 'rgba(128,203,196,0.3)',
    stat: 'Always online',
    statIcon: '⚡',
  },
  {
    id: 'marketing-portal',
    icon: '🚀',
    name: 'NFEGlobal Marketing Portal',
    tag: 'PROMO',
    tagColor: '#CBFF01',
    desc: 'Standalone external portal for marketing and referrals',
    gradient: 'linear-gradient(135deg, #1B3300 0%, #CBFF01 100%)',
    glow: 'rgba(203,255,1,0.3)',
    stat: 'Live at promo.nfeglobal.online',
    statIcon: '🌐',
    href: 'https://promo.nfeglobal.online'
  },
];

const LIVE_STATS = [
  { label: 'Total Members', value: '5,820+', icon: '👥' },
  { label: 'BNB Distributed', value: '12.4 BNB', icon: '💰' },
  { label: 'Webinars Hosted', value: '247', icon: '🎙️' },
  { label: 'NFTs Minted', value: '1,840', icon: '🖼️' },
];

const RECENT_EVENTS = [
  { title: 'AI + Passive BNB Income Masterclass', time: 'Tomorrow 8PM UTC', status: 'upcoming', seats: 180, maxSeats: 200 },
  { title: 'DAO Treasury Vote: Q3 Expansion', time: 'Live Now', status: 'live', seats: 340, maxSeats: 500 },
  { title: 'NFT Badge Drop — Tier 3 Achievers', time: 'In 3 hours', status: 'soon', seats: 90, maxSeats: 150 },
];

function ParticleField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(163,255,18,${p.alpha})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}

export default function MetaverseScreen({ onNavigate }) {
  const { nodeId, nodeTier, hasNode } = useGameStore();
  const [activeModule, setActiveModule] = useState(null);
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTicker(t => t + 1), 3000);
    return () => clearInterval(iv);
  }, []);

  const statusColor = { live: '#FF4444', upcoming: '#FFD700', soon: '#A3FF12' };
  const statusLabel = { live: '🔴 LIVE', upcoming: '📅 UPCOMING', soon: '⏰ SOON' };

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Hero Banner */}
      <div style={{
        position: 'relative', borderRadius: 24, overflow: 'hidden', marginBottom: 20,
        background: 'linear-gradient(135deg, #050812 0%, #0D1B2A 40%, #0A2A1A 100%)',
        border: '1px solid rgba(163,255,18,0.15)',
        minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 20
      }}>
        <ParticleField />
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06,
          backgroundImage: 'linear-gradient(rgba(163,255,18,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(163,255,18,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, background: 'radial-gradient(circle, rgba(163,255,18,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 220, height: 220, background: 'radial-gradient(circle, rgba(79,195,247,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ background: '#FF4444', color: '#fff', fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 20, letterSpacing: 1 }}>● LIVE</span>
            <span style={{ background: 'rgba(163,255,18,0.1)', color: '#A3FF12', fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(163,255,18,0.2)' }}>METAVERSE</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, marginBottom: 6 }}>
            NFEGlobal Core<br />
            <span style={{ color: '#A3FF12' }}>MetaVerse</span>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, maxWidth: 260 }}>
            AI-powered decentralized webinar ecosystem. Learn, earn BNB & govern with DAO.
          </p>
          {hasNode ? (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap:'wrap' }}>
              <div style={{ background: 'rgba(163,255,18,0.1)', border: '1px solid rgba(163,255,18,0.3)', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 800, color: '#A3FF12' }}>
                ⬡ NODE #{nodeId} · T{nodeTier}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                🌐 Full Access
              </div>
              <button
                onClick={() => onNavigate && onNavigate('hall', { title: 'AI + Passive BNB Income Masterclass' })}
                style={{ background:'linear-gradient(135deg,#A3FF12,#4FC3F7)', border:'none', color:'#000', padding:'6px 16px', borderRadius:8, fontSize:11, fontWeight:900, cursor:'pointer', boxShadow:'0 4px 16px rgba(163,255,18,0.4)' }}>
                🌀 Enter Virtual Hall
              </button>
              <button
                onClick={() => onNavigate && onNavigate('lobby')}
                style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', padding:'6px 16px', borderRadius:8, fontSize:11, fontWeight:900, cursor:'pointer' }}>
                🏢 Enter Virtual Lobby
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 12, background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#FF8A80', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              🔒 Activate Node to unlock full MetaVerse access
            </div>
          )}
        </div>
      </div>

      {/* Live Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
        {LIVE_STATS.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            style={{ background: 'rgba(22,27,34,0.9)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 3 }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Sub-Module Cards */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>🌐 MetaVerse Modules</h2>
          <span style={{ fontSize: 10, color: '#A3FF12', fontWeight: 700 }}>6 ACTIVE</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MODULES.map((mod, i) => (
            <motion.div key={mod.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              onClick={() => setActiveModule(activeModule === mod.id ? null : mod.id)}
              style={{
                background: 'rgba(22,27,34,0.9)',
                border: activeModule === mod.id ? `1px solid ${mod.glow.replace('0.3', '0.6')}` : '1px solid rgba(255,255,255,0.05)',
                borderRadius: 16, padding: '14px 16px', cursor: 'pointer',
                boxShadow: activeModule === mod.id ? `0 0 20px ${mod.glow}` : 'none',
                transition: 'all 0.2s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Icon */}
                <div style={{
                  width: 46, height: 46, borderRadius: 12, background: mod.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
                  boxShadow: `0 4px 14px ${mod.glow}`,
                }}>
                  {mod.icon}
                </div>
                {/* Text */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{mod.name}</span>
                    <span style={{ background: `${mod.tagColor}20`, color: mod.tagColor, fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 8, border: `1px solid ${mod.tagColor}40` }}>{mod.tag}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{mod.desc}</div>
                </div>
                {/* Arrow */}
                <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)', transform: activeModule === mod.id ? 'rotate(90deg)' : 'none', transition: '0.2s' }}>›</div>
              </div>

              {/* Expanded content */}
              <AnimatePresence>
                {activeModule === mod.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}>
                    <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{mod.statIcon} {mod.stat}</span>
                        <span style={{ fontSize: 10, color: mod.tagColor, fontWeight: 800 }}>DECENTRALIZED</span>
                      </div>
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (mod.href) { openLink(mod.href); }
                          else { onNavigate && onNavigate(mod.id); }
                        }}
                        style={{
                          width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                          background: mod.gradient, color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer',
                          boxShadow: `0 4px 14px ${mod.glow}`,
                        }}>
                        Enter {mod.name} →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Upcoming Events */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>📅 Live & Upcoming</h2>
          <span style={{ fontSize: 10, color: '#4FC3F7', fontWeight: 700 }}>{RECENT_EVENTS.length} EVENTS</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {RECENT_EVENTS.map((ev, i) => {
            const pct = Math.round((ev.seats / ev.maxSeats) * 100);
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                style={{ background: 'rgba(22,27,34,0.9)', borderRadius: 14, padding: 14, border: ev.status === 'live' ? '1px solid rgba(255,68,68,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1, paddingRight: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 4 }}>{ev.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{ev.time}</div>
                  </div>
                  <span style={{ background: `${statusColor[ev.status]}20`, color: statusColor[ev.status], fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 8, whiteSpace: 'nowrap', border: `1px solid ${statusColor[ev.status]}40` }}>
                    {statusLabel[ev.status]}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4FC3F7', fontWeight: 700, marginBottom: 6 }}>
                  <span>{ev.seats} / {ev.maxSeats} seats</span>
                  <span>{pct}% full</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#FF4444' : 'linear-gradient(90deg, #4FC3F7, #A3FF12)', borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* AI Host Banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        style={{
          borderRadius: 18, padding: 18,
          background: 'linear-gradient(135deg, rgba(0,77,64,0.6) 0%, rgba(13,17,23,0.9) 100%)',
          border: '1px solid rgba(128,203,196,0.3)',
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16,
        }}>
        <div style={{ fontSize: 36 }}>🤖</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#80CBC4', marginBottom: 3 }}>NFEGlobal AI Host is Online</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
            "Welcome to NFEGlobal Core MetaVerse! Today's masterclass on passive BNB income starts in 45 minutes."
          </div>
        </div>
      </motion.div>

      {/* NFT Reward Teaser */}
      <div style={{
        borderRadius: 18, padding: 18,
        background: 'linear-gradient(135deg, rgba(123,52,30,0.4) 0%, rgba(13,17,23,0.95) 100%)',
        border: '1px solid rgba(255,215,0,0.2)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ fontSize: 36 }}>🏅</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#FFD700', marginBottom: 3 }}>Earn NFT Attendance Badges</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
            Join webinars → earn NFT proof of participation → unlock VIP rooms & bonus BNB rewards
          </div>
        </div>
      </div>
    </div>
  );
}
