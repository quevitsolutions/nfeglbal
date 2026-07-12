import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import toast from 'react-hot-toast';

const SPONSORS = [
  {
    id: 'binance',
    name: 'Binance Smart Chain',
    logo: '🟡',
    color: '#F3BA2F',
    avatar: '👨‍🚀',
    desc: 'The leading EVM-compatible blockchain network for decentralized applications.',
    boards: ['BSC Mainnet Integration', 'High Speed, Low Fees', 'Referral Commission Pool'],
    links: [{ label: 'Visit BSC', url: 'https://bnbchain.org' }],
    swag: { claimed: false, item: '0.005 BNB Gas Voucher', claimedIcon: '🎫' }
  },
  {
    id: 'aipcore-nodes',
    name: 'AIPCore Nodes & Mining',
    logo: '⬡',
    color: '#A3FF12',
    avatar: '🤖',
    desc: 'Decentralized mining network powering AIPCore Core AI moderator workflows.',
    boards: ['Active Node Rewards', 'Node Upgrades', 'Community Share Pool'],
    links: [{ label: 'View Node Dashboard', url: '#' }],
    swag: { claimed: false, item: 'AIPCore Commemorative Badge NFT', claimedIcon: '🏅' }
  },
  {
    id: 'meta-nfts',
    name: 'Meta NFT Gallery',
    logo: '🖼️',
    color: '#CE93D8',
    avatar: '🎨',
    desc: 'Premium digital art collection showcasing achievements and community rankings.',
    boards: ['Rare Badges Showcase', 'NFT Boost Factors', 'Marketplace Linkages'],
    links: [{ label: 'Browse Gallery', url: '#' }],
    swag: { claimed: false, item: 'Golden Avatar Frame NFT', claimedIcon: '🖼️' }
  },
  {
    id: 'web3-wallet',
    name: 'Web3 Wallet Services',
    logo: '💳',
    color: '#4FC3F7',
    avatar: '💼',
    desc: 'Non-custodial smart contract wallet provider powering secure dApp logins.',
    boards: ['RainbowKit SDK Connectors', 'Secure BNB Vaults', 'DAO Multi-sig Integrations'],
    links: [{ label: 'Developer SDK Docs', url: 'https://rainbowkit.com' }],
    swag: { claimed: false, item: '100 $AIPCORE Promo Tokens', claimedIcon: '🪙' }
  }
];

export default function VirtualLobbyScreen({ onBack, onNavigate }) {
  const { hasNode, walletAddress } = useGameStore();
  const [tab, setTab] = useState('lobby'); // 'lobby' | 'exhibit' | 'swag'
  const [selectedBooth, setSelectedBooth] = useState(null);
  const [swagClaimed, setSwagClaimed] = useState({});
  const [spatialChat, setSpatialChat] = useState([
    { user: '🤖 Receptionist', msg: 'Welcome to AIPCore Core Virtual Event Center! How can I assist you today?', isAI: true },
    { user: '🦁 0x8f2...', msg: 'Heading into the Exhibit Hall to claim my BNB vouchers!' },
    { user: '🐯 0xa91...', msg: 'The Binance booth has some great developer resource boards.' }
  ]);
  const [chatMsg, setChatMsg] = useState('');

  const claimSwag = (boothId, itemName) => {
    if (!hasNode) {
      return toast.error('🔒 Activate your node to claim partner swag benefits!', { duration: 3500 });
    }
    if (swagClaimed[boothId]) {
      return toast.error('Already claimed this partner swag reward!', { duration: 2500 });
    }
    setSwagClaimed(prev => ({ ...prev, [boothId]: true }));
    toast.success(`🎁 Successfully claimed: ${itemName}! Sent to your wallet dashboard.`, { duration: 4000 });
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    const shortAddr = walletAddress ? `${walletAddress.slice(0, 6)}...` : '0xYou...';
    setSpatialChat(prev => [...prev, { user: `🐼 ${shortAddr}`, msg: chatMsg }]);
    setChatMsg('');
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#050812', color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
      
      {/* ── TOP EVENT LOBBY TABS (Inspired by Image 5) ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(5, 8, 18, 0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(163,255,18,0.12)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 18, width: 34, height: 34, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>AIPCore Core Event Center</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Virtual Lobby & Expo</div>
          </div>
        </div>

        {/* Core Navigation Tabs */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', overflowX: 'auto' }}>
          {[
            { id: 'lobby', label: '🏢 Lobby', color: '#fff' },
            { id: 'exhibit', label: '🖼️ Exhibit Hall', color: '#A3FF12' },
            { id: 'swag', label: '🎒 Swag Bag', color: '#FFD700' }
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '6px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
                background: tab === t.id ? t.color : 'rgba(255,255,255,0.05)',
                color: tab === t.id ? '#000' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.2s'
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: IMMERSIVE VIRTUAL LOBBY (Inspired by Image 5) ── */}
      {tab === 'lobby' && (
        <div style={{ padding: 16 }}>
          {/* Main 3D Lobby Billboard backdrop */}
          <div style={{
            position: 'relative', borderRadius: 20, overflow: 'hidden', minHeight: 220, marginBottom: 20,
            background: 'linear-gradient(135deg, #0A1B2A 0%, #0D2D1A 100%)',
            border: '1px solid rgba(163,255,18,0.2)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 20
          }}>
            {/* Grid ceiling effect */}
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.08,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }} />
            <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(163,255,18,0.15)', border: '1px solid #A3FF12', borderRadius: 20, padding: '4px 16px', fontSize: 12, fontWeight: 900, color: '#A3FF12', letterSpacing: 2 }}>
              WELCOME TO AIPCore CONVENTION CENTER
            </div>

            <div style={{ position: 'relative', zIndex: 2 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Where Web3 Partners Unite</h2>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, maxWidth: 300, marginBottom: 12 }}>
                Explore customizable booths in the Exhibit Hall, join webinars in the Auditorium, or claim special gas/NFT incentives.
              </p>

              {/* Lobby Escalators/Portals */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setTab('exhibit')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#A3FF12', color: '#000', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>
                  🚶 Enter Exhibit Hall
                </button>
                <button onClick={() => onNavigate && onNavigate('live')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                  🎭 Go to Auditorium
                </button>
              </div>
            </div>
          </div>

          {/* Lobby Info Desk / Spatial Chat */}
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#4FC3F7' }}>🛎️ Lobby Help Desk</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>24/7 AI Receptionist</span>
            </div>
            
            <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {spatialChat.map((c, i) => (
                <div key={i} style={{ fontSize: 11, lineHeight: 1.4 }}>
                  <strong style={{ color: c.isAI ? '#80CBC4' : '#CE93D8' }}>{c.user}: </strong>
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>{c.msg}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 6 }}>
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Ask Receptionist or talk to Lobby..."
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 11, outline: 'none' }} />
              <button type="submit" style={{ background: '#4FC3F7', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 900, color: '#000', cursor: 'pointer' }}>↑</button>
            </form>
          </div>

          {/* Partner Billboard wall (Inspired by Image 2) */}
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>PREMIUM SPONSORS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {SPONSORS.map(s => (
                <div key={s.id} onClick={() => { setTab('exhibit'); setSelectedBooth(s); }}
                  style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${s.color}30`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                    {s.logo}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>{s.name}</div>
                    <div style={{ fontSize: 8, color: s.color, fontWeight: 700 }}>VISIT BOOTH →</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ISOMETRIC SPONSOR EXPO HALL (Inspired by Image 3 & 4) ── */}
      {tab === 'exhibit' && (
        <div style={{ padding: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#A3FF12' }}>🖼️ Sponsor Exhibition Hall</h2>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Click on any sponsor booth logo to zoom in and interact</p>
          </div>

          {/* Sponsor Booths Grid Layout (Inspired by Image 3) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            {SPONSORS.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                onClick={() => setSelectedBooth(s)}
                style={{
                  background: 'linear-gradient(135deg, rgba(22,27,34,0.95) 0%, rgba(13,17,23,0.98) 100%)',
                  border: `1px solid ${s.color}40`,
                  borderRadius: 20, padding: 16, cursor: 'pointer', position: 'relative', overflow: 'hidden'
                }}>
                {/* Header glow bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color }} />

                <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}15`, border: `1px solid ${s.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    {s.logo}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{s.name}</span>
                      <span style={{ background: `${s.color}20`, color: s.color, fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 6 }}>BOOTH ONLINE</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>{s.desc}</div>
                  </div>
                </div>

                {/* Simulated interactive items of the booth (Inspired by Image 4) */}
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {s.boards.slice(0, 2).map((b, idx) => (
                    <span key={idx} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 8px', fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
                      📋 {b}
                    </span>
                  ))}
                  <span style={{ background: 'rgba(163,255,18,0.1)', border: '1px solid rgba(163,255,18,0.2)', borderRadius: 8, padding: '4px 8px', fontSize: 8, color: '#A3FF12', fontWeight: 900, marginLeft: 'auto' }}>
                    🎁 Claim Swag Bag
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Zoomed Booth Detail Modal View (Inspired by Image 4) */}
          <AnimatePresence>
            {selectedBooth && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                onClick={() => setSelectedBooth(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: '#0D1117', border: `1px solid ${selectedBooth.color}60`, borderRadius: 24, padding: 20, width: '100%', maxWidth: 360,
                    boxShadow: `0 0 40px ${selectedBooth.color}25`
                  }}>
                  {/* Booth Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: `${selectedBooth.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                      {selectedBooth.logo}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{selectedBooth.name}</div>
                      <div style={{ fontSize: 10, color: selectedBooth.color, fontWeight: 700 }}>Interactive Booth Display</div>
                    </div>
                  </div>

                  {/* Representative Avatar standing (Inspired by Image 4) */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)', borderRadius: 14, padding: 12, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <span style={{ fontSize: 32 }}>{selectedBooth.avatar}</span>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>BOOTH MANAGER</div>
                      <div style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>Hello! Tap the display boards to learn more or claim your swag items.</div>
                    </div>
                  </div>

                  {/* Clickable Image Board / Display Boards */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: 8, letterSpacing: 0.5 }}>CLICKABLE DISPLAY BOARDS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedBooth.boards.map((b, idx) => (
                        <div key={idx} onClick={() => toast.success(`📋 Info loaded: "${b}"`, { duration: 2000 })}
                          style={{
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', fontSize: 11, cursor: 'pointer',
                            display: 'flex', justifyBetween: 'space-between', alignItems: 'center', transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = selectedBooth.color}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
                          <span>{b}</span>
                          <span style={{ color: selectedBooth.color, fontSize: 12 }}>→</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={() => claimSwag(selectedBooth.id, selectedBooth.swag.item)}
                      style={{
                        width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: selectedBooth.color, color: '#000', fontSize: 13, fontWeight: 900, cursor: 'pointer',
                        boxShadow: `0 4px 16px ${selectedBooth.color}40`
                      }}>
                      🎒 Claim Swag Reward
                    </button>
                    {selectedBooth.links.map((lnk, idx) => (
                      <button key={idx} onClick={() => toast.success(`🔗 Launching ${lnk.label}...`)}
                        style={{
                          width: '100%', padding: '10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 800, cursor: 'pointer'
                        }}>
                        {lnk.label}
                      </button>
                    ))}
                    <button onClick={() => setSelectedBooth(null)}
                      style={{
                        width: '100%', padding: '10px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginTop: 4
                      }}>
                      Close Booth View
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── TAB 3: SPONSOR SWAG BAG (Inspired by Swag bag feature) ── */}
      {tab === 'swag' && (
        <div style={{ padding: 16 }}>
          <div style={{
            background: 'linear-gradient(135deg, #2B1B0A 0%, #0D1117 100%)',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            borderRadius: 20, padding: 18, marginBottom: 16, textAlign: 'center'
          }}>
            <span style={{ fontSize: 36 }}>🎒</span>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#FFD700', marginTop: 6 }}>Sponsor Swag Bag Inventory</h2>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 1.4 }}>
              Claim vouchers, tokens, and badge achievements sponsored by our Web3 partners. Keep node activated to unlock claims.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SPONSORS.map(s => {
              const claimed = swagClaimed[s.id];
              return (
                <div key={s.id}
                  style={{
                    background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 14,
                    display: 'flex', justifyBetween: 'space-between', alignItems: 'center', gap: 12
                  }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {s.logo}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 2 }}>{s.name} Swag</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{s.swag.item}</div>
                  </div>
                  
                  {claimed ? (
                    <div style={{ background: 'rgba(163,255,18,0.1)', border: '1px solid rgba(163,255,18,0.3)', borderRadius: 10, padding: '6px 12px', fontSize: 10, fontWeight: 900, color: '#A3FF12', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{s.swag.claimedIcon}</span> CLAIMED
                    </div>
                  ) : (
                    <button onClick={() => claimSwag(s.id, s.swag.item)}
                      style={{
                        background: s.color, color: '#000', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 10, fontWeight: 900, cursor: 'pointer'
                      }}>
                      Claim
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
