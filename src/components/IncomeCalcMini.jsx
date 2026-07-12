import React, { useState } from 'react';
import { Share2, Info, ShieldCheck } from 'lucide-react';
import { formatNumber } from '../utils/format.js';

const LVL_USD_COST_D = [5,5,10,20,40,80,160,320,640,1280,2560,5120,10240,20480,40960,81920,163840,327680];
const LVL_VESTING_DAYS = [5,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,90];
const TC_D = ['#A3FF12','#B4FF3A','#FFD700','#FFC107','#FF9800','#FF7043','#FF5252','#E91E63','#AB47BC','#7E57C2','#5C6BC0','#42A5F5','#26C6DA','#26A69A','#66BB6A','#8BC34A','#CDDC39','#FF6B35'];
function fmtD(n){ if(n>=1e9)return(n/1e9).toFixed(2)+'B'; if(n>=1e6)return(n/1e6).toFixed(2)+'M'; if(n>=1e3)return(n/1e3).toFixed(1)+'K'; return n.toFixed?n.toFixed(2):n; }

export default function IncomeCalcMini({ nodeTier }) {
  const [nativePrice, setNativePrice] = useState(600);
  const [myTier, setMyTier] = useState(Math.max(1, Number(nodeTier)||1));
  const acc = '#FFB74D';

  const levels = LVL_USD_COST_D.map((costUsd, i) => {
    const lv        = i + 1;
    const people    = Math.pow(2, lv);
    const earnPer   = costUsd * 0.70;
    const totalEarn = people * earnPer;
    const vDays     = LVL_VESTING_DAYS[i] || 5;
    const dailyEarn = totalEarn / vDays;
    const locked    = lv > myTier;
    return { lv, people, costUsd, earnPer, totalEarn, dailyEarn, vDays, locked };
  });

  const unlocked  = levels.filter(l => !l.locked);
  const totPeople = unlocked.reduce((s,l) => s + l.people, 0);
  const totUsd    = unlocked.reduce((s,l) => s + l.totalEarn, 0);
  const totBnb    = nativePrice > 0 ? totUsd / nativePrice : 0;

  return (
    <div style={{ 
      background: 'rgba(5, 8, 15, 0.4)', 
      border: '1px solid rgba(255, 255, 255, 0.05)', 
      borderRadius: 24, 
      padding: '24px 20px', 
      marginBottom: 32,
      fontFamily: 'Outfit, sans-serif',
      textAlign: 'left'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ background: 'rgba(163,255,18,0.1)', padding: 10, borderRadius: 14 }}>
          <Share2 size={22} color="var(--neon-lime)" />
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 955, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>Level-wise Matrix Plan</h2>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '4px 0 0' }}>70% Algorithmic Daily Yield split over 5-90 Days</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
        <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:14, padding:'10px 14px', border:'1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize:8, fontWeight:900, color:'#888', letterSpacing:1, marginBottom:4 }}>NATIVE PRICE (USD)</div>
          <input type="number" value={nativePrice} onChange={e => setNativePrice(Number(e.target.value)||0)} min={0}
            style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'#fff', fontWeight:900, fontSize:14, fontFamily:'monospace' }} />
        </div>
        <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:14, padding:'10px 14px', border:`1px solid ${TC_D[myTier-1]}40` }}>
          <div style={{ fontSize:8, fontWeight:900, color:'#888', letterSpacing:1, marginBottom:4 }}>YOUR SIMULATED TIER</div>
          <select value={myTier} onChange={e => setMyTier(Number(e.target.value))}
            style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:TC_D[myTier-1], fontWeight:900, fontSize:13, cursor:'pointer' }}>
            {LVL_USD_COST_D.map((usd,i) => <option key={i} value={i+1} style={{ background:'#111' }}>L{i+1} — ${usd} Tier</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
        {[
          {label:'TOTAL CAPACITY',val:fmtD(totPeople),color:'#4FC3F7'},
          {label:'TOTAL EST BNB',val:totBnb.toFixed(2) + ' BNB',color:'#FFD700'},
          {label:'TOTAL EST USD',val:'$'+formatNumber(totUsd),color:'#A3FF12'},
        ].map((c,i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.02)', borderRadius:12, padding:'12px 8px', textAlign:'center', border:`1px solid ${c.color}20` }}>
            <div style={{ fontSize:14, fontWeight:955, color:c.color }}>{c.val}</div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', fontWeight:900, marginTop:4, letterSpacing: 0.5 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Level table */}
      <div style={{ background:'rgba(0,0,0,0.25)', borderRadius:16, border: '1px solid rgba(255,255,255,0.04)', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'44px 1fr 110px 24px', gap:6, padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {['LEVEL','DAILY PAYOUT (VESTING)','TOTAL USD',''].map((h, i) => (
            <span key={h} style={{ fontSize:8, fontWeight:900, color:'rgba(255,255,255,0.4)', textAlign: i===2?'right':i===3?'center':'left' }}>{h}</span>
          ))}
        </div>
        <div style={{ maxHeight:360, overflowY:'auto' }}>
          {levels.map(({ lv, people, costUsd, earnPer, totalEarn, dailyEarn, vDays, locked }) => {
            const color = TC_D[(lv-1)%18];
            return (
              <div 
                key={lv} 
                style={{ 
                  display:'grid', 
                  gridTemplateColumns:'44px 1fr 110px 24px', 
                  gap:6, 
                  padding:'10px 14px', 
                  borderBottom:'1px solid rgba(255,255,255,0.02)', 
                  alignItems:'center', 
                  opacity:locked?0.4:1,
                  background: !locked ? 'rgba(163,255,18,0.01)' : 'transparent',
                  transition: 'background 0.2s'
                }}
              >
                <span style={{ fontSize:9, fontWeight:955, color, background:`${color}12`, border: `1px solid ${color}25`, borderRadius:6, padding:'2px 6px', textAlign:'center', width: 'fit-content' }}>
                  L{lv}
                </span>
                <span style={{ fontSize:11, color:'#fff', fontWeight: 600 }}>
                  ${dailyEarn.toLocaleString(undefined, { maximumFractionDigits: 1 })}/day <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>·</span> <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>(${totalEarn.toLocaleString(undefined, { maximumFractionDigits: 0 })}/{vDays}d)</span>
                </span>
                <span style={{ fontSize:11, color: locked ? '#ccc' : 'var(--neon-lime)', fontWeight:800, textAlign: 'right' }}>
                  ${totalEarn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span style={{ display: 'flex', justifyContent: 'center', fontSize: 12 }}>
                  {locked ? '🔒' : '✅'}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Total Footer Row */}
        <div style={{ 
          display:'grid', 
          gridTemplateColumns:'44px 1fr 110px 24px', 
          gap:6, 
          padding:'12px 14px', 
          background:`rgba(255,183,77,0.03)`, 
          borderTop:`1px solid rgba(255,183,77,0.15)`, 
          alignItems:'center' 
        }}>
          <span style={{ fontSize:9, fontWeight:955, color:acc, background:`${acc}12`, borderRadius:6, padding:'2px 6px', textAlign:'center', width: 'fit-content' }}>ALL</span>
          <span style={{ fontSize:10, color:'#ccc', fontWeight:800 }}>
            {totPeople.toLocaleString()} Users
          </span>
          <span style={{ fontSize:12, color:'#A3FF12', fontWeight:955, textAlign: 'right' }}>
            ${totUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span></span>
        </div>
      </div>
      
      <div style={{ fontSize:8, color:'rgba(255,255,255,0.2)', fontWeight:800, marginTop:12, textAlign:'center', letterSpacing: 0.5 }}>
        ESTIMATES ONLY · BINARY MATRIX · 70% DISTRIBUTION PATTERN
      </div>
    </div>
  );
}
