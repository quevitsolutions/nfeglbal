import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Send, CheckCircle2, Shield, X, ExternalLink, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGameStore } from '../store/gameStore.js';
import { getTelegramUser, isTelegramMiniApp, triggerHaptic, openTelegramBot } from '../utils/telegram.js';

export default function TelegramBindModal({ isOpen, onClose }) {
  const { walletAddress, nodeId, nodeTier } = useGameStore();
  const [isBinding, setIsBinding] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [tgUser, setTgUser] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const user = getTelegramUser();
      setTgUser(user);
      checkStatus();
    }
  }, [isOpen, walletAddress]);

  const checkStatus = async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/telegram/status/${walletAddress}`);
      const data = await res.json();
      if (data.success) {
        setTelegramStatus(data);
      }
    } catch (e) {
      console.warn('Failed to check Telegram binding status:', e);
    }
  };

  const handleBind = async () => {
    if (!walletAddress) {
      toast.error('Please connect your wallet first!');
      return;
    }

    triggerHaptic('medium');
    setIsBinding(true);

    try {
      // If inside Telegram Mini App, auto-bind with current user info
      const user = tgUser || getTelegramUser();
      const telegramId = user ? user.id : null;
      const username = user ? user.username : null;

      const res = await fetch('/api/telegram/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          nodeId: nodeId ? Number(nodeId) : 0,
          telegramId,
          username,
          nodeTier: nodeTier || 0
        })
      });

      const data = await res.json();
      if (data.success) {
        triggerHaptic('success');
        toast.success('🎉 Telegram Alerts Activated!');
        setTelegramStatus({ linked: true, telegramId, username });
        checkStatus();
      } else {
        toast.error(data.error || 'Failed to link Telegram');
      }
    } catch (e) {
      toast.error('Network error linking Telegram');
    } finally {
      setIsBinding(false);
    }
  };

  const handleTestAlert = async () => {
    if (!walletAddress) return;
    triggerHaptic('light');
    try {
      const res = await fetch('/api/telegram/notify-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('🔔 Test notification sent to Telegram!');
      } else {
        toast.error(data.error || 'Could not send test notification');
      }
    } catch (e) {
      toast.error('Error triggering test alert');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(2, 3, 5, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          style={{
            background: 'linear-gradient(145deg, #0c121e 0%, #06090e 100%)',
            border: '1px solid rgba(0, 136, 204, 0.3)',
            borderRadius: '24px',
            width: '100%', maxWidth: '440px',
            padding: '24px',
            position: 'relative',
            boxShadow: '0 20px 50px rgba(0, 136, 204, 0.2)'
          }}
        >
          {/* Close Button */}
          <button
            onClick={() => { triggerHaptic('light'); onClose(); }}
            style={{
              position: 'absolute', top: '18px', right: '18px',
              background: 'rgba(255,255,255,0.06)', border: 'none',
              borderRadius: '50%', width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div style={{ textAlignment: 'center', textAlign: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '18px',
              background: 'linear-gradient(135deg, #0088cc, #00c6ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', color: '#fff',
              boxShadow: '0 8px 24px rgba(0, 136, 204, 0.4)'
            }}>
              <Bell size={28} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>
              Telegram Payout Alerts
            </h3>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>
              Receive instant real-time Telegram messages when you earn referral rewards, matrix payouts, or tier upgrades!
            </p>
          </div>

          {/* User Profile / Status Box */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Connected Wallet:</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--neon-lime)' }}>
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not Connected'}
              </span>
            </div>

            {tgUser && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Telegram User:</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0088cc' }}>
                  @{tgUser.username || tgUser.first_name || tgUser.id}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Alert Status:</span>
              <span style={{
                fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '10px',
                background: telegramStatus?.linked ? 'rgba(163,255,18,0.15)' : 'rgba(255,199,44,0.15)',
                color: telegramStatus?.linked ? 'var(--neon-lime)' : '#FFC72C',
                border: `1px solid ${telegramStatus?.linked ? 'rgba(163,255,18,0.3)' : 'rgba(255,199,44,0.3)'}`
              }}>
                {telegramStatus?.linked ? 'ACTIVE 🔔' : 'NOT LINKED ⚠️'}
              </span>
            </div>
          </div>

          {/* Benefits Bullet List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
              <CheckCircle2 size={16} color="#0088cc" />
              <span>Instant referral commission alerts</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
              <CheckCircle2 size={16} color="#0088cc" />
              <span>Matrix position fill & auto-upgrade notices</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
              <CheckCircle2 size={16} color="#0088cc" />
              <span>Reward Pool & Leaderboard updates</span>
            </div>
          </div>

          {/* Primary Action Button */}
          {telegramStatus?.linked ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleTestAlert}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #0088cc, #00a8ff)',
                  color: '#fff', border: 'none', borderRadius: '14px',
                  padding: '14px', fontSize: '14px', fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: 'pointer', boxShadow: '0 4px 16px rgba(0, 136, 204, 0.3)'
                }}
              >
                <Send size={16} /> Send Test Alert to Telegram
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleBind}
                disabled={isBinding}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #0088cc 0%, #00a8ff 100%)',
                  color: '#fff', border: 'none', borderRadius: '14px',
                  padding: '14px', fontSize: '14px', fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: 'pointer', boxShadow: '0 4px 20px rgba(0, 136, 204, 0.4)',
                  opacity: isBinding ? 0.7 : 1
                }}
              >
                {isBinding ? (
                  <> <RefreshCw size={16} className="spin" /> Linking Account... </>
                ) : (
                  <> <Bell size={16} /> Activate Telegram Alerts </>
                )}
              </button>

              <button
                onClick={() => openTelegramBot('AIPCoreBot', nodeId ? String(nodeId) : walletAddress)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '14px', padding: '12px', fontSize: '12px', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  cursor: 'pointer'
                }}
              >
                Launch @AIPCoreBot Directly <ExternalLink size={14} />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
