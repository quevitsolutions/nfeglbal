import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Send, Sparkles, Copy, MessageSquare, Twitter, MessageCircle } from 'lucide-react'

const PROMPT_TEMPLATES = [
  { icon: Twitter, label: 'Write Twitter Thread', prompt: 'Write a highly engaging 5-part Twitter thread about NFEGlobal Core\'s new 18-tier matrix and how to earn passive BNB. Use emojis and a strong hook.' },
  { icon: MessageSquare, label: 'Telegram Promo', prompt: 'Draft a short, high-energy Telegram announcement for my group about joining my NFEGlobal Core node downline.' },
  { icon: MessageCircle, label: 'WhatsApp Pitch', prompt: 'Write a casual, friendly WhatsApp message to pitch the NFEGlobal Core mining node to a friend.' },
  { icon: Sparkles, label: 'Explain Binary Matrix', prompt: 'Explain the 70% binary matrix income simply in 3 bullet points so I can use it in my YouTube description.' }
]

export default function AIAgentPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm Bella, your NFEGlobal Marketing AI. I can write tweets, Telegram posts, scripts, or explain the protocol to your prospects. What do you need to promote today?" }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (text) => {
    const msgText = typeof text === 'string' ? text : input
    if (!msgText.trim()) return

    setMessages(prev => [...prev, { role: 'user', content: msgText }])
    setInput('')
    setIsTyping(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://nfeglobal.online/api'}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: msgText })
      });
      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.result || 'Sorry, I encountered an error. Please try again.'
      }]);
    } catch (error) {
      console.error('AI Gen Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I am offline or encountering an issue reaching the server.'
      }]);
    } finally {
      setIsTyping(false);
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div style={{ paddingTop: 100, paddingBottom: 60, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', width: '100%', padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(206,147,216,0.1)', color: '#CE93D8', borderRadius: 20, fontSize: 13, fontWeight: 900, marginBottom: 16 }}>
            <Bot size={16} /> NFEGlobal AI MARKETING AGENT
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, letterSpacing: -0.5, marginBottom: 12 }}>
            Generate Marketing Copy
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', maxWidth: 500, margin: '0 auto' }}>
            Never stare at a blank page. Instantly create high-converting promotional content for any platform.
          </p>
        </div>

        {/* Chat Interface */}
        <div style={{ background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, display: 'flex', flexDirection: 'column', flex: 1, maxHeight: '60vh', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          
          {/* Chat Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                
                <div style={{ width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: msg.role === 'user' ? 'rgba(79,195,247,0.1)' : 'rgba(206,147,216,0.15)',
                  color: msg.role === 'user' ? '#4FC3F7' : '#CE93D8', border: `1px solid ${msg.role === 'user' ? 'rgba(79,195,247,0.3)' : 'rgba(206,147,216,0.3)'}`
                }}>
                  {msg.role === 'user' ? <MessageSquare size={16} /> : <Bot size={18} />}
                </div>

                <div style={{
                  background: msg.role === 'user' ? '#4FC3F7' : 'rgba(255,255,255,0.03)',
                  color: msg.role === 'user' ? '#000' : '#fff',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  padding: '12px 18px', borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  fontSize: 14, lineHeight: 1.6, maxWidth: '80%', whiteSpace: 'pre-wrap', position: 'relative'
                }}>
                  {msg.content}
                  {msg.role === 'assistant' && i > 0 && (
                    <button onClick={() => handleCopy(msg.content)} style={{ position: 'absolute', bottom: -30, right: 0, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Copy size={12} /> Copy
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            
            {isTyping && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                 <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(206,147,216,0.15)', color: '#CE93D8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={18} />
                </div>
                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: '12px 18px', borderRadius: '4px 16px 16px 16px' }}>
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} style={{ width: 6, height: 6, background: '#CE93D8', borderRadius: '50%' }} />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} style={{ width: 6, height: 6, background: '#CE93D8', borderRadius: '50%' }} />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} style={{ width: 6, height: 6, background: '#CE93D8', borderRadius: '50%' }} />
                </div>
              </div>
            )}
            <div ref={chatRef} style={{ height: 20 }} />
          </div>

          {/* Quick Prompts */}
          <div style={{ padding: '0 20px', display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
            {PROMPT_TEMPLATES.map((t, i) => {
              const Icon = t.icon
              return (
                <button key={i} onClick={() => handleSend(t.prompt)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                  <Icon size={14} color="#CE93D8" /> {t.label}
                </button>
              )
            })}
          </div>

          {/* Input Area */}
          <div style={{ padding: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <form onSubmit={e => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: 10 }}>
              <input 
                type="text" 
                value={input} 
                onChange={e => setInput(e.target.value)}
                placeholder="Ask Bella to generate promo copy..."
                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '14px 20px', color: '#fff', fontSize: 14, outline: 'none' }}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isTyping}
                style={{ width: 50, borderRadius: 16, background: '#CE93D8', border: 'none', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed', opacity: input.trim() && !isTyping ? 1 : 0.5 }}
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}
