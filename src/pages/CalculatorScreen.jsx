import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import { useNativePrice } from '../hooks/useNativePrice.js';
import { ethers } from 'ethers';
import { CONTRACTS, RPC_NODES } from '../config/constants.js';
import { AIPCORE_ABI } from '../config/abi.js';

const TIER_USD_COSTS = [5, 5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480, 40960, 81920, 163840, 327680];

export default function CalculatorScreen() {
  const { isConnected, nodeId, setActiveTab } = useGameStore();
  const nativePrice = useNativePrice() || 600; // fallback to 600 USD per BNB

  // Calculator Parameters
  const [invitesPerUser, setInvitesPerUser] = useState(3);
  const [conversionRate, setConversionRate] = useState(10); // in percent
  const [targetTier, setTargetTier] = useState(1);
  const [bnbPriceInput, setBnbPriceInput] = useState(Math.round(nativePrice));
  const [tierCostsBnb, setTierCostsBnb] = useState([]);

  // Fetch actual contract costs if available
  useEffect(() => {
    const fetchContractCosts = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_NODES[0]);
        const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, provider);
        const costsRaw = await core.getTierCosts().catch(() => null);
        if (costsRaw) {
          setTierCostsBnb(costsRaw.map(c => parseFloat(ethers.formatEther(c))));
        }
      } catch (err) {
        console.warn('Failed to load live tier costs for calculator:', err);
      }
    };
    fetchContractCosts();
  }, []);

  // Update BNB price input if native price changes
  useEffect(() => {
    if (nativePrice > 0) {
      setBnbPriceInput(Math.round(nativePrice));
    }
  }, [nativePrice]);

  // Compute actual tier BNB cost
  const getTierBnbCost = (tierIndex) => {
    if (tierCostsBnb && tierCostsBnb[tierIndex - 1] !== undefined) {
      return tierCostsBnb[tierIndex - 1];
    }
    // Fallback: estimate from USD price
    const usd = TIER_USD_COSTS[tierIndex - 1] || 5;
    return usd / (bnbPriceInput || 600);
  };

  const selectedTierCostBnb = getTierBnbCost(targetTier);

  // Compute projections level-by-level
  const projections = [];
  let currentFree = 1; // start with the user themselves
  let accumulatedEarningsBnb = 0;
  let totalNetworkSize = 0;
  let totalPaidNodes = 0;

  for (let l = 1; l <= 10; l++) {
    // Each level's free users = previous level's free users * invitesPerUser
    const levelFree = currentFree * invitesPerUser;
    const levelPaid = levelFree * (conversionRate / 100);

    // Earnings calculation:
    // Level 1: 10% Direct + 1.5% Layer = 11.5%
    // Level 2-10: 1.5% Layer
    const commissionPct = l === 1 ? 0.115 : 0.015;
    const levelEarningsBnb = levelPaid * commissionPct * selectedTierCostBnb;

    accumulatedEarningsBnb += levelEarningsBnb;
    totalNetworkSize += levelFree;
    totalPaidNodes += levelPaid;

    projections.push({
      level: l,
      freeUsers: Math.round(levelFree),
      paidNodes: Math.round(levelPaid),
      earningsBnb: levelEarningsBnb,
    });

    // Advance to next level
    currentFree = levelFree;
  }

  const formatNum = (num) => {
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  return (
    <div className="sub-page page-calculator" style={{ paddingBottom: 'calc(var(--tabbar-h, 80px) + 24px)' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', padding: '10px 0 24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '6px' }}>NETWORK CALCULATOR</h2>
        <div style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: '20px',
          background: 'rgba(163,255,18,0.1)',
          border: '1px solid rgba(163,255,18,0.2)'
        }}>
          <span style={{ fontSize: '10px', color: '#A3FF12', fontWeight: 900, letterSpacing: '1px' }}>
            10-LEVEL REFERRAL PROJECTIONS
          </span>
        </div>
      </div>

      {/* Inputs Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 12px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '18px', padding: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 900, color: '#A3FF12', letterSpacing: '1.5px', marginBottom: '16px', textTransform: 'uppercase' }}>
            Simulation Adjustments
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Slider 1: Invites per Free User */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#888', fontWeight: 800 }}>INVITES PER FREE USER</span>
                <span style={{ fontSize: '12px', color: '#fff', fontWeight: 900 }}>{invitesPerUser} Friends</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={invitesPerUser}
                onChange={(e) => setInvitesPerUser(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#A3FF12' }}
              />
            </div>

            {/* Slider 2: Conversion Rate */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#888', fontWeight: 800 }}>UPGRADE CONVERSION RATE</span>
                <span style={{ fontSize: '12px', color: '#A3FF12', fontWeight: 900 }}>{conversionRate}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={conversionRate}
                onChange={(e) => setConversionRate(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#A3FF12' }}
              />
            </div>

            {/* Target Tier Selection */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#888', fontWeight: 800 }}>TARGET UPGRADE TIER</span>
                <span style={{ fontSize: '12px', color: '#4FC3F7', fontWeight: 900 }}>Tier {targetTier}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                {[1, 2, 3, 5, 10, 18].map(t => (
                  <button
                    key={t}
                    onClick={() => setTargetTier(t)}
                    style={{
                      background: targetTier === t ? 'rgba(79,195,247,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${targetTier === t ? '#4FC3F7' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '8px',
                      padding: '8px 0',
                      fontSize: '10px',
                      fontWeight: 800,
                      color: targetTier === t ? '#4FC3F7' : '#888',
                      cursor: 'pointer'
                    }}
                  >
                    T{t}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '9px', color: '#555', marginTop: '6px', textAlign: 'right', fontWeight: 700 }}>
                Upgrade Cost: {selectedTierCostBnb.toFixed(4)} BNB (~${(selectedTierCostBnb * bnbPriceInput).toFixed(2)} USD)
              </div>
            </div>

            {/* BNB Price Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#888', fontWeight: 800 }}>BNB PRICE (USD)</span>
                <input
                  type="number"
                  value={bnbPriceInput}
                  onChange={(e) => setBnbPriceInput(Number(e.target.value))}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 900,
                    width: '70px',
                    textAlign: 'center'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Overview */}
      <div style={{ padding: '0 12px', marginBottom: '24px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(163,255,18,0.1) 0%, rgba(0,0,0,0.5) 100%)',
          border: '1px solid rgba(163,255,18,0.25)',
          borderRadius: '20px',
          padding: '20px',
          boxShadow: '0 4px 24px rgba(163,255,18,0.05)'
        }}>
          <div style={{ fontSize: '10px', fontWeight: 900, color: '#A3FF12', letterSpacing: '2px', marginBottom: '14px', textAlign: 'center' }}>
            POTENTIAL INCOME EARNINGS
          </div>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '38px', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
              {accumulatedEarningsBnb.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: '18px', color: '#A3FF12' }}>BNB</span>
            </h1>
            <p style={{ fontSize: '14px', color: '#4FC3F7', fontWeight: 800, marginTop: '4px' }}>
              ≈ ${(accumulatedEarningsBnb * bnbPriceInput).toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>{formatNum(totalNetworkSize)}</div>
              <div style={{ fontSize: '8px', color: '#666', fontWeight: 800, marginTop: '2px', textTransform: 'uppercase' }}>Total Free Users</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#A3FF12' }}>{formatNum(totalPaidNodes)}</div>
              <div style={{ fontSize: '8px', color: '#666', fontWeight: 800, marginTop: '2px', textTransform: 'uppercase' }}>Total Paid Nodes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Funnel breakdown per level */}
      <div style={{ padding: '0 12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 900, color: '#888', letterSpacing: '1.5px', marginBottom: '12px', textAlign: 'center', textTransform: 'uppercase' }}>
          Funnel Projection by Level
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projections.map((p, idx) => (
            <div
              key={p.level}
              style={{
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.04)',
                background: 'rgba(255,255,255,0.01)',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, color: '#FFB74D', background: 'rgba(255,183,77,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                  LEVEL {p.level}
                </span>
                <span style={{ fontSize: '11px', color: '#fff', fontWeight: 900 }}>
                  +{p.earningsBnb.toLocaleString(undefined, { maximumFractionDigits: 2 })} BNB
                  <span style={{ fontSize: '9px', color: '#4FC3F7', marginLeft: '6px', fontWeight: 800 }}>
                    (${ (p.earningsBnb * bnbPriceInput).toLocaleString(undefined, { maximumFractionDigits: 0 }) })
                  </span>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '6px 10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '8px', color: '#555', fontWeight: 800 }}>FREE INVITES</span>
                  <span style={{ fontSize: '11px', fontWeight: 900, color: '#ccc' }}>{formatNum(p.freeUsers)}</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '6px 10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '8px', color: '#555', fontWeight: 800 }}>PAID NODES</span>
                  <span style={{ fontSize: '11px', fontWeight: 900, color: '#A3FF12' }}>{formatNum(p.paidNodes)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
