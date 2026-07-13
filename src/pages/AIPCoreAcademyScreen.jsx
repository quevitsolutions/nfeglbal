import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import toast from 'react-hot-toast';

const COURSES = [
  {
    id: 1, title: 'Passive BNB Income Masterclass', category: 'Income', icon: '💰',
    lessons: 12, duration: '4h 20m', level: 'Beginner', enrolled: 3240,
    reward: 2000, nft: 'Academy NFT',
    color: '#FFD700', glow: 'rgba(255,215,0,0.3)',
    topics: ['BNB Chain basics', 'Staking strategies', 'Referral income', 'Compounding'],
  },
  {
    id: 2, title: 'DAO Governance & Treasury', category: 'DAO', icon: '🏛️',
    lessons: 8, duration: '2h 45m', level: 'Intermediate', enrolled: 1820,
    reward: 1500, nft: 'DAO NFT',
    color: '#A3FF12', glow: 'rgba(163,255,18,0.3)',
    topics: ['Snapshot voting', 'Proposal creation', 'Treasury management', 'Tokenomics'],
  },
  {
    id: 3, title: 'NFT Creation & Monetization', category: 'NFTs', icon: '🖼️',
    lessons: 10, duration: '3h 10m', level: 'Intermediate', enrolled: 2100,
    reward: 1800, nft: 'Creator NFT',
    color: '#CE93D8', glow: 'rgba(206,147,216,0.3)',
    topics: ['NFT minting', 'IPFS storage', 'Royalty systems', 'Marketplaces'],
  },
  {
    id: 4, title: 'AI Agent Building with LangChain', category: 'AI', icon: '🤖',
    lessons: 15, duration: '6h 00m', level: 'Advanced', enrolled: 980,
    reward: 3000, nft: 'AI Builder NFT',
    color: '#80CBC4', glow: 'rgba(128,203,196,0.3)',
    topics: ['LangChain basics', 'CrewAI agents', 'OpenAI API', 'ElevenLabs voice'],
  },
  {
    id: 5, title: 'Web3 Referral Economy', category: 'Referral', icon: '🔗',
    lessons: 6, duration: '2h 00m', level: 'Beginner', enrolled: 4200,
    reward: 1000, nft: 'Referral NFT',
    color: '#4FC3F7', glow: 'rgba(79,195,247,0.3)',
    topics: ['Multi-level referrals', 'Commission structures', 'Smart contracts', 'Analytics'],
  },
];

const CERTIFICATES = [
  { name: 'BNB Income Pro', icon: '💰', date: 'Earned Apr 2026', rarity: 'Gold' },
  { name: 'DAO Delegate', icon: '🏛️', date: 'Earned Mar 2026', rarity: 'Silver' },
];

const LEVEL_COLORS = { Beginner: '#A3FF12', Intermediate: '#FFD700', Advanced: '#FF6B6B' };

export default function AIPCoreAcademyScreen({ onBack }) {
  const { hasNode, nodeTier } = useGameStore();
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedCourse, setExpandedCourse] = useState(null);

  const categories = ['All', ...new Set(COURSES.map(c => c.category))];
  const filtered = activeCategory === 'All' ? COURSES : COURSES.filter(c => c.category === activeCategory);

  const handleEnroll = (course) => {
    if (!hasNode) return toast.error('🔒 Activate your node to access AIPCore Academy', { duration: 4000 });
    toast.success(`🎓 Enrolled in "${course.title}"! Complete to earn ${course.reward.toLocaleString()} $AIPCORE`, { duration: 5000 });
  };

  return (
    <div style={{ paddingBottom: 'calc(var(--tabbar-h, 80px) + 24px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 18, width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 900 }}>🎓 AIPCore Academy</h1>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>AI-Powered Courses & NFT Certifications</div>
        </div>
      </div>

      {/* Stats Banner */}
      <div style={{
        borderRadius: 18, padding: 16, marginBottom: 18,
        background: 'linear-gradient(135deg, #1565C0 0%, rgba(13,17,23,0.9) 100%)',
        border: '1px solid rgba(79,195,247,0.3)',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center',
      }}>
        {[['48', 'Courses'], ['12,840', 'Learners'], ['$AIPCORE', 'Rewards']].map(([val, label]) => (
          <div key={label}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#4FC3F7' }}>{val}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* My Certificates */}
      {hasNode && CERTIFICATES.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#FFD700', marginBottom: 10 }}>🏅 My Certificates</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {CERTIFICATES.map((cert, i) => (
              <div key={i} style={{
                background: 'linear-gradient(135deg, rgba(123,52,30,0.5), rgba(22,27,34,0.9))',
                border: '1px solid rgba(255,215,0,0.3)', borderRadius: 14, padding: '12px 16px', flexShrink: 0, minWidth: 140
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{cert.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#FFD700', marginBottom: 2 }}>{cert.name}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{cert.date}</div>
                <span style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 6 }}>{cert.rarity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
              background: activeCategory === cat ? '#A3FF12' : 'rgba(255,255,255,0.05)', color: activeCategory === cat ? '#000' : 'rgba(255,255,255,0.5)' }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Courses */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((course, i) => (
          <motion.div key={course.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            style={{
              background: 'rgba(22,27,34,0.95)', borderRadius: 18, overflow: 'hidden',
              border: expandedCourse === course.id ? `1px solid ${course.color}60` : '1px solid rgba(255,255,255,0.05)',
              boxShadow: expandedCourse === course.id ? `0 0 20px ${course.glow}` : 'none',
              transition: 'all 0.2s',
            }}>
            {/* Course top accent */}
            <div style={{ height: 3, background: `linear-gradient(90deg, ${course.color}, transparent)` }} />
            <div style={{ padding: 16, cursor: 'pointer' }} onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${course.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                  {course.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{course.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: LEVEL_COLORS[course.level] }}>{course.level}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>•</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{course.lessons} lessons</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>•</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{course.duration}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>•</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{course.enrolled.toLocaleString()} enrolled</span>
                  </div>
                </div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', transform: expandedCourse === course.id ? 'rotate(90deg)' : 'none', transition: '0.2s' }}>›</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <span style={{ background: 'rgba(163,255,18,0.1)', color: '#A3FF12', fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 8 }}>+{course.reward.toLocaleString()} $AIPCORE</span>
                {course.nft && <span style={{ background: 'rgba(255,215,0,0.1)', color: '#FFD700', fontSize: 10, fontWeight: 900, padding: '4px 10px', borderRadius: 8 }}>🏅 {course.nft}</span>}
              </div>
            </div>
            {/* Expanded */}
            {expandedCourse === course.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>WHAT YOU'LL LEARN</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {course.topics.map(topic => (
                    <div key={topic} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#fff' }}>
                      <span style={{ color: course.color, fontSize: 10 }}>✓</span>{topic}
                    </div>
                  ))}
                </div>
                <button onClick={() => handleEnroll(course)}
                  style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: course.color, color: '#000', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
                  🎓 Enroll & Start Learning
                </button>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* AI Learning Recommendation */}
      <div style={{ marginTop: 20, background: 'rgba(0,77,64,0.3)', border: '1px solid rgba(128,203,196,0.3)', borderRadius: 16, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 28 }}>🤖</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#80CBC4', marginBottom: 2 }}>AI Recommendation</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
            Based on your node tier, start with <strong style={{ color: '#fff' }}>Passive BNB Income Masterclass</strong> — it's most aligned with your current goals.
          </div>
        </div>
      </div>
    </div>
  );
}
