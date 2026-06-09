import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import toast from 'react-hot-toast';

/* ─── Static Data ─────────────────────────────────────────── */
const AUDIENCE = [
  { name: 'CryptoQueen', color: '#b060ff', hair: '#9400d3', skin: '#f9c9a0', tag: true, row: 0, col: 0 },
  { name: 'BlockStar',   color: '#4FC3F7', hair: '#1a3aff', skin: '#ffe0b2', tag: true,  row: 0, col: 1 },
  { name: 'AI_Explorer', color: '#A3FF12', hair: '#00c853', skin: '#c8a97e', tag: true,  row: 0, col: 2 },
  { name: 'Haydiem',     color: '#ff9800', hair: '#ff6d00', skin: '#ffcc80', tag: true,  row: 0, col: 3 },
  { name: 'Web3Warrior', color: '#ff4081', hair: '#ad1457', skin: '#ffe0b2', tag: false, row: 0, col: 4 },
  { name: 'DeFi_Guru',   color: '#00e5ff', hair: '#0097a7', skin: '#d7ccc8', tag: false, row: 1, col: 0 },
  { name: 'EtherSurfer', color: '#ffab40', hair: '#f57c00', skin: '#f9c9a0', tag: false, row: 1, col: 1 },
  { name: 'NodeMaster',  color: '#b2ff59', hair: '#33691e', skin: '#c8a97e', tag: false, row: 1, col: 2 },
  { name: 'AlphaBuilder',color: '#ea80fc', hair: '#7b1fa2', skin: '#ffe0b2', tag: false, row: 1, col: 3 },
  { name: 'NFT_Queen',   color: '#ff6e40', hair: '#bf360c', skin: '#d7ccc8', tag: false, row: 1, col: 4 },
];

const CHAT_INIT = [
  { user: 'Emma Blockchain', msg: 'Amazing event! 🚀',                  color: '#4FC3F7', emoji: '🦊' },
  { user: 'DeFi Hunter',     msg: 'The future is here! 💜',              color: '#b060ff', emoji: '🐯' },
  { user: 'MoonBuilder',     msg: 'Love the AI avatar host!',            color: '#A3FF12', emoji: '🌙' },
  { user: 'Web3Max',         msg: 'Great insights so far 🔥',            color: '#ff9800', emoji: '🦁' },
  { user: 'StakingKing',     msg: 'This is next level! 🔥',              color: '#00e5ff', emoji: '👑' },
  { user: 'NFT Queen',       msg: "Super excited for what's coming next! 📣", color: '#ff4081', emoji: '🌸' },
];

const REACTIONS = [
  { icon: '👏', label: 'Clap',    count: 4800  },
  { icon: '😍', label: 'Love',    count: 3200  },
  { icon: '🚀', label: 'Rocket',  count: 12500 },
  { icon: '🔥', label: 'Fire',    count: 8400  },
  { icon: '🎉', label: 'Party',   count: 6100  },
  { icon: '👍', label: 'Like',    count: 5200  },
];

const NAV_ITEMS = [
  { id: 'lobby',    icon: '🏠', label: 'Lobby'         },
  { id: 'main-hall',icon: '🏟️', label: 'Main Hall'     },
  { id: 'sponsors', icon: '🏢', label: 'Sponsor Halls' },
  { id: 'network',  icon: '🤝', label: 'Network Lounge'},
  { id: 'expo',     icon: '🖼️', label: 'Expo Zone'     },
  { id: 'avatar',   icon: '🧑‍💻', label: 'My Avatar'    },
  { id: 'wallet',   icon: '💳', label: 'Wallet'        },
];

const SLIDES = [
  {
    title: 'The Future of\nAI-Powered Communities',
    sub: 'Connecting People, Intelligence\nand Opportunities in Web3',
    url: 'nfeglobal.online',
    bullets: [
      { icon: '🤖', text: 'AI Avatar Interaction' },
      { icon: '🔐', text: 'Decentralized Identity' },
      { icon: '🌐', text: 'Smart Communities' },
      { icon: '🔗', text: 'Global Networking' },
    ],
  },
  {
    title: 'Node Activation &\nRewards Ecosystem',
    sub: 'Fueling decentralized computational\nworkflows with $NFEGLOBAL',
    url: 'nfeglobal.online/nodes',
    bullets: [
      { icon: '⛏️', text: 'Computational Mining Pools' },
      { icon: '💰', text: 'Passive BNB Distribution' },
      { icon: '🚀', text: 'Tier-Based Boost Multipliers' },
      { icon: '⚡', text: 'Instant Rewards Claim' },
    ],
  },
];

const MAP_ZONES = [
  { label: 'Main Hall',     active: true  },
  { label: 'Sponsor Halls', active: false },
  { label: 'Expo Zone',     active: false },
  { label: 'Lounge Area',   active: false },
  { label: 'Networking',    active: false },
];

const AGENDA = [
  { time: '10:00 AM', title: 'Opening Remarks & Vision Keynote',         desc: 'Setting the stage for decentralized intelligence.' },
  { time: '10:30 AM', title: 'Unveiling NFEGlobal AI Host Core Integration',   desc: 'Deep dive into LLM automation via on-chain mining nodes.' },
  { time: '11:15 AM', title: 'Sustainable BNB Passive Income',           desc: 'Panel debate on high-efficiency yield systems.' },
  { time: '12:00 PM', title: 'Community DAO Governance Roundtable',      desc: 'Decentralized voting mechanisms and proposal frameworks.' },
];

const SPEAKERS = [
  { name: 'Dr. Alexis Vance', role: 'Lead AI Scientist, NFEGlobal Core',  bio: 'Pioneering decentralization of NLP and deep learning on EVM.', emoji: '🧑‍💻' },
  { name: 'Emma Blockchain',  role: 'Founder, Web3 Growth',          bio: 'Advising top decentralized communities on sustainable mining.', emoji: '👩‍💼' },
  { name: 'NFEGlobal AI Host',      role: 'Autonomous Synthesized Presenter', bio: '24/7 fully synthetic presenter generating live knowledge.', emoji: '🤖' },
];

const fmtNum = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n;
const fmtAddr = (a) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '0x7A3F...98de';

/* ─── Avatar SVG component ───────────────────────────────── */
function AudienceAvatar({ person, size = 48, showTag = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
      {showTag && (
        <div style={{
          background: 'rgba(0,0,0,0.75)', border: `1px solid ${person.color}60`,
          borderRadius: 6, padding: '2px 6px', fontSize: 8, fontWeight: 800,
          color: person.color, whiteSpace: 'nowrap', marginBottom: 2,
        }}>{person.name}{person.tag && <span style={{ color: '#4FC3F7', marginLeft: 3 }}>✔</span>}</div>
      )}
      <svg width={size} height={size * 1.4} viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Hair */}
        <ellipse cx="20" cy="10" rx="12" ry="10" fill={person.hair} />
        <rect x="8" y="8" width="24" height="12" rx="2" fill={person.hair} />
        {/* Face */}
        <ellipse cx="20" cy="17" rx="9" ry="10" fill={person.skin} />
        {/* Eyes */}
        <circle cx="16.5" cy="16" r="1.5" fill="#1a1a2e" />
        <circle cx="23.5" cy="16" r="1.5" fill="#1a1a2e" />
        <circle cx="17" cy="15.5" r="0.5" fill="#fff" />
        <circle cx="24" cy="15.5" r="0.5" fill="#fff" />
        {/* Mouth */}
        <path d="M17 21 Q20 23.5 23 21" stroke="#666" strokeWidth="0.8" fill="none" />
        {/* Body */}
        <rect x="11" y="27" width="18" height="22" rx="4" fill={person.color} opacity="0.9" />
        {/* Collar/shirt detail */}
        <path d="M18 27 L20 31 L22 27" fill="rgba(255,255,255,0.25)" />
        {/* Arms */}
        <rect x="5" y="28" width="7" height="14" rx="3" fill={person.color} opacity="0.8" />
        <rect x="28" y="28" width="7" height="14" rx="3" fill={person.color} opacity="0.8" />
        {/* Legs */}
        <rect x="12" y="48" width="6" height="7" rx="2" fill={person.color} opacity="0.7" />
        <rect x="22" y="48" width="6" height="7" rx="2" fill={person.color} opacity="0.7" />
      </svg>
    </div>
  );
}

/* ─── AI Host SVG ────────────────────────────────────────── */
function AIHostAvatar({ size = 120 }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 80 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Hair */}
      <ellipse cx="40" cy="18" rx="18" ry="15" fill="#1a1a2e" />
      <rect x="22" y="14" width="36" height="18" rx="2" fill="#1a1a2e" />
      {/* Face */}
      <ellipse cx="40" cy="30" rx="16" ry="17" fill="#d4a574" />
      {/* Eyes */}
      <ellipse cx="33" cy="28" rx="4" ry="3.5" fill="#fff" />
      <ellipse cx="47" cy="28" rx="4" ry="3.5" fill="#fff" />
      <circle cx="33" cy="28" r="2.2" fill="#1a1a3e" />
      <circle cx="47" cy="28" r="2.2" fill="#1a1a3e" />
      <circle cx="34" cy="27" r="0.8" fill="#fff" />
      <circle cx="48" cy="27" r="0.8" fill="#fff" />
      {/* Eyebrows */}
      <path d="M29 23.5 Q33 22 37 23.5" stroke="#1a1a2e" strokeWidth="1.2" fill="none" />
      <path d="M43 23.5 Q47 22 51 23.5" stroke="#1a1a2e" strokeWidth="1.2" fill="none" />
      {/* Nose */}
      <path d="M38 32 Q40 36 42 32" stroke="#b8866a" strokeWidth="0.8" fill="none" />
      {/* Mouth */}
      <path d="M35 40 Q40 44 45 40" stroke="#8a5a4a" strokeWidth="1.5" fill="rgba(180,80,60,0.3)" />
      {/* Suit body */}
      <rect x="18" y="47" width="44" height="72" rx="8" fill="#0d1a2e" />
      {/* Suit lapels */}
      <path d="M36 47 L40 62 L44 47" fill="#152040" />
      <path d="M36 47 L28 60 L36 70 L40 62" fill="#1a2a4a" />
      <path d="M44 47 L52 60 L44 70 L40 62" fill="#1a2a4a" />
      {/* NFEGlobal logo on chest */}
      <circle cx="40" cy="78" r="8" fill="none" stroke="#4FC3F7" strokeWidth="1.5" />
      <text x="40" y="81" textAnchor="middle" fontSize="7" fill="#4FC3F7" fontWeight="bold">NFEGlobal</text>
      {/* Arms */}
      <rect x="4" y="48" width="15" height="35" rx="6" fill="#0d1a2e" />
      <rect x="61" y="48" width="15" height="35" rx="6" fill="#0d1a2e" />
      {/* Right hand gesture - pointing out */}
      <ellipse cx="70" cy="83" rx="7" ry="5" fill="#d4a574" />
      {/* Legs */}
      <rect x="20" y="118" width="16" height="9" rx="4" fill="#0a1525" />
      <rect x="44" y="118" width="16" height="9" rx="4" fill="#0a1525" />
    </svg>
  );
}

/* ─── NFEGlobal Logo SVG ────────────────────────────────────────── */
function NFEGlobalLogo({ size = 80 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="38" fill="none" stroke="#4FC3F7" strokeWidth="1.5" opacity="0.6" />
      <circle cx="40" cy="40" r="30" fill="none" stroke="#6ab0e0" strokeWidth="0.8" opacity="0.4" />
      <circle cx="40" cy="40" r="34" fill="rgba(79,195,247,0.05)" />
      {/* Glowing A triangle */}
      <path d="M40 14 L62 58 L18 58 Z" fill="none" stroke="#4FC3F7" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M40 22 L56 54 L24 54 Z" fill="rgba(79,195,247,0.15)" />
      <line x1="30" y1="46" x2="50" y2="46" stroke="#4FC3F7" strokeWidth="2" />
      {/* Center glow */}
      <circle cx="40" cy="40" r="4" fill="#4FC3F7" opacity="0.8" />
    </svg>
  );
}

/* ─── Radar Map ────────────────────────────────────────────── */
function RadarMap() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="38" fill="rgba(163,255,18,0.04)" stroke="rgba(163,255,18,0.25)" strokeWidth="1" />
      <circle cx="40" cy="40" r="26" fill="none" stroke="rgba(163,255,18,0.18)" strokeWidth="1" strokeDasharray="4 3" />
      <circle cx="40" cy="40" r="14" fill="rgba(79,195,247,0.08)" stroke="rgba(163,255,18,0.35)" strokeWidth="1" />
      {/* Radar sweep — static representation */}
      <line x1="40" y1="40" x2="72" y2="22" stroke="rgba(163,255,18,0.6)" strokeWidth="1.5" />
      <path d="M40 40 L72 22 A38 38 0 0 0 70 56 Z" fill="rgba(163,255,18,0.07)" />
      {/* Cross hairs */}
      <line x1="40" y1="2" x2="40" y2="78" stroke="rgba(163,255,18,0.12)" strokeWidth="0.8" />
      <line x1="2" y1="40" x2="78" y2="40" stroke="rgba(163,255,18,0.12)" strokeWidth="0.8" />
      {/* Dots for zones */}
      <circle cx="40" cy="40" r="3.5" fill="#A3FF12" />
      <circle cx="62" cy="30" r="2.5" fill="#4FC3F7" />
      <circle cx="20" cy="55" r="2" fill="#b060ff" opacity="0.8" />
      <circle cx="55" cy="60" r="2" fill="#ff9800" opacity="0.8" />
      <circle cx="18" cy="25" r="2" fill="#A3FF12" opacity="0.6" />
    </svg>
  );
}

/* ─── Stage Background ────────────────────────────────────── */
function StageBG() {
  return (
    <svg
      width="100%" height="100%" viewBox="0 0 900 440"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Dark background */}
      <rect width="900" height="440" fill="#060c18" />

      {/* Concentric rings - top center glow */}
      <ellipse cx="450" cy="120" rx="340" ry="100" fill="none" stroke="rgba(79,195,247,0.12)" strokeWidth="1" />
      <ellipse cx="450" cy="120" rx="260" ry="75" fill="none" stroke="rgba(79,195,247,0.16)" strokeWidth="1.5" />
      <ellipse cx="450" cy="120" rx="180" ry="52" fill="none" stroke="rgba(79,195,247,0.22)" strokeWidth="2" />
      <ellipse cx="450" cy="120" rx="100" ry="30" fill="rgba(79,195,247,0.06)" stroke="rgba(79,195,247,0.3)" strokeWidth="2" />

      {/* Ceiling lights arcs */}
      <ellipse cx="450" cy="60" rx="420" ry="60" fill="none" stroke="rgba(100,180,255,0.06)" strokeWidth="1" />
      <ellipse cx="450" cy="80" rx="380" ry="50" fill="none" stroke="rgba(163,255,18,0.05)" strokeWidth="1" />

      {/* Neon strip lights on ceiling */}
      <line x1="100" y1="70" x2="380" y2="50" stroke="rgba(79,195,247,0.3)" strokeWidth="1.5" />
      <line x1="800" y1="70" x2="520" y2="50" stroke="rgba(79,195,247,0.3)" strokeWidth="1.5" />
      <line x1="60" y1="90" x2="340" y2="65" stroke="rgba(79,195,247,0.15)" strokeWidth="1" />
      <line x1="840" y1="90" x2="560" y2="65" stroke="rgba(79,195,247,0.15)" strokeWidth="1" />

      {/* Purple accent strips */}
      <line x1="150" y1="82" x2="320" y2="68" stroke="rgba(160,80,255,0.35)" strokeWidth="2" />
      <line x1="750" y1="82" x2="580" y2="68" stroke="rgba(160,80,255,0.35)" strokeWidth="2" />

      {/* Stage platform - perspective trapezoid */}
      <path d="M220 310 L680 310 L760 440 L140 440 Z" fill="rgba(8,20,40,0.95)" stroke="rgba(79,195,247,0.2)" strokeWidth="1" />
      {/* Stage shine lines */}
      <line x1="220" y1="310" x2="140" y2="440" stroke="rgba(79,195,247,0.15)" strokeWidth="1" />
      <line x1="680" y1="310" x2="760" y2="440" stroke="rgba(79,195,247,0.15)" strokeWidth="1" />
      {/* Stage front edge glow */}
      <line x1="220" y1="310" x2="680" y2="310" stroke="rgba(163,255,18,0.5)" strokeWidth="2" />
      {/* Neon runway lines on stage */}
      <line x1="380" y1="310" x2="340" y2="440" stroke="rgba(163,255,18,0.2)" strokeWidth="1.5" />
      <line x1="520" y1="310" x2="560" y2="440" stroke="rgba(163,255,18,0.2)" strokeWidth="1.5" />
      <line x1="450" y1="310" x2="450" y2="440" stroke="rgba(163,255,18,0.15)" strokeWidth="2" />

      {/* Audience seating perspective */}
      {/* Row 1 floor */}
      <line x1="0" y1="380" x2="900" y2="380" stroke="rgba(79,195,247,0.06)" strokeWidth="1" />
      <line x1="0" y1="340" x2="900" y2="340" stroke="rgba(79,195,247,0.04)" strokeWidth="1" />

      {/* Floor grid */}
      {[0,1,2,3,4,5].map(i => (
        <line key={i} x1={i * 150} y1="310" x2={i * 120 + 60} y2="440"
          stroke="rgba(79,195,247,0.04)" strokeWidth="1" />
      ))}

      {/* Side wall panels */}
      <rect x="0" y="0" width="100" height="440" fill="rgba(5,10,22,0.6)" />
      <rect x="800" y="0" width="100" height="440" fill="rgba(5,10,22,0.6)" />
      {/* Wall tech lines */}
      <line x1="80" y1="20" x2="80" y2="440" stroke="rgba(79,195,247,0.1)" strokeWidth="1" />
      <line x1="820" y1="20" x2="820" y2="440" stroke="rgba(79,195,247,0.1)" strokeWidth="1" />

      {/* Ambient glow underneath stage */}
      <ellipse cx="450" cy="310" rx="200" ry="12" fill="rgba(163,255,18,0.08)" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function VirtualHallScreen({ onBack, event }) {
  const { walletAddress } = useGameStore();

  const [activeTab,      setActiveTab]      = useState('main-hall');
  const [voiceActive,    setVoiceActive]    = useState(false);
  const [handRaised,     setHandRaised]     = useState(false);
  const [chatInput,      setChatInput]      = useState('');
  const [messages,       setMessages]       = useState(CHAT_INIT);
  const [rxCounts,       setRxCounts]       = useState(() =>
    Object.fromEntries(REACTIONS.map(r => [r.icon, r.count]))
  );
  const [floaters,       setFloaters]       = useState([]);
  const [overlay,        setOverlay]        = useState(null);
  const [slideIdx,       setSlideIdx]       = useState(0);
  const [waveTick,       setWaveTick]       = useState(0);
  const [attendees,      setAttendees]      = useState(1248);
  const [chatVisible,    setChatVisible]    = useState(true);
  const [rxVisible,      setRxVisible]      = useState(true);
  const chatEndRef = useRef(null);

  /* auto-scroll chat */
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* waveform animation */
  useEffect(() => {
    const iv = setInterval(() => setWaveTick(t => t + 1), 140);
    return () => clearInterval(iv);
  }, []);

  /* slide cycle */
  useEffect(() => {
    const iv = setInterval(() => setSlideIdx(i => (i + 1) % SLIDES.length), 14000);
    return () => clearInterval(iv);
  }, []);

  /* random attendee count drift */
  useEffect(() => {
    const iv = setInterval(() => {
      setAttendees(n => n + Math.floor(Math.random() * 3 - 1));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  /* periodic auto-chat messages */
  useEffect(() => {
    const bots = [
      { user: 'CryptoNinja',  msg: 'This AI host is incredible 🔥', color: '#A3FF12', emoji: '🥷' },
      { user: 'QuantumNode',  msg: 'Node rewards just hit! 💰',      color: '#4FC3F7', emoji: '⚡' },
      { user: 'MoonMiner',    msg: 'Best summit in Web3 history 🚀',  color: '#b060ff', emoji: '🌕' },
      { user: 'BlockBoss',    msg: 'NFEGlobal is the future 🌐',           color: '#ff9800', emoji: '💎' },
    ];
    let i = 0;
    const iv = setInterval(() => {
      const bot = bots[i % bots.length];
      setMessages(prev => [...prev.slice(-20), { ...bot, isBot: true }]);
      i++;
    }, 6000);
    return () => clearInterval(iv);
  }, []);

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const addr = walletAddress ? `${walletAddress.slice(0,6)}...` : '0xYou';
    setMessages(prev => [...prev, { user: addr, msg: chatInput, color: '#A3FF12', emoji: '🐼' }]);
    setChatInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, {
        user: '🤖 NFEGlobal AI Host', msg: 'Thanks for engaging! Raise your hand if you have a live question.',
        color: '#4FC3F7', emoji: '🤖', isAI: true
      }]);
    }, 2200);
  };

  const handleReaction = (icon) => {
    setRxCounts(p => ({ ...p, [icon]: p[icon] + 1 }));
    const id = Date.now() + Math.random();
    setFloaters(p => [...p, { id, icon, x: 15 + Math.random() * 70 }]);
    setTimeout(() => setFloaters(p => p.filter(f => f.id !== id)), 2800);
  };

  const slide = SLIDES[slideIdx];

  const waveHeights = Array.from({ length: 18 }, (_, i) =>
    Math.max(3, Math.abs(Math.sin((waveTick + i * 1.7) * 0.6) * 18) + 3)
  );

  return (
    <div style={{
      width: '100%', height: '100vh', background: '#05070F', color: '#fff',
      fontFamily: 'Outfit, sans-serif', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'fixed', inset: 0, zIndex: 200,
    }}>

      {/* ══════════ KEYFRAMES ══════════ */}
      <style>{`
        @keyframes radarSpin { to { transform: rotate(360deg); } }
        @keyframes livePulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        @keyframes waveBar  { 0%,100%{transform:scaleY(0.4);} 50%{transform:scaleY(1);} }
        @keyframes float3d  { 0%,100%{transform:translateY(0px);} 50%{transform:translateY(-6px);} }
        @keyframes glow     { 0%,100%{box-shadow:0 0 20px rgba(79,195,247,0.3);} 50%{box-shadow:0 0 40px rgba(79,195,247,0.7);} }
        @keyframes logoPulse{ 0%,100%{opacity:0.8;} 50%{opacity:1;} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
        @keyframes scanline { 0%{top:-20%;} 100%{top:120%;} }
        @keyframes orbitRing{ to{transform:rotate(360deg);} }
        .vh-tab-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .vh-nav-btn:hover { background: rgba(255,255,255,0.06) !important; }
        .vh-react-btn:hover { transform:scale(1.12); border-color:rgba(255,255,255,0.3) !important; }
        .vh-qnav-btn:hover { border-color:#A3FF12 !important; background:rgba(163,255,18,0.06) !important; }
        .vh-ctrl-btn:hover { background: rgba(255,255,255,0.1) !important; }
      `}</style>

      {/* ══════════ TOP NAVBAR ══════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'rgba(5,7,15,0.97)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 16px', height: 52, flexShrink: 0, zIndex: 10,
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 18 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #4FC3F7 0%, #A3FF12 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 900, color: '#000', flexShrink: 0,
          }}>A</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', lineHeight: 1.2, letterSpacing: 0.5 }}>NFEGlobal CORE</div>
            <div style={{ fontSize: 7.5, color: '#4FC3F7', fontWeight: 700, letterSpacing: 1.8 }}>AI · WEB3 · COMMUNITY</div>
          </div>
        </div>

        {/* Navigation tabs */}
        <div style={{ display: 'flex', flex: 1, gap: 2 }}>
          {NAV_ITEMS.map(t => (
            <button key={t.id}
              className="vh-tab-btn"
              onClick={() => {
                setActiveTab(t.id);
                if (t.id === 'lobby') onBack();
              }}
              style={{
                background: activeTab === t.id ? 'rgba(79,195,247,0.12)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === t.id ? '2px solid #4FC3F7' : '2px solid transparent',
                color: activeTab === t.id ? '#4FC3F7' : 'rgba(255,255,255,0.55)',
                padding: '0 12px', height: 52, fontSize: 11, fontWeight: 800,
                cursor: 'pointer', transition: 'all 0.18s', whiteSpace: 'nowrap',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* User Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 12 }}>
          {/* Avatar circle */}
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4FC3F7, #b060ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, border: '2px solid rgba(79,195,247,0.4)',
          }}>🧑</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700 }}>{fmtAddr(walletAddress)}</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>John Web3</div>
            <div style={{ fontSize: 8.5, color: '#A3FF12', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#A3FF12', display: 'inline-block', animation: 'livePulse 2s infinite' }} />
              Online
            </div>
          </div>
          <button style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700,
            padding: '4px 8px', cursor: 'pointer',
          }}>▾</button>
        </div>
      </div>

      {/* ══════════ THREE-COLUMN BODY ══════════ */}
      <div style={{
        display: 'grid', gridTemplateColumns: '240px 1fr 290px',
        flex: 1, overflow: 'hidden', gap: 0,
      }}>

        {/* ───────── LEFT PANEL ───────── */}
        <div style={{
          borderRight: '1px solid rgba(255,255,255,0.06)',
          overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
          background: 'rgba(5,7,15,0.7)',
        }}>

          {/* Summit info card */}
          <div style={{
            background: 'linear-gradient(145deg,#0e1523 0%,#080e1a 100%)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 14,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{
                background: 'rgba(255,60,60,0.15)', border: '1px solid #ff4444',
                color: '#ff5555', fontSize: 8, fontWeight: 900, padding: '2px 7px',
                borderRadius: 6, letterSpacing: 0.5, animation: 'livePulse 1.5s infinite',
              }}>● LIVE NOW</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>
                👥 {attendees.toLocaleString()}
              </span>
            </div>

            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', lineHeight: 1.3, marginBottom: 4 }}>
              NFEGlobal CORE GLOBAL SUMMIT
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.45, marginBottom: 10 }}>
              The Future of AI, Web3 and Decentralized Communities
            </div>

            <div style={{ fontSize: 9, color: '#A3FF12', fontWeight: 800, marginBottom: 3 }}>
              Event Time
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginBottom: 12 }}>
              May 31, 2025 | 10:00 AM UTC
            </div>

            <button onClick={() => setOverlay('agenda')} style={{
              width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#4FC3F7,#b060ff)',
              color: '#fff', fontSize: 11, fontWeight: 900, cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(79,195,247,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              📅 Event Agenda
            </button>
          </div>

          {/* Sub-navigation */}
          <div style={{
            background: 'rgba(14,20,35,0.6)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            {[
              { id: 'about',    icon: 'ℹ️',  label: 'About Event' },
              { id: 'speakers', icon: '👥',  label: 'Speakers' },
              { id: 'schedule', icon: '📅',  label: 'Schedule' },
              { id: 'support',  icon: '🛠️', label: 'Support' },
            ].map((item, i) => (
              <button key={item.id}
                className="vh-nav-btn"
                onClick={() => setOverlay(item.id === 'about' ? 'about' : item.id)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 14px', background: 'transparent', border: 'none',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{item.icon}</span> {item.label}
                </span>
                <span style={{ opacity: 0.5 }}>›</span>
              </button>
            ))}
          </div>

          {/* Hall Map */}
          <div style={{
            background: 'rgba(14,20,35,0.6)', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 14, padding: 12,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
            }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>
                Hall Map
              </span>
              <span style={{ fontSize: 8, color: '#A3FF12', fontWeight: 800 }}>▲</span>
            </div>

            {/* Radar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                <RadarMap />
                {/* Spinning sweep */}
                <div style={{
                  position: 'absolute', inset: 0,
                  animation: 'radarSpin 5s linear infinite',
                  transformOrigin: 'center',
                  pointerEvents: 'none',
                }}>
                  <svg width="80" height="80" viewBox="0 0 80 80">
                    <path d="M40 40 L78 40 A38 38 0 0 0 72 18 Z" fill="rgba(163,255,18,0.12)" />
                    <line x1="40" y1="40" x2="78" y2="40" stroke="rgba(163,255,18,0.7)" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#fff' }}>NFEGlobal Core Arena</div>
                <div style={{ fontSize: 8, color: '#A3FF12', marginTop: 2 }}>Concentric Zone A</div>
              </div>
            </div>

            {/* Zone list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {MAP_ZONES.map(z => (
                <div key={z.label}
                  onClick={() => z.label !== 'Main Hall' && toast.success(`🗺️ Navigating to ${z.label}...`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px',
                    borderRadius: 8, cursor: 'pointer',
                    background: z.active ? 'rgba(79,195,247,0.12)' : 'transparent',
                    border: z.active ? '1px solid rgba(79,195,247,0.3)' : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: z.active ? '#4FC3F7' : 'rgba(255,255,255,0.2)',
                    boxShadow: z.active ? '0 0 6px #4FC3F7' : 'none',
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    color: z.active ? '#4FC3F7' : 'rgba(255,255,255,0.55)',
                  }}>{z.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ───────── CENTER PANEL (STAGE) ───────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: '#060c18', position: 'relative',
        }}>

          {/* Floating reactions */}
          <AnimatePresence>
            {floaters.map(f => (
              <motion.div key={f.id}
                initial={{ opacity: 1, y: 0, x: `${f.x}%`, scale: 1 }}
                animate={{ opacity: 0, y: -140, scale: 2.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.5, ease: 'easeOut' }}
                style={{ position: 'absolute', pointerEvents: 'none', zIndex: 20, fontSize: 28, bottom: 80 }}>
                {f.emoji || f.icon}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Stage header text */}
          <div style={{
            textAlign: 'center', padding: '10px 20px 4px',
            borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
          }}>
            <div style={{
              fontSize: 22, fontWeight: 900, letterSpacing: 3,
              background: 'linear-gradient(90deg,#4FC3F7,#fff,#4FC3F7)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>NFEGlobal CORE</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: 3 }}>
              BUILDING THE DECENTRALIZED FUTURE
            </div>
          </div>

          {/* ── IMMERSIVE STAGE AREA ── */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <StageBG />

            {/* ── PRESENTATION SCREEN on stage ── */}
            <div style={{
              position: 'absolute', top: '5%', left: '6%',
              width: '50%', zIndex: 5,
            }}>
              <AnimatePresence mode="wait">
                <motion.div key={slideIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.6 }}
                  style={{
                    background: 'linear-gradient(145deg,rgba(6,14,30,0.92) 0%,rgba(3,8,20,0.96) 100%)',
                    border: '1px solid rgba(79,195,247,0.25)',
                    borderRadius: 14, padding: '16px 18px',
                    boxShadow: '0 0 40px rgba(79,195,247,0.12), inset 0 0 20px rgba(79,195,247,0.04)',
                  }}>
                  {/* Screen top bar */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg,transparent,#4FC3F7,transparent)',
                    borderRadius: '14px 14px 0 0',
                  }} />

                  {/* Slide title */}
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1.25, marginBottom: 6, whiteSpace: 'pre-line' }}>
                    {slide.title}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.45, marginBottom: 11, whiteSpace: 'pre-line' }}>
                    {slide.sub}
                  </div>

                  {/* Bullets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                    {slide.bullets.map((b, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: 'rgba(79,195,247,0.12)', border: '1px solid rgba(79,195,247,0.25)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0,
                        }}>{b.icon}</div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>{b.text}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{slide.url}</div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── NFEGlobal LOGO CIRCLE (right side of screen) ── */}
            <div style={{
              position: 'absolute', top: '8%', right: '10%',
              zIndex: 5, animation: 'logoPulse 4s infinite',
            }}>
              {/* Outer orbit ring */}
              <div style={{
                position: 'absolute', inset: -16, borderRadius: '50%',
                border: '1px dashed rgba(79,195,247,0.25)',
                animation: 'orbitRing 12s linear infinite',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%,-50%)',
                  width: 7, height: 7, borderRadius: '50%', background: '#4FC3F7',
                }} />
              </div>
              <div style={{
                position: 'absolute', inset: -8, borderRadius: '50%',
                border: '1px solid rgba(79,195,247,0.18)',
                animation: 'orbitRing 8s linear infinite reverse',
              }}>
                <div style={{
                  position: 'absolute', bottom: 0, left: '50%', transform: 'translate(-50%,50%)',
                  width: 5, height: 5, borderRadius: '50%', background: '#b060ff',
                }} />
              </div>
              <NFEGlobalLogo size={90} />
            </div>

            {/* ── AI HOST AVATAR on stage ── */}
            <div style={{
              position: 'absolute', bottom: '18%',
              left: '50%', transform: 'translateX(-50%)',
              zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'center',
              animation: 'float3d 4s ease-in-out infinite',
            }}>
              {/* Glow under feet */}
              <div style={{
                position: 'absolute', bottom: 0,
                width: 80, height: 20, borderRadius: '50%',
                background: 'radial-gradient(ellipse,rgba(79,195,247,0.35) 0%,transparent 70%)',
              }} />
              <AIHostAvatar size={110} />

              {/* NFEGlobal CORE AI HOST badge */}
              <div style={{
                marginTop: 6, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(79,195,247,0.5)', borderRadius: 10,
                padding: '5px 14px', textAlign: 'center',
                boxShadow: '0 0 20px rgba(79,195,247,0.2)',
              }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: '#4FC3F7', letterSpacing: 1.5 }}>
                  NFEGlobal CORE AI HOST
                </div>
                {/* Waveform */}
                <div style={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center', height: 14, marginTop: 4 }}>
                  {waveHeights.map((h, i) => (
                    <div key={i} style={{
                      width: 2.5, height: h,
                      background: `linear-gradient(180deg,#A3FF12,#4FC3F7)`,
                      borderRadius: 1.5, transition: 'height 0.13s ease',
                    }} />
                  ))}
                </div>
              </div>
            </div>

            {/* ── AUDIENCE ROWS ── */}
            {/* Row 1 — back row */}
            <div style={{
              position: 'absolute', bottom: '36%',
              left: 0, right: 0,
              display: 'flex', justifyContent: 'space-around',
              alignItems: 'flex-end', padding: '0 4%',
              zIndex: 3, transform: 'scale(0.72)', transformOrigin: 'bottom center',
            }}>
              {AUDIENCE.slice(0, 5).map((p, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {p.tag && (
                    <div style={{
                      background: 'rgba(0,0,0,0.75)', border: `1px solid ${p.color}70`,
                      borderRadius: 5, padding: '2px 7px', fontSize: 7.5, fontWeight: 800,
                      color: p.color, whiteSpace: 'nowrap', marginBottom: 3,
                    }}>{p.name} <span style={{ color: '#4FC3F7', fontSize: 7 }}>✔</span></div>
                  )}
                  <AudienceAvatar person={p} size={38} />
                </div>
              ))}
            </div>

            {/* Row 2 — front row */}
            <div style={{
              position: 'absolute', bottom: '18%',
              left: 0, right: 0,
              display: 'flex', justifyContent: 'space-around',
              alignItems: 'flex-end', padding: '0 2%',
              zIndex: 4,
            }}>
              {/* Left side seated */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
                {AUDIENCE.slice(5, 8).map((p, i) => (
                  <AudienceAvatar key={i} person={p} size={44} />
                ))}
              </div>
              {/* Gap for stage */}
              <div style={{ flex: 1 }} />
              {/* Right side seated */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
                {AUDIENCE.slice(8).map((p, i) => (
                  <AudienceAvatar key={i} person={p} size={44} />
                ))}
              </div>
            </div>

            {/* Floating name tags for front row attendees */}
            <div style={{
              position: 'absolute', bottom: '32%', left: '8%', zIndex: 6,
            }}>
              <div style={{
                background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(163,255,18,0.35)',
                borderRadius: 6, padding: '2px 8px', fontSize: 8, fontWeight: 800,
                color: '#A3FF12',
              }}>Web3Warrior ✔</div>
            </div>
          </div>
        </div>

        {/* ───────── RIGHT PANEL ───────── */}
        <div style={{
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: 0,
          background: 'rgba(5,7,15,0.7)', overflowY: 'auto',
        }}>

          {/* LIVE CHAT */}
          <div style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div
              onClick={() => setChatVisible(v => !v)}
              style={{
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer',
              }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>Live Chat</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{chatVisible ? '∧' : '∨'}</span>
            </div>

            {chatVisible && (
              <>
                {/* Messages */}
                <div style={{
                  height: 210, overflowY: 'auto', padding: '0 14px 8px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {messages.map((m, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: `${m.color}25`, border: `1px solid ${m.color}50`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                      }}>{m.emoji || '👤'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 900, color: m.isAI ? '#A3FF12' : m.color || '#4FC3F7' }}>
                          {m.user}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.35 }}>{m.msg}</div>
                      </div>
                    </motion.div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Send */}
                <form onSubmit={sendChat} style={{ padding: '6px 12px 10px', display: 'flex', gap: 6 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    style={{
                      flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, padding: '7px 10px', color: '#fff', fontSize: 10, outline: 'none',
                      fontFamily: 'Outfit, sans-serif',
                    }} />
                  <button type="submit" style={{
                    background: '#4FC3F7', border: 'none', borderRadius: 8,
                    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 12, color: '#000', fontWeight: 900, flexShrink: 0,
                  }}>↑</button>
                </form>
              </>
            )}
          </div>

          {/* AUDIENCE REACTIONS */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div
              onClick={() => setRxVisible(v => !v)}
              style={{
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer',
              }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>Audience Reactions</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>👥 12.5K</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{rxVisible ? '∧' : '∨'}</span>
              </div>
            </div>

            {rxVisible && (
              <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {REACTIONS.map(r => (
                  <button key={r.icon}
                    className="vh-react-btn"
                    onClick={() => handleReaction(r.icon)}
                    style={{
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, padding: '9px 6px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      transition: 'all 0.15s',
                    }}>
                    <span style={{ fontSize: 18 }}>{r.icon}</span>
                    <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>
                      {fmtNum(rxCounts[r.icon])}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* QUICK NAVIGATION */}
          <div style={{ padding: '10px 14px', flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5, marginBottom: 10 }}>
              Quick Navigation
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { id: 'lobby',    icon: '🏠', label: 'Lobby' },
                { id: 'sponsors', icon: '🏢', label: 'Sponsor\nHalls' },
                { id: 'network',  icon: '🤝', label: 'Network\nLounge' },
                { id: 'expo',     icon: '🖼️', label: 'Expo Zone' },
              ].map(q => (
                <button key={q.id}
                  className="vh-qnav-btn"
                  onClick={() => {
                    setActiveTab(q.id);
                    if (q.id === 'lobby') onBack();
                    else toast.success(`🗺️ Navigating to ${q.label.replace('\n', ' ')}...`);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: '12px 8px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 20 }}>{q.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3 }}>
                    {q.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ BOTTOM CONTROL BAR ══════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: 'rgba(4,6,14,0.97)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '10px 24px', flexShrink: 0,
      }}>
        {/* Voice Chat */}
        <button className="vh-ctrl-btn"
          onClick={() => {
            setVoiceActive(!voiceActive);
            toast.success(voiceActive ? '🔇 Mic muted' : '🎙️ Voice chat activated!');
          }}
          style={{
            background: voiceActive ? 'rgba(163,255,18,0.12)' : 'rgba(255,255,255,0.05)',
            border: voiceActive ? '1px solid #A3FF12' : '1px solid rgba(255,255,255,0.1)',
            color: voiceActive ? '#A3FF12' : 'rgba(255,255,255,0.65)',
            borderRadius: 12, padding: '8px 16px', cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 62,
          }}>
          <span style={{ fontSize: 18 }}>🎙️</span>
          <span style={{ fontSize: 8.5, fontWeight: 800 }}>Voice Chat</span>
        </button>

        {/* Raise Hand */}
        <button className="vh-ctrl-btn"
          onClick={() => {
            setHandRaised(!handRaised);
            toast.success(handRaised ? 'Hand lowered' : '✋ Hand raised! Host notified.');
          }}
          style={{
            background: handRaised ? 'rgba(79,195,247,0.12)' : 'rgba(255,255,255,0.05)',
            border: handRaised ? '1px solid #4FC3F7' : '1px solid rgba(255,255,255,0.1)',
            color: handRaised ? '#4FC3F7' : 'rgba(255,255,255,0.65)',
            borderRadius: 12, padding: '8px 16px', cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 62,
          }}>
          <span style={{ fontSize: 18 }}>✋</span>
          <span style={{ fontSize: 8.5, fontWeight: 800 }}>Raise Hand</span>
        </button>

        {/* Reactions */}
        <button className="vh-ctrl-btn"
          onClick={() => { handleReaction('😍'); toast.success('😍 Reaction sent!'); }}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.65)', borderRadius: 12, padding: '8px 16px',
            cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 62,
          }}>
          <span style={{ fontSize: 18 }}>😍</span>
          <span style={{ fontSize: 8.5, fontWeight: 800 }}>Reactions</span>
        </button>

        {/* Chat */}
        <button className="vh-ctrl-btn"
          onClick={() => { setChatVisible(true); toast.success('💬 Chat panel open'); }}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.65)', borderRadius: 12, padding: '8px 16px',
            cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 62,
          }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <span style={{ fontSize: 8.5, fontWeight: 800 }}>Chat</span>
        </button>

        {/* People */}
        <button className="vh-ctrl-btn"
          onClick={() => toast.success(`👥 ${attendees.toLocaleString()} people attending live`)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.65)', borderRadius: 12, padding: '8px 16px',
            cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 62,
          }}>
          <span style={{ fontSize: 18 }}>👥</span>
          <span style={{ fontSize: 8.5, fontWeight: 800 }}>{attendees.toLocaleString()}</span>
        </button>

        {/* Settings */}
        <button className="vh-ctrl-btn"
          onClick={() => setOverlay('settings')}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.65)', borderRadius: 12, padding: '8px 16px',
            cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 62,
          }}>
          <span style={{ fontSize: 18 }}>⚙️</span>
          <span style={{ fontSize: 8.5, fontWeight: 800 }}>Settings</span>
        </button>

        {/* Leave Event */}
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,82,82,0.18)', border: '1px solid #FF5252',
            color: '#FF5252', borderRadius: 12, padding: '8px 18px',
            cursor: 'pointer', transition: 'all 0.15s', marginLeft: 8,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 72,
            fontFamily: 'Outfit, sans-serif',
          }}>
          <span style={{ fontSize: 18 }}>🚪</span>
          <span style={{ fontSize: 8.5, fontWeight: 900 }}>Leave Event</span>
        </button>
      </div>

      {/* ══════════ OVERLAY MODALS ══════════ */}
      <AnimatePresence>
        {overlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
              zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
            onClick={() => setOverlay(null)}>

            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'linear-gradient(145deg,#0d1525 0%,#080e1c 100%)',
                border: '1px solid rgba(79,195,247,0.2)',
                borderRadius: 22, padding: 24, width: '100%', maxWidth: 440,
                boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 40px rgba(79,195,247,0.1)',
              }}>

              {/* Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 14, marginBottom: 18,
              }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#4FC3F7' }}>
                  {overlay === 'agenda'   && '📅 Event Agenda'}
                  {overlay === 'speakers' && '👥 Guest Speakers'}
                  {overlay === 'schedule' && '📅 Full Schedule'}
                  {overlay === 'support'  && '🛠️ Event Support'}
                  {overlay === 'about'    && 'ℹ️ About This Event'}
                  {overlay === 'settings' && '⚙️ Settings'}
                </div>
                <button onClick={() => setOverlay(null)} style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.7)',
                  width: 30, height: 30, borderRadius: 8, fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              </div>

              {/* Content */}
              <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {overlay === 'agenda' && AGENDA.map((item, i) => (
                  <div key={i} style={{
                    background: 'rgba(79,195,247,0.06)', border: '1px solid rgba(79,195,247,0.15)',
                    borderRadius: 12, padding: 12,
                  }}>
                    <div style={{ fontSize: 9, color: '#4FC3F7', fontWeight: 900, marginBottom: 3 }}>{item.time}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                ))}

                {overlay === 'speakers' && SPEAKERS.map((s, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: 12, display: 'flex', gap: 12, alignItems: 'center',
                  }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 12, background: 'rgba(79,195,247,0.1)',
                      border: '1px solid rgba(79,195,247,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                    }}>{s.emoji}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: '#4FC3F7', fontWeight: 700, marginTop: 1 }}>{s.role}</div>
                      <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 1.4 }}>{s.bio}</div>
                    </div>
                  </div>
                ))}

                {(overlay === 'schedule' || overlay === 'about') && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    <p><strong style={{ color: '#4FC3F7' }}>NFEGlobal Core Global Summit</strong> is a groundbreaking Web3 and AI event streaming globally across decentralized channels.</p>
                    <p style={{ marginTop: 10 }}>Main stages cycle active presentation slides with synchronized multi-region audio feeds powered by the NFEGlobal AI Host system.</p>
                    <p style={{ marginTop: 10 }}>After closing remarks, join lounge spaces for decentralized networking and physical location matching.</p>
                  </div>
                )}

                {overlay === 'support' && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    <p>Having trouble connecting to Voice Chat or claiming partner swag items?</p>
                    <p style={{ marginTop: 10 }}>Reach out via global chat or ping the <strong style={{ color: '#A3FF12' }}>🤖 AI Host</strong> directly to reset node integrations.</p>
                    <div style={{ marginTop: 16, background: 'rgba(163,255,18,0.07)', border: '1px solid rgba(163,255,18,0.2)', borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: '#A3FF12' }}>Support Channels</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>📧 support@nfeglobal.online</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>💬 Telegram: @NFEGlobalSupport</div>
                    </div>
                  </div>
                )}

                {overlay === 'settings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Video Quality',    value: 'HD 1080p' },
                      { label: 'Audio Output',     value: 'System Default' },
                      { label: 'Notifications',    value: 'Enabled' },
                      { label: 'Chat Language',    value: 'English' },
                    ].map((s, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
                      }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{s.label}</span>
                        <span style={{ fontSize: 11, color: '#4FC3F7', fontWeight: 800 }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => setOverlay(null)} style={{
                width: '100%', marginTop: 18, padding: '11px', borderRadius: 12, border: 'none',
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
              }}>
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
