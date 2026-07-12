import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import { CONTRACTS } from '../config/constants.js';
import { getEthersSigner } from '../utils/ethers-adapter.js';
import { ethers } from 'ethers';
import { config } from '../config/wagmi.js';
import toast from 'react-hot-toast';

import FrogCaseScreen from './FrogCaseScreen.jsx';
import MilestoneScreen from './MilestoneScreen.jsx';

const V3_SUB_TABS = [
  { id: 'vesting',   icon: '💎', label: 'Vesting Vault' },
  { id: 'founder',   icon: '🏆', label: 'Milestones' },
  { id: 'frogcase',  icon: '🐸', label: 'Frog Case' }
];

const VESTING_VAULT_ABI = [
  "function getNodeSummary(uint256 nodeId) view returns (uint256 totalDeposited, uint256 totalClaimed, uint256 vestedClaimable, uint256 unvestedRemaining, uint256 activePositions)",
  "function claimVestedRewards(uint256 nodeId) external",
  "function instantWithdraw(uint256 nodeId, uint256 amount) external"
];

const CYCLE_MANAGER_ABI = [
  "function isActive(uint256 nodeId) view returns (bool)",
  "function daysRemaining(uint256 nodeId) view returns (uint256)",
  "function getSubscription(uint256 nodeId) view returns (uint32 cycleId, uint40 cycleEnd, bool isExempt)"
];

export default function V3RewardsScreen() {
  const [subTab, setSubTab] = useState('vesting');
  const { nodeId, walletAddress, hasNode } = useGameStore();

  // Vesting Vault States
  const [vestingData, setVestingData] = useState({
    totalDeposited: 0n, totalClaimed: 0n, vestedClaimable: 0n, unvestedRemaining: 0n, activePositions: 0n
  });
  const [cycleData, setCycleData] = useState({ isActive: false, daysRemaining: 0n, cycleEnd: 0n });
  const [vestingLoading, setVestingLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    if (subTab === 'vesting' && hasNode && nodeId) {
      loadVestingData();
    }
  }, [subTab, nodeId, hasNode]);

  const loadVestingData = async () => {
    setVestingLoading(true);
    try {
      const signer = await getEthersSigner(config);
      if (!signer) return;

      const vault = new ethers.Contract(CONTRACTS.NFEVESTINGVAULT || "0x9e1655eA63A9A10314B55A3c01bf2e23F28e52D8", VESTING_VAULT_ABI, signer);
      const cycle = new ethers.Contract(CONTRACTS.NFECYCLEMANAGER || "0x5f497681CaFDF847A72897a9E70D400B8eA84E6a", CYCLE_MANAGER_ABI, signer);

      const [summary, active, days, sub] = await Promise.all([
        vault.getNodeSummary(nodeId).catch(() => [0n, 0n, 0n, 0n, 0n]),
        cycle.isActive(nodeId).catch(() => false),
        cycle.daysRemaining(nodeId).catch(() => 0n),
        cycle.getSubscription(nodeId).catch(() => [0n, 0n, false])
      ]);

      setVestingData({
        totalDeposited: summary[0],
        totalClaimed: summary[1],
        vestedClaimable: summary[2],
        unvestedRemaining: summary[3],
        activePositions: summary[4]
      });

      setCycleData({
        isActive: active,
        daysRemaining: days,
        cycleEnd: sub[1]
      });
    } catch (e) {
      console.error(e);
    } finally {
      setVestingLoading(false);
    }
  };

  const handleClaimVested = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    const toastId = toast.loading('Claiming vested rewards...');
    try {
      const signer = await getEthersSigner(config);
      const vault = new ethers.Contract(CONTRACTS.NFEVESTINGVAULT || "0x9e1655eA63A9A10314B55A3c01bf2e23F28e52D8", VESTING_VAULT_ABI, signer);
      const tx = await vault.claimVestedRewards(nodeId);
      await tx.wait();
      toast.success('Successfully claimed vested rewards!', { id: toastId });
      loadVestingData();
    } catch (e) {
      toast.error(e.reason || e.message || 'Claim failed', { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInstantWithdraw = async () => {
    if (actionLoading || !withdrawAmount) return;
    setActionLoading(true);
    const toastId = toast.loading('Executing instant withdrawal with 20% penalty...');
    try {
      const signer = await getEthersSigner(config);
      const vault = new ethers.Contract(CONTRACTS.NFEVESTINGVAULT || "0x9e1655eA63A9A10314B55A3c01bf2e23F28e52D8", VESTING_VAULT_ABI, signer);
      const amountWei = ethers.parseEther(withdrawAmount);
      const tx = await vault.instantWithdraw(nodeId, amountWei);
      await tx.wait();
      toast.success('Instant withdrawal successful!', { id: toastId });
      setWithdrawAmount('');
      loadVestingData();
    } catch (e) {
      toast.error(e.reason || e.message || 'Withdraw failed', { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="hub-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* ═ SUB NAVIGATION BAR ═ */}
      <div className="hub-subnav-container" style={{
        padding: '12px 16px 12px',
        background: 'rgba(5, 8, 15, 0.6)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch'
      }}>
        {V3_SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            style={{
              background: subTab === tab.id ? 'rgba(155, 81, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              border: subTab === tab.id ? '1px solid #9B51FF' : '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '8px 16px',
              color: subTab === tab.id ? '#D8B4FE' : '#fff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease-out'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═ SUB TAB CONTENT ═ */}
      <div className="hub-content" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 100px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: subTab === 'frogcase' ? 0 : 'min-content' }}
          >
            {subTab === 'frogcase' && <FrogCaseScreen />}

            {/* VESTING VAULT SUB-PANEL */}
            {subTab === 'vesting' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Outfit, sans-serif' }}>
                {!hasNode && (
                  <div style={{
                    background: 'rgba(255, 183, 77, 0.08)',
                    border: '1px solid rgba(255, 183, 77, 0.25)',
                    borderRadius: 14,
                    padding: '12px 16px',
                    fontSize: '12px',
                    color: '#FFB74D',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                    lineHeight: 1.4
                  }}>
                    <span>⚠️</span>
                    <span><strong>View-Only Mode:</strong> No active Node ID detected. Activate a Node to unlock reward vesting, linear release streams, and cycle management.</span>
                  </div>
                )}

                {vestingLoading ? (
                  <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading Vault data from BSC...</div>
                ) : (
                  <>
                    {/* Subscription Cycle Card */}
                    <div style={{
                      borderRadius: 18, padding: 18,
                      background: cycleData.isActive ? 'linear-gradient(135deg, rgba(27,67,50,0.5), rgba(13,17,23,0.95))' : 'linear-gradient(135deg, rgba(123,52,30,0.5), rgba(13,17,23,0.95))',
                      border: cycleData.isActive ? '1px solid rgba(163,255,18,0.3)' : '1px solid rgba(255,82,82,0.3)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>Subscription Status</div>
                        <span style={{
                          fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 8,
                          background: cycleData.isActive ? 'rgba(163,255,18,0.1)' : 'rgba(255,82,82,0.1)',
                          color: cycleData.isActive ? '#A3FF12' : '#FF5252'
                        }}>
                          {cycleData.isActive ? 'ACTIVE' : 'EXPIRED'}
                        </span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900 }}>{Number(cycleData.daysRemaining)} Days</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                        Cycle Expiration: {cycleData.cycleEnd > 0 ? new Date(Number(cycleData.cycleEnd) * 1000).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>

                    {/* Vesting Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 14 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Total Deposited</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 4 }}>
                          {ethers.formatEther(vestingData.totalDeposited)} BNB
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 14 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Total Claimed</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 4 }}>
                          {ethers.formatEther(vestingData.totalClaimed)} BNB
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 14 }}>
                        <div style={{ fontSize: 10, color: 'var(--neon-lime)', fontWeight: 800 }}>Vested Claimable (0% fee)</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--neon-lime)', marginTop: 4 }}>
                          {ethers.formatEther(vestingData.vestedClaimable)} BNB
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 14 }}>
                        <div style={{ fontSize: 10, color: '#FFB74D' }}>Unvested Remaining</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#FFB74D', marginTop: 4 }}>
                          {ethers.formatEther(vestingData.unvestedRemaining)} BNB
                        </div>
                      </div>
                    </div>

                    {/* Claim Vested Button */}
                    <button
                      onClick={handleClaimVested}
                      disabled={actionLoading || vestingData.vestedClaimable === 0n || !hasNode}
                      style={{
                        background: (vestingData.vestedClaimable > 0n && hasNode) ? 'var(--neon-lime)' : 'rgba(255,255,255,0.05)',
                        color: (vestingData.vestedClaimable > 0n && hasNode) ? '#000' : 'rgba(255,255,255,0.3)',
                        border: 'none', borderRadius: 12, padding: 14, fontSize: 13, fontWeight: 900,
                        cursor: (vestingData.vestedClaimable > 0n && hasNode) ? 'pointer' : 'not-allowed', width: '100%'
                      }}
                    >
                      Claim Vested Rewards (0% Fee)
                    </button>

                    {/* Instant Withdrawal Box */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#FF5252', marginBottom: 6 }}>⚠️ Instant Withdrawal (20% Penalty Tax)</div>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, marginBottom: 12 }}>
                        Bypasses the linear vesting schedule to withdraw locked rewards immediately. Deducts a 20% penalty split back into the ecosystem pools.
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="number"
                          placeholder="Amount in BNB"
                          value={withdrawAmount}
                          disabled={!hasNode}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          style={{
                            flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12, outline: 'none',
                            opacity: hasNode ? 1 : 0.5
                          }}
                        />
                        <button
                          onClick={handleInstantWithdraw}
                          disabled={actionLoading || !withdrawAmount || !hasNode}
                          style={{
                            background: hasNode ? '#FF5252' : 'rgba(255,255,255,0.05)',
                            color: hasNode ? '#fff' : 'rgba(255,255,255,0.2)',
                            border: 'none', borderRadius: 10,
                            padding: '10px 16px', fontSize: 12, fontWeight: 900,
                            cursor: hasNode ? 'pointer' : 'not-allowed'
                          }}
                        >
                          Withdraw
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* FOUNDER MILESTONES SUB-PANEL */}
            {subTab === 'founder' && <MilestoneScreen />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
