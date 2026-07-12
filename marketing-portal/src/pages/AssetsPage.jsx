import { motion } from 'framer-motion'
import { Download, FileText, Image as ImageIcon, Video, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

const ASSETS = [
  {
    category: 'Presentations',
    items: [
      { title: 'AIPCore Core Official Pitch Deck', type: 'PDF', size: '4.2 MB', icon: FileText, color: '#FF6BFF' },
      { title: '1-Pager Executive Summary', type: 'PDF', size: '1.1 MB', icon: FileText, color: '#FF6BFF' },
    ]
  },
  {
    category: 'Social Media Kits',
    items: [
      { title: 'Twitter/X Promo Banners', type: 'ZIP', size: '12.5 MB', icon: ImageIcon, color: '#4FC3F7' },
      { title: 'Telegram Stickers & GIFs', type: 'ZIP', size: '8.4 MB', icon: ImageIcon, color: '#4FC3F7' },
      { title: 'Instagram Story Templates', type: 'ZIP', size: '15.2 MB', icon: ImageIcon, color: '#4FC3F7' },
    ]
  },
  {
    category: 'Video Assets',
    items: [
      { title: '60s Explainer Video (MP4)', type: 'MP4', size: '45.8 MB', icon: Video, color: '#CBFF01' },
      { title: 'AIPCore Logo Animation Loop', type: 'MP4', size: '18.2 MB', icon: Video, color: '#CBFF01' },
    ]
  }
]

export default function AssetsPage() {
  const handleCopyLink = (e) => {
    e.preventDefault()
    navigator.clipboard.writeText(window.location.href)
    toast.success('Asset link copied!')
  }

  return (
    <div style={{ paddingTop: 100, paddingBottom: 100, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{ display: 'inline-block', padding: '8px 16px', background: 'rgba(255,107,255,0.1)', color: '#FF6BFF', borderRadius: 20, fontSize: 13, fontWeight: 900, marginBottom: 16 }}>
            📁 MARKETING ASSETS
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 900, letterSpacing: -1, marginBottom: 16 }}>
            Downloads & <span style={{ color: '#FF6BFF' }}>Presentations</span>
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
            Everything you need to pitch AIPCore Core. High-quality decks, banners, and video assets optimized for conversion.
          </p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          {ASSETS.map((section, idx) => (
            <div key={idx}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12, marginBottom: 20 }}>
                {section.category}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {section.items.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 + idx * 0.1 }}
                      whileHover={{ scale: 1.02 }}
                      style={{
                        background: 'rgba(22,27,34,0.6)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16,
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                        <Icon size={24} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{item.title}</div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                          <span>{item.type}</span> • <span>{item.size}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Download size={16} />
                        </button>
                        <button onClick={handleCopyLink} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Copy size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
