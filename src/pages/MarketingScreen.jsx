import { motion } from 'framer-motion';
import { ExternalLink, GraduationCap, Image as ImageIcon, Bot } from 'lucide-react';
import { openLink } from '../utils/openLink.js';

export default function MarketingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#05080F', color: '#fff', overflowX: 'hidden', fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ position: 'fixed', top: '-20%', left: '-15%', width: '55%', height: '55%', background: 'radial-gradient(circle, rgba(206,147,216,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-15%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(79,195,247,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      
      <div style={{ position: 'relative', zIndex: 1, paddingTop: 100, paddingBottom: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '0 24px' }}>
        
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 32, padding: '40px 30px', maxWidth: 600, width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          
          <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #CBFF01, #4FFFFF)', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
            <GraduationCap size={40} />
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, letterSpacing: -1, marginBottom: 16 }}>
            AIPCore Core <span style={{ color: '#4FC3F7' }}>Marketing Hub</span>
          </h1>
          
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 32 }}>
            We've moved our promotional tools to a dedicated powerhouse platform! Access the Training Academy, Marketing Assets, and our custom AI Agent.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40, textAlign: 'left', background: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: '#CBFF01' }}><GraduationCap size={20} /></div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Training Academy & Masterclasses</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: '#FF6BFF' }}><ImageIcon size={20} /></div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Pitch Decks & Social Media Kits</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: '#CE93D8' }}><Bot size={20} /></div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Bella: AI Marketing Copy Agent</span>
            </div>
          </div>

          <button
            onClick={() => openLink('https://promo.aipcore.online')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10, background: '#fff', color: '#000',
              padding: '16px 32px', borderRadius: 20, fontSize: 16, fontWeight: 900,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 0 30px rgba(255,255,255,0.2)', transition: 'transform 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
            Launch Marketing Hub <ExternalLink size={18} />
          </button>

        </motion.div>
      </div>
    </div>
  );
}
