import { useGameStore } from '../store/gameStore.js';

export default function TabBar() {
  const { activeTab, setActiveTab, hasNode } = useGameStore();

  const TABS = [
    { id: 'core',    icon: '📊', label: 'Core' },
    { id: 'v3',      icon: '💎', label: 'V3 Rewards' },
    { id: 'academy', icon: '📚', label: 'Academy' }
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

