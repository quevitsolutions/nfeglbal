import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import toast from 'react-hot-toast';

const SESSIONS = [
  {
    id: 1, status: 'live', title: 'AI + Passive BNB Income Masterclass',
    host: 'NFEGlobal AI Host', hostIcon: '🤖', viewers: 1240, duration: '1h 24m',
    tags: ['BNB Rewards', 'AI Strategy', 'Passive Income'],
    reward: 500, nft: 'Attendance NFT',
  },
  {
    id: 2, status: 'upcoming', title: 'DAO Treasury & Governance Deepdive',
    host: 'Community Council', hostIcon: '🏛️', viewers: 0, duration: '~2h',
    tags: ['DAO', 'Voting', 'Treasury'], scheduled: 'Tomorrow 8PM UTC',
    reward: 300, nft: 'Governance NFT',
  },
  {
    id: 3, status: 'upcoming', title: 'NFT Badge System & Tier Rewards',
    host: 'NFEGlobal Academy', hostIcon: '🎓', viewers: 0, duration: '~45m',
    tags: ['NFTs', 'Tier Rewards', 'Academy'], scheduled: 'Fri 6PM UTC',
    reward: 200, nft: 'Creator NFT',
  },
  {
    id: 4, status: 'replay', title: 'Web3 Referral Economy Blueprint',
    host: 'NFEGlobal AI Host', hostIcon: '🤖', viewers: 4820, duration: '58m',
    tags: ['Referral', 'Web3', 'Income'],
    reward: 0, nft: null,
  },
];

const POLL_OPTIONS = [
  { id: 'a', label: 'BNB Staking Rewards', votes: 342 },
  { id: 'b', label: 'NFT Marketplace', votes: 198 },
  { id: 'c', label: 'Mobile App Launch', votes: 287 },
  { id: 'd', label: 'Cross-chain Bridge', votes: 141 },
];

const AI_MESSAGES = [
  "🤖 Welcome everyone! Today we cover 5 proven strategies to earn passive BNB income.",
  "📊 Our community has distributed 12.4 BNB in the last 30 days alone!",
  "🎯 Remember — holding your Attendance NFT unlocks Tier 2 VIP rooms.",
  "🔥 Over 1,200 members are watching live right now. Incredible energy!",
  "💡 Pro tip: Activate your node today to 10x your mining rate.",
];

const CHAT_MSGS = [
  { user: '0x8f2...', msg: 'This is insane! 12 BNB in rewards already 🔥', time: '2m' },
  { user: '0xa91...', msg: 'Just activated my Tier 2 node! LFG 🚀', time: '1m' },
  { user: '0x3c4...', msg: 'AI host is so smooth, can\'t tell it\'s AI 😂', time: '45s' },
  { user: '0xf7b...', msg: 'When is the next DAO vote?', time: '20s' },
  { user: '0x1d2...', msg: 'Just earned my Attendance NFT 🏅', time: '5s' },
];

export default function NFEGlobalLiveScreen({ onBack, onEnterHall }) {
  const { hasNode, nodeTier } = useGameStore();
  const [activeSession, setActiveSession] = useState(1);
  const [tab, setTab] = useState('live');
  const [pollVoted, setPollVoted] = useState(null);
  const [pollData, setPollData] = useState(POLL_OPTIONS);
  const [aiMsgIdx, setAiMsgIdx] = useState(0);
  const [joined, setJoined] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chat, setChat] = useState(CHAT_MSGS);

  useEffect(() => {
    const iv = setInterval(() => setAiMsgIdx(i => (i + 1) % AI_MESSAGES.length), 5000);
    return () => clearInterval(iv);
  }, []);

  const session = SESSIONS.find(s => s.id === activeSession) || SESSIONS[0];

  const handleJoin = () => {
    if (!hasNode) return toast.error('🔒 Activate your node to join live sessions', { duration: 4000 });
    setJoined(true);
    toast.success('🎙️ Joined live session! You\'ll earn 500 $NFEGLOBAL on completion.', { duration: 5000 });
  };

  const handleEnterHall = () => {
    if (!hasNode) return toast.error('🔒 Activate your node to enter the Virtual Hall', { duration: 4000 });
    if (onEnterHall) onEnterHall(session);
  };

  const handleVote = (optId) => {
    if (pollVoted) return;
    setPollVoted(optId);
    setPollData(prev => prev.map(o => o.id === optId ? { ...o, votes: o.votes + 1 } : o));
    toast.success('🗳️ Vote recorded!', { duration: 2500 });
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    setChat(prev => [...prev, { user: '0xYou', msg: chatMsg, time: 'now' }]);
    setChatMsg('');
  };

  const totalVotes = pollData.reduce((s, o) => s + o.votes, 0);

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 18, width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h1 style={{ fontSize: 18, fontWeight: 900 }}>🎙️ NFEGlobal Live</h1>
            <span style={{ background: '#FF4444', color: '#fff', fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 10 }}>● LIVE</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>AI-Hosted Webinar & Masterclass Sessions</div>
        </div>
      </div>

      {/* Session Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {['live', 'upcoming', 'replay'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
              background: tab === t ? '#A3FF12' : 'rgba(255,255,255,0.05)', color: tab === t ? '#000' : 'rgba(255,255,255,0.5)' }}>
            {t === 'live' ? '🔴 Live' : t === 'upcoming' ? '📅 Upcoming' : '▶️ Replay'}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {SESSIONS.filter(s => s.status === tab || (tab === 'live' && s.status === 'live')).map(s => (
          <motion.div key={s.id} whileHover={{ scale: 1.01 }}
            onClick={() => setActiveSession(s.id)}
            style={{
              background: activeSession === s.id ? 'rgba(163,255,18,0.05)' : 'rgba(22,27,34,0.9)',
              border: activeSession === s.id ? '1px solid rgba(163,255,18,0.4)' : '1px solid rgba(255,255,255,0.05)',
              borderRadius: 16, padding: 14, cursor: 'pointer', transition: 'all 0.2s',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 4, lineHeight: 1.3 }}>{s.title}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{s.hostIcon} {s.host} · {s.status === 'live' ? `${s.viewers.toLocaleString()} watching` : s.scheduled || `${s.viewers.toLocaleString()} views`}</div>
              </div>
              <span style={{
                fontSize: 8, fontWeight: 900, padding: '3px 7px', borderRadius: 8,
                background: s.status === 'live' ? 'rgba(255,68,68,0.2)' : s.status === 'upcoming' ? 'rgba(255,215,0,0.15)' : 'rgba(79,195,247,0.15)',
                color: s.status === 'live' ? '#FF4444' : s.status === 'upcoming' ? '#FFD700' : '#4FC3F7',
                border: `1px solid ${s.status === 'live' ? 'rgba(255,68,68,0.4)' : s.status === 'upcoming' ? 'rgba(255,215,0,0.3)' : 'rgba(79,195,247,0.3)'}`,
                whiteSpace: 'nowrap',
              }}>
                {s.status === 'live' ? '● LIVE' : s.status === 'upcoming' ? '📅' : '▶ REPLAY'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {s.tags.map(tag => (
                <span key={tag} style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 8 }}>{tag}</span>
              ))}
              {s.reward > 0 && <span style={{ background: 'rgba(163,255,18,0.1)', color: '#A3FF12', fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 8 }}>+{s.reward} $NFEGLOBAL</span>}
              {s.nft && <span style={{ background: 'rgba(255,215,0,0.1)', color: '#FFD700', fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 8 }}>🏅 {s.nft}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Active Session Detail */}
      {session && session.status === 'live' && (
        <div style={{ marginBottom: 20 }}>
          {/* Stream Viewport */}
          <div style={{
            borderRadius: 18, overflow: 'hidden', marginBottom: 14, position: 'relative',
            background: 'linear-gradient(135deg, #050812 0%, #0A1628 100%)',
            border: '1px solid rgba(255,68,68,0.3)',
            aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Live indicator */}
            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '4px 10px' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF4444', boxShadow: '0 0 6px #FF4444', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 10, fontWeight: 900, color: '#FF4444' }}>LIVE</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{session.viewers.toLocaleString()}</span>
            </div>
            {/* Duration */}
            <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '4px 10px', fontSize: 10, fontWeight: 700, color: '#fff' }}>
              {session.duration}
            </div>
            {/* Center content */}
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🤖</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{session.title}</div>
              {!joined ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
                  <button onClick={handleJoin} style={{ background: '#FF4444', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 12, fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
                    ▶ Join Live Session
                  </button>
                  <button onClick={handleEnterHall}
                    style={{ background:'linear-gradient(135deg,#A3FF12,#4FC3F7)', border:'none', color:'#000', padding:'11px 28px', borderRadius:12, fontSize:13, fontWeight:900, cursor:'pointer', boxShadow:'0 4px 20px rgba(163,255,18,0.4)' }}>
                    🌐 Enter Virtual Hall
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
                  <div style={{ background: 'rgba(163,255,18,0.1)', border: '1px solid rgba(163,255,18,0.3)', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 800, color: '#A3FF12' }}>
                    ✅ You are live! Earn {session.reward} $NFEGLOBAL on completion
                  </div>
                  <button onClick={handleEnterHall}
                    style={{ background:'linear-gradient(135deg,#A3FF12,#4FC3F7)', border:'none', color:'#000', padding:'11px 28px', borderRadius:12, fontSize:13, fontWeight:900, cursor:'pointer', boxShadow:'0 4px 20px rgba(163,255,18,0.35)' }}>
                    🌐 Enter Virtual Hall →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* AI Host Message */}
          <AnimatePresence mode="wait">
            <motion.div key={aiMsgIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              style={{ background: 'rgba(0,77,64,0.3)', border: '1px solid rgba(128,203,196,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#80CBC4', fontWeight: 600 }}>
              {AI_MESSAGES[aiMsgIdx]}
            </motion.div>
          </AnimatePresence>

          {/* Live Poll */}
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 12 }}>🗳️ Live Poll — What feature next?</div>
            {pollData.map(opt => {
              const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
              const isVoted = pollVoted === opt.id;
              return (
                <div key={opt.id} onClick={() => handleVote(opt.id)}
                  style={{ marginBottom: 8, cursor: pollVoted ? 'default' : 'pointer', padding: '10px 12px', borderRadius: 10,
                    background: isVoted ? 'rgba(163,255,18,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isVoted ? 'rgba(163,255,18,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: isVoted ? 'rgba(163,255,18,0.07)' : 'rgba(255,255,255,0.03)', transition: 'width 0.5s' }} />
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: isVoted ? '#A3FF12' : '#fff' }}>{isVoted ? '✓ ' : ''}{opt.label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{pct}%</span>
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 8, fontWeight: 600 }}>{totalVotes} total votes</div>
          </div>

          {/* Live Chat */}
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 10 }}>💬 Live Chat</div>
            <div style={{ maxHeight: 140, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {chat.map((m, i) => (
                <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', display: 'flex', gap: 6 }}>
                  <span style={{ color: '#4FC3F7', fontWeight: 800, flexShrink: 0 }}>{m.user}</span>
                  <span>{m.msg}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, marginLeft: 'auto', flexShrink: 0 }}>{m.time}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 8 }}>
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                placeholder="Say something..."
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 12, outline: 'none' }} />
              <button type="submit" style={{ background: '#A3FF12', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 900, color: '#000', cursor: 'pointer' }}>↑</button>
            </form>
          </div>
        </div>
      )}

      {/* Upcoming session detail */}
      {session && session.status === 'upcoming' && (
        <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 18, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#FFD700', marginBottom: 6 }}>{session.title}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>{session.scheduled}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
            <span style={{ background: 'rgba(163,255,18,0.1)', color: '#A3FF12', fontSize: 11, fontWeight: 900, padding: '5px 12px', borderRadius: 10 }}>+{session.reward} $NFEGLOBAL</span>
            {session.nft && <span style={{ background: 'rgba(255,215,0,0.1)', color: '#FFD700', fontSize: 11, fontWeight: 900, padding: '5px 12px', borderRadius: 10 }}>🏅 {session.nft}</span>}
          </div>
          <button onClick={() => toast.success('🔔 Reminder set! We\'ll notify you before it starts.', { duration: 3000 })}
            style={{ background: '#FFD700', border: 'none', color: '#000', padding: '12px 28px', borderRadius: 12, fontSize: 13, fontWeight: 900, cursor: 'pointer', width: '100%' }}>
            🔔 Set Reminder
          </button>
        </div>
      )}
    </div>
  );
}
