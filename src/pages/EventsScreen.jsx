/**
 * EventsScreen — MetaVerse Hub Router
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MetaverseScreen from './MetaverseScreen.jsx';
import AIPCoreLiveScreen from './AIPCoreLiveScreen.jsx';
import AIPCoreAcademyScreen from './AIPCoreAcademyScreen.jsx';
import AIPCoreDAOScreen from './AIPCoreDAOScreen.jsx';
import AIPCoreRewardsScreen from './AIPCoreRewardsScreen.jsx';
import AIPCoreCommunityScreen from './AIPCoreCommunityScreen.jsx';
import AIPCoreAIHostScreen from './AIPCoreAIHostScreen.jsx';
import VirtualHallScreen from './VirtualHallScreen.jsx';
import VirtualLobbyScreen from './VirtualLobbyScreen.jsx';

const MODULE_COMPONENTS = {
  live: AIPCoreLiveScreen,
  academy: AIPCoreAcademyScreen,
  dao: AIPCoreDAOScreen,
  rewards: AIPCoreRewardsScreen,
  community: AIPCoreCommunityScreen,
  'ai-host': AIPCoreAIHostScreen,
};

export default function EventsScreen() {
  const [subView, setSubView] = useState('community');
  const [hallEvent, setHallEvent] = useState(null); // event passed into VirtualHall

  const navigateTo = (moduleId, eventData = null) => {
    if (moduleId === 'hall') { setHallEvent(eventData); setSubView('hall'); return; }
    setSubView(moduleId);
  };
  const goBack = () => { setSubView(null); setHallEvent(null); };

  // Virtual Hall — full-screen, no wrapping page padding
  if (subView === 'hall') {
    return <VirtualHallScreen onBack={goBack} event={hallEvent} />;
  }

  // Virtual Lobby & Expo — full-screen
  if (subView === 'lobby') {
    return <VirtualLobbyScreen onBack={goBack} onNavigate={navigateTo} />;
  }

  const ActiveComponent = subView ? MODULE_COMPONENTS[subView] : null;

  return (
    <AnimatePresence mode="wait">
      {ActiveComponent ? (
        <motion.div key={subView} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.2, ease:'easeOut' }}>
          <ActiveComponent onBack={goBack} onNavigate={navigateTo} onEnterHall={(ev) => navigateTo('hall', ev)} />
        </motion.div>
      ) : (
        <motion.div key="metaverse-hub" initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }} transition={{ duration:0.2, ease:'easeOut' }}>
          <MetaverseScreen onNavigate={navigateTo} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
