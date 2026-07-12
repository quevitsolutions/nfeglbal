import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import { useContract } from '../hooks/useContract.js';
import DashboardScreen from './DashboardScreen.jsx';
import AnalyticsScreen from './AnalyticsScreen.jsx';
import TeamScreen from './TeamScreen.jsx';
import CalculatorScreen from './CalculatorScreen.jsx';
import ContractsScreen from './ContractsScreen.jsx';
import { ChevronRight, ArrowLeft, RefreshCw, Zap, TrendingUp, Users, Target, BarChart2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CoreHubScreen() {
  const { walletAddress, nodeId, nodeTier, hasNode, setActiveTab } = useGameStore();
  const { loadNodeData } = useContract();
  const [activeView, setActiveView] = useState('hub');
  const [refreshing, setRefreshing] = useState(false);

  const handleSyncTelemetry = async () => {
    if (!walletAddress) return toast.error('Connect wallet first');
    setRefreshing(true);
    try {
      await loadNodeData(walletAddress);
      toast.success('Telemetry synced with blockchain! ⬡');
    } catch (e) {
      toast.error('Sync failed');
    } finally {
      setRefreshing(false);
    }
  };

  const menuItems = [
    {
      id: 'upgrade',
      title: 'Upgrade Node',
      desc: 'Unlock 18 levels of matrix spillover & boost rewards',
      gradient: 'linear-gradient(135deg, #FF9800 0%, #FF5722 100%)', // Orange/Red-Orange
      icon: <TrendingUp size={36} color="rgba(255,255,255,0.9)" />,
      action: () => setActiveTab('upgrade')
    },
    {
      id: 'prelaunch',
      title: 'Pre-Launch Earn',
      desc: 'Build team with $0 free slots & hit 10-ref goal',
      gradient: 'linear-gradient(135deg, #E53935 0%, #B71C1C 100%)', // Vibrant Red
      icon: <Target size={36} color="rgba(255,255,255,0.9)" />,
      action: () => setActiveTab('prelaunch')
    },
    {
      id: 'dash',
      title: 'Operator Dashboard',
      desc: 'Check live balances, withdrawable vault & pool claims',
      gradient: 'linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)', // Royal Blue
      icon: <Zap size={36} color="rgba(255,255,255,0.9)" />,
      action: () => setActiveView('dash')
    },
    {
      id: 'network',
      title: 'Matrix Network',
      desc: 'Explore your 10-level on-chain downlines & team size',
      gradient: 'linear-gradient(135deg, #8E24AA 0%, #4A148C 100%)', // Cyber Purple
      icon: <Users size={36} color="rgba(255,255,255,0.9)" />,
      action: () => setActiveView('network')
    },
    {
      id: 'analytics',
      title: 'Global Analytics',
      desc: 'Track total nodes, contract volume & telemetry data',
      gradient: 'linear-gradient(135deg, #43A047 0%, #1B5E20 100%)', // Emerald Green
      icon: <BarChart2 size={36} color="rgba(255,255,255,0.9)" />,
      action: () => setActiveView('analytics')
    },
    {
      id: 'calc',
      title: 'Revenue Calculator',
      desc: 'Estimate daily matrix earnings & spillover ROI',
      gradient: 'linear-gradient(135deg, #78909C 0%, #37474F 100%)', // Slate Gray
      icon: <BookOpen size={36} color="rgba(255,255,255,0.9)" />,
      action: () => setActiveView('calc')
    }
  ];

  if (activeView === 'hub') {
    return (
      <div style={{ fontFamily: 'Outfit, sans-serif', paddingBottom: '30px' }}>
        
        {/* Daily Telemetry Sync Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(32,34,37,0.85) 0%, rgba(20,22,25,0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '24px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Alien-like decorative background icon (resembling task screen) */}
          <div style={{
            position: 'absolute', top: '16px', right: '20px', fontSize: '38px', opacity: 0.25
          }}>
            👽
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <span style={{
              background: 'rgba(163,255,18,0.1)', border: '1px solid rgba(163,255,18,0.2)',
              borderRadius: '20px', padding: '3px 10px', fontSize: '9px', fontWeight: 900, color: '#A3FF12'
            }}>
              DAILY TELEMETRY
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px', padding: '3px 10px', fontSize: '9px', fontWeight: 900, color: '#fff'
            }}>
              ONCE A DAY
            </span>
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 950, color: '#fff', marginBottom: '6px' }}>
            Sync On-Chain Telemetry
          </h3>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: '16px', maxWidth: '80%' }}>
            Refresh contract balances, active node status, and team structures directly from the blockchain.
          </p>

          <button
            onClick={handleSyncTelemetry}
            disabled={refreshing}
            style={{
              width: '100%',
              background: refreshing ? 'rgba(255,255,255,0.05)' : '#fff',
              color: refreshing ? 'rgba(255,255,255,0.3)' : '#000',
              border: 'none',
              borderRadius: '16px',
              padding: '14px',
              fontSize: '13px',
              fontWeight: 900,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(255,255,255,0.05)'
            }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Syncing...' : 'Sync Telemetry'}
          </button>
        </div>

        {/* Colorful Gradient Feature Cards */}
        <h4 style={{ fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
          🎮 PLATFORM SECTOR
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {menuItems.map(item => (
            <motion.div
              key={item.id}
              whileTap={{ scale: 0.98 }}
              onClick={item.action}
              style={{
                background: item.gradient,
                borderRadius: '24px',
                padding: '20px 24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Soft background glow overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.04))',
                pointerEvents: 'none'
              }} />

              <div style={{ flex: 1, paddingRight: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 950, color: '#fff', letterSpacing: '-0.01em' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginTop: '4px', lineHeight: 1.4 }}>
                  {item.desc}
                </p>
              </div>

              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                {item.icon}
              </div>
            </motion.div>
          ))}
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Immersive Sub-Navigation Header */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(5, 8, 15, 0.6)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button
          onClick={() => setActiveView('hub')}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '8px 14px',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          <ArrowLeft size={14} /> Back to Hub
        </button>

        <span style={{ fontSize: '12px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px' }}>
          {activeView === 'dash' && 'DASHBOARD STATS'}
          {activeView === 'network' && 'MATRIX TREE'}
          {activeView === 'analytics' && 'GLOBAL STATS'}
          {activeView === 'calc' && 'ROI CALCULATOR'}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 100px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{ width: '100%' }}
          >
            {activeView === 'dash' && <DashboardScreen />}
            {activeView === 'network' && <TeamScreen />}
            {activeView === 'analytics' && <AnalyticsScreen />}
            {activeView === 'calc' && <CalculatorScreen />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
