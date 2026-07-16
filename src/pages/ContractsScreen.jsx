import React, { useState } from 'react';
import { CONTRACTS } from '../config/constants.js';
import { useGameStore } from '../store/gameStore.js';
import { getEthersSigner } from '../utils/ethers-adapter.js';
import { ethers } from 'ethers';
import { config } from '../config/wagmi.js';
import { AIPCORE_ABI } from '../../contracts/abi.js';
import { api } from '../services/api.js';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ── DATA ─────────────────────────────────────────────────────────────
const INCOME_STREAMS = [
  { icon: '👥', title: 'Referral Income', pct: '10%', desc: 'Earn 10% of every direct referral node purchase instantly on-chain. Built for viral scaling and immediate rewards.', color: '#A3FF12' },
  { icon: '🌐', title: 'Matrix Bonus', pct: '70%', desc: 'A vast 2×18 matrix positions nodes automatically. Capture immense spillover rewards as your team and upline grows.', color: '#00D4FF' },
  { icon: '🏆', title: 'Level Rewards', pct: '15%', desc: 'Progressive tiered reward pool — unlock higher percentages and compounding payouts as your global team expands.', color: '#FF9500' },
  { icon: '💎', title: 'Global Pool', pct: '5%', desc: 'Elite qualifiers receive a proportional share of the global reward pool, funded by every transaction network-wide.', color: '#FF2D55' },
];

const NODE_TIERS = [
  ['Tier 1', '$5', '🟤'],       ['Tier 2', '$5', '🔵'],       ['Tier 3', '$10', '🔵'], 
  ['Tier 4', '$20', '🟣'],      ['Tier 5', '$40', '🟣'],      ['Tier 6', '$80', '🟣'], 
  ['Tier 7', '$160', '🟡'],     ['Tier 8', '$320', '🟡'],     ['Tier 9', '$640', '🟡'], 
  ['Tier 10', '$1,280', '🟠'],  ['Tier 11', '$2,560', '🟠'],  ['Tier 12', '$5,120', '🟠'], 
  ['Tier 13', '$10,240', '🔴'], ['Tier 14', '$20,480', '🔴'], ['Tier 15', '$40,960', '🔴'], 
  ['Tier 16', '$81,920', '💎'], ['Tier 17', '$163,840', '💎'], ['Tier 18', '$327,680', '💎']
];

const CONTRACTS_LIST = [
  { label: 'AIPCORE ENGINE', address: CONTRACTS.AIPCORE, desc: 'Core node logic, matrix positioning & rewards distribution' },
  { label: 'AIPCOREVIEW HELPER', address: CONTRACTS.AIPCOREVIEW, desc: 'On-chain data aggregation and dashboard helper' },
  { label: 'REWARD POOL', address: CONTRACTS.REWARDPOOL, desc: 'Global staking & dynamic global reward pool contract' }
];

export default function ContractsScreen() {
  const { walletAddress, hasNode, referrerId, fetchUserData } = useGameStore();
  const [registering, setRegistering] = useState(false);

  // ── LOGIC ───────────────────────────────────────────────────────────
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`, { style: { background: '#1A1F26', color: '#A3FF12', border: '1px solid rgba(163, 255, 18, 0.2)' } });
  };

  const handleRegisterOnChain = async () => {
    if (registering) return;
    setRegistering(true);
    try {
      const signer = await getEthersSigner(config);
      if (!signer) { toast.error('Please connect your wallet first'); setRegistering(false); return; }

      const contract = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, signer);

      // Resolve sponsor node ID from referrerId (may be a wallet address or already a node ID)
      let sponsorNodeId = 55555n;
      if (referrerId) {
        try {
          // referrerId stored as wallet address → look up their node ID
          if (typeof referrerId === 'string' && referrerId.startsWith('0x') && referrerId.length === 42) {
            const refId = await contract.nodeId(referrerId);
            if (refId && Number(refId) > 0) sponsorNodeId = BigInt(refId);
          } else if (Number(referrerId) > 0) {
            // Already a numeric node ID
            sponsorNodeId = BigInt(referrerId);
          }
        } catch { /* keep default sponsor = 55555 */ }
      }

      // SELF-HEAL: If DB missed the registration, the contract will revert with no reason.
      const existingNodeId = await contract.nodeId(walletAddress).catch(() => 0n);
      if (existingNodeId > 0n) {
        toast.success('Node was already registered! Syncing...', { id: 'register' });
        await api.confirmNode(walletAddress, Number(existingNodeId), 1, "0xsync").catch(() => {});
        useGameStore.setState({ lastBackendSync: null });
        await fetchUserData().catch(() => {});
        setTimeout(() => window.location.reload(), 1500);
        return;
      }

      const cost = await contract.getRegistrationFee().catch(() => 0n);
      const bufferCost = cost > 0n ? (cost * 105n) / 100n : 0n;

      toast.loading('Confirm transaction in your wallet...', { id: 'register' });
      const tx = await contract.createNode(sponsorNodeId, { value: bufferCost, gasLimit: 3000000 });
      toast.loading(`Transaction sent: ${tx.hash.slice(0, 10)}...`, { id: 'register' });
      const receipt = await tx.wait();

      // Parse NodeCreated event to get the new node ID
      let newNodeId = 0;
      try {
        const iface = new ethers.Interface(AIPCORE_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed?.name === 'NodeCreated') {
              newNodeId = Number(parsed.args[1]); // userId (second indexed param)
              break;
            }
          } catch { /* not this event */ }
        }
      } catch { /* event parse failed, proceed without nodeId */ }

      // Auto-register in the Reward Pool
      if (newNodeId > 0) {
        try {
          const { REWARDPOOL_ABI: rpAbi } = await import('../../contracts/abi.js');
          const pool = new ethers.Contract(CONTRACTS.REWARDPOOL, rpAbi, signer);
          await (await pool.registerNode(newNodeId)).wait();
        } catch (e) {
          console.warn('Pool auto-registration skipped:', e.message);
        }

        // ✅ INSTANT DB UPDATE — zero RPC on server, no page reload
        await api.confirmNode(walletAddress, newNodeId, 1, receipt.hash);
      }

      toast.success('🚀 Node registered! Welcome to AIPCore.', { id: 'register', duration: 5000 });

      // Refresh store from updated DB — fast, no reload
      useGameStore.setState({ lastBackendSync: null });
      await fetchUserData().catch(() => {});
      // Trigger a soft background reload for full hydration
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      let errMsg = err?.reason || err?.shortMessage || err?.message || 'Transaction failed';
      if (errMsg.toLowerCase().includes('insufficient funds')) {
        errMsg = 'Insufficient BNB balance for transaction & gas.';
      } else if (errMsg.toLowerCase().includes('user rejected') || err?.code === 4001) {
        errMsg = 'Transaction rejected by user.';
      } else {
        errMsg = errMsg.slice(0, 80);
      }
      toast.error(errMsg, { id: 'register' });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', paddingBottom: 'calc(var(--tabbar-h, 80px) + 24px)' }}>
      
      {/* ═ HERO SECTION ═ */}
      <section style={{
        position: 'relative',
        padding: '60px 20px 40px',
        textAlign: 'center',
        background: 'radial-gradient(ellipse at top, rgba(0,210,255,0.08) 0%, transparent 70%)',
        marginBottom: 24,
        overflow: 'hidden'
      }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div style={{ 
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(155,81,255,0.1)', border: '1px solid rgba(155,81,255,0.3)',
            borderRadius: 40, padding: '6px 16px', fontSize: 10, fontWeight: 800, 
            letterSpacing: 2, color: '#C084FC', marginBottom: 24
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D2FF', boxShadow: '0 0 8px #00D2FF' }} />
            AIPCORE PROTOCOL
          </div>

          <h1 style={{
            fontSize: 'clamp(32px, 8vw, 42px)', fontWeight: 900, lineHeight: 1.1,
            marginBottom: 16, letterSpacing: '-0.02em',
          }}>
            MINING THE <br/>
            <span style={{
              background: 'linear-gradient(90deg, #00D2FF 0%, #A3FF12 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>FUTURE OF AI</span>
          </h1>

          <p style={{
            fontSize: 14, color: '#4FC3F7', lineHeight: 1.6,
            maxWidth: 340, margin: '0 auto 32px', fontWeight: 500
          }}>
            A fully decentralized, node-driven passive mining network on BNB Chain. Turn your wallet into a high-yield mining rig.
          </p>

          {!hasNode && (
            <button
              onClick={handleRegisterOnChain}
              disabled={registering}
              style={{
                background: registering ? 'rgba(163,255,18,0.4)' : 'linear-gradient(90deg, #A3FF12 0%, #00D2FF 100%)',
                border: 'none', borderRadius: 16, padding: '18px 32px', fontSize: 16, fontWeight: 900,
                color: '#000', cursor: registering ? 'wait' : 'pointer',
                boxShadow: '0 0 30px rgba(163,255,18,0.3)', width: '100%', maxWidth: 340,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '0 auto'
              }}>
              {registering ? '⏳ PENDING...' : '🚀 REGISTER NODE ON-CHAIN'}
            </button>
          )}

          <div style={{
            display: 'flex', justifyContent: 'center', gap: 12, marginTop: 40, flexWrap: 'wrap'
          }}>
            {['18 TIERS', '100% COMMUNITY DISTRIBUTION', 'BSC SMART CONTRACTS'].map((tag, i) => (
              <div key={i} style={{
                fontSize: 10, fontWeight: 800, color: '#FF5252',
                background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.05)'
              }}>{tag}</div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═ FEATURES / INCOME STREAMS ═ */}
      <section style={{ padding: '0 20px', marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 20, textAlign: 'center' }}>
          <span style={{ color: '#fff' }}>4 PROTOCOL </span>
          <span style={{ color: '#9B51FF' }}>INCOME STREAMS</span>
        </h2>
        
        {/* Distribution Bar */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 16, marginBottom: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 12, marginBottom: 12 }}>
            {INCOME_STREAMS.map((s, i) => (
              <div key={i} style={{ width: s.pct, background: s.color }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px 16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {INCOME_STREAMS.map((s) => (
              <span key={s.title} style={{ fontSize: 10, fontWeight: 800, color: '#FFFFFF' }}>
                <span style={{ color: s.color }}>■</span> {s.title} ({s.pct})
              </span>
            ))}
          </div>
        </div>

        {/* Feature Cards Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {INCOME_STREAMS.map((stream, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                borderRadius: 16, padding: '20px 16px', border: '1px solid rgba(255,255,255,0.05)',
                borderTop: `1px solid ${stream.color}55`, position: 'relative', overflow: 'hidden'
              }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{stream.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{stream.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, fontWeight: 500 }}>{stream.desc}</div>
              <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 60, opacity: 0.03, fontWeight: 900 }}>{stream.pct}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═ NODE TIERS GRID ═ */}
      <section style={{ padding: '0 20px', marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 20, textAlign: 'center' }}>
          <span style={{ color: '#fff' }}>MASSIVE SCALING </span>
          <span style={{ color: '#00D2FF' }}>18 TIERS</span>
        </h2>

        <div style={{ 
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,210,255,0.1)', 
          borderRadius: 20, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 
        }}>
          {NODE_TIERS.map(([tier, rate, icon], i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 8px',
              textAlign: 'center', border: '1px solid rgba(255,255,255,0.03)'
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#FFB74D', marginBottom: 2 }}>{tier}</div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--neon-lime)' }}>{rate} <span style={{ fontSize: 8, opacity: 0.5}}>USD</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* ═ SMART CONTRACTS ═ */}
      <section style={{ padding: '0 20px', marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 20, textAlign: 'center' }}>
          <span style={{ color: '#fff' }}>VERIFIED </span>
          <span style={{ color: '#A3FF12' }}>CONTRACTS</span>
        </h2>
        
        <p style={{ fontSize: 12, color: '#FFD700', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
          Code is law. All distribution mechanics and pools run autonomously on the Binance Smart Chain. No central admin can alter payouts.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CONTRACTS_LIST.map((c, i) => (
            <div key={i} onClick={() => copyToClipboard(c.address, c.label)} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: 16, padding: 16, cursor: 'pointer', position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{c.label}</span>
                <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 12, fontWeight: 700 }}>COPY</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--neon-lime)', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 8 }}>
                {c.address}
              </div>
              <div style={{ fontSize: 10, color: '#A3FF12', lineHeight: 1.4 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═ FOOTER ═ */}
      <section style={{ padding: '0 20px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(163,255,18,0.1) 0%, rgba(0,210,255,0.05) 100%)',
          border: '1px solid rgba(163,255,18,0.15)', borderRadius: 20, padding: 24, textAlign: 'center'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>JOIN THE COMMUNITY</h3>
          <p style={{ fontSize: 12, color: '#4FC3F7', marginBottom: 20 }}>
            Connect with thousands of other node operators in our official Telegram group to share strategies and earn together.
          </p>
          <a href="https://t.me/AIPCoreOfficial" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <button style={{
              background: '#fff', color: '#000', border: 'none', borderRadius: 12,
              padding: '12px 24px', fontSize: 13, fontWeight: 900, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8
            }}>
              ✈️ TELEGRAM
            </button>
          </a>
        </div>
      </section>

    </div>
  );
}
