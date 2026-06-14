import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NFEGlobalDAOScreen from './NFEGlobalDAOScreen.jsx';
import NFEGlobalAcademyScreen from './NFEGlobalAcademyScreen.jsx';
import TaskScreen from './TaskScreen.jsx';
import EventsScreen from './EventsScreen.jsx';
import NFEGlobalAIHostScreen from './NFEGlobalAIHostScreen.jsx';

const ACADEMY_SUB_TABS = [
  { id: 'dao',      icon: '🏛️', label: 'Governance' },
  { id: 'academy',  icon: '📚', label: 'Academy' },
  { id: 'tasks',    icon: '✅', label: 'Tasks' },
  { id: 'events',   icon: '🎟️', label: 'Events' },
  { id: 'aihost',   icon: '🤖', label: 'AI Host' }
];

export default function AcademyHubScreen() {
  const [subTab, setSubTab] = useState('dao');

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
        {ACADEMY_SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            style={{
              background: subTab === tab.id ? 'rgba(79, 195, 247, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: subTab === tab.id ? '1px solid #4FC3F7' : '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '8px 16px',
              color: subTab === tab.id ? '#4FC3F7' : '#fff',
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
      <div className="hub-content" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{ width: '100%' }}
          >
            {subTab === 'dao'     && <NFEGlobalDAOScreen />}
            {subTab === 'academy' && <NFEGlobalAcademyScreen />}
            {subTab === 'tasks'   && <TaskScreen />}
            {subTab === 'events'  && <EventsScreen />}
            {subTab === 'aihost'  && <NFEGlobalAIHostScreen />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
