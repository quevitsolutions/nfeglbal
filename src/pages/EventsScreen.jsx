/**
 * EventsScreen — MetaVerse Hub Router
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MetaverseScreen from './MetaverseScreen.jsx';
import NFEGlobalLiveScreen from './NFEGlobalLiveScreen.jsx';
import NFEGlobalAcademyScreen from './NFEGlobalAcademyScreen.jsx';
import NFEGlobalDAOScreen from './NFEGlobalDAOScreen.jsx';
import NFEGlobalRewardsScreen from './NFEGlobalRewardsScreen.jsx';
import NFEGlobalCommunityScreen from './NFEGlobalCommunityScreen.jsx';
import NFEGlobalAIHostScreen from './NFEGlobalAIHostScreen.jsx';
import VirtualHallScreen from './VirtualHallScreen.jsx';
import VirtualLobbyScreen from './VirtualLobbyScreen.jsx';

const MODULE_COMPONENTS = {
  live: NFEGlobalLiveScreen,
  academy: NFEGlobalAcademyScreen,
  dao: NFEGlobalDAOScreen,
  rewards: NFEGlobalRewardsScreen,
  community: NFEGlobalCommunityScreen,
  'ai-host': NFEGlobalAIHostScreen,
};

export default function EventsScreen() {
  const [subView, setSubView] = useState(null);
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
