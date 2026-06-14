import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import {
  Rocket, Brain, Users, Trophy, Wallet, Globe, Shield, Play, Check,
  ChevronDown, ChevronUp, Map, Gift, ArrowRight, Video, Award,
  TrendingUp, HelpCircle, Laptop, Settings, List, Users2, Database,
  BarChart3, Lock, Star, Activity, Sparkles, X
} from 'lucide-react';

// ── 3D ROTATING GLOBE CANVAS ──────────────────────────────────────────────
function GlobeCanvas() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame;
    let width = canvas.width = containerRef.current?.offsetWidth || 500;
    let height = canvas.height = containerRef.current?.offsetHeight || 500;

    // Generate points on a sphere using Golden Spiral algorithm
    const points = [];
    const numPoints = 130;
    for (let i = 0; i < numPoints; i++) {
      const y = 1 - (i / (numPoints - 1)) * 2; // y goes from 1 to -1
      const radius = Math.sqrt(1 - y * y); // radius at y
      const theta = 3.6 * Math.sqrt(numPoints) * Math.asin(y); // golden angle increment
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      points.push({ x, y, z });
    }

    let angleX = 0.003;
    let angleY = 0.005;

    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      width = canvas.width = containerRef.current.offsetWidth;
      height = canvas.height = containerRef.current.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width, height) * 0.38; // Sphere radius
      const focalLength = 400;

      // Rotate points
      const rotatedPoints = points.map(p => {
        // Rotate Y
        let x1 = p.x * Math.cos(angleY) - p.z * Math.sin(angleY);
        let z1 = p.z * Math.cos(angleY) + p.x * Math.sin(angleY);

        // Rotate X
        let y2 = p.y * Math.cos(angleX) - z1 * Math.sin(angleX);
        let z2 = z1 * Math.cos(angleX) + p.y * Math.sin(angleX);

        // Project
        const scale = focalLength / (focalLength + z2 * r);
        const sx = cx + x1 * r * scale;
        const sy = cy + y2 * r * scale;

        return { x: sx, y: sy, z: z2, scale };
      });

      // Draw connection lines for points close to each other
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.07)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < rotatedPoints.length; i++) {
        const p1 = rotatedPoints[i];
        for (let j = i + 1; j < rotatedPoints.length; j++) {
          const p2 = rotatedPoints[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < width * 0.16) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw points with gradient/glowing dots
      rotatedPoints.forEach(p => {
        const opacity = Math.max(0.1, (p.z + 1) / 2); // fade back nodes
        const radius = Math.max(1.5, 3.5 * p.scale);

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        
        // Front points are gold/amber, back points are darker amber
        if (p.z < 0) {
          ctx.fillStyle = `rgba(255, 200, 50, ${opacity * 0.95})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(255, 180, 0, 0.5)';
        } else {
          ctx.fillStyle = `rgba(255, 160, 0, ${opacity * 0.5})`;
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      });

      ctx.shadowBlur = 0; // Reset shadow

      // Increment rotation angles
      angleY += 0.0018;
      angleX += 0.0006;
      frame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', inset: 0 }} />
    </div>
  );
}

// ── DYNAMIC FLYWHEEL SVG DIAGRAM ──────────────────────────────────────────
function FlywheelDiagram() {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const stages = [
    { label: 'COMMUNITY', desc: 'Active world community feeding matrix participation.', x: 150, y: 35 },
    { label: 'PARTICIPATION', desc: 'Securing nodes and establishing network positions.', x: 265, y: 110 },
    { label: 'GROWTH', desc: 'Direct & indirect referrals expanding ecosystem volume.', x: 220, y: 235 },
    { label: 'TIER PROGRESSION', desc: 'Upgrading node tiers to scale hourly mining rates.', x: 80, y: 235 },
    { label: 'EXPANSION', desc: 'Accumulating global rewards and funding next-gen cycles.', x: 35, y: 110 }
  ];

  return (
    <div style={{
      background: 'rgba(255,255,255,0.01)',
      border: '1px solid rgba(255,200,50,0.08)',
      borderRadius: '20px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '320px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ fontSize: '10px', fontWeight: 800, color: '#FFC72C', letterSpacing: 2, marginBottom: '16px', textAlign: 'center' }}>
        THE POWER OF CIRCULATION
      </div>
      
      {/* Interactive Flywheel Graph */}
      <div style={{ position: 'relative', width: '300px', height: '270px' }}>
        <svg viewBox="0 0 300 270" style={{ width: '100%', height: '100%' }}>
          {/* Outer Rotating/Pulse Circle */}
          <circle cx="150" cy="135" r="95" fill="none" stroke="rgba(255,200,50,0.05)" strokeWidth="1" />
          <circle cx="150" cy="135" r="95" fill="none" stroke="rgba(255,200,50,0.2)" strokeWidth="1.5" strokeDasharray="30 150" style={{ transformOrigin: 'center', animation: 'spin 20s linear infinite' }} />

          {/* Connectors */}
          <path d="M 150,35 Q 265,110 220,235 Q 80,235 35,110 Z" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />

          {/* Golden Center */}
          <circle cx="150" cy="135" r="45" fill="rgba(10, 8, 5, 0.9)" stroke="rgba(255,200,50,0.2)" strokeWidth="1.5" />
          <text x="150" y="132" textAnchor="middle" fill="#FFF" fontSize="12" fontWeight="950" letterSpacing="1">NFE</text>
          <text x="150" y="146" textAnchor="middle" fill="#FFC72C" fontSize="9" fontWeight="800" letterSpacing="0.5">GLOBAL</text>

          {/* Interactive Nodes */}
          {stages.map((st, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g 
                key={idx} 
                onMouseEnter={() => setHoveredIdx(idx)} 
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle 
                  cx={st.x} 
                  cy={st.y} 
                  r={isHovered ? 18 : 14} 
                  fill={isHovered ? 'rgba(255,200,50,0.15)' : 'rgba(20,15,10,0.9)'} 
                  stroke={isHovered ? '#FFC72C' : 'rgba(255,200,50,0.3)'} 
                  strokeWidth="1.5"
                  style={{ transition: 'all 0.2s ease' }}
                />
                {isHovered && (
                  <circle 
                    cx={st.x} 
                    cy={st.y} 
                    r="25" 
                    fill="none" 
                    stroke="rgba(255,200,50,0.3)" 
                    strokeWidth="1"
                  />
                )}
                <text 
                  x={st.x} 
                  y={st.y + 4} 
                  textAnchor="middle" 
                  fill={isHovered ? '#FFF' : '#FFC72C'} 
                  fontSize="8" 
                  fontWeight="900"
                >
                  {idx + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Description Box */}
      <div style={{
        marginTop: '16px',
        minHeight: '56px',
        width: '100%',
        textAlign: 'center',
        padding: '10px',
        background: 'rgba(255,200,50,0.03)',
        border: '1px solid rgba(255,200,50,0.05)',
        borderRadius: '10px',
        transition: 'all 0.3s ease'
      }}>
        {hoveredIdx !== null ? (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, color: '#FFF', marginBottom: '3px' }}>
              {stages[hoveredIdx].label}
            </div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>
              {stages[hoveredIdx].desc}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', paddingTop: '10px' }}>
            Hover over any numbered node to see flow mechanics
          </div>
        )}
      </div>
    </div>
  );
}

// ── INTERACTIVE DASHBOARD PREVIEW WIDGET ──────────────────────────────────
function DashboardPreview() {
  const [activeTab, setActiveTab] = useState('dash');

  return (
    <div style={{
      background: 'linear-gradient(180deg, #101115 0%, #08080A 100%)',
      border: '1px solid rgba(255,200,50,0.12)',
      borderRadius: '24px',
      padding: '16px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
      fontFamily: 'Outfit, sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4FC3F7', boxShadow: '0 0 8px #4FC3F7' }} />
        <span style={{ fontSize: '10px', fontWeight: 900, color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>YOUR PERSONAL DASHBOARD (PREVIEW)</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '16px' }} className="dashboard-preview-grid">
        {/* Mock Sidebar Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} className="dashboard-nav">
          {[
            { id: 'dash', label: 'Dashboard', icon: <BarChart3 size={11} /> },
            { id: 'team', label: 'Network', icon: <Users2 size={11} /> },
            { id: 'treasury', label: 'Treasury', icon: <Database size={11} /> },
            { id: 'ranks', label: 'Rankings', icon: <Trophy size={11} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 4px',
                background: activeTab === tab.id ? 'rgba(255,200,50,0.08)' : 'transparent',
                border: activeTab === tab.id ? '1px solid rgba(255,200,50,0.2)' : '1px solid transparent',
                borderRadius: '8px',
                color: activeTab === tab.id ? '#FFC72C' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                gap: '4px'
              }}
            >
              {tab.icon}
              <span style={{ fontSize: '8px', fontWeight: 800 }}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Mock Screen Content */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255,255,255,0.02)', minHeight: '185px' }}>
          {activeTab === 'dash' && (
            <div>
              {/* Mini Stats Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px' }}>
                  <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>TOTAL NODES</div>
                  <div style={{ fontSize: '11px', color: '#FFF', fontWeight: 950 }}>31,256 <span style={{ fontSize: '7px', color: 'var(--neon-lime)' }}>+12.5%</span></div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px' }}>
                  <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>ACTIVE MEMBERS</div>
                  <div style={{ fontSize: '11px', color: '#FFF', fontWeight: 950 }}>12,847 <span style={{ fontSize: '7px', color: 'var(--neon-lime)' }}>+18.7%</span></div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px' }}>
                  <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>COUNTRIES</div>
                  <div style={{ fontSize: '11px', color: '#FFF', fontWeight: 950 }}>47 <span style={{ fontSize: '7px', color: '#4FC3F7' }}>+3</span></div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px' }}>
                  <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>TREASURY</div>
                  <div style={{ fontSize: '11px', color: '#FFC72C', fontWeight: 950 }}>$245,780 <span style={{ fontSize: '7px', color: 'var(--neon-lime)' }}>+14.2%</span></div>
                </div>
              </div>

              {/* Mock Line Chart */}
              <div style={{ height: '70px', position: 'relative' }}>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginBottom: '4px' }}>GROWTH OVERVIEW</div>
                <svg viewBox="0 0 200 50" style={{ width: '100%', height: '80%' }}>
                  <path d="M 0,45 Q 35,35 60,30 T 120,18 T 200,5" fill="none" stroke="rgba(79,195,247,0.8)" strokeWidth="1.5" />
                  <path d="M 0,45 Q 35,35 60,30 T 120,18 T 200,5 L 200,50 L 0,50 Z" fill="url(#chartGrad)" opacity="0.1" />
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4FC3F7" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                  <circle cx="200" cy="5" r="3" fill="#4FC3F7" />
                </svg>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginBottom: '8px' }}>MATRIX NETWORK MAP</div>
              {/* Visual Node Tree Mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ border: '1px solid #FFC72C', borderRadius: '4px', padding: '3px 6px', fontSize: '7px', background: 'rgba(255,200,50,0.05)', fontWeight: 800 }}>Node #31256 (T12)</div>
                <div style={{ width: '2px', height: '8px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '2px 4px', fontSize: '6px', color: 'rgba(255,255,255,0.6)' }}>#31260</div>
                    <div style={{ width: '1px', height: '6px', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ fontSize: '5px', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '1px 2px', borderRadius: '2px' }}>#31301</span>
                      <span style={{ fontSize: '5px', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '1px 2px', borderRadius: '2px' }}>#31302</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '2px 4px', fontSize: '6px', color: 'rgba(255,255,255,0.6)' }}>#31261</div>
                    <div style={{ width: '1px', height: '6px', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ fontSize: '5px', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '1px 2px', borderRadius: '2px' }}>#31303</span>
                      <span style={{ fontSize: '5px', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '1px 2px', borderRadius: '2px' }}>#31304</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'treasury' && (
            <div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginBottom: '6px' }}>TREASURY SWEEP ALLOCATION</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
                    <span>NODE HOLDERS DIST</span>
                    <span>50%</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                    <div style={{ width: '50%', height: '100%', background: '#FFC72C', borderRadius: '2px' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
                    <span>GLOBAL REWARD POOLS</span>
                    <span>30%</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                    <div style={{ width: '30%', height: '100%', background: '#4FC3F7', borderRadius: '2px' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
                    <span>DAO STAKING & RESERVES</span>
                    <span>20%</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                    <div style={{ width: '20%', height: '100%', background: 'var(--neon-lime)', borderRadius: '2px' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ranks' && (
            <div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginBottom: '6px' }}>TOP PROTOCOL BUILDERS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  { name: 'Oliwer Smith', points: '12,456', rank: 1 },
                  { name: 'Sophia Clark', points: '10,218', rank: 2 },
                  { name: 'Daniel White', points: '8,730', rank: 3 },
                  { name: 'Michael Brown', points: '7,654', rank: 4 }
                ].map(b => (
                  <div key={b.rank} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: 'rgba(255,255,255,0.01)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '7px', fontWeight: 900, color: b.rank === 1 ? '#FFD700' : 'rgba(255,255,255,0.5)' }}>#{b.rank}</span>
                      <span style={{ fontSize: '7px', fontWeight: 800, color: '#FFF' }}>{b.name}</span>
                    </div>
                    <span style={{ fontSize: '7px', fontWeight: 900, color: 'var(--neon-lime)' }}>{b.points} Nodes</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FAQS ACCORDION ────────────────────────────────────────────────────────
function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState(null);

  const faqs = [
    {
      q: "What is Node Creation?",
      a: "Node Creation registers your unique digital wallet to secure a slot in the NFE Global network. It grants you a unique Node ID, initiates your real-time tracking metrics, opens your dashboard, and locks in your sponsor tree position."
    },
    {
      q: "Why is the charge only $0.70?",
      a: "To encourage mass global participation. By keeping the barrier to entry extremely low (under one dollar equivalent in BNB), anyone globally can instantly secure their spot and start building community without high financial risks."
    },
    {
      q: "Can I track my growth?",
      a: "Absolutely. Once your node is created, you get immediate access to your Personal Dashboard containing real-time metrics, matrix structure graphs, active direct count, global reward pool indicators, and level-wise conversions."
    },
    {
      q: "Is the activity transparent?",
      a: "Yes, 100%. NFE Global is built fully on the Binance Smart Chain (BSC) network. Every node registry, tier progression, referral distribution, and treasury sweep happens directly on verified smart contracts visible publicly."
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {faqs.map((faq, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={idx}
            style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,200,50,0.08)',
              borderRadius: '12px',
              overflow: 'hidden',
              transition: 'all 0.3s ease'
            }}
          >
            <button
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '16px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#FFF',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 900, color: isOpen ? '#FFC72C' : '#FFF', letterSpacing: '0.5px' }}>{faq.q}</span>
              {isOpen ? <ChevronUp size={16} color="#FFC72C" /> : <ChevronDown size={16} color="rgba(255,255,255,0.5)" />}
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div style={{
                    padding: '0 16px 16px 16px',
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.65)',
                    lineHeight: 1.5,
                    borderTop: '1px solid rgba(255,200,50,0.03)'
                  }}>
                    {faq.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ── PRESENTATION VIDEO MODAL ──────────────────────────────────────────────
function VideoModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.9)',
      backdropFilter: 'blur(20px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '720px',
        background: '#0D0E12',
        border: '1px solid rgba(255,200,50,0.25)',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 0 50px rgba(255,200,50,0.15)'
      }}>
        {/* Header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: '12px', fontWeight: 950, color: '#FFF', letterSpacing: '1px' }}>NFE GLOBAL PRESENTATION</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Video simulation / player */}
        <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: 'radial-gradient(circle, rgba(255,200,50,0.05) 0%, transparent 80%)'
          }}>
            <Play size={48} color="#FFC72C" style={{ animation: 'pulse 2s infinite' }} />
            <div style={{ color: '#FFF', fontSize: '12px', fontWeight: 800 }}>Ecosystem Video Presentation</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>Press Play to Watch (Demo Player)</div>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(0,0,0,0.3)', fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>
          <div>🛡️ SECURED BY BINANCE SMART CHAIN</div>
          <div style={{ textAlign: 'right' }}>📊 REAL-TIME SMART PROTOCOL</div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN LANDING SCREEN ───────────────────────────────────────────────────
export default function LoginScreen({ onConnect }) {
  const { connect } = useConnect();
  const hasInjectedProvider = typeof window !== 'undefined' && !!window.ethereum;
  const [videoOpen, setVideoOpen] = useState(false);

  // Trigger wallet connect flow
  const handleConnectAction = () => {
    try { localStorage.removeItem('nfeglobal_disconnected'); } catch(e) {}
    if (hasInjectedProvider) connect({ connector: injected() });
    else onConnect();
  };

  return (
    <div style={{
      minHeight: '100%',
      width: '100%',
      background: '#020305',
      color: '#FFF',
      fontFamily: 'Outfit, sans-serif',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Dynamic Background Grid and Lights */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(255,200,50,0.02) 0%, transparent 100%)',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.015) 1px, transparent 0)',
        backgroundSize: '24px 24px',
        zIndex: 0, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '10%', right: '-10%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,200,50,0.04) 0%, transparent 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '20%', left: '-10%',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,195,247,0.03) 0%, transparent 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none'
      }} />

      {/* ── HEADER NAVIGATION ── */}
      <header style={{
        position: 'relative', zIndex: 10,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        backdropFilter: 'blur(10px)',
        background: 'rgba(2, 3, 5, 0.8)',
        padding: '16px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #FFC72C 0%, #C89000 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: '950', color: '#000',
            boxShadow: '0 0 15px rgba(255,200,50,0.3)'
          }}>N</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 950, color: '#FFF', letterSpacing: '0.5px' }}>NFE GLOBAL</div>
            <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: '1px' }}>BUILDING COMMUNITIES</div>
          </div>
        </div>

        {/* Feature Badges (Desktop/Tablet) */}
        <div className="header-badges" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {[
            { label: 'TRANSPARENT', icon: <Shield size={10} color="#FFC72C" /> },
            { label: 'GLOBAL NETWORK', icon: <Globe size={10} color="#FFC72C" /> },
            { label: 'REAL-TIME ANALYTICS', icon: <Activity size={10} color="#FFC72C" /> }
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '40px', padding: '4px 10px', fontSize: '8px', fontWeight: 800, color: '#FFF'
            }}>
              {item.icon}
              {item.label}
            </div>
          ))}

          {/* Quick Connect Trigger */}
          <button onClick={handleConnectAction} style={{
            background: 'rgba(255,200,50,0.08)',
            border: '1px solid rgba(255,200,50,0.3)',
            borderRadius: '12px', padding: '6px 14px',
            fontSize: '9px', fontWeight: 900, color: '#FFC72C',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'Outfit, sans-serif'
          }}>
            <Wallet size={12} />
            CONNECT
          </button>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section style={{ position: 'relative', zIndex: 5, padding: '40px 24px 60px 24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '40px', alignItems: 'center' }} className="hero-grid">
          {/* Hero text side */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,200,50,0.05)', border: '1px solid rgba(255,200,50,0.15)', borderRadius: '30px', padding: '4px 12px', marginBottom: '20px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FFC72C', animation: 'ping 1.5s infinite' }} />
              <span style={{ fontSize: '9px', fontWeight: 900, color: '#FFC72C', letterSpacing: '1px' }}>GLOBAL POSITION RESERVATION OPEN</span>
            </div>

            <h1 style={{
              fontSize: 'clamp(28px, 5vw, 48px)',
              fontWeight: 950,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              marginBottom: '20px'
            }}>
              THE FUTURE BELONGS TO THOSE WHO <span style={{ background: 'linear-gradient(135deg, #FFF 40%, #FFC72C 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TAKE ACTION TODAY</span>
            </h1>

            <p style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.6,
              marginBottom: '32px',
              maxWidth: '520px'
            }}>
              Reserve your position before the global community expands. Join a transparent blockchain-powered ecosystem designed for participation, community building, analytics, and long-term growth.
            </p>

            {/* Price Callout and CTA Container */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,200,50,0.06) 0%, rgba(20,15,5,0.4) 100%)',
              border: '1px solid rgba(255,200,50,0.18)',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '440px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', fontWeight: 800, letterSpacing: '1px' }}>NODE CREATION CHARGE</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '9px', color: '#FFF', fontWeight: 800 }}>ONLY</span>
                    <span style={{ fontSize: '24px', color: '#FFC72C', fontWeight: 950 }}>$0.70</span>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>USD EQUIVALENT IN BNB</span>
                  </div>
                </div>
              </div>

              {/* Gold Action Button */}
              <button 
                onClick={handleConnectAction}
                style={{
                  width: '100%',
                  background: 'linear-gradient(90deg, #FFC72C 0%, #E6A100 100%)',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '14px 20px',
                  fontSize: '12px',
                  fontWeight: 950,
                  color: '#000',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 25px rgba(255,200,50,0.3)',
                  transition: 'all 0.2s ease',
                  fontFamily: 'Outfit, sans-serif'
                }}
              >
                CREATE MY NODE NOW
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Hero interactive globe side */}
          <div style={{ height: '340px', position: 'relative', width: '100%' }} className="hero-globe-wrapper">
            <GlobeCanvas />
            
            {/* Overlay indicators on the globe */}
            <div style={{
              position: 'absolute', top: '15%', left: '10%',
              background: 'rgba(10,10,10,0.85)', border: '1px solid rgba(255,255,255,0.05)',
              padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4FC3F7', boxShadow: '0 0 5px #4FC3F7' }} />
              <span style={{ fontSize: '7px', fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>Live Node Matrix</span>
            </div>
            <div style={{
              position: 'absolute', bottom: '15%', right: '10%',
              background: 'rgba(10,10,10,0.85)', border: '1px solid rgba(255,255,255,0.05)',
              padding: '6px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--neon-lime)', boxShadow: '0 0 5px var(--neon-lime)' }} />
              <span style={{ fontSize: '7px', fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>Uptime: 98.6%</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── METRICS BAR ── */}
      <section style={{
        background: 'rgba(255,200,50,0.02)',
        borderTop: '1px solid rgba(255,200,50,0.08)',
        borderBottom: '1px solid rgba(255,200,50,0.08)',
        padding: '24px'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', textAlign: 'center' }} className="metrics-grid">
          {[
            { val: '31,256+', label: 'NODES CREATED', sub: 'Active registry slots' },
            { val: '47+', label: 'COUNTRIES', sub: 'Worldwide penetration' },
            { val: '12,847+', label: 'COMMUNITY MEMBERS', sub: 'Total ecosystem users' },
            { val: '98.6%', label: 'UPTIME SYSTEM', sub: 'Contract validation sync' },
            { val: '100%', label: 'TRANSPARENT', sub: 'Verified BSC smart contracts' }
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ fontSize: '20px', fontWeight: 950, color: '#FFF' }}>{m.val}</div>
              <div style={{ fontSize: '7px', fontWeight: 900, color: '#FFC72C', letterSpacing: '1px' }}>{m.label}</div>
              <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MAIN DETAIL GRID ── */}
      <section style={{ padding: '60px 24px', maxWidth: '1100px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '48px' }}>
        
        {/* Row 1: Why Join & Video Presentation */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '32px' }} className="detail-row-1">
          {/* Why Join NFE Global Card Grid */}
          <div style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.03)',
            borderRadius: '24px',
            padding: '32px'
          }}>
            <h2 style={{ fontSize: '13px', fontWeight: 950, color: '#FFC72C', letterSpacing: '2px', marginBottom: '24px' }}>WHY JOIN NFE GLOBAL?</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="features-grid">
              {[
                { title: 'GLOBAL COMMUNITY', desc: 'Connect with members worldwide and share ecosystem vision.', icon: <Globe size={18} color="#FFC72C" /> },
                { title: 'REAL-TIME ANALYTICS', desc: 'Track performance and node network matrix growth 24/7.', icon: <Activity size={18} color="#FFC72C" /> },
                { title: 'BLOCKCHAIN TRANSPARENCY', desc: 'Every registry and payout is completely verifiable on BSC.', icon: <Shield size={18} color="#FFC72C" /> },
                { title: 'COMMUNITY DRIVEN', desc: 'Designed fully by users, prioritizing collective distribution.', icon: <Users size={18} color="#FFC72C" /> },
                { title: 'SMART CONTRACT POWERED', desc: 'Zero manual intervention. Node sweeps are secure & automatic.', icon: <Laptop size={18} color="#FFC72C" /> },
                { title: 'SUSTAINABLE ECOSYSTEM', desc: 'Designed with recurring circulation cycles for long-term growth.', icon: <TrendingUp size={18} color="#FFC72C" /> }
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>{f.icon}</div>
                  <div>
                    <h3 style={{ fontSize: '10px', fontWeight: 900, color: '#FFF', marginBottom: '4px', letterSpacing: '0.5px' }}>{f.title}</h3>
                    <p style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Watch Presentation Video Thumbnail Card */}
          <div 
            onClick={() => setVideoOpen(true)}
            style={{
              background: 'linear-gradient(135deg, rgba(20,18,14,0.9) 0%, rgba(10,9,7,0.95) 100%)',
              border: '1px solid rgba(255,200,50,0.12)',
              borderRadius: '24px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
            className="video-promo-card"
          >
            {/* Decorative background light */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(255,200,50,0.03) 0%, transparent 60%)', zIndex: 0 }} />

            <div style={{ zIndex: 1 }}>
              <span style={{ fontSize: '9px', fontWeight: 900, color: '#FFC72C', letterSpacing: '1px' }}>WATCH PRESENTATION</span>
              <h2 style={{ fontSize: '16px', fontWeight: 950, color: '#FFF', marginTop: '6px', lineHeight: 1.3 }}>DISCOVER HOW NFE GLOBAL WORKS</h2>
            </div>

            {/* Play Button Simulation */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0', zIndex: 1 }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(255,200,50,0.1)',
                border: '2px solid #FFC72C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 30px rgba(255,200,50,0.2)'
              }}>
                <Play size={24} color="#FFC72C" fill="#FFC72C" />
              </div>
            </div>

            {/* Checkmarks under presentation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1 }}>
              {[
                'Why Community Matters',
                'How Transparency Builds Trust',
                'The Power of Analytics',
                'Our Vision For The Future'
              ].map((txt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', color: 'rgba(255,255,255,0.7)', fontWeight: 800 }}>
                  <Check size={10} color="#FFC72C" />
                  {txt}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Flywheel Diagram & Dashboard Preview */}
        <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '32px' }} className="detail-row-2">
          {/* Interactive Flywheel */}
          <FlywheelDiagram />

          {/* Interactive Dashboard Preview Widget */}
          <DashboardPreview />
        </div>

        {/* Row 3: World Map & Benefits Checklist & FAQ Accordion */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }} className="detail-row-3">
          
          {/* Left panel: World Map & What You Receive */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* World Map presence */}
            <div style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,255,255,0.03)',
              borderRadius: '24px',
              padding: '24px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '9px', fontWeight: 900, color: '#FFC72C', letterSpacing: '1px', marginBottom: '16px' }}>GLOBAL ECOSYSTEM PRESENCE</div>
              <div style={{ color: 'rgba(255,255,255,0.15)', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <Map size={100} strokeWidth={1} style={{ opacity: 0.2 }} />
                <div style={{ position: 'absolute', top: '25%', left: '25%', width: '6px', height: '6px', borderRadius: '50%', background: '#FFC72C', boxShadow: '0 0 8px #FFC72C' }} />
                <div style={{ position: 'absolute', top: '40%', left: '50%', width: '6px', height: '6px', borderRadius: '50%', background: '#FFC72C', boxShadow: '0 0 8px #FFC72C' }} />
                <div style={{ position: 'absolute', top: '35%', left: '75%', width: '6px', height: '6px', borderRadius: '50%', background: '#FFC72C', boxShadow: '0 0 8px #FFC72C' }} />
                <div style={{ position: 'absolute', top: '70%', left: '35%', width: '6px', height: '6px', borderRadius: '50%', background: '#FFC72C', boxShadow: '0 0 8px #FFC72C' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '7px', fontWeight: 900, color: 'rgba(255,255,255,0.5)', marginTop: '12px' }}>
                <span>EUROPE</span>
                <span>ASIA</span>
                <span>AFRICA</span>
                <span>N. AMERICA</span>
                <span>S. AMERICA</span>
                <span>OCEANIA</span>
              </div>
            </div>

            {/* Checklist */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,200,50,0.02) 0%, transparent 100%)',
              border: '1px solid rgba(255,200,50,0.08)',
              borderRadius: '24px',
              padding: '28px',
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.8fr',
              gap: '16px',
              alignItems: 'center'
            }} className="checklist-grid">
              <div>
                <h3 style={{ fontSize: '11px', fontWeight: 950, color: '#FFC72C', letterSpacing: '1px', marginBottom: '16px' }}>UPON NODE CREATION RECEIVE:</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    'Unique Node ID',
                    'Personal Dashboard',
                    'Team & Matrix Analytics',
                    'Referral & Marketing Tools',
                    'Blockchain Verification',
                    'Global Community Access',
                    'Future Ecosystem Features'
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', fontWeight: 800 }}>
                      <Check size={11} color="#FFC72C" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gift Box Graphic (Vector placeholder matching image) */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: '90px', height: '90px',
                  background: 'linear-gradient(135deg, rgba(255,200,50,0.1) 0%, rgba(20,15,5,0.6) 100%)',
                  border: '1.5px solid #FFC72C',
                  borderRadius: '16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 10px 25px rgba(255,200,50,0.15)',
                  position: 'relative'
                }}>
                  <Gift size={32} color="#FFC72C" style={{ animation: 'bounce 3s infinite' }} />
                  <span style={{ fontSize: '7px', fontWeight: 900, color: '#FFC72C', marginTop: '6px', letterSpacing: '0.5px' }}>NFE BENEFITS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: FAQ Accordion */}
          <div style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.03)',
            borderRadius: '24px',
            padding: '32px'
          }}>
            <h2 style={{ fontSize: '13px', fontWeight: 950, color: '#FFC72C', letterSpacing: '2px', marginBottom: '24px' }}>FREQUENTLY ASKED QUESTIONS</h2>
            <FaqAccordion />
          </div>

        </div>

      </section>

      {/* ── PRE-FOOTER CTA BAR ── */}
      <section style={{
        background: 'linear-gradient(90deg, rgba(255,200,50,0.05) 0%, rgba(10,8,5,0.6) 50%, rgba(255,200,50,0.05) 100%)',
        borderTop: '1px solid rgba(255,200,50,0.15)',
        borderBottom: '1px solid rgba(255,200,50,0.15)',
        padding: '32px 24px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ fontSize: '10px', fontWeight: 950, color: '#FFC72C', letterSpacing: '2px', marginBottom: '8px' }}>THE WORLDWIDE COMMUNITY IS COMING</div>
          <h2 style={{ fontSize: '20px', fontWeight: 950, color: '#FFF', marginBottom: '12px' }}>RESERVE YOUR NODE TODAY</h2>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', fontWeight: 800, marginBottom: '24px', letterSpacing: '1px' }}>
            NODE CREATION CHARGE ONLY <span style={{ color: '#FFC72C' }}>$0.70 USD EQUIVALENT IN BNB</span>
          </div>
          
          <button 
            onClick={handleConnectAction}
            style={{
              margin: '0 auto',
              background: 'linear-gradient(90deg, #FFC72C 0%, #E6A100 100%)',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 32px',
              fontSize: '11px',
              fontWeight: 950,
              color: '#000',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 25px rgba(255,200,50,0.3)',
              fontFamily: 'Outfit, sans-serif'
            }}
          >
            CREATE MY NODE NOW
            <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        marginTop: 'auto',
        background: '#010204',
        borderTop: '1px solid rgba(255,255,255,0.03)',
        padding: '32px 24px',
        fontSize: '9px',
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Slogan */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontWeight: 800, color: 'rgba(255,255,255,0.3)' }} className="footer-links">
            <span>TRANSPARENT</span>
            <span>DECENTRALIZED</span>
            <span>COMMUNITY DRIVEN</span>
          </div>

          <div>NFE GLOBAL © {new Date().getFullYear()} · Building Communities · Creating Opportunities · Empowering Growth</div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '8px', fontWeight: 900, color: '#FFC72C', letterSpacing: '2px' }}>
            <Sparkles size={10} />
            EVERY ACTION CREATES IMPACT
          </div>
        </div>
      </footer>

      {/* Video Modal Overlay */}
      <VideoModal isOpen={videoOpen} onClose={() => setVideoOpen(false)} />
    </div>
  );
}
