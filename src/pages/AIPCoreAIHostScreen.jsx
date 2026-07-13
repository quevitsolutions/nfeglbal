import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import toast from 'react-hot-toast';

const AI_AGENTS = [
  {
    id: 'host', name: 'AIPCore AI Host', icon: '🎙️', color: '#FF4444',
    role: 'Event Host & Presenter',
    status: 'active',
    capabilities: ['Welcome attendees', 'Narrate presentations', 'Introduce speakers', 'Announce schedules', 'Handle Q&A transitions'],
    personality: 'Professional, energetic, community-focused',
    voice: 'ElevenLabs v3 — Adam',
  },
  {
    id: 'moderator', name: 'AIPCore Moderator', icon: '🛡️', color: '#A3FF12',
    role: 'Chat & Content Moderator',
    status: 'active',
    capabilities: ['Spam filtering', 'Scam detection', 'Auto moderation', 'Chat control', 'Toxic content removal'],
    personality: 'Firm, fair, lightning-fast',
    voice: 'Text-only agent',
  },
  {
    id: 'support', name: 'AIPCore Support Agent', icon: '💬', color: '#4FC3F7',
    role: '24/7 Community Support',
    status: 'active',
    capabilities: ['Answer FAQs', 'Navigation help', 'Wallet support', 'Technical guidance', 'Onboarding assistance'],
    personality: 'Helpful, patient, knowledgeable',
    voice: 'ElevenLabs v3 — Rachel',
  },
  {
    id: 'marketing', name: 'AIPCore Marketing Agent', icon: '📣', color: '#CE93D8',
    role: 'Marketing & Content Creator',
    status: 'active',
    capabilities: ['Generate event posters', 'Create social content', 'WhatsApp campaigns', 'Promo video scripts', 'Telegram announcements'],
    personality: 'Creative, data-driven, trend-aware',
    voice: 'ElevenLabs v3 — Bella',
  },
  {
    id: 'analytics', name: 'AIPCore Analytics Agent', icon: '📊', color: '#FFD700',
    role: 'Performance & Analytics AI',
    status: 'active',
    capabilities: ['Engagement tracking', 'User behavior analysis', 'Watch time reports', 'Conversion optimization', 'Revenue attribution'],
    personality: 'Precise, analytical, insight-driven',
    voice: 'Data-only agent',
  },
];

const HOST_MESSAGES = [
  { id: 1, from: 'AIPCore AI Host', msg: "Welcome, everyone! I'm your AI host for tonight's BNB Income Masterclass. We'll be covering 5 proven strategies that our community has used to generate passive income.", time: '8:00 PM', icon: '🎙️', color: '#FF4444' },
  { id: 2, from: 'AIPCore AI Host', msg: "Before we begin — please check your reward panel. Attending this full session earns you 500 $AIPCORE plus an Attendance NFT badge!", time: '8:01 PM', icon: '🎙️', color: '#FF4444' },
  { id: 3, from: 'AIPCore Moderator', msg: "🛡️ Chat moderation is active. Please keep discussions respectful and relevant. Spam or scam links will result in immediate removal.", time: '8:01 PM', icon: '🛡️', color: '#A3FF12' },
  { id: 4, from: 'AIPCore Support', msg: "👋 If you need help navigating the MetaVerse or have wallet questions, type /help and I'll assist you instantly!", time: '8:02 PM', icon: '💬', color: '#4FC3F7' },
];

const FAQS = [
  { q: 'How do I claim BNB rewards?', a: 'Go to AIPCore Rewards Arena → Claim BNB. Rewards are claimable every 24 hours to your connected wallet.' },
  { q: 'What is an Attendance NFT?', a: 'An on-chain proof of webinar participation. Collecting them unlocks VIP rooms, higher mining rates, and exclusive events.' },
  { q: 'How does the referral system work?', a: 'Share your unique link. When someone activates a node through your link, you earn multi-level BNB commissions automatically.' },
  { q: 'How do I vote in the DAO?', a: 'Go to AIPCore DAO Hall → Proposals. Connect your wallet and vote FOR, AGAINST, or ABSTAIN. Votes are submitted via Snapshot on-chain.' },
  { q: 'What chains are supported?', a: 'BNB Chain is primary. Polygon, Ethereum, and Base bridges are planned for Phase 2 via cross-chain DAO vote.' },
];

export default function AIPCoreAIHostScreen({ onBack }) {
  const { hasNode } = useGameStore();
  const [tab, setTab] = useState('host');
  const [activeAgent, setActiveAgent] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [conversation, setConversation] = useState(HOST_MESSAGES);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');

    setConversation(prev => [...prev, {
      id: Date.now(), from: 'You', msg: userMsg, time: 'now', icon: '👤', color: '#4FC3F7',
    }]);

    setIsTyping(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsTyping(false);

    const faqMatch = FAQS.find(f => userMsg.toLowerCase().includes(f.q.toLowerCase().split(' ')[1]));
    const response = faqMatch
      ? faqMatch.a
      : "Great question! I'm processing your request. In the meantime, check the AIPCore Academy for in-depth guides on this topic, or visit the Community Hub to ask fellow members. 🤖";

    setConversation(prev => [...prev, {
      id: Date.now() + 1, from: 'AIPCore Support', msg: response, time: 'now', icon: '💬', color: '#4FC3F7',
    }]);
  };

  return (
    <div style={{ paddingBottom: 'calc(var(--tabbar-h, 80px) + 24px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 18, width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 900 }}>🤖 AIPCore AI Host</h1>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>5 AI Agents · OpenAI · ElevenLabs · LangChain</div>
        </div>
      </div>

      {/* Status Row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
        {AI_AGENTS.map(agent => (
          <div key={agent.id} style={{ flexShrink: 0, background: 'rgba(22,27,34,0.9)', border: `1px solid ${agent.color}40`, borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{agent.icon}</span>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: agent.color }}>{agent.name.split(' ').pop()}</div>
              <div style={{ fontSize: 8, color: '#A3FF12', fontWeight: 700 }}>● ACTIVE</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['host', 'agents', 'chat', 'faq'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 800,
              background: tab === t ? '#80CBC4' : 'rgba(255,255,255,0.05)', color: tab === t ? '#000' : 'rgba(255,255,255,0.5)' }}>
            {t === 'host' ? '🎙️ Live' : t === 'agents' ? '🤖 Agents' : t === 'chat' ? '💬 Ask AI' : '❓ FAQ'}
          </button>
        ))}
      </div>

      {/* HOST TAB — Live AI Broadcast */}
      {tab === 'host' && (
        <div>
          {/* AI Avatar Stage */}
          <div style={{
            borderRadius: 20, overflow: 'hidden', marginBottom: 16, position: 'relative',
            background: 'linear-gradient(135deg, #050812 0%, #0A1628 100%)',
            border: '1px solid rgba(128,203,196,0.3)', padding: 24, textAlign: 'center',
          }}>
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 72, marginBottom: 12 }}>🤖</motion.div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#80CBC4', marginBottom: 4 }}>AIPCore AI Host</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 16, lineHeight: 1.5 }}>
              "Good evening, AIPCore Core community! Tonight we're exploring passive income strategies powered by BNB Chain and AI automation. Get ready — your financial future starts tonight."
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              <div style={{ background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 8, padding: '5px 12px', fontSize: 10, fontWeight: 800, color: '#FF4444' }}>
                ● SPEAKING
              </div>
              <div style={{ background: 'rgba(128,203,196,0.15)', border: '1px solid rgba(128,203,196,0.3)', borderRadius: 8, padding: '5px 12px', fontSize: 10, fontWeight: 800, color: '#80CBC4' }}>
                🎤 ElevenLabs Voice
              </div>
            </div>
          </div>

          {/* Live Chat Feed */}
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 12 }}>🎙️ AI Host Broadcast Log</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto' }}>
              {HOST_MESSAGES.map(msg => (
                <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 16, flexShrink: 0 }}>{msg.icon}</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 900, color: msg.color, marginBottom: 2 }}>{msg.from} · {msg.time}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{msg.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AGENTS TAB */}
      {tab === 'agents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {AI_AGENTS.map((agent, i) => (
            <motion.div key={agent.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              onClick={() => setActiveAgent(activeAgent === agent.id ? null : agent.id)}
              style={{ background: 'rgba(22,27,34,0.95)', border: `1px solid ${activeAgent === agent.id ? agent.color + '60' : 'rgba(255,255,255,0.05)'}`, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: `${agent.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: `1px solid ${agent.color}40` }}>
                    {agent.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{agent.name}</span>
                      <span style={{ background: 'rgba(163,255,18,0.1)', color: '#A3FF12', fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 6 }}>● ACTIVE</span>
                    </div>
                    <div style={{ fontSize: 10, color: agent.color, fontWeight: 700 }}>{agent.role}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Voice: {agent.voice}</div>
                  </div>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', transform: activeAgent === agent.id ? 'rotate(90deg)' : 'none', transition: '0.2s' }}>›</span>
                </div>
              </div>
              <AnimatePresence>
                {activeAgent === agent.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>CAPABILITIES</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                      {agent.capabilities.map(cap => (
                        <div key={cap} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                          <span style={{ color: agent.color, fontSize: 10 }}>✓</span>{cap}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Personality: {agent.personality}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* CHAT TAB — Ask AI Support */}
      {tab === 'chat' && (
        <div>
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(79,195,247,0.2)', borderRadius: 16, padding: 14, marginBottom: 12, maxHeight: 340, overflowY: 'auto' }}>
            {conversation.map(msg => (
              <div key={msg.id} style={{ marginBottom: 12, textAlign: msg.from === 'You' ? 'right' : 'left' }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: msg.color, marginBottom: 3 }}>{msg.icon} {msg.from} · {msg.time}</div>
                <div style={{
                  display: 'inline-block', maxWidth: '85%', padding: '10px 12px', borderRadius: msg.from === 'You' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.from === 'You' ? 'rgba(79,195,247,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${msg.from === 'You' ? 'rgba(79,195,247,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, textAlign: 'left',
                }}>
                  {msg.msg}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 0' }}>
                <span style={{ fontSize: 12 }}>💬</span>
                <span style={{ fontSize: 10, color: '#4FC3F7', fontWeight: 700 }}>AIPCore Support is typing</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0,1,2].map(d => <div key={d} style={{ width: 4, height: 4, borderRadius: '50%', background: '#4FC3F7', opacity: 0.7, animation: `pulse 1s ${d * 0.3}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={chatRef} />
          </div>
          <form onSubmit={handleAsk} style={{ display: 'flex', gap: 8 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask AIPCore AI Support anything..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(79,195,247,0.2)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 12, outline: 'none' }} />
            <button type="submit" style={{ background: '#4FC3F7', border: 'none', borderRadius: 12, padding: '10px 16px', fontSize: 14, fontWeight: 900, color: '#000', cursor: 'pointer' }}>↑</button>
          </form>
        </div>
      )}

      {/* FAQ TAB */}
      {tab === 'faq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQS.map((faq, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', flex: 1, paddingRight: 10 }}>{faq.q}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', transform: expandedFaq === i ? 'rotate(90deg)' : 'none', transition: '0.2s' }}>›</span>
              </div>
              <AnimatePresence>
                {expandedFaq === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden', padding: '0 16px 14px', fontSize: 12, color: '#80CBC4', lineHeight: 1.6 }}>
                    {faq.a}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
