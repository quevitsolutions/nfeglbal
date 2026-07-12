import { motion } from 'framer-motion'
import { PlayCircle, Clock, BookOpen, Award } from 'lucide-react'

const COURSES = [
  {
    title: 'Web3 Referral Marketing 101',
    desc: 'Learn the fundamentals of building a massive downline on BNB Chain.',
    duration: '45 mins', lessons: 5, color: '#CBFF01', level: 'Beginner'
  },
  {
    title: 'Pitching AIPCore Core to Influencers',
    desc: 'Scripts, templates, and strategies for closing high-volume KOLs.',
    duration: '1h 20m', lessons: 8, color: '#4FFFFF', level: 'Intermediate'
  },
  {
    title: 'Social Media Domination',
    desc: 'How to automate Twitter & Telegram marketing using AI tools.',
    duration: '2h 15m', lessons: 12, color: '#FF6BFF', level: 'Advanced'
  },
  {
    title: 'Income Matrix Deep Dive',
    desc: 'Master the 18-tier binary matrix to maximize your global spillover.',
    duration: '50 mins', lessons: 6, color: '#FF9F43', level: 'Intermediate'
  }
]

export default function AcademyPage() {
  return (
    <div style={{ paddingTop: 100, paddingBottom: 100, minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '10%', left: '10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(79,195,247,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{ display: 'inline-block', padding: '8px 16px', background: 'rgba(79,195,247,0.1)', color: '#4FC3F7', borderRadius: 20, fontSize: 13, fontWeight: 900, marginBottom: 16 }}>
            🎓 AIPCore TRAINING ACADEMY
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 900, letterSpacing: -1, marginBottom: 16, lineHeight: 1.1 }}>
            Master The Art Of<br />
            <span style={{ color: '#4FC3F7', textShadow: '0 0 30px rgba(79,195,247,0.4)' }}>Web3 Promotion</span>
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            Access exclusive training materials, marketing strategies, and video masterclasses to build your global downline.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {COURSES.map((course, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5 }}
              style={{
                background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 24,
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden'
              }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: course.color }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: course.color, padding: '4px 10px', background: `${course.color}15`, borderRadius: 12 }}>
                  {course.level}
                </span>
                <BookOpen size={16} color="rgba(255,255,255,0.3)" />
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, lineHeight: 1.3 }}>{course.title}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 24 }}>{course.desc}</p>

              <div style={{ display: 'flex', gap: 16, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                  <Clock size={14} /> {course.duration}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                  <Award size={14} /> {course.lessons} Lessons
                </div>
              </div>

              <button style={{
                width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                <PlayCircle size={18} /> Start Course
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
