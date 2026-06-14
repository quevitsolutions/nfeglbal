import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardScreen from './DashboardScreen.jsx';
import UpgradeScreen from './UpgradeScreen.jsx';
import TeamScreen from './TeamScreen.jsx';
import CalculatorScreen from './CalculatorScreen.jsx';
import ContractsScreen from './ContractsScreen.jsx';

const CORE_SUB_TABS = [
  { id: 'dash',      icon: '📊', label: 'Dashboard' },
  { id: 'upgrade',   icon: '🚀', label: 'Upgrade' },
  { id: 'network',   icon: '🕸️', label: 'Network' },
  { id: 'calc',      icon: '🧮', label: 'Calculator' },
  { id: 'contracts', icon: '📄', label: 'Contracts' }
];

export default function CoreHubScreen() {
  const [subTab, setSubTab] = useState('dash');

  return (
    <div className="hub-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* ═ SUB NAVIGATION BAR ═ */}
      <div className="hub-subnav-container" style={{
        padding: '12px 16px',
        background: 'rgba(5, 8, 15, 0.6)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch'
      }}>
        {CORE_SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            style={{
              background: subTab === tab.id ? 'rgba(163, 255, 18, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: subTab === tab.id ? '1px solid var(--neon-lime)' : '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '8px 16px',
              color: subTab === tab.id ? 'var(--neon-lime)' : '#fff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease-out'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═ SUB TAB CONTENT ═ */}
      <div className="hub-content" style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{ width: '100%' }}
          >
            {subTab === 'dash'      && <DashboardScreen />}
            {subTab === 'upgrade'   && <UpgradeScreen />}
            {subTab === 'network'   && <TeamScreen />}
            {subTab === 'calc'      && <CalculatorScreen />}
            {subTab === 'contracts' && <ContractsScreen />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
