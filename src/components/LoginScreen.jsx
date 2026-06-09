import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { Rocket, Brain, Users, Trophy, Wallet } from 'lucide-react';

// ── Animated perspective grid canvas ──────────────────────────────────────
function GridCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame;
    let offset = 0;

    const draw = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const W = canvas.width, H = canvas.height;
      const horizon = H * 0.52;
      const vp = { x: W / 2, y: horizon };

      ctx.clearRect(0, 0, W, H);

      const numV = 22;
      for (let i = 0; i <= numV; i++) {
        const t = i / numV;
        const x = W * t;
        const alpha = 0.04 + Math.abs(t - 0.5) * 0.12;
        ctx.beginPath();
        ctx.moveTo(vp.x + (x - vp.x) * 0.01, vp.y);
        ctx.lineTo(x, H);
        ctx.strokeStyle = `rgba(0, 220, 255, ${alpha})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      const numH = 18;
      for (let i = 0; i <= numH; i++) {
        const tRaw = i / numH;
        const tAnim = ((tRaw + offset) % 1);
        const t = Math.pow(tAnim, 2.2);
        const y = horizon + (H - horizon) * t;
        const alpha = 0.03 + t * 0.14;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.strokeStyle = `rgba(0, 210, 255, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      const grad = ctx.createLinearGradient(0, horizon, W, horizon);
      grad.addColorStop(0,   'transparent');
      grad.addColorStop(0.35, 'rgba(0, 220, 255, 0.35)');
      grad.addColorStop(0.5,  'rgba(155, 81, 255, 0.55)');
      grad.addColorStop(0.65, 'rgba(0, 220, 255, 0.35)');
      grad.addColorStop(1,   'transparent');
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(W, horizon);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      offset = (offset + 0.0012) % 1;
      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, opacity: 0.85
    }} />
  );
}

export default function LoginScreen({ onConnect }) {
  const { connect } = useConnect();
  const hasInjectedProvider = typeof window !== 'undefined' && !!window.ethereum;

  return (
    <div style={{
      height: '100%',
      width: '100%',
      background: '#000000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      color: '#fff',
      fontFamily: 'Outfit, sans-serif',
      WebkitOverflowScrolling: 'touch',
    }}>
      <GridCanvas />

      {/* Background Orbs */}
      <div style={{
        position: 'absolute', top: '10%', left: '10%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(155,81,255,0.08) 0%, transparent 60%)',
        filter: 'blur(50px)', zIndex: 0, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '5%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,210,255,0.06) 0%, transparent 60%)',
        filter: 'blur(50px)', zIndex: 0, pointerEvents: 'none'
      }} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          zIndex: 10,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: 480,
          padding: '20px 20px 32px',
        }}
      >
        {/* ── Row 1: Logo + Badge inline (compact) ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{
              width: 54, height: 54, borderRadius: 16,
              background: 'linear-gradient(135deg, #7B2CBF 0%, #00D2FF 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
              boxShadow: '0 0 20px rgba(155,81,255,0.4)',
              position: 'relative', flexShrink: 0
            }}
          >
            <span>⚡</span>
            <motion.div
              animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: -3, borderRadius: 19,
                border: '1px solid rgba(155,81,255,0.8)',
                pointerEvents: 'none'
              }}
            />
          </motion.div>

          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em'
            }}>NFEGLOBAL HUB</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(155,81,255,0.3)',
              borderRadius: 40, padding: '2px 8px',
              fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
              color: '#C084FC', marginTop: 3
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#A3FF12', display: 'inline-block', boxShadow: '0 0 6px #A3FF12' }} />
              V2.0 LIVE
            </div>
          </div>
        </div>

        {/* ── Row 2: Headline (compact on mobile) ── */}
        <h1 style={{
          fontSize: 'clamp(28px, 8vw, 56px)',
          fontWeight: 900, lineHeight: 1.1,
          marginBottom: 10, letterSpacing: '-0.02em',
        }}>
          <span style={{ color: '#ffffff' }}>BUILD </span>
          <span style={{ color: '#00D2FF' }}>TODAY.</span><br />
          <span style={{ color: '#ffffff' }}>SHAPE </span>
          <span style={{ color: '#00D2FF' }}>TOMORROW.</span>
        </h1>

        {/* ── Subheadline ── */}
        <div style={{ fontSize: 'clamp(8px, 2vw, 11px)', fontWeight: 800, letterSpacing: 1.5, marginBottom: 18 }}>
          <span style={{ color: '#00D2FF' }}>THE FUTURE OF AI IS HERE. </span>
          <span style={{ color: '#C084FC' }}>BE A PART OF IT.</span>
        </div>

        {/* ── CONNECT WALLET BUTTON — top priority, always visible ── */}
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => {
            const handleConnect = () => {
              // Clear explicit-disconnect flag so reconnect is allowed
              try { localStorage.removeItem('nfeglobal_disconnected'); } catch(e) {}
              if (hasInjectedProvider) connect({ connector: injected() });
              else openConnectModal();
            };

            return (
              <div
                style={{ width: '100%', maxWidth: 360, marginBottom: 6 }}
                {...(!mounted && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none' } })}
              >
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 0 50px rgba(0,210,255,0.5)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleConnect}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(90deg, #00D2FF 0%, #7B2CBF 100%)',
                    color: '#fff', border: 'none', borderRadius: 14,
                    padding: '15px 24px', fontSize: 15, fontWeight: 900,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    letterSpacing: '1px',
                    boxShadow: '0 0 30px rgba(0,210,255,0.35)',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  <Wallet size={18} />
                  CONNECT WALLET
                </motion.button>
                <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 0.5 }}>
                  TokenPocket • MetaMask • Trust Wallet • WalletConnect
                </div>
              </div>
            );
          }}
        </ConnectButton.Custom>

        {/* ── Divider ── */}
        <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.3), rgba(155,81,255,0.3), transparent)', margin: '16px 0' }} />

        {/* ── Features Grid (2-col compact on mobile) ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '12px 16px', width: '100%', marginBottom: 16,
        }}>
          {[
            { icon: <Rocket size={16} color="#C084FC" />, title: 'DREAM BIG', desc: 'Vision is the first step to victory.' },
            { icon: <Brain size={16} color="#C084FC" />, title: 'TAKE ACTION', desc: 'Small steps today, giant leaps tomorrow.' },
            { icon: <Users size={16} color="#00D2FF" />, title: 'BUILD TOGETHER', desc: 'A strong team creates an unstoppable future.' },
            { icon: <Trophy size={16} color="#C084FC" />, title: 'NEVER QUIT', desc: 'Challenges make you stronger. Keep going.' }
          ].map((ft, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left' }}>
              <div style={{ flexShrink: 0, marginTop: 1 }}>{ft.icon}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#00D2FF', marginBottom: 2, letterSpacing: 0.5 }}>{ft.title}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, fontWeight: 500 }}>{ft.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Quote Box ── */}
        <div style={{
          position: 'relative', width: '100%',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(155,81,255,0.25)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <div style={{ position: 'absolute', top: 8, left: 12, fontSize: 20, color: '#C084FC', fontWeight: 900, lineHeight: 1 }}>"</div>
          <div style={{ fontSize: 11, fontWeight: 800, lineHeight: 1.5, letterSpacing: 0.3, paddingLeft: 12 }}>
            THE BEST TIME TO PLANT A TREE WAS 20 YEARS AGO.<br />
            THE SECOND BEST TIME <span style={{ color: '#00D2FF' }}>IS NOW.</span>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: 3, marginTop: 6 }}>
            BELIEVE • PLAN • ACT • SUCCEED
          </div>
        </div>

        {/* ── Footer Text ── */}
        <div style={{ marginTop: 16, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, textAlign: 'center' }}>
          TOGETHER, WE DON'T JUST FOLLOW THE FUTURE. <span style={{ color: '#00D2FF' }}>WE BUILD IT.</span>
        </div>

      </motion.div>
    </div>
  );
}
