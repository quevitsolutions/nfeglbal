import { useEffect, useRef, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from './store/gameStore.js';
import { shortAddr } from './utils/format.js';
import { useContract, useWalletLifecycle } from './hooks/useContract.js';
import { useChainEvents } from './hooks/useChainEvents.js';
import LoginScreen from './components/LoginScreen.jsx';
import TopBar from './components/TopBar.jsx';
import TabBar from './components/TabBar.jsx';
import CoreHubScreen from './pages/CoreHubScreen.jsx';
import RegistrationModal from './components/RegistrationModal.jsx';
// V3RewardsScreen and AcademyHubScreen hidden during pre-launch
// import V3RewardsScreen from './pages/V3RewardsScreen.jsx';
// import AcademyHubScreen from './pages/AcademyHubScreen.jsx';
import PreLaunchScreen from './pages/PreLaunchScreen.jsx';
import UpgradeScreen from './pages/UpgradeScreen.jsx';
import LeaderboardScreen from './pages/LeaderboardScreen.jsx';
import ProfileScreen from './pages/ProfileScreen.jsx';
import AdminScreen from './pages/AdminScreen.jsx';
import ClaimScreen from './pages/ClaimScreen.jsx';


const NAV_ITEMS = [
  { id: 'prelaunch',   icon: '🚀', label: 'Pre-Launch Earn' },
  { id: 'claim',       icon: '💰', label: 'Claim' },
  { id: 'leaderboard', icon: '🏆', label: 'Leaderboard' },
  { id: 'upgrade',     icon: '🛍️', label: 'Node Tiers' },
  { id: 'profile',     icon: '👤', label: 'Profile' }
];

function DesktopSidebar({ activeTab, setActiveTab, nodeId, nodeTier }) {
  const tabs = [...NAV_ITEMS, { id: 'admin', icon: '⚡', label: 'Master Admin' }];

  return (
    <aside className="desktop-sidebar">
      <div className="sidebar-logo">
        <div style={{ width: 32, height: 32, background: 'var(--neon-lime)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#000' }}>A</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>AIPCORE <span style={{ fontSize: 9, color: 'var(--neon-lime)', opacity: 0.7 }}>PRO</span></div>
          {nodeId && <div style={{ fontSize: 9, color: '#A3FF12', fontWeight: 700 }}>NODE #{nodeId} · T{nodeTier}</div>}
        </div>
      </div>

      {tabs.map(item => (
        <button key={item.id} className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => setActiveTab(item.id)}>
          <span className="sidebar-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </aside>
  );
}

const TOAST_STYLE = {
  background: 'rgba(20,30,51,0.95)', color: '#fff',
  border: '1px solid rgba(203,255,1,0.2)', backdropFilter: 'blur(10px)',
  fontFamily: 'Outfit, sans-serif', fontWeight: 800, borderRadius: '14px', fontSize: '13px'
};

export default function App() {
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const {
    activeTab, setActiveTab,
    isConnected, hasNode, isFreeActive,
    rechargeEnergy,
    showNodePopup, showDailyPopup, lastClaimDate,
    setShowDailyPopup, setReferrerId,
    nodeId, nodeTier, isAdmin,
    sponsorWallet, isNewUser,
    walletAddress
  } = useGameStore();

  const { connectWallet, disconnectWallet } = useContract();
  const { setupListeners, removeListeners } = useWalletLifecycle();
  const welcomeShown = useRef(false);

  // Real-time chain event listener — pushes DB updates + toast notifications
  useChainEvents();



  // Initialize and expand Telegram WebApp if available
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      try {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      } catch (e) {
        console.error('Telegram WebApp init failed:', e);
      }
    }
  }, []);

  // Popup logic for un-activated wallets (guest operators)
  useEffect(() => {
    if (isConnected) {
      if (hasNode || isFreeActive) {
        setShowRegisterModal(false);
      } else {
        const t = setTimeout(() => {
          const s = useGameStore.getState();
          if (!s.hasNode && !s.isFreeActive) {
            setShowRegisterModal(true);
          }
        }, 1500);
        return () => clearTimeout(t);
      }
    } else {
      setShowRegisterModal(false);
    }
  }, [isConnected, hasNode, isFreeActive]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    // Accept both wallet addresses AND numeric Node IDs as referral tokens
    if (ref && /^(0x[a-fA-F0-9]{40}|\d+)$/i.test(ref)) {
      setReferrerId(ref);
      // Persist to localStorage immediately — survives MetaMask redirect & page reload
      try { localStorage.setItem('aipcore_ref', ref); } catch(e) {}
    }
  }, [setReferrerId]);

  // Show "Referred by" banner once on first connect
  useEffect(() => {
    if (!isConnected || welcomeShown.current) return;
    welcomeShown.current = true;
    if (sponsorWallet) {
      setTimeout(() => {
        toast(
          `🤝 Referred by ${shortAddr(sponsorWallet)} — Welcome to AIPCore!`,
          {
            duration: 6000,
            icon: '🔗',
            style: {
              background: 'linear-gradient(135deg, rgba(79,195,247,0.2), rgba(5,8,15,0.95))',
              border: '1px solid #4FC3F7',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
            }
          }
        );
      }, 1500);
    } else if (isNewUser) {
      setTimeout(() => {
        toast(
          '🚀 Welcome to AIPCore! Start mining and invite friends to earn more.',
          { duration: 5000, icon: '⬡', style: { background: 'rgba(203,255,1,0.1)', border: '1px solid rgba(203,255,1,0.3)', color: '#fff', fontWeight: 800, fontSize: 13 } }
        );
      }, 1500);
    }
  }, [isConnected, sponsorWallet, isNewUser]);

  useEffect(() => {
    if (!isConnected) return;
    const { fetchUserData, walletAddress } = useGameStore.getState();
    if (walletAddress) {
      useGameStore.setState({ lastBackendSync: null });
      fetchUserData().catch(() => {});
    }
  }, [isConnected]);

  // Auto-refresh user data every 30s when connected (keeps balance and stats live)
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      const { fetchUserData, walletAddress } = useGameStore.getState();
      if (walletAddress) {
        useGameStore.setState({ lastBackendSync: null });
        fetchUserData().catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Tab-switch refresh: instantly reload data when navigating to data-heavy screens
  useEffect(() => {
    if (!isConnected) return;
    const { fetchReferralData, fetchUserData, walletAddress } = useGameStore.getState();
    if (!walletAddress) return;

    if (['prelaunch', 'leaderboard', 'upgrade', 'profile'].includes(activeTab)) {
      useGameStore.setState({ lastBackendSync: null });
      fetchUserData().catch(() => {});
      fetchReferralData().catch(() => {});
    }
  }, [activeTab, isConnected]);

  if (!isConnected) {
    return (
      <div className="app-container">
        <LoginScreen onConnect={connectWallet} />
        <Toaster position="top-center" toastOptions={{ style: TOAST_STYLE }} />
      </div>
    );
  }

  // Non-activated users go directly to full app (EarnScreen has a registration gate built-in)

  return (
    <div className="app-container">
      <Toaster position="top-center" toastOptions={{ style: TOAST_STYLE }} />
      <RegistrationModal isOpen={showRegisterModal} onClose={() => setShowRegisterModal(false)} />

      {/* Desktop sidebar (hidden on mobile/tablet via CSS) */}
      <DesktopSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        nodeId={nodeId}
        nodeTier={nodeTier}
        isAdmin={isAdmin}
      />

      {/* TopBar — fixed on mobile/tablet, grid on desktop */}
      <TopBar onConnect={connectWallet} onDisconnect={disconnectWallet} />

      {/* Main content area */}
      <main className="page">


        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            {activeTab === 'prelaunch'   && <PreLaunchScreen />}
            {activeTab === 'claim'       && <ClaimScreen />}
            {activeTab === 'leaderboard' && <LeaderboardScreen />}
            {activeTab === 'upgrade'     && <UpgradeScreen />}
            {activeTab === 'profile'     && <ProfileScreen />}
            {activeTab === 'admin'       && <AdminScreen />}
          </motion.div>
        </AnimatePresence>

        {/* Scroll Spacer to prevent tabbar cut-off */}
        <div style={{ height: 'calc(var(--tabbar-h) + 24px)', flexShrink: 0 }} />
      </main>
      <TabBar />
    </div>
  );
}
