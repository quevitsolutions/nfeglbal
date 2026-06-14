import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Layers, Share2, Crown, ChevronRight, Info, 
  TrendingUp, Users, Target, Activity, ShieldCheck
} from 'lucide-react';
import { useGameStore } from '../store/gameStore.js';
import { useContract } from '../hooks/useContract.js';
import { formatNumber, formatBNB, shortAddr } from '../utils/format.js';
import { useNativePrice } from '../hooks/useNativePrice.js';
import { CONTRACTS } from '../config/constants.js';

// ── Inline Income Calculator (Mini) ──────────────────────────────────────────
const LVL_USD_COST_D = [5,5,10,20,40,80,160,320,640,1280,2560,5120,10240,20480,40960,81920,163840,327680];
const TC_D = ['#A3FF12','#B4FF3A','#FFD700','#FFC107','#FF9800','#FF7043','#FF5252','#E91E63','#AB47BC','#7E57C2','#5C6BC0','#42A5F5','#26C6DA','#26A69A','#66BB6A','#8BC34A','#CDDC39','#FF6B35'];
const TIER_NFEGlobal_D = [100,200,200,300,300,300,500,500,500,800,800,800,1200,1200,1200,2000,2000,2500];
function fmtD(n){ if(n>=1e9)return(n/1e9).toFixed(2)+'B'; if(n>=1e6)return(n/1e6).toFixed(2)+'M'; if(n>=1e3)return(n/1e3).toFixed(1)+'K'; return n.toFixed?n.toFixed(2):n; }

function IncomeCalcMini({ nodeTier }) {
  const [open, setOpen]     = useState(false);
  const [nativePrice, setNativePrice] = useState(600);
  const [myTier, setMyTier] = useState(Math.max(1, Number(nodeTier)||1));
  const acc = '#FFB74D';

  const levels = LVL_USD_COST_D.map((costUsd, i) => {
    const lv        = i + 1;
    const people    = Math.pow(2, lv);
    const earnPer   = costUsd * 0.70;
    const totalEarn = people * earnPer;
    const locked    = lv > myTier;
    return { lv, people, costUsd, earnPer, totalEarn, locked };
  });

  const unlocked  = levels.filter(l => !l.locked);
  const totPeople = unlocked.reduce((s,l) => s + l.people, 0);
  const totUsd    = unlocked.reduce((s,l) => s + l.totalEarn, 0);
  const totBnb    = nativePrice > 0 ? totUsd / nativePrice : 0;

  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width:'100%', background:open?'rgba(255,183,77,0.10)':'rgba(255,255,255,0.04)', border:`1px solid ${open?'rgba(255,183,77,0.4)':'rgba(255,255,255,0.1)'}`, borderRadius:open?'14px 14px 0 0':14, padding:'14px 16px', color:open?acc:'#fff', fontWeight:900, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, transition:'all 0.2s' }}>
        <span style={{ fontSize:18 }}>💰</span> MATRIX INCOME CALCULATOR <span style={{ marginLeft:'auto' }}>{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div style={{ background:'rgba(0,0,0,0.45)', border:`1px solid ${acc}25`, borderTop:'none', borderRadius:'0 0 14px 14px', padding:'16px 14px' }}>
          {/* Formula */}
          <div style={{ background:'rgba(255,183,77,0.06)', borderRadius:10, padding:'8px 12px', marginBottom:12, fontSize:9, color:'rgba(255,255,255,0.5)', lineHeight:1.7 }}>
            <span style={{ color:acc, fontWeight:900 }}>FORMULA: </span>People = 2<sup>L</sup> &nbsp;·&nbsp; Earn = <span style={{ color:'#A3FF12' }}>Level Cost × 70%</span>
          </div>
          {/* Controls */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 12px', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize:8, fontWeight:900, color:'#888', letterSpacing:1, marginBottom:4 }}>NATIVE PRICE $</div>
              <input type="number" value={nativePrice} onChange={e => setNativePrice(Number(e.target.value)||0)} min={0}
                style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'#fff', fontWeight:900, fontSize:14, fontFamily:'monospace' }} />
            </div>
            <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 12px', border:`1px solid ${TC_D[myTier-1]}40` }}>
              <div style={{ fontSize:8, fontWeight:900, color:'#888', letterSpacing:1, marginBottom:4 }}>YOUR LEVEL</div>
              <select value={myTier} onChange={e => setMyTier(Number(e.target.value))}
                style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:TC_D[myTier-1], fontWeight:900, fontSize:13, cursor:'pointer' }}>
                {LVL_USD_COST_D.map((usd,i) => <option key={i} value={i+1} style={{ background:'#111' }}>L{i+1} — ${usd}</option>)}
              </select>
            </div>
          </div>
          {/* Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
            {[
              {label:'NODES',val:fmtD(totPeople),color:'#4FC3F7'},
              {label:'EST BNB',val:totBnb.toFixed(3),color:'#FFD700'},
              {label:'EST USD',val:'$'+fmtD(totUsd),color:'#A3FF12'},
            ].map((c,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'8px 6px', textAlign:'center', border:`1px solid ${c.color}20` }}>
                <div style={{ fontSize:13, fontWeight:900, color:c.color }}>{c.val}</div>
                <div style={{ fontSize:7, color:'#444', fontWeight:900, marginTop:2 }}>{c.label}</div>
              </div>
            ))}
          </div>
          {/* Level table */}
          <div style={{ fontSize:9, fontWeight:900, color:'#4FC3F7', letterSpacing:1, marginBottom:6 }}>📊 LEVEL-WISE 70% INCOME</div>
          <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:10, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'32px 48px 56px 56px 1fr', gap:4, padding:'6px 10px', background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              {['LVL','PEOPLE','COST $','70% EA','TOTAL $'].map(h => <span key={h} style={{ fontSize:7, fontWeight:900, color:'#555' }}>{h}</span>)}
            </div>
            <div style={{ maxHeight:280, overflowY:'auto' }}>
              {levels.map(({ lv, people, costUsd, earnPer, totalEarn, locked }) => {
                const color = TC_D[(lv-1)%18];
                return (
                  <div key={lv} style={{ display:'grid', gridTemplateColumns:'32px 48px 56px 56px 1fr', gap:4, padding:'6px 10px', borderBottom:'1px solid rgba(255,255,255,0.03)', alignItems:'center', opacity:locked?0.3:1 }}>
                    <span style={{ fontSize:8, fontWeight:900, color, background:`${color}18`, borderRadius:3, padding:'1px 3px', textAlign:'center' }}>L{lv}</span>
                    <span style={{ fontSize:8, color:'#ccc' }}>{fmtD(people)}</span>
                    <span style={{ fontSize:8, color:'#FFB74D' }}>${costUsd}</span>
                    <span style={{ fontSize:8, color:'#FFD700' }}>${earnPer.toFixed(2)}</span>
                    <span style={{ fontSize:8, color:'#A3FF12', fontWeight:800 }}>${fmtD(totalEarn)}</span>
                  </div>
                );
              })}
              <div style={{ display:'grid', gridTemplateColumns:'32px 48px 56px 56px 1fr', gap:4, padding:'7px 10px', background:`rgba(255,183,77,0.07)`, borderTop:`1px solid ${acc}30`, alignItems:'center' }}>
                <span style={{ fontSize:7, fontWeight:900, color:acc }}>ALL</span>
                <span style={{ fontSize:8, color:'#ccc', fontWeight:900 }}>{fmtD(totPeople)}</span>
                <span style={{ fontSize:8, color:'#888' }}>—</span>
                <span style={{ fontSize:8, color:'#888' }}>—</span>
                <span style={{ fontSize:8, color:'#A3FF12', fontWeight:900 }}>${fmtD(totUsd)}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize:8, color:'#333', fontWeight:700, marginTop:10, textAlign:'center' }}>⚠️ ESTIMATES ONLY · BINARY MATRIX · 70% DISTRIBUTION</div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const {
    walletAddress, hasNode, nodeId, nodeActive, nodeTier,
    totalEarned, pendingReward, teamSize, directRefs,
    poolClaimable, poolQual, isConnected,
    conversionHistory, isFreeActive, globalStats,
    bnbBalance, sponsorNodeId
  } = useGameStore();
  
  const { loadNodeData, connectWallet, claimPool, claimRewards, fetchTeamCounts, registerPool } = useContract();
  const nativePrice = useNativePrice();
  
  const [levelCounts, setLevelCounts] = useState([]);
  const [selectedIncome, setSelectedIncome] = useState(null);

  const usd = (bnb) => nativePrice > 0 ? <span style={{ fontSize: 11, fontWeight: 700, color: '#4FC3F7', display: 'block', marginTop: 2 }}>≈ ${(parseFloat(bnb || 0) * nativePrice).toFixed(2)}</span> : null;

  const INCOME_TYPES = [
    {
      id: 'direct',
      name: 'DIRECT REWARD',
      share: '10.0%',
      color: '#FF7043',
      icon: <Zap size={18} />,
      desc: 'Earn 10% instantly from every node activation and tier upgrade performerd by your direct referrals. Infinite width, applies to all 18 tiers.'
    },
    {
      id: 'layer',
      name: 'LAYER YIELD',
      share: '15.0%',
      color: '#4FC3F7',
      icon: <Layers size={18} />,
      desc: 'Deep penetration rewards across 10 layers. Flat 1.5% commission per layer. Requires 2 direct referrals to unlock deep depth (Layers 6-10).'
    },
    {
      id: 'matrix',
      name: 'MATRIX CASCADE',
      share: '70.0%',
      color: 'var(--neon-lime)',
      icon: <Share2 size={18} />,
      desc: 'Our flagship algorithm. Targeted 70% binary payload with a 10-level fallback split. Ensures 100% distribution even if parents are unqualified.'
    },
    {
      id: 'pool',
      name: 'GLOBAL POOL',
      share: '5.0%',
      color: '#FFD700',
      icon: <Crown size={18} />,
      desc: 'Lifetime royalty sharing from 5% of all global platform volume. Passive yield generated by every single transaction in the ecosystem.'
    }
  ];


  useEffect(() => {
    if (walletAddress) {
      loadNodeData(walletAddress);
    }
  }, [walletAddress, loadNodeData]);

  useEffect(() => {
    if (isConnected && nodeId) {
      fetchTeamCounts(nodeId).then(setLevelCounts);
    }
  }, [isConnected, nodeId, fetchTeamCounts]);

  const calcDirects = levelCounts.length > 0 ? levelCounts[0] : (directRefs || 0);
  const calcTotal = levelCounts.length > 0 ? levelCounts.reduce((a, b) => a + b, 0) : (teamSize || 0);

  return (
    <div className="page page-dashboard">
      {/* Hero Header */}
      <div style={{ padding: '20px 0 32px', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 16px' }}>
          <div style={{ 
            width: '100%', height: '100%', 
            background: 'var(--bg-card)', 
            borderRadius: '24px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '36px',
            border: `2px solid ${hasNode && nodeActive ? 'var(--neon-lime)' : '#FF3B30'}`,
            boxShadow: hasNode && nodeActive ? '0 0 20px rgba(203, 255, 1, 0.2)' : 'none'
          }}>
            {hasNode ? '⬡' : '👤'}
          </div>
          {hasNode && nodeActive && (
            <div style={{ 
              position: 'absolute', bottom: -5, right: -5,
              width: '24px', height: '24px', borderRadius: '50%',
              background: 'var(--neon-lime)', border: '4px solid var(--bg-dark)',
              animation: 'pulse 2s infinite'
            }} />
          )}
        </div>
        <h2 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.02em', textShadow: '0 0 10px rgba(255,255,255,0.1)' }}>
          {hasNode ? `NODE #${nodeId}` : (isFreeActive ? 'FREE OPERATIVE' : 'GUEST OPERATOR')}
        </h2>
        <div style={{ 
          display: 'inline-flex', padding: '4px 12px', borderRadius: '20px', 
          background: 'rgba(255,255,255,0.05)', marginTop: 8, gap: 8, alignItems: 'center'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#FF5252' }}>
            {isConnected ? shortAddr(walletAddress) : 'NOT CONNECTED'}
          </span>
          {isConnected && <span style={{ color: 'var(--neon-lime)', fontSize: '10px' }}>●</span>}
        </div>
      </div>

        {/* Total Earned - Main Highlight with Animation */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="partner-card" 
          style={{ 
            flexDirection: 'column', alignItems: 'center', margin: '0 0 12px', padding: '24px 20px',
            background: 'linear-gradient(135deg, rgba(203,255,1,0.12) 0%, rgba(203,255,1,0.03) 100%)',
            border: '1px solid rgba(203,255,1,0.25)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#A3FF12', letterSpacing: 2, marginBottom: 8 }}>ALGORITHMIC NODE FLOW (BNB)</span>
          <span style={{ fontSize: '36px', fontWeight: 950, color: '#fff', textShadow: '0 0 20px rgba(203,255,1,0.4)' }}>{formatBNB(totalEarned)}</span>
          {usd(totalEarned)}
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
          {((hasNode || isFreeActive) ? [
            { 
              label: 'SELF LEVEL', 
              val: hasNode ? `TIER ${nodeTier}` : 'FREE OPERATIVE', 
              sub: hasNode ? `Spent: ${formatBNB(poolQual.totalDeposited)}` : 'Free Trial Node', 
              color: '#FFB74D', 
              glowKey: null 
            },
            { 
              label: 'UNCLAIMED', 
              val: formatBNB(pendingReward), 
              sub: 'Node Balance', 
              color: 'var(--neon-lime)', 
              glowKey: parseFloat(pendingReward) > 0 ? 'lime' : null, 
              action: parseFloat(pendingReward) > 0 ? 'TAP TO CLAIM' : null 
            },
            { 
              label: 'POOL ROI', 
              val: hasNode ? formatBNB(poolClaimable) : '0.00 BNB', 
              sub: hasNode ? 'Global Payout' : 'Ineligible (Free)', 
              color: hasNode ? '#4FC3F7' : '#444', 
              glowKey: (hasNode && parseFloat(poolClaimable) > 0) ? 'blue' : null, 
              action: (hasNode && parseFloat(poolClaimable) > 0) ? 'TAP TO CLAIM' : null 
            },
            { 
              label: 'ACTIVE SPONSOR', 
              val: sponsorNodeId ? `#${sponsorNodeId}` : 'GENESIS', 
              sub: 'Matrix Parent', 
              color: '#9B51FF', 
              glowKey: null 
            }
          ] : [
            { label: 'SELF LEVEL', val: 'INACTIVE', sub: 'No Node Activated', color: '#FF5252', glowKey: null },
            { label: 'WALLET BAL', val: `${parseFloat(bnbBalance).toFixed(4)} BNB`, sub: 'Ready to Activate', color: 'var(--neon-lime)', glowKey: null },
            { label: 'POOL ROI', val: '0.00 BNB', sub: 'Ineligible', color: '#444', glowKey: null },
            { label: 'SPONSOR', val: sponsorNodeId ? `#${sponsorNodeId}` : 'GENESIS', sub: 'Matrix Parent', color: '#9B51FF', glowKey: null }
          ]).map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={(e) => {
                if (item.glowKey === 'lime' && nodeId)  claimRewards();
                if (item.glowKey === 'blue' && nodeId) claimPool(nodeId);
              }}
              className="partner-card" 
              style={{ 
                flexDirection: 'column', alignItems: 'flex-start', margin: 0, padding: 16,
                border: item.glowKey === 'lime' ? '1px solid rgba(163,255,18,0.5)' 
                      : item.glowKey === 'blue' ? '1px solid rgba(79,195,247,0.5)' 
                      : '1px solid rgba(255,255,255,0.05)',
                boxShadow: item.glowKey === 'lime' ? '0 0 12px rgba(163,255,18,0.15)' 
                         : item.glowKey === 'blue' ? '0 0 12px rgba(79,195,247,0.15)' 
                         : 'none',
                cursor: item.glowKey ? 'pointer' : 'default',
                transition: 'border 0.3s, box-shadow 0.3s'
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 800, color: item.color, letterSpacing: 0.5 }}>{item.label}</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff', marginTop: 4 }}>{item.val}</span>
              {item.action ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <span style={{ fontSize: '9px', color: item.color, fontWeight: 900, letterSpacing: 1, animation: 'pulse 1.5s infinite' }}>{item.action} →</span>
                </div>
              ) : (
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{item.sub}</span>
              )}
            </motion.div>
          ))}
        </div>

        {/* ALGORITHMIC INCOME ARCHITECTURE - NEW INTERACTIVE SECTION */}
        <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="#A3FF12" /> INCOME DISTRIBUTION ARCHITECTURE
        </h3>
        
        <div style={{ 
          background: 'var(--bg-card)', 
          borderRadius: '24px', 
          padding: '24px', 
          border: '1px solid rgba(203, 255, 1, 0.1)',
          marginBottom: 32,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Animated SVG Backdrop */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.1, pointerEvents: 'none' }}>
            <svg width="100%" height="100%" viewBox="0 0 400 400">
              <motion.circle 
                cx="200" cy="200" r="100" fill="none" stroke="var(--neon-lime)" strokeWidth="0.5" 
                animate={{ r: [100, 110, 100], opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
              <line x1="200" y1="200" x2="0" y2="0" stroke="white" strokeWidth="0.5" />
              <line x1="200" y1="200" x2="400" y2="0" stroke="white" strokeWidth="0.5" />
              <line x1="200" y1="200" x2="0" y2="400" stroke="white" strokeWidth="0.5" />
              <line x1="200" y1="200" x2="400" y2="400" stroke="white" strokeWidth="0.5" />
            </svg>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, position: 'relative', zIndex: 2 }}>
            {INCOME_TYPES.map((type) => (
              <motion.div
                key={type.id}
                layout
                onClick={() => setSelectedIncome(selectedIncome === type.id ? null : type.id)}
                whileTap={{ scale: 0.96 }}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedIncome === type.id ? type.color : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '16px',
                  padding: '16px',
                  cursor: 'pointer',
                  boxShadow: selectedIncome === type.id ? `0 0 15px ${type.color}20` : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ 
                    padding: 8, borderRadius: '10px', background: `${type.color}15`, color: type.color 
                  }}>
                    {type.icon}
                  </div>
                  <span style={{ fontSize: '18px', fontWeight: 950, color: type.color, textShadow: `0 0 10px ${type.color}40` }}>{type.share}</span>
                </div>
                
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#fff', letterSpacing: 0.5 }}>{type.name}</div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Info size={10} /> TAP FOR SPECS
                </div>
                
                <AnimatePresence>
                  {selectedIncome === type.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ marginTop: 16, overflow: 'hidden' }}
                    >
                      <p style={{ fontSize: '11px', lineHeight: 1.6, color: '#ddd', margin: 0, fontWeight: 500 }}>
                        {type.desc}
                      </p>
                      <div style={{ 
                        marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', gap: 8, color: type.color, fontSize: '10px', fontWeight: 900
                      }}>
                        <ShieldCheck size={12} /> PROTOCOL VERIFIED
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Reward Pool Command Center */}
      <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#FF5252', marginBottom: 12 }}>COMMAND: REWARD POOL</h3>
      <div className="partner-card" style={{ flexDirection: 'column', padding: 20, marginBottom: 24, background: 'rgba(203, 255, 1, 0.02)', border: '1px solid rgba(203, 255, 1, 0.1)' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#FFFFFF' }}>QUALIFYING FOR</span>
            <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--neon-lime)' }}>{poolQual.poolName.toUpperCase()}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#FFB74D' }}>STATUS</span>
            <div style={{ fontSize: '14px', fontWeight: 900, color: poolQual.isPoolQualified ? 'var(--neon-lime)' : '#FF3B30' }}>
              {poolQual.isPoolQualified ? 'QUALIFIED' : 'PENDING'}
            </div>
          </div>
        </div>

        {/* Qualification Bars */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'DIRECT FRIENDS', current: calcDirects, missing: poolQual.missingDirects },
            { label: 'SELF LEVEL', current: nodeTier, missing: poolQual.missingTier },
            { label: 'TOTAL TEAM', current: calcTotal, missing: poolQual.missingTeam },
          ].map(req => {
            const total = req.current + req.missing;
            const progress = total === 0 ? 0 : Math.min(100, (req.current / total) * 100);
            return (
              <div key={req.label} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#FFD700' }}>{req.label}</span>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: progress >= 100 ? 'var(--neon-lime)' : '#fff' }}>
                    {req.current} / {total}
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: progress >= 100 ? 'var(--neon-lime)' : '#555', transition: 'width 1s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pool Lifetime Stats Row — 3 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {[
            { label: 'POOL EARNED',  val: formatBNB(poolQual.totalPoolEarned),  color: '#A3FF12', icon: '⬡' },
            { label: 'POOL CLAIMED', val: formatBNB(poolQual.totalPoolClaimed), color: '#4FC3F7', icon: '✅' },
            { label: 'DEPOSITED',    val: formatBNB(poolQual.totalDeposited),   color: '#FFD700', icon: '📥' },

          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', fontWeight: 800, letterSpacing: 0.5, marginTop: 2 }}>{s.label}</div>
              {nativePrice > 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>≈ ${(parseFloat(s.val) * nativePrice).toFixed(2)}</div>}
            </div>
          ))}
        </div>

        {/* Pool Cap Row — lifetime cap + remaining with progress bar */}
        {parseFloat(poolQual.lifetimeCap) > 0 && (() => {
          const cap      = parseFloat(poolQual.lifetimeCap  || 0);
          const rem      = parseFloat(poolQual.remainingCap || 0);
          const used     = cap - rem;
          const usedPct  = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
          const capColor = usedPct >= 90 ? '#FF5252' : usedPct >= 60 ? '#FFB74D' : '#A3FF12';
          return (
            <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '14px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: 0.5 }}>POOL CAP</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#FFD700' }}>{formatBNB(cap)}</span>
                  {nativePrice > 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>≈ ${(cap * nativePrice).toFixed(2)}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: 0.5 }}>REMAINING</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: capColor }}>{formatBNB(rem)}</span>
                  {nativePrice > 0 && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>≈ ${(rem * nativePrice).toFixed(2)}</span>}
                </div>
              </div>
              {/* Progress bar — used vs cap */}
              <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${usedPct}%`, height: '100%', background: capColor, borderRadius: 3, transition: 'width 1s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>USED {usedPct.toFixed(1)}%</span>
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>CAP LIMIT {formatBNB(cap)}</span>
              </div>
            </div>
          );
        })()}

        {poolQual.isPoolQualified && poolQual.poolName !== "Gold" && (
          <button 
            className="giant-btn" 
            style={{ 
              marginTop: 24, 
              background: 'var(--neon-lime)', 
              color: '#000', 
              height: 44, 
              fontSize: 13,
              boxShadow: '0 0 20px rgba(203, 255, 1, 0.4)'
            }}
            onClick={() => registerPool(nodeId)}
          >
            ACTIVATE {poolQual.poolName === 'None' ? 'BRONZE' : poolQual.poolName === 'Bronze' ? 'SILVER' : 'GOLD'} POOL
          </button>
        )}


        {/* Claim Node Rewards — activates when pendingReward > 0 */}
        {parseFloat(pendingReward) > 0 && (
          <button 
            className="giant-btn" 
            style={{ 
              marginTop: 16, 
              background: 'linear-gradient(135deg, var(--neon-lime), #7BFF00)',
              color: '#000', height: 48, fontSize: 13, fontWeight: 900,
              boxShadow: '0 0 20px rgba(163,255,18,0.35)'
            }}
            onClick={() => claimRewards()}
          >
            ⬡ CLAIM NODE REWARDS ({formatBNB(pendingReward)})
          </button>
        )}

        {/* Claim Pool Rewards — activates when poolClaimable > 0 */}
        {parseFloat(poolClaimable) > 0 && (
          <button 
            className="giant-btn" 
            style={{ 
              marginTop: 12,
              background: 'linear-gradient(135deg, #4FC3F7, #0288D1)',
              color: '#000', height: 48, fontSize: 13, fontWeight: 900,
              boxShadow: '0 0 20px rgba(79,195,247,0.35)'
            }}
            onClick={() => claimPool(nodeId)}
          >
            🏆 CLAIM POOL REWARDS ({formatBNB(poolClaimable)})
          </button>
        )}

        {/* Show a disabled state when neither is claimable */}
        {parseFloat(pendingReward) <= 0 && parseFloat(poolClaimable) <= 0 && (
          <div style={{
            marginTop: 16, padding: '14px', borderRadius: 12, textAlign: 'center',
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)'
          }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: 1 }}>NO CLAIMABLE BALANCE</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>Rewards accumulate from matrix activity</div>
          </div>
        )}
      </div>

      {/* Network Stats Card */}
      <div className="partner-card" style={{ flexDirection: 'column', padding: 20, marginBottom: 32 }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: '14px', fontWeight: 800 }}>NETWORK GROWTH</span>
          <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--neon-lime)' }}>LEVEL {nodeTier}</span>
        </div>
        <div style={{ width: '100%', display: 'flex', gap: 32 }}>
          <div className="flex-column">
            <span style={{ fontSize: '24px', fontWeight: 900 }}>{calcDirects}</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#A3FF12' }}>DIRECT FRIENDS</span>
          </div>
          <div className="flex-column">
            <span style={{ fontSize: '24px', fontWeight: 900 }}>{calcTotal}</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#4FC3F7' }}>TOTAL NETWORK</span>
          </div>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: 20, overflow: 'hidden' }}>
          <div style={{ width: '45%', height: '100%', background: 'var(--neon-lime)', boxShadow: '0 0 10px var(--neon-lime)' }} />
        </div>
      </div>

      {/* Protocol Global Stats Card */}
      <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#FF5252', marginBottom: 12, marginTop: 32 }}>PROTOCOL GLOBAL INSIGHTS</h3>
      <div className="partner-card" style={{ padding: '24px 20px', marginBottom: 24, background: 'linear-gradient(180deg, rgba(203,255,1,0.05) 0%, transparent 100%)', border: '1px solid rgba(203,255,1,0.1)' }}>
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--neon-lime)' }}>
              {parseFloat(globalStats?.total_volume_bnb || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#FFFFFF', marginTop: 2 }}>TOTAL VOL (BNB)</div>
            {nativePrice > 0 && <div style={{ fontSize: '9px', fontWeight: 700, color: '#4FC3F7', marginTop: 1 }}>≈ ${(parseFloat(globalStats?.total_volume_bnb || 0) * nativePrice).toFixed(0)}</div>}
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900 }}>{globalStats?.active_nodes || 0}</div>
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#FFB74D', marginTop: 4 }}>ACTIVE OPERATORS</div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900 }}>{globalStats?.total_users || 0}</div>
            <div style={{ fontSize: '9px', fontWeight: 800, color: '#FFD700', marginTop: 4 }}>TOTAL NETWORK</div>
          </div>
        </div>
      </div>



      {/* Income Calculator */}
      <IncomeCalcMini nodeTier={nodeTier} />

      {/* Wallet Actions */}
      {!isConnected ? (
        <button className="giant-btn" style={{ position: 'relative', bottom: 0, marginBottom: 32 }} onClick={connectWallet}>
          CONNECT BSC WALLET
        </button>
      ) : (
        <div className="partner-card" style={{ padding: 16, justifyContent: 'space-between', background: 'rgba(255,59,48,0.05)', border: '1px solid rgba(255,59,48,0.1)' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#FF3B30' }}>CONNECTED WALLET</span>
          <span style={{ fontSize: '12px', fontWeight: 700 }}>{shortAddr(walletAddress)}</span>
        </div>
      )}

      {/* Contract Verification Section */}
      <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', margin: '32px 0 12px', textAlign: 'center' }}>
        SMART CONTRACT VERIFICATION
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, paddingBottom: 60 }}>
        {[
          { name: 'CORE', addr: CONTRACTS.NFEGLOBAL },
          { name: 'VIEW', addr: CONTRACTS.NFEGLOBALVIEW },
          { name: 'POOL', addr: CONTRACTS.REWARDPOOL },
        ].map(c => (
          <a 
            key={c.name}
            href={`https://bscscan.com/address/${c.addr}`}
            target="_blank" rel="noreferrer"
            style={{ 
              background: 'var(--bg-card)', padding: '16px 8px', 
              borderRadius: '16px', textAlign: 'center', textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 900, color: '#fff', marginBottom: 4 }}>{c.name}</div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--neon-lime)' }}>{shortAddr(c.addr)}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
