import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import { useContract } from '../hooks/useContract.js';
import { useNativePrice } from '../hooks/useNativePrice.js';
import { ethers } from 'ethers';
import { CONTRACTS } from '../config/constants.js';
import { blockchain } from '../services/blockchain.js';
import { AIPCORE_ABI } from '../config/abi.js';
import { Shield, Sparkles, CheckCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegistrationModal({ isOpen, onClose }) {
  const { walletAddress, isConnected, hasNode } = useGameStore();
  const { createNode, createNodeWithSponsorAddress, loadNodeData } = useContract();
  const nativePrice = useNativePrice();

  const [sponsorInput, setSponsorInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tier1Cost, setTier1Cost] = useState('0.050');
  const [showSuccess, setShowSuccess] = useState(false);

  // Pre-fill sponsor input from URL referrerId
  useEffect(() => {
    const { referrerId } = useGameStore.getState();
    if (referrerId) {
      setSponsorInput(String(referrerId));
    }
  }, []);

  // Fetch Tier 1 cost dynamically
  useEffect(() => {
    const fetchTierCost = async () => {
      try {
        const costsRaw = await blockchain.core.getTierCosts().catch(() => null);
        if (costsRaw && costsRaw.length > 0) {
          setTier1Cost(ethers.formatEther(costsRaw[0]));
        }
      } catch (e) {
        console.warn("Failed to fetch Tier 1 cost, using fallback:", e);
      }
    };
    if (isConnected) {
      fetchTierCost();
    }
  }, [isConnected]);

  const handleRegister = async () => {
    setIsLoading(true);
    useGameStore.setState({ isRegistering: true });
    try {
      const refVal = sponsorInput.trim();
      let effectiveSponsor = 55555;
      let useSponsorAddress = false;
      let sponsorAddress = "";

      if (refVal) {
        try {
          if (refVal.startsWith('0x') && refVal.length === 42) {
            const refId = await blockchain.core.nodeId(refVal).catch(() => 0n);
            if (refId && Number(refId) > 0) {
              effectiveSponsor = Number(refId);
            } else {
              useSponsorAddress = true;
              sponsorAddress = refVal;
            }
          } else if (Number(refVal) > 0) {
            effectiveSponsor = Number(refVal);
          }
        } catch (e) {
          console.warn("Referrer ID lookup failed, using fallback:", e);
        }
      }

      let nid = null;
      if (useSponsorAddress && sponsorAddress) {
        nid = await createNodeWithSponsorAddress(sponsorAddress, 1);
      } else {
        nid = await createNode(effectiveSponsor);
      }

      if (nid) {
        await loadNodeData(walletAddress);
        setShowSuccess(true);
        toast.success('Registration successful! 🚀');
      }
    } catch (err) {
      toast.error(err?.message || 'Registration failed');
    }
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.9)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          style={{
            background: 'linear-gradient(135deg, #202225 0%, #12131a 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '28px',
            width: '100%',
            maxWidth: '380px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Decorative Background Glow */}
          <div style={{
            position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
            width: '200px', height: '200px',
            background: 'radial-gradient(circle, rgba(163,255,18,0.1) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          {!showSuccess ? (
            <>
              {/* Form Header */}
              <div style={{
                width: '60px', height: '60px', borderRadius: '18px',
                background: 'rgba(163,255,18,0.1)', border: '1.5px solid rgba(163,255,18,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '26px', margin: '0 auto 16px', color: '#A3FF12'
              }}>
                ⬡
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 950, color: '#fff', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                Activate Your Node
              </h2>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: '20px' }}>
                Register your account on-chain to unlock matrix earnings, matrix spillover, and global pools.
              </p>

              {/* Sponsor Input Form */}
              <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                <label style={{ fontSize: '10px', fontWeight: 900, color: '#A3FF12', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                  SPONSOR ID OR ADDRESS
                </label>
                <input
                  type="text"
                  placeholder="Enter Sponsor ID or Wallet Address (default: 55555)"
                  value={sponsorInput}
                  onChange={(e) => setSponsorInput(e.target.value)}
                  style={{
                    background: 'rgba(32, 34, 37, 0.8)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    color: '#fff',
                    fontSize: '13px',
                    fontFamily: 'Outfit, sans-serif',
                    outline: 'none',
                    width: '100%',
                    fontWeight: 600
                  }}
                />
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', marginTop: '6px', fontWeight: 700 }}>
                  {sponsorInput.trim() ? (
                    sponsorInput.trim().startsWith('0x') && sponsorInput.trim().length === 42 ? (
                      "✨ Sponsor Address detected."
                    ) : Number(sponsorInput.trim()) > 0 ? (
                      "✨ Sponsor ID #" + sponsorInput.trim() + " detected."
                    ) : (
                      "⚠️ Invalid format. Will fallback to Sponsor #55555 (Platform)."
                    )
                  ) : (
                    "ℹ️ Empty. Will default to Sponsor #55555 (Platform)."
                  )}
                </div>
              </div>

              {/* Node Details Info */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '16px',
                padding: '12px 14px',
                border: '1px solid rgba(255,255,255,0.04)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>REGISTRATION COST</span>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#A3FF12' }}>
                  0.000 BNB
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginLeft: '4px', fontWeight: 700 }}>
                    (FREE)
                  </span>
                </span>
              </div>

              {/* Action Button */}
              <button
                onClick={handleRegister}
                disabled={isLoading}
                style={{
                  width: '100%',
                  background: 'var(--neon-lime)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '14px',
                  fontSize: '13px',
                  fontWeight: 900,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(163,255,18,0.1)'
                }}
              >
                {isLoading ? 'Activating Node...' : 'Activate Tier 0 Node'}
                {!isLoading && <ArrowRight size={15} />}
              </button>

              {/* Option to Browse as Guest */}
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginTop: '14px',
                  textDecoration: 'underline'
                }}
              >
                Browse as Guest
              </button>
            </>
          ) : (
            <>
              {/* Success View */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{ padding: '20px 0' }}
              >
                <CheckCircle size={56} color="#A3FF12" style={{ margin: '0 auto 16px', filter: 'drop-shadow(0 0 10px rgba(163,255,18,0.3))' }} />
                
                <h2 style={{ fontSize: '20px', fontWeight: 950, color: '#fff', marginBottom: '8px' }}>
                  Node Activated!
                </h2>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: '24px' }}>
                  Congratulations! Your AIPCore Tier 0 Node has been successfully initialized on-chain.
                </p>

                <button
                  onClick={onClose}
                  style={{
                    width: '100%',
                    background: '#fff',
                    color: '#000',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '14px',
                    fontSize: '13px',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(255,255,255,0.05)'
                  }}
                >
                  Enter Portal
                  <Sparkles size={15} color="#FFD700" />
                </button>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
