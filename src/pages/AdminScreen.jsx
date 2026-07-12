import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { formatNumber, shortAddr } from '../utils/format.js';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { CONTRACTS, RPC_NODES } from '../config/constants.js';
import { GOVERNANCE_ABI } from '../config/abi.js';
import axios from 'axios';
import toast from 'react-hot-toast';

const provider = new ethers.JsonRpcProvider(RPC_NODES[0]);

// Deployed addresses reference
const ALL_CONTRACTS = [
  { name: 'aipcore (Core Engine)', address: CONTRACTS.AIPCORE, link: `https://bscscan.com/address/${CONTRACTS.AIPCORE}` },
  { name: 'AIPCoreViewsContract', address: CONTRACTS.AIPCOREVIEW, link: `https://bscscan.com/address/${CONTRACTS.AIPCOREVIEW}` },
  { name: 'RewardPool', address: CONTRACTS.REWARDPOOL, link: `https://bscscan.com/address/${CONTRACTS.REWARDPOOL}` },
  { name: 'NFEGovernance', address: CONTRACTS.GOVERNANCE, link: `https://bscscan.com/address/${CONTRACTS.GOVERNANCE}` },
  { name: 'NFEVestingVault', address: CONTRACTS.NFEVESTINGVAULT, link: `https://bscscan.com/address/${CONTRACTS.NFEVESTINGVAULT}` },
  { name: 'NFECycleManager', address: CONTRACTS.NFECYCLEMANAGER, link: `https://bscscan.com/address/${CONTRACTS.NFECYCLEMANAGER}` },
  { name: 'RewardPoolLeadership', address: '0xd9988CB1c0339EDbBFdd7451B7aF4C2d40CEf463', link: 'https://bscscan.com/address/0xd9988CB1c0339EDbBFdd7451B7aF4C2d40CEf463' },
  { name: 'FounderPool', address: '0x3ba1C975d8c9d9B38477c3c90d56c7Cb78DdB1C3', link: 'https://bscscan.com/address/0x3ba1C975d8c9d9B38477c3c90d56c7Cb78DdB1C3' },
  { name: 'LeaderboardPool', address: '0x45Bc0E983D013A6987042A4dDCbFe40257D9c2ac', link: 'https://bscscan.com/address/0x45Bc0E983D013A6987042A4dDCbFe40257D9c2ac' },
  { name: 'NFERenewalEngine', address: '0x8543E4680346A5f7795Dd277372aEF333F91e59D', link: 'https://bscscan.com/address/0x8543E4680346A5f7795Dd277372aEF333F91e59D' },
];

const inputStyle = {
  background: 'rgba(32, 34, 37, 0.8)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '14px',
  padding: '12px 16px',
  color: '#fff',
  fontSize: '13px',
  fontFamily: 'Outfit, sans-serif',
  outline: 'none',
  width: '100%',
  fontWeight: 600
};

export default function AdminScreen() {
  const { walletAddress, isAdmin } = useGameStore();
  const [devBypass, setDevBypass] = useState(false);
  const [activeTab, setActiveTab] = useState('protocol');
  const [telemetry, setTelemetry] = useState(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  // Search node state
  const [searchVal, setSearchVal] = useState('');
  const [searchedNode, setSearchedNode] = useState(null);
  const [searchingNode, setSearchingNode] = useState(false);

  // Governance proposals state
  const [proposals, setProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  // Cycle & Renewals stats state
  const [cycleConfig, setCycleConfig] = useState(null);
  const [loadingCycles, setLoadingCycles] = useState(false);

  useEffect(() => {
    fetchProtocolOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'governance') {
      loadProposals();
    } else if (activeTab === 'cycles') {
      loadCycleConfig();
    }
  }, [activeTab]);

  const fetchProtocolOverview = async () => {
    setLoadingTelemetry(true);
    try {
      const res = await axios.get('/api/admin/overview');
      setTelemetry(res.data);
    } catch (err) {
      toast.error('Failed to load live protocol overview telemetry');
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const handleSearchNode = async () => {
    if (!searchVal.trim()) return;
    setSearchingNode(true);
    setSearchedNode(null);
    try {
      const res = await axios.get(`/api/admin/node/${searchVal}`);
      setSearchedNode(res.data);
      toast.success(`Loaded Node #${res.data.nodeId}`);
    } catch (err) {
      toast.error('Node not found on-chain');
    } finally {
      setSearchingNode(false);
    }
  };

  const loadProposals = async () => {
    setLoadingProposals(true);
    try {
      const gov = new ethers.Contract(CONTRACTS.GOVERNANCE, GOVERNANCE_ABI, provider);
      const count = await gov.proposalCount().catch(() => 0n);
      const list = [];
      for (let i = 0n; i < count && i < 15n; i++) {
        const prop = await gov.proposals(i).catch(() => null);
        if (prop) {
          list.push({
            id: Number(prop.id),
            proposerNodeId: Number(prop.proposerNodeId),
            target: prop.target,
            amount: parseFloat(ethers.formatEther(prop.amount)),
            purpose: prop.purpose,
            createdAt: Number(prop.createdAt),
            votesFor: Number(prop.votesFor),
            votesAgainst: Number(prop.votesAgainst),
            executed: prop.executed
          });
        }
      }
      setProposals(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProposals(false);
    }
  };

  const loadCycleConfig = async () => {
    setLoadingCycles(true);
    try {
      const cycleContract = new ethers.Contract(
        CONTRACTS.NFECYCLEMANAGER,
        [
          'function cycleDuration() view returns (uint256)',
          'function renewalCost() view returns (uint256)',
          'function gracePeriod() view returns (uint256)',
          'function totalRenewalsCount() view returns (uint256)'
        ],
        provider
      );
      const [duration, cost, grace, total] = await Promise.all([
        cycleContract.cycleDuration().catch(() => 2592000n), // default 30 days
        cycleContract.renewalCost().catch(() => 0n),
        cycleContract.gracePeriod().catch(() => 86400n),
        cycleContract.totalRenewalsCount().catch(() => 0n),
      ]);
      setCycleConfig({
        duration: Number(duration) / 86400,
        cost: parseFloat(ethers.formatEther(cost)),
        grace: Number(grace) / 3600,
        totalRenewals: Number(total)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCycles(false);
    }
  };

  // Safe checks
  const currentTab = (tab) => activeTab === tab;

  if (!isAdmin && !devBypass) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        background: '#12131a',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#FF5252', letterSpacing: '0.5px' }}>ACCESS DENIED</h3>
        <p style={{ fontSize: '12px', color: '#b9bbbe', marginTop: '8px', maxWidth: '320px', lineHeight: '1.6', marginBottom: '24px' }}>
          Your wallet ({shortAddr(walletAddress)}) is not registered as the protocol owner on BSC Mainnet.
        </p>
        <button
          onClick={() => {
            setDevBypass(true);
            toast.success('Bypassed for Dev Testing Mode');
          }}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '14px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'Outfit'
          }}
        >
          🔓 BYPASS FOR DEV TESTING
        </button>
      </div>
    );
  }

  return (
    <div className="sub-page page-admin" style={{ padding: '16px', background: '#12131a', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Title */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 950, color: '#fff', letterSpacing: '-0.02em' }}>
          ⚡ MASTER ADMIN CONTROLLER
        </h2>
        <p style={{ fontSize: '11px', color: '#b9bbbe', marginTop: '4px' }}>
          Live protocol governance, on-chain metrics inspection & contract linkage checks
        </p>
      </div>

      {/* Mobile Swipeable Tab Navigation */}
      <div className="admin-tabs" style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '12px',
        marginBottom: '20px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}>
        {[
          { id: 'protocol', label: '📊 Telemetry' },
          { id: 'inspector', label: '🔍 Node Inspector' },
          { id: 'pools', label: '🏆 Rewards Pool' },
          { id: 'vesting', label: '🔒 Vesting Vault' },
          { id: 'governance', label: '⚖️ Governance' },
          { id: 'cycles', label: '🔄 Cycles' },
          { id: 'contracts', label: '🔗 Contracts Grid' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flexShrink: 0,
              padding: '10px 18px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              border: activeTab === tab.id ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.05)',
              background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'rgba(32,34,37,0.4)',
              color: activeTab === tab.id ? '#ffffff' : '#b9bbbe',
              transition: 'all 0.2s ease',
              fontFamily: 'Outfit'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence mode="wait">
          
          {/* TAB 1: PROTOCOL TELEMETRY */}
          {currentTab('protocol') && (
            <motion.div
              key="protocol"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#A3FF12', letterSpacing: '0.5px' }}>📈 LIVE PROTOCOL METRICS</h3>
                  <button onClick={fetchProtocolOverview} disabled={loadingTelemetry} style={{ background: 'none', border: 'none', color: '#b9bbbe', fontSize: '11px', cursor: 'pointer', fontWeight: 800 }}>
                    {loadingTelemetry ? 'Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>

                {telemetry ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    <div style={{ background: 'rgba(32,34,37,0.4)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>TOTAL NODES</div>
                      <div style={{ fontSize: '20px', fontWeight: 950, color: '#fff', marginTop: '4px' }}>{telemetry.totalNodes}</div>
                    </div>
                    <div style={{ background: 'rgba(32,34,37,0.4)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>REGISTRATIONS 24H</div>
                      <div style={{ fontSize: '20px', fontWeight: 950, color: '#A3FF12', marginTop: '4px' }}>+{telemetry.registrations24h}</div>
                    </div>
                    <div style={{ background: 'rgba(32,34,37,0.4)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>TOTAL DISTRIBUTED</div>
                      <div style={{ fontSize: '20px', fontWeight: 950, color: '#FFD700', marginTop: '4px' }}>{(telemetry.totalBnbDistributed || 0).toFixed(2)} BNB</div>
                    </div>
                    <div style={{ background: 'rgba(32,34,37,0.4)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>BNB ORACLE PRICE</div>
                      <div style={{ fontSize: '20px', fontWeight: 950, color: '#fff', marginTop: '4px' }}>${(telemetry.bnbPrice || 0).toFixed(2)}</div>
                    </div>
                    <div style={{ background: 'rgba(32,34,37,0.4)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>FREE REGISTERED</div>
                      <div style={{ fontSize: '20px', fontWeight: 950, color: '#A12CFF', marginTop: '4px' }}>{telemetry.totalFreeUsers || 0}</div>
                    </div>
                    <div style={{ background: 'rgba(32,34,37,0.4)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>FREE UPGRADED</div>
                      <div style={{ fontSize: '20px', fontWeight: 950, color: '#fff', marginTop: '4px' }}>{telemetry.totalFreeUpgraded || 0}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '40px 0', textAlign: 'center', fontSize: '12px', color: '#b9bbbe' }}>Loading live stats...</div>
                )}
              </div>

              {telemetry && (
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px', marginBottom: '16px' }}>💰 CONTRACT BNB LIQUIDITY</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { name: 'Core Engine (aipcore)', balance: telemetry.balances?.core },
                      { name: 'Rewards Pool', balance: telemetry.balances?.rewardPool },
                      { name: 'Vesting Vault', balance: telemetry.balances?.vestingVault },
                      { name: 'Leaderboard Pool', balance: telemetry.balances?.leaderboardPool },
                      { name: 'Founder Pool', balance: telemetry.balances?.founderPool },
                      { name: 'Leadership Engine', balance: telemetry.balances?.leadership }
                    ].map(pool => (
                      <div key={pool.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: 'rgba(32,34,37,0.4)' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#b9bbbe' }}>{pool.name}</span>
                        <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff' }}>{(pool.balance || 0).toFixed(4)} BNB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: NODE INSPECTOR */}
          {currentTab('inspector') && (
            <motion.div
              key="inspector"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px', marginBottom: '16px' }}>🔍 DEEP NODE SEARCH</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    placeholder="Enter Node ID (e.g. 55556)"
                    value={searchVal}
                    onChange={e => setSearchVal(e.target.value)}
                    style={inputStyle}
                  />
                  <button
                    onClick={handleSearchNode}
                    disabled={searchingNode}
                    style={{
                      background: '#A3FF12',
                      color: '#000',
                      border: 'none',
                      borderRadius: '14px',
                      padding: '0 24px',
                      fontWeight: 900,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {searchingNode ? '...' : 'Search'}
                  </button>
                </div>
              </div>

              {searchedNode && (
                <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 950, color: '#fff' }}>NODE #{searchedNode.nodeId} SUMMARY</h4>
                    <span style={{ fontSize: '11px', background: 'rgba(163,255,18,0.15)', color: '#A3FF12', padding: '4px 10px', borderRadius: '8px', fontWeight: 800 }}>
                      Tier {searchedNode.tier}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>WALLET ADDRESS</div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{shortAddr(searchedNode.wallet)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>SPONSOR ID</div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>#{searchedNode.sponsor} ({shortAddr(searchedNode.sponsorWallet)})</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>MATRIX PARENT ID</div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>#{searchedNode.matrixParent}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>REGISTRATION DATE</div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{new Date(searchedNode.joinedAt * 1000).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                    <h5 style={{ fontSize: '12px', fontWeight: 900, color: '#fff', marginBottom: '12px' }}>📊 REWARDS & EARNINGS</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(32,34,37,0.4)' }}>
                        <span style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>TOTAL REWARDS</span>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>{(searchedNode.income?.total || 0).toFixed(4)} BNB</div>
                      </div>
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(32,34,37,0.4)' }}>
                        <span style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>DIRECT SALES</span>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>{(searchedNode.income?.direct || 0).toFixed(4)} BNB</div>
                      </div>
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(32,34,37,0.4)' }}>
                        <span style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>MATRIX YIELD</span>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>{(searchedNode.income?.binary || 0).toFixed(4)} BNB</div>
                      </div>
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(32,34,37,0.4)' }}>
                        <span style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>GLOBAL POOLS</span>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>{(searchedNode.income?.poolIncome || 0).toFixed(4)} BNB</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                    <h5 style={{ fontSize: '12px', fontWeight: 900, color: '#fff', marginBottom: '12px' }}>🔒 VESTING VAULT SUMMARY</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(32,34,37,0.4)' }}>
                        <span style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>DEPOSITED</span>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>{(searchedNode.vault?.deposited || 0).toFixed(4)} BNB</div>
                      </div>
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(32,34,37,0.4)' }}>
                        <span style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>CLAIMABLE</span>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#A3FF12', marginTop: '2px' }}>{(searchedNode.vault?.vestedClaimable || 0).toFixed(4)} BNB</div>
                      </div>
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(32,34,37,0.4)' }}>
                        <span style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>UNVESTED LOCKED</span>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>{(searchedNode.vault?.unvested || 0).toFixed(4)} BNB</div>
                      </div>
                      <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(32,34,37,0.4)' }}>
                        <span style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>ACTIVE POSITIONS</span>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', marginTop: '2px' }}>{searchedNode.vault?.positionCount || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: POOLS */}
          {currentTab('pools') && (
            <motion.div
              key="pools"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px', marginBottom: '16px' }}>🏆 GLOBAL MILESTONE POOLS</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { name: 'Bronze Milestone Pool', limit: '0.1 BNB cap', condition: 'Node Tier ≥ 2' },
                    { name: 'Silver Milestone Pool', limit: '0.5 BNB cap', condition: 'Node Tier ≥ 6' },
                    { name: 'Gold Milestone Pool', limit: '2.0 BNB cap', condition: 'Node Tier ≥ 12' }
                  ].map((pool, idx) => (
                    <div key={pool.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '14px', background: 'rgba(32,34,37,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>{pool.name}</div>
                        <div style={{ fontSize: '10px', color: '#b9bbbe', marginTop: '2px' }}>Requirement: {pool.condition}</div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#FFD700', fontWeight: 800 }}>{pool.limit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px', marginBottom: '16px' }}>👑 SPECIALTY POOLS</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: 'rgba(32,34,37,0.4)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#b9bbbe' }}>Leadership Engine Contract</span>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff' }}>Active</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: 'rgba(32,34,37,0.4)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#b9bbbe' }}>Founder Pool Contract</span>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff' }}>Active</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: 'rgba(32,34,37,0.4)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#b9bbbe' }}>Leaderboard Pool Contract</span>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff' }}>Active</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: VESTING VAULT */}
          {currentTab('vesting') && (
            <motion.div
              key="vesting"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px', marginBottom: '16px' }}>🔒 VAULT LINEAR RULES</h3>
                <p style={{ fontSize: '12px', color: '#b9bbbe', lineHeight: '1.6' }}>
                  Platform rewards are routed through the `NFEVestingVault` to secure long-term liquidity solvency.
                  Upgraded users vest rewards linearly over 30 days. Instant withdrawal triggers a penalty fee, which is automatically recirculated back to the protocol core.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                  <div style={{ background: 'rgba(32,34,37,0.4)', padding: '12px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>VESTING TERM</div>
                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', marginTop: '4px' }}>30 Days</div>
                  </div>
                  <div style={{ background: 'rgba(32,34,37,0.4)', padding: '12px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '9px', color: '#b9bbbe', fontWeight: 800 }}>CLAIM FEE</div>
                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', marginTop: '4px' }}>0% (at maturity)</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 5: GOVERNANCE */}
          {currentTab('governance') && (
            <motion.div
              key="governance"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px', marginBottom: '16px' }}>⚖️ PROTOCOL GOVERNANCE</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: 'rgba(32,34,37,0.4)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#b9bbbe' }}>Timelock Delay</span>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff' }}>48 Hours</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: 'rgba(32,34,37,0.4)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#b9bbbe' }}>Dormancy Sweep Duration</span>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff' }}>180 Days</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px', marginBottom: '16px' }}>📜 GOVERNANCE PROPOSALS ({proposals.length})</h3>
                {loadingProposals ? (
                  <div style={{ fontSize: '12px', color: '#b9bbbe' }}>Fetching proposals from chain...</div>
                ) : proposals.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {proposals.map(prop => (
                      <div key={prop.id} style={{ background: 'rgba(32,34,37,0.4)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff' }}>Proposal #{prop.id}</span>
                          <span style={{ fontSize: '10px', background: prop.executed ? 'rgba(163,255,18,0.15)' : 'rgba(255,199,44,0.15)', color: prop.executed ? '#A3FF12' : '#FFC72C', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                            {prop.executed ? 'Executed' : 'Queued'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#b9bbbe', lineHeight: '1.4' }}>{prop.purpose}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px', fontSize: '10px', color: '#b9bbbe' }}>
                          <span>Target: {shortAddr(prop.target)}</span>
                          <span>Votes: 👍 {prop.votesFor} | 👎 {prop.votesAgainst}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#b9bbbe' }}>No active proposals found in timelock</div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 6: CYCLES */}
          {currentTab('cycles') && (
            <motion.div
              key="cycles"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px', marginBottom: '16px' }}>🔄 CYCLE CONFIGURATION</h3>
                {loadingCycles ? (
                  <div style={{ fontSize: '12px', color: '#b9bbbe' }}>Loading cycle config...</div>
                ) : cycleConfig ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: 'rgba(32,34,37,0.4)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#b9bbbe' }}>Cycle Duration</span>
                      <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff' }}>{cycleConfig.duration} Days</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: 'rgba(32,34,37,0.4)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#b9bbbe' }}>Renewal Cost</span>
                      <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff' }}>{cycleConfig.cost} BNB</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: 'rgba(32,34,37,0.4)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#b9bbbe' }}>Grace Period</span>
                      <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff' }}>{cycleConfig.grace} Hours</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: 'rgba(32,34,37,0.4)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#b9bbbe' }}>Total Renewals Actioned</span>
                      <span style={{ fontSize: '12px', fontWeight: 900, color: '#A3FF12' }}>{cycleConfig.totalRenewals}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#b9bbbe' }}>Failed to retrieve cycle settings.</div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 7: CONTRACTS GRID */}
          {currentTab('contracts') && (
            <motion.div
              key="contracts"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px', marginBottom: '16px' }}>🔗 LIVE CONTRACT LINKAGES</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {ALL_CONTRACTS.map(c => (
                    <div key={c.name} style={{ background: 'rgba(32,34,37,0.4)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff' }}>{c.name}</span>
                        <a href={c.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10px', color: '#A3FF12', textDecoration: 'none', fontWeight: 800 }}>
                          BscScan ↗
                        </a>
                      </div>
                      <span style={{ fontSize: '10px', color: '#b9bbbe', fontFamily: 'monospace', wordBreak: 'break-all' }}>{c.address}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
