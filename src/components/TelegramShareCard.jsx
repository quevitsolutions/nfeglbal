import React, { useState } from 'react';
import { Send, Copy, Check, MessageSquare, ExternalLink, Sparkles, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { shareOnTelegram, triggerHaptic, openTelegramBot } from '../utils/telegram.js';

const PROMO_TEMPLATES = [
  {
    id: 'english',
    label: '🇬🇧 English',
    title: '🚀 Earn Passive BNB on BSC',
    text: `🚀 AIPCore Pre-Launch is LIVE on Binance Smart Chain!\n\n✨ Join today (~$1 entry fee)\n✨ Passive BNB mining & 2x18 Matrix\n✨ 100% On-Chain Community Distribution\n\nSecure your position now: `
  },
  {
    id: 'spanish',
    label: '🇪🇸 Español',
    title: '🚀 Gana BNB Pasivo en BSC',
    text: `🚀 ¡El Pre-Lanzamiento de AIPCore está EN VIVO en Binance Smart Chain!\n\n✨ Únete hoy (Tarifa de entrada ~$1)\n✨ Minería pasiva de BNB y Matriz 2x18\n✨ Distribución 100% en la cadena\n\nAsegura tu posición ahora: `
  },
  {
    id: 'russian',
    label: '🇷🇺 Русский',
    title: '🚀 Зарабатывайте пассивный BNB',
    text: `🚀 Предзапуск AIPCore на Binance Smart Chain!\n\n✨ БЕСПЛАТНОЕ участие ($0 вход)\n✨ Пассивный майнинг BNB и Матрица 2х18\n✨ 100% распределение в смарт-контракте\n\nЗаймите позицию прямо сейчас: `
  },
  {
    id: 'hindi',
    label: '🇮🇳 हिंदी',
    title: '🚀 BNB कमाएं AIPCore के साथ',
    text: `🚀 AIPCore का प्री-लॉन्च शुरू हो चुका है BNB Smart Chain पर!\n\n✨ मुफ़्त में शामिल हों ($0 शुल्क)\n✨ पैसिव BNB माइनिंग और 2x18 मैट्रिक्स\n✨ 100% ऑन-चेन कम्युनिटी डिस्ट्रीब्यूशन\n\nअभी अपनी जगह सुरक्षित करें: `
  }
];

export default function TelegramShareCard({ userNodeId, walletAddress, botUsername = 'AIPCoreBot' }) {
  const [selectedTemplate, setSelectedTemplate] = useState('english');
  const [copied, setCopied] = useState(false);

  // Generate unique referral links
  const refCode = userNodeId ? String(userNodeId) : walletAddress ? String(walletAddress) : '1';
  const webAppShareUrl = `https://aipcore.online/?ref=${refCode}`;
  const telegramBotShareUrl = `https://t.me/${botUsername}?start=${refCode}`;

  const currentTemplate = PROMO_TEMPLATES.find(t => t.id === selectedTemplate) || PROMO_TEMPLATES[0];
  const fullShareText = `${currentTemplate.text}${webAppShareUrl}`;

  const handleCopyLink = () => {
    triggerHaptic('light');
    navigator.clipboard.writeText(telegramBotShareUrl);
    setCopied(true);
    toast.success('Telegram Bot Invite Link Copied!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleShareTelegram = () => {
    triggerHaptic('medium');
    shareOnTelegram(telegramBotShareUrl, currentTemplate.text);
  };

  const handleOpenBot = () => {
    triggerHaptic('light');
    openTelegramBot(botUsername, refCode);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(16,24,38,0.95) 0%, rgba(8,12,20,0.98) 100%)',
      border: '1px solid rgba(0, 136, 204, 0.3)',
      borderRadius: '20px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0, 136, 204, 0.15)'
    }}>
      {/* Background Glow */}
      <div style={{
        position: 'absolute', top: '-40px', right: '-40px',
        width: '140px', height: '140px',
        background: '#0088cc', opacity: 0.12,
        borderRadius: '50%', filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />

      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #0088cc, #00a8ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 4px 12px rgba(0,136,204,0.3)'
          }}>
            <Send size={20} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Telegram Viral Share
              <span style={{
                fontSize: '9px', fontWeight: 800, padding: '2px 8px',
                borderRadius: '10px', background: 'rgba(0,136,204,0.2)',
                color: '#0088cc', border: '1px solid rgba(0,136,204,0.3)'
              }}>
                BOOST EARNINGS
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
              Invite team members directly via Telegram to build your Matrix
            </div>
          </div>
        </div>
      </div>

      {/* Language Selector */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
        {PROMO_TEMPLATES.map(tmpl => (
          <button
            key={tmpl.id}
            onClick={() => { triggerHaptic('selection'); setSelectedTemplate(tmpl.id); }}
            style={{
              padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 800,
              background: selectedTemplate === tmpl.id ? 'rgba(0, 136, 204, 0.25)' : 'rgba(255,255,255,0.04)',
              color: selectedTemplate === tmpl.id ? '#0088cc' : 'rgba(255,255,255,0.6)',
              border: `1px solid ${selectedTemplate === tmpl.id ? '#0088cc' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}
          >
            {tmpl.label}
          </button>
        ))}
      </div>

      {/* Template Preview Box */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '12px 14px',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.8)',
        whiteSpace: 'pre-line',
        marginBottom: '16px',
        lineHeight: 1.5,
        fontFamily: 'Inter, sans-serif'
      }}>
        {fullShareText}
      </div>

      {/* Action Buttons Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button
          onClick={handleShareTelegram}
          style={{
            background: 'linear-gradient(135deg, #0088cc 0%, #00a8ff 100%)',
            color: '#fff', border: 'none', borderRadius: '12px',
            padding: '12px', fontSize: '13px', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(0, 136, 204, 0.3)',
            transition: 'transform 0.1s'
          }}
          onMouseDown={() => triggerHaptic('light')}
        >
          <Send size={16} />
          Share to Telegram
        </button>

        <button
          onClick={handleCopyLink}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            color: copied ? 'var(--neon-lime)' : '#fff',
            border: `1px solid ${copied ? 'var(--neon-lime)' : 'rgba(255, 255, 255, 0.15)'}`,
            borderRadius: '12px', padding: '12px', fontSize: '13px', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          {copied ? <Check size={16} color="var(--neon-lime)" /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy Bot Link'}
        </button>
      </div>

      {/* Bot Direct Launch Sub-card */}
      <div style={{
        marginTop: '14px', paddingTop: '12px',
        borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
          Bot Link: <span style={{ color: '#0088cc', fontWeight: 700 }}>@{botUsername}?start={refCode}</span>
        </div>
        <button
          onClick={handleOpenBot}
          style={{
            background: 'transparent', border: 'none',
            color: '#0088cc', fontSize: '11px', fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
          }}
        >
          Test Bot <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}
