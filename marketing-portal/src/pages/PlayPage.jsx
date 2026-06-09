import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Wallet, Trophy, Target, Sparkles, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PlayPage() {
  const [wallet, setWallet] = useState(null);
  const [taps, setTaps] = useState(0);
  const [energy, setEnergy] = useState(500);
  const maxEnergy = 500;
  const [particles, setParticles] = useState([]);
  const [showUpsell, setShowUpsell] = useState(false);
  const syncTimeoutRef = useRef(null);

  // Sync with backend API
  const syncWithServer = async (currentTaps, currentEnergy) => {
    if (!wallet) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'https://nfeglobal.online/api'}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet, taps: currentTaps, energy: currentEnergy })
      });
    } catch (e) {
      console.error('Sync failed', e);
    }
  };

  const handleConnect = async () => {
    if (!window.ethereum) {
      toast.error('Please install a Web3 wallet (like MetaMask)');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      setWallet(address);
      
      // Fetch user state to create account & load taps
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://nfeglobal.online/api'}/user/${address}`);
      const data = await res.json();
      if (data && data.taps !== undefined) {
        setTaps(Number(data.taps) || 0);
        setEnergy(Number(data.energy) || 500);
      }
      
      toast.success('Wallet connected! Start tapping.');
    } catch (e) {
      toast.error('Failed to connect wallet');
    }
  };

  const handleTap = (e) => {
    if (!wallet) {
      toast.error('Connect your wallet first to start earning!');
      return;
    }
    if (energy <= 0) {
      toast.error('Not enough energy! Wait for it to recharge.');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setParticles(prev => [...prev, { id: Date.now(), x, y }]);
    
    setTaps(t => {
      const newTaps = t + 1;
      if (newTaps === 1000) {
        setShowUpsell(true);
      }
      return newTaps;
    });
    
    setEnergy(e => e - 1);

    // Debounce sync to prevent backend spam
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncWithServer(taps + 1, energy - 1);
    }, 2000);
  };

  // Energy regeneration loop
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy(e => (e < maxEnergy ? e + 1 : e));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#030509',
      padding: '100px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: 'Outfit, sans-serif'
    }}>
      <div style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>
        
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: 48, fontWeight: 900, color: '#fff', marginBottom: 10 }}>
            Tap to <span style={{ color: '#CBFF01' }}>Earn</span>
          </h1>
          <p style={{ color: '#aaa', fontSize: 18, marginBottom: 40 }}>
            Generate free NFEGlobal Sparks by tapping. Build your power before activating a real node!
          </p>
        </motion.div>

        {/* Stats Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30, background: 'rgba(255,255,255,0.02)', padding: '20px 30px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Total Taps</div>
            <div style={{ color: '#fff', fontSize: 32, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
              {taps.toLocaleString()} <Sparkles size={24} color="#CBFF01" />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Wallet</div>
            {!wallet ? (
              <button 
                onClick={handleConnect}
                style={{ background: '#CBFF01', color: '#000', border: 'none', padding: '8px 16px', borderRadius: 10, fontWeight: 800, marginTop: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Wallet size={16} /> Connect
              </button>
            ) : (
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginTop: 5 }}>
                {wallet.slice(0,6)}...{wallet.slice(-4)}
              </div>
            )}
          </div>
        </div>

        {/* Energy Bar */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={16} color="#FFD700" /> Energy</span>
            <span>{energy} / {maxEnergy}</span>
          </div>
          <div style={{ width: '100%', height: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden' }}>
            <motion.div 
              style={{ height: '100%', background: 'linear-gradient(90deg, #FFD700, #FF5722)' }}
              animate={{ width: `${(energy / maxEnergy) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Tap Area (Dashboard Style) */}
        <motion.div
          whileTap={{ scale: wallet && energy > 0 ? 0.96 : 1 }}
          onClick={handleTap}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', margin: '0 auto 40px', padding: 24,
            border: wallet && energy > 0 ? '1px solid rgba(163,255,18,0.5)' : '1px solid rgba(255,255,255,0.05)',
            boxShadow: wallet && energy > 0 ? '0 0 20px rgba(163,255,18,0.2)' : 'none',
            cursor: wallet && energy > 0 ? 'pointer' : 'not-allowed',
            transition: 'border 0.3s, box-shadow 0.3s',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 16,
            width: '100%',
            position: 'relative'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#A3FF12', letterSpacing: 0.5 }}>UNCLAIMED SPARKS</span>
          <span style={{ fontSize: '32px', fontWeight: 900, color: '#fff', marginTop: 8 }}>{taps.toLocaleString()}</span>
          <span style={{ fontSize: '12px', color: '#A3FF12', fontWeight: 900, marginTop: 6, letterSpacing: 1, animation: 'pulse 1.5s infinite' }}>TAP TO COLLECT →</span>

          <AnimatePresence>
            {particles.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 1, x: p.x - 10, y: p.y - 40, scale: 0.5 }}
                animate={{ opacity: 0, y: p.y - 100, scale: 1.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                onAnimationComplete={() => setParticles(arr => arr.filter(item => item.id !== p.id))}
                style={{
                  position: 'absolute', left: 0, top: 0,
                  color: '#A3FF12', fontSize: 24, fontWeight: 900,
                  pointerEvents: 'none', zIndex: 20
                }}
              >
                +1
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Upsell Modal */}
        <AnimatePresence>
          {showUpsell && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999,
                padding: 24
              }}
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }}
                style={{
                  background: '#111', border: '1px solid #CBFF01', borderRadius: 24,
                  padding: 40, maxWidth: 400, textAlign: 'center'
                }}
              >
                <Trophy size={64} color="#CBFF01" style={{ margin: '0 auto 20px' }} />
                <h2 style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 15 }}>You are ready!</h2>
                <p style={{ color: '#aaa', fontSize: 16, marginBottom: 30, lineHeight: 1.6 }}>
                  You've tapped {taps} times! It's time to upgrade your virtual node to a real Web3 Mining Node and start earning real BNB.
                </p>
                <button
                  onClick={() => window.location.href = 'https://nfeglobal.online'}
                  style={{
                    width: '100%', background: '#CBFF01', color: '#000', border: 'none', padding: '16px',
                    borderRadius: 12, fontSize: 18, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10
                  }}
                >
                  Activate Genesis Node <ChevronRight size={20} />
                </button>
                <button
                  onClick={() => setShowUpsell(false)}
                  style={{ background: 'transparent', border: 'none', color: '#666', marginTop: 20, cursor: 'pointer', fontWeight: 700 }}
                >
                  Continue playing for free
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
