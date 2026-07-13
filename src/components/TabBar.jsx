import { useGameStore } from '../store/gameStore.js';

export default function TabBar() {
  const { activeTab, setActiveTab, hasNode } = useGameStore();

  const TABS = [
    { id: 'prelaunch',   icon: '🚀',  label: 'Earn'    },
    { id: 'claim',       icon: '💰',  label: 'Claim'   },
    { id: 'leaderboard', icon: '🏆',  label: 'Leaders' },
    { id: 'upgrade',     icon: '⬆️',  label: 'Upgrade' },
    { id: 'profile',     icon: '👤',  label: 'Profile' },
  ];

  return (
    <nav className="rpg-chunky-tabs">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`rpg-chunky-tab-item ${activeTab === t.id ? 'active' : ''}`}
          onClick={() => setActiveTab(t.id)}
        >
          <span className="rpg-chunky-tab-icon">{t.icon}</span>
          <span className="rpg-chunky-tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
