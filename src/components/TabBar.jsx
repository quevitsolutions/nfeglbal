import { useGameStore } from '../store/gameStore.js';

export default function TabBar() {
  const { activeTab, setActiveTab, hasNode } = useGameStore();

  const TABS = [
    { id: 'dash',      icon: '📊', label: 'Stats' },
    { id: 'mine',      icon: '🚀', label: hasNode ? 'Upgrade' : 'Activate' },
    { id: 'team',      icon: '🕸️', label: 'Network' },
    { id: 'dao',       icon: '🏛️', label: 'DAO' },
    { id: 'contracts', icon: '📄', label: 'Contracts' },
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

