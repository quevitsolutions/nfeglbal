import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function MiningNoticeModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="dialogue-glass-wrap" style={{ zIndex: 9999 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="dialogue-glass-card"
            style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}
          >
            {/* Header Icon */}
            <div style={{
              width: '72px', height: '72px',
              background: 'rgba(255, 199, 44, 0.1)',
              borderRadius: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px',
              margin: '0 auto 20px',
              border: '1px solid rgba(255, 199, 44, 0.25)',
              color: '#FFC72C'
            }}>
              <AlertTriangle size={36} />
            </div>

            <div className="modal-title" style={{ fontSize: '18px', fontWeight: 950, color: '#FFF', marginBottom: '12px', letterSpacing: '0.5px' }}>
              MINING UPDATE
            </div>

            <p style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.6,
              marginBottom: '28px',
              textAlign: 'center'
            }}>
              AIPCore has discontinued token mining from now as the most advanced phase has started. Token mining will resume in the future roadmap.
            </p>

            <button
              onClick={onClose}
              className="cta-register-free"
              style={{
                width: '100%',
                fontSize: '13px',
                padding: '14px 0',
                borderRadius: '12px',
                fontWeight: 900,
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              ACKNOWLEDGE
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
