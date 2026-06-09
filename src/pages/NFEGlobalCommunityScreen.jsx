import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import toast from 'react-hot-toast';

// Meeting link config — update these URLs as needed
const ROOM_LINKS = {
  auditorium:  { type: 'jitsi',    url: 'https://meet.jit.si/NFEGlobalAuditorium',      label: 'Join Live Auditorium' },
  networking:  { type: 'jitsi',    url: 'https://meet.jit.si/NFEGlobalNetworking',      label: 'Join Networking Lounge' },
  'vip-hall':  { type: 'telegram', url: 'https://t.me/+nfeglobal_vip',                  label: 'Join VIP Telegram Room' },
  'dao-room':  { type: 'telegram', url: 'https://t.me/+nfeglobal_dao',                  label: 'Join DAO Meeting' },
  'nft-gallery': { type: 'jitsi', url: 'https://meet.jit.si/NFEGlobalNFTGallery',       label: 'Enter NFT Gallery' },
  'sponsor-expo': { type: 'jitsi', url: 'https://meet.jit.si/NFEGlobalSponsorExpo',     label: 'Visit Sponsor Expo' },
};

const ROOMS = [
  { id: 'auditorium',   name: 'Main Auditorium',    icon: '🎭', capacity: 500, online: 342, desc: 'Live AI presentations & webinars',      locked: false, color: '#FF4444' },
  { id: 'networking',   name: 'Networking Lounge',  icon: '🤝', capacity: 200, online: 87,  desc: 'Meet community members',               locked: false, color: '#4FC3F7' },
  { id: 'vip-hall',     name: 'VIP Hall',           icon: '👑', capacity: 50,  online: 12,  desc: 'Exclusive Tier 3+ members only',       locked: true,  color: '#FFD700' },
  { id: 'dao-room',     name: 'DAO Meeting Room',   icon: '🏛️', capacity: 100, online: 28,  desc: 'Governance discussions & proposals',   locked: false, color: '#A3FF12' },
  { id: 'nft-gallery',  name: 'NFT Gallery',        icon: '🖼️', capacity: 150, online: 44,  desc: 'Browse & showcase NFT collections',    locked: false, color: '#CE93D8' },
  { id: 'sponsor-expo', name: 'Sponsor Expo',       icon: '🏢', capacity: 300, online: 61,  desc: 'Partner booths & product demos',       locked: false, color: '#80CBC4' },
];

const MEMBERS = [
  { addr: '0x8f2...3a1', tier: 5, nfts: 8, status: 'online', role: 'Council', avatar: '🦁' },
  { addr: '0xa91...7c2', tier: 4, nfts: 6, status: 'online', role: 'Delegate', avatar: '🐯' },
  { addr: '0x3c4...8d5', tier: 3, nfts: 4, status: 'online', role: 'Member', avatar: '🦊' },
  { addr: '0xf7b...2e8', tier: 3, nfts: 3, status: 'away', role: 'Member', avatar: '🐺' },
  { addr: '0x1d2...6a5', tier: 2, nfts: 2, status: 'online', role: 'Newcomer', avatar: '🐻' },
  { addr: '0x5c9...1b3', tier: 1, nfts: 1, status: 'online', role: 'Newcomer', avatar: '🐸' },
];

const ANNOUNCEMENTS = [
  { title: 'Webinar Tonight 8PM UTC', msg: 'AI Income Masterclass — 500 $NFEGLOBAL reward for attendance!', time: '2h ago', icon: '📢', urgent: true },
  { title: 'New DAO Proposal NFEGlobal-009', msg: 'Vote to increase referral commission to 15%. Ends in 1 day.', time: '5h ago', icon: '🗳️', urgent: false },
  { title: 'NFT Badge Drop', msg: 'Top 50 community builders receive Achievement NFT this Friday.', time: '1d ago', icon: '🏅', urgent: false },
];

const CHAT_ROOMS = [
  { id: 'general', name: '# general', online: 128 },
  { id: 'income-tips', name: '# income-tips', online: 64 },
  { id: 'bnb-strategy', name: '# bnb-strategy', online: 43 },
  { id: 'dao-discuss', name: '# dao-discuss', online: 31 },
];

const GLOBAL_CHAT = [
  { user: '🦁 0x8f2...', msg: 'Just hit 4.2 BNB this month from referrals alone 🔥', time: '1m' },
  { user: '🐯 0xa91...', msg: 'New proposal NFEGlobal-009 looks great — voting FOR', time: '3m' },
  { user: '🦊 0x3c4...', msg: 'Anyone joining the webinar tonight?', time: '5m' },
  { user: '🤖 AI Host', msg: 'Welcome to NFEGlobal Community Hub! Tonight\'s masterclass starts at 8PM UTC 🎙️', time: '10m', isAI: true },
];

export default function NFEGlobalCommunityScreen({ onBack, onNavigate }) {
  const { hasNode, nodeId, nodeTier, walletAddress } = useGameStore();
  const [tab, setTab] = useState('rooms');
  const [activeRoom, setActiveRoom] = useState(null);
  const [joinModal, setJoinModal] = useState(null); // room object shown in modal
  const [chatRoom, setChatRoom] = useState('general');
  const [chatMsg, setChatMsg] = useState('');
  const [messages, setMessages] = useState(GLOBAL_CHAT);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRoomClick = (room) => {
    if (room.id === 'sponsor-expo') {
      if (!hasNode) return toast.error('🔒 Activate your node to enter the Sponsor Expo', { duration: 4000 });
      if (onNavigate) return onNavigate('lobby');
    }
    if (room.locked && (!hasNode || nodeTier < 3)) {
      return toast.error(`👑 ${room.name} requires Tier 3+ Node`, { duration: 3500 });
    }
    if (!hasNode) return toast.error('🔒 Activate your node to enter the MetaVerse rooms', { duration: 4000 });
    setJoinModal(room);
  };

  const handleJoinMeeting = (room) => {
    const link = ROOM_LINKS[room.id];
    if (link?.url) {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
    setActiveRoom(room.id);
    setJoinModal(null);
    toast.success(`🌐 Joined ${room.name}!`, { duration: 3000 });
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    toast('👋 Left the room.', { duration: 2000 });
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    if (!hasNode) return toast.error('🔒 Join a room to chat', { duration: 2500 });
    const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '0xYou...';
    setMessages(prev => [...prev, { user: `🐼 ${shortAddr}`, msg: chatMsg, time: 'now' }]);
    setChatMsg('');
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 18, width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 900 }}>🌐 NFEGlobal Community Hub</h1>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Virtual Rooms · Networking · Sponsor Expo</div>
        </div>
      </div>

      {/* Live Count Banner */}
      <div style={{
        borderRadius: 16, padding: '12px 16px', marginBottom: 18,
        background: 'linear-gradient(135deg, rgba(74,20,140,0.6) 0%, rgba(13,17,23,0.95) 100%)',
        border: '1px solid rgba(206,147,216,0.3)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#CE93D8' }}>🌐 MetaVerse is Live</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>574 avatars active across 6 rooms</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>574</div>
          <div style={{ fontSize: 9, color: '#CE93D8', fontWeight: 700 }}>ONLINE NOW</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {['rooms', 'members', 'chat', 'announcements'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
              background: tab === t ? '#CE93D8' : 'rgba(255,255,255,0.05)', color: tab === t ? '#000' : 'rgba(255,255,255,0.5)' }}>
            {t === 'rooms' ? '🏠 Rooms' : t === 'members' ? '👥 Members' : t === 'chat' ? '💬 Chat' : '📢 News'}
          </button>
        ))}
      </div>

      {/* JOIN MEETING MODAL */}
      {joinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setJoinModal(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            style={{ background: '#161B22', border: `1px solid ${joinModal.color}60`, borderRadius: 24, padding: 28, width: '100%', maxWidth: 380, textAlign: 'center' }}>
            {/* Room icon */}
            <div style={{ width: 72, height: 72, borderRadius: 20, background: `${joinModal.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px', boxShadow: `0 0 30px ${joinModal.color}40` }}>
              {joinModal.icon}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{joinModal.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{joinModal.desc}</div>
            <div style={{ fontSize: 11, color: joinModal.color, fontWeight: 700, marginBottom: 20 }}>
              {joinModal.online} members online · {ROOM_LINKS[joinModal.id]?.type === 'telegram' ? '📩 Telegram Group' : '🎥 Jitsi Meet'}
            </div>
            {/* How it works */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>HOW TO ENTER</div>
              {ROOM_LINKS[joinModal.id]?.type === 'telegram' ? (
                <>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>1. Click <strong style={{color:'#fff'}}>Join Meeting</strong> below</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>2. Telegram opens automatically</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>3. Tap <strong style={{color:'#fff'}}>Join Group</strong> in Telegram</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>1. Click <strong style={{color:'#fff'}}>Join Meeting</strong> below</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>2. A new tab opens with the meeting room</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>3. Allow microphone/camera if prompted</div>
                </>
              )}
            </div>
            <button onClick={() => handleJoinMeeting(joinModal)}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: joinModal.color, color: '#000', fontSize: 15, fontWeight: 900, cursor: 'pointer', marginBottom: 10, boxShadow: `0 4px 20px ${joinModal.color}50` }}>
              {ROOM_LINKS[joinModal.id]?.label || 'Join Meeting'} →
            </button>
            <button onClick={() => setJoinModal(null)}
              style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
          </motion.div>
        </div>
      )}

      {/* ROOMS */}
      {tab === 'rooms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Active room banner */}
          {activeRoom && (() => {
            const r = ROOMS.find(r => r.id === activeRoom);
            const link = ROOM_LINKS[activeRoom];
            return r ? (
              <div style={{ background: `${r.color}15`, border: `1px solid ${r.color}50`, borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: r.color }}>● You are in {r.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Meeting is open in another tab</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => window.open(link?.url, '_blank', 'noopener,noreferrer')}
                    style={{ background: r.color, border: 'none', color: '#000', padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>Rejoin</button>
                  <button onClick={handleLeaveRoom}
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Leave</button>
                </div>
              </div>
            ) : null;
          })()}

          {ROOMS.map((room, i) => {
            const fillPct = Math.round((room.online / room.capacity) * 100);
            const isActive = activeRoom === room.id;
            const isLocked = room.locked && (!hasNode || nodeTier < 3);
            return (
              <motion.div key={room.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                onClick={() => handleRoomClick(room)}
                style={{
                  background: isActive ? `${room.color}12` : 'rgba(22,27,34,0.9)',
                  border: isActive ? `1px solid ${room.color}60` : isLocked ? '1px solid rgba(255,215,0,0.1)' : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 16, padding: 14, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: isActive ? `0 0 20px ${room.color}20` : 'none',
                  opacity: isLocked ? 0.55 : 1,
                }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: `${room.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    {isLocked ? '🔒' : room.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: isLocked ? 'rgba(255,255,255,0.35)' : '#fff' }}>{room.name}</span>
                      {room.locked && <span style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 6 }}>T3+</span>}
                      {isActive && <span style={{ background: 'rgba(163,255,18,0.15)', color: '#A3FF12', fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 6 }}>● HERE</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 9, color: ROOM_LINKS[room.id]?.type === 'telegram' ? '#4FC3F7' : '#CE93D8', fontWeight: 700 }}>
                        {ROOM_LINKS[room.id]?.type === 'telegram' ? '📩 Telegram' : '🎥 Jitsi'}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{room.desc}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, marginBottom: 4 }}>
                      <span style={{ color: room.color }}>{room.online} online</span>
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>/{room.capacity} capacity</span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${fillPct}%`, background: room.color, borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
                {/* Enter button shown inline */}
                {!isLocked && !isActive && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: room.color }}>Tap to Enter →</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* MEMBERS */}
      {tab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 4 }}>ONLINE — {MEMBERS.filter(m => m.status === 'online').length} members</div>
          {MEMBERS.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, position: 'relative' }}>
                {m.avatar}
                <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: m.status === 'online' ? '#A3FF12' : '#FFD700', border: '2px solid #0D1117' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{m.addr}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#4FC3F7' }}>T{m.tier}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>·</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{m.nfts} NFTs</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>·</span>
                  <span style={{ fontSize: 9, color: '#CE93D8', fontWeight: 700 }}>{m.role}</span>
                </div>
              </div>
              <button onClick={() => toast.success(`👋 Connection request sent to ${m.addr}`, { duration: 2500 })}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                Connect
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* CHAT */}
      {tab === 'chat' && (
        <div>
          {/* Room selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {CHAT_ROOMS.map(r => (
              <button key={r.id} onClick={() => setChatRoom(r.id)}
                style={{ padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
                  background: chatRoom === r.id ? '#CE93D8' : 'rgba(255,255,255,0.05)', color: chatRoom === r.id ? '#000' : 'rgba(255,255,255,0.5)' }}>
                {r.name} <span style={{ opacity: 0.6 }}>({r.online})</span>
              </button>
            ))}
          </div>
          {/* Messages */}
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 14, marginBottom: 10, maxHeight: 300, overflowY: 'auto' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: m.isAI ? '#80CBC4' : '#CE93D8', fontWeight: 800, marginBottom: 2 }}>{m.user}</div>
                <div style={{ fontSize: 12, color: m.isAI ? '#80CBC4' : 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{m.msg}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>{m.time}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
            <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder={hasNode ? `Message #${chatRoom}...` : 'Activate node to chat...'}
              disabled={!hasNode}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 12, outline: 'none' }} />
            <button type="submit" style={{ background: '#CE93D8', border: 'none', borderRadius: 12, padding: '10px 16px', fontSize: 14, fontWeight: 900, color: '#000', cursor: 'pointer' }}>↑</button>
          </form>
        </div>
      )}

      {/* ANNOUNCEMENTS */}
      {tab === 'announcements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ANNOUNCEMENTS.map((ann, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              style={{ background: 'rgba(22,27,34,0.9)', border: ann.urgent ? '1px solid rgba(255,68,68,0.3)' : '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 24 }}>{ann.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{ann.title}</span>
                    {ann.urgent && <span style={{ background: 'rgba(255,68,68,0.2)', color: '#FF4444', fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 6 }}>URGENT</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, marginBottom: 6 }}>{ann.msg}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{ann.time}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
