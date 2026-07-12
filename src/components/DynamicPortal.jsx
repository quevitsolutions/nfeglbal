import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';

export default function DynamicPortal() {
  const { isSyncing, isProcessing, processingLabel } = useGameStore();
  
  const isActive = false;
  const label = isProcessing ? processingLabel : (isSyncing ? "Syncing Network..." : "");

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ y: -50, x: '-50%', opacity: 0, scale: 0.8 }}
          animate={{ y: 0, x: '-50%', opacity: 1, scale: 1 }}
          exit={{ y: -50, x: '-50%', opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          style={{
            position: 'fixed',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(13, 17, 23, 0.85)',
            backdropFilter: 'blur(20px)',
            webkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(163, 255, 18, 0.3)',
            borderRadius: '40px',
            padding: '6px 14px 6px 8px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 15px rgba(163, 255, 18, 0.1)',
            minWidth: 'auto'
          }}
        >
          {/* Pulsing Egg Icon */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            style={{
              width: '28px',
              height: '28px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <img 
              src="/assets/egg_orange.png?v=3" 
              alt="processing" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 900, 
              color: 'var(--neon-lime)', 
              letterSpacing: '0.05em',
              lineHeight: 1
            }}>
              {isProcessing ? "PROCESSING" : "SYNCING"}
            </span>
            <span style={{ 
              fontSize: '9px', 
              fontWeight: 700, 
              color: 'rgba(255, 255, 255, 0.6)',
              marginTop: '2px',
              textTransform: 'uppercase'
            }}>
              {label}
            </span>
          </div>

          {/* Activity Dot */}
          <motion.div 
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--neon-lime)',
              marginLeft: '4px',
              boxShadow: '0 0 10px var(--neon-lime)'
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
