import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore.js';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { CONTRACTS, RPC_NODES } from '../config/constants.js';
import { GOVERNANCE_ABI } from '../config/abi.js';
import { config } from '../config/wagmi.js';
import { getEthersSigner } from '../utils/ethers-adapter.js';

const CORE_ABI = [
  "function daoTreasury() view returns (uint256)",
  "function totalMissedRewards() view returns (uint256)",
  "function totalPendingRewards() view returns (uint256)",
  "function inTreasuryQueue(uint256) view returns (bool)",
  "function queuedTier(uint256) view returns (uint256)",
  "function queuedCostBNB(uint256) view returns (uint256)",
  "function lastActivity(uint256) view returns (uint256)",
  "function dormancyThreshold() view returns (uint256)",
  "function dormantSince(uint256) view returns (uint256)",
  "function nodes(uint256) view returns (address wallet, uint88 nodeId_, uint256 sponsor, uint256 matrixParent, uint40 joinedAt, uint256 tier, uint256 directNodes, uint256 totalMatrixNodes, uint256 totalContribution)",
  "function treasury(uint256) view returns (uint256 bnbAmount, uint256 usdValue)",
  "function getUserLevel(uint256) view returns (uint256)",
  "function declareDormant(uint256) external",
  "function reclaimDormantNode() external",
  "function abandonTreasury(uint256) external",
  "function processTreasuryQueue() external"
];

const STATUS_LABELS = ['🗳️ ACTIVE', '✅ SUCCEEDED', '⏳ QUEUED', '🚀 EXECUTED', '❌ DEFEATED'];
const STATUS_COLORS = ['#A3FF12', '#4FC3F7', '#FFB74D', '#A3FF12', '#FF5252'];

export default function AIPCoreDAOScreen() {
  const { hasNode, nodeId, walletAddress, setActiveTab } = useGameStore();

  const [tab, setTab] = useState('proposals');
  const [filterStatus, setFilterStatus] = useState('active');
  const [expanded, setExpanded] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Governance proposals state
  const [proposals, setProposals] = useState([]);
  const [proposalCount, setProposalCount] = useState(0);
  const [userVotes, setUserVotes] = useState({});
  const [votingPower, setVotingPower] = useState(0);

  // Treasury info state
  const [daoTreasury, setDaoTreasury] = useState('0');
  const [totalMissed, setTotalMissed] = useState('0');
  const [totalPending, setTotalPending] = useState('0');
  const [dormancyThresh, setDormancyThresh] = useState(1095 * 24 * 3600);

  // User's own treasury queue state
  const [userInQueue, setUserInQueue] = useState(false);
  const [userQueuedTier, setUserQueuedTier] = useState(0);
  const [userQueuedCost, setUserQueuedCost] = useState('0');

  // Proposal Creation form state
  const [targetAddress, setTargetAddress] = useState('');
  const [proposalAmount, setProposalAmount] = useState('');
  const [proposalPurpose, setProposalPurpose] = useState('');

  // Dormancy Auditor state
  const [dormancyCheckNodeId, setDormancyCheckNodeId] = useState('');
  const [auditedNode, setAuditedNode] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    loadTreasuryData();
    loadProposals();
  }, [nodeId]);

  const loadProposals = async () => {
    setIsLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(RPC_NODES[0]);
      const gov = new ethers.Contract(CONTRACTS.GOVERNANCE, GOVERNANCE_ABI, provider);
      const count = await gov.proposalCount().catch(() => 0n);
      const c = Number(count);
      setProposalCount(c);

      const propsList = [];
      for (let i = 1; i <= c; i++) {
        try {
          const prop = await gov.proposals(i);
          const status = await gov.getProposalStatus(i);
          propsList.push({
            id: i,
            proposerNodeId: Number(prop.proposerNodeId),
            target: prop.target,
            amount: ethers.formatEther(prop.amount),
            purpose: prop.purpose,
            createdAt: Number(prop.createdAt),
            votesFor: Number(prop.votesFor),
            votesAgainst: Number(prop.votesAgainst),
            timelockStartsAt: Number(prop.timelockStartsAt),
            executed: prop.executed,
            coreProposalId: Number(prop.coreProposalId),
            status: Number(status)
          });
        } catch (err) {
          console.error("Error loading proposal ID:", i, err);
        }
      }
      setProposals(propsList.reverse());

      if (nodeId && c > 0) {
        const votes = {};
        for (let i = 1; i <= c; i++) {
          const voted = await gov.hasVoted(i, nodeId).catch(() => false);
          if (voted) votes[i] = true;
        }
        setUserVotes(votes);
      }
    } catch (err) {
      console.error("Error loading proposals:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTreasuryData = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_NODES[0]);
      const core = new ethers.Contract(CONTRACTS.AIPCORE, CORE_ABI, provider);
      
      const [daoTreasuryVal, totalMissedVal, totalPendingVal, thresholdVal] = await Promise.all([
        core.daoTreasury().catch(() => 0n),
        core.totalMissedRewards().catch(() => 0n),
        core.totalPendingRewards().catch(() => 0n),
        core.dormancyThreshold().catch(() => 1095n * 24n * 3600n)
      ]);

      setDaoTreasury(ethers.formatEther(daoTreasuryVal));
      setTotalMissed(ethers.formatEther(totalMissedVal));
      setTotalPending(ethers.formatEther(totalPendingVal));
      setDormancyThresh(Number(thresholdVal));

      if (nodeId) {
        const [queued, qTier, qCost, userWeight] = await Promise.all([
          core.inTreasuryQueue(nodeId).catch(() => false),
          core.queuedTier(nodeId).catch(() => 0n),
          core.queuedCostBNB(nodeId).catch(() => 0n),
          core.getUserLevel(nodeId).catch(() => 0n)
        ]);
        setUserInQueue(queued);
        setUserQueuedTier(Number(qTier));
        setUserQueuedCost(ethers.formatEther(qCost));
        setVotingPower(Number(userWeight));
      }
    } catch (err) {
      console.error("Error loading treasury data:", err);
    }
  };

  const auditNodeDormancy = async (nId) => {
    if (!nId || Number(nId) <= 0) return;
    setAuditLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(RPC_NODES[0]);
      const core = new ethers.Contract(CONTRACTS.AIPCORE, CORE_ABI, provider);
      const nodeRaw = await core.nodes(nId).catch(() => null);
      if (!nodeRaw || nodeRaw.wallet === ethers.ZeroAddress) {
        setAuditedNode(null);
        toast.error(`Node #${nId} not registered or invalid`);
        return;
      }

      const [lastAct, dormantSinceVal, treasuryVal] = await Promise.all([
        core.lastActivity(nId).catch(() => 0n),
        core.dormantSince(nId).catch(() => 0n),
        core.treasury(nId).catch(() => [0n, 0n])
      ]);

      setAuditedNode({
        id: Number(nId),
        wallet: nodeRaw.wallet,
        tier: Number(nodeRaw.tier),
        lastActivity: Number(lastAct),
        dormantSince: Number(dormantSinceVal),
        treasuryBalance: ethers.formatEther(treasuryVal[0])
      });
    } catch (err) {
      console.error("Error auditing node:", err);
      toast.error("Failed to audit Node");
    } finally {
      setAuditLoading(false);
    }
  };

  const handleVote = async (proposalId, support) => {
    if (!nodeId) return toast.error("Connect wallet first!");
    const signer = await getEthersSigner(config);
    if (!signer) return toast.error("Wallet not connected!");
    const gov = new ethers.Contract(CONTRACTS.GOVERNANCE, GOVERNANCE_ABI, signer);
    const tid = toast.loading(`Casting vote...`);
    try {
      const tx = await gov.vote(proposalId, support);
      await tx.wait();
      toast.success("Vote cast successfully!", { id: tid });
      loadProposals();
    } catch (err) {
      toast.error(err?.shortMessage || err?.message || "Voting failed", { id: tid });
    }
  };

  const handleQueue = async (proposalId) => {
    const signer = await getEthersSigner(config);
    if (!signer) return toast.error("Wallet not connected!");
    const gov = new ethers.Contract(CONTRACTS.GOVERNANCE, GOVERNANCE_ABI, signer);
    const tid = toast.loading(`Queueing proposal...`);
    try {
      const tx = await gov.queue(proposalId);
      await tx.wait();
      toast.success("Proposal queued! Timelock started.", { id: tid });
      loadProposals();
    } catch (err) {
      toast.error(err?.shortMessage || err?.message || "Queueing failed", { id: tid });
    }
  };

  const handleExecute = async (proposalId) => {
    const signer = await getEthersSigner(config);
    if (!signer) return toast.error("Wallet not connected!");
    const gov = new ethers.Contract(CONTRACTS.GOVERNANCE, GOVERNANCE_ABI, signer);
    const tid = toast.loading(`Executing proposal...`);
    try {
      const tx = await gov.execute(proposalId);
      await tx.wait();
      toast.success("Proposal executed and DAO funds transferred!", { id: tid });
      loadProposals();
      loadTreasuryData();
    } catch (err) {
      toast.error(err?.shortMessage || err?.message || "Execution failed", { id: tid });
    }
  };

  const handleCreateProposal = async (e) => {
    e.preventDefault();
    if (!targetAddress || !proposalAmount || !proposalPurpose) {
      return toast.error("All fields are required");
    }
    const signer = await getEthersSigner(config);
    if (!signer) return toast.error("Wallet not connected!");
    const gov = new ethers.Contract(CONTRACTS.GOVERNANCE, GOVERNANCE_ABI, signer);
    const tid = toast.loading("Creating proposal...");
    try {
      const amountWei = ethers.parseEther(proposalAmount);
      const tx = await gov.propose(targetAddress, amountWei, proposalPurpose);
      await tx.wait();
      toast.success("Proposal created successfully!", { id: tid });
      setTargetAddress('');
      setProposalAmount('');
      setProposalPurpose('');
      setTab('proposals');
      loadProposals();
    } catch (err) {
      toast.error(err?.shortMessage || err?.message || "Proposal creation failed", { id: tid });
    }
  };

  const handleProcessQueue = async () => {
    const signer = await getEthersSigner(config);
    if (!signer) return toast.error("Wallet not connected!");
    const core = new ethers.Contract(CONTRACTS.AIPCORE, CORE_ABI, signer);
    const tid = toast.loading("Processing treasury queue...");
    try {
      const tx = await core.processTreasuryQueue();
      await tx.wait();
      toast.success("Treasury queue processed successfully!", { id: tid });
      loadTreasuryData();
    } catch (err) {
      toast.error(err?.shortMessage || err?.message || "Queue processing failed", { id: tid });
    }
  };

  const handleDeclareDormant = async (nodeIdToDeclare) => {
    const signer = await getEthersSigner(config);
    if (!signer) return toast.error("Wallet not connected!");
    const core = new ethers.Contract(CONTRACTS.AIPCORE, CORE_ABI, signer);
    const tid = toast.loading(`Declaring Node #${nodeIdToDeclare} dormant...`);
    try {
      const tx = await core.declareDormant(nodeIdToDeclare);
      await tx.wait();
      toast.success("Node declared dormant!", { id: tid });
      auditNodeDormancy(nodeIdToDeclare);
    } catch (err) {
      toast.error(err?.shortMessage || err?.message || "Failed to declare dormant", { id: tid });
    }
  };

  const handleReclaimNode = async () => {
    const signer = await getEthersSigner(config);
    if (!signer) return toast.error("Wallet not connected!");
    const core = new ethers.Contract(CONTRACTS.AIPCORE, CORE_ABI, signer);
    const tid = toast.loading(`Reclaiming node...`);
    try {
      const tx = await core.reclaimDormantNode();
      await tx.wait();
      toast.success("Node successfully reclaimed and recovery completed!", { id: tid });
      if (auditedNode) auditNodeDormancy(auditedNode.id);
      loadTreasuryData();
    } catch (err) {
      toast.error(err?.shortMessage || err?.message || "Failed to reclaim node", { id: tid });
    }
  };

  const handleAbandonTreasury = async (nodeIdToAbandon) => {
    const signer = await getEthersSigner(config);
    if (!signer) return toast.error("Wallet not connected!");
    const core = new ethers.Contract(CONTRACTS.AIPCORE, CORE_ABI, signer);
    const tid = toast.loading(`Abandoning Node #${nodeIdToAbandon} treasury...`);
    try {
      const tx = await core.abandonTreasury(nodeIdToAbandon);
      await tx.wait();
      toast.success("Treasury successfully abandoned. Missed rewards credited to DAO!", { id: tid });
      auditNodeDormancy(nodeIdToAbandon);
      loadTreasuryData();
    } catch (err) {
      toast.error(err?.shortMessage || err?.message || "Failed to abandon treasury", { id: tid });
    }
  };

  // Filter proposals list
  const filtered = proposals.filter(p => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return p.status === 0;
    if (filterStatus === 'passed') return p.status === 1 || p.status === 2 || p.status === 3;
    if (filterStatus === 'rejected') return p.status === 4;
    return true;
  });

  return (
    <div style={{ paddingBottom: 'calc(var(--tabbar-h, 80px) + 24px)', maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={() => setActiveTab('dash')} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 18, width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 900 }}>🏛️ AIPCore DAO Hall</h1>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Community Governance · Treasury · Timelock Proposals</div>
        </div>
      </div>

      {/* DAO Power Banner */}
      <div style={{
        borderRadius: 18, padding: 16, marginBottom: 18,
        background: 'linear-gradient(135deg, rgba(27,67,50,0.8) 0%, rgba(13,17,23,0.95) 100%)',
        border: '1px solid rgba(163,255,18,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#A3FF12' }}>Your Voting Weight</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Based on your Node Tier level on-chain</div>
          </div>
          {hasNode ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#A3FF12' }}>{votingPower}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>VP (Node #{nodeId})</div>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 800, color: '#FF8A80' }}>🔒 Guest (No Node)</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { id: 'proposals', label: '📋 Proposals' },
          { id: 'treasury', label: '💰 Treasury & Dormancy' },
          { id: 'create', label: '✍️ Create Proposal' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800,
              background: tab === t.id ? '#A3FF12' : 'rgba(255,255,255,0.05)', color: tab === t.id ? '#000' : 'rgba(255,255,255,0.5)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* PROPOSALS TAB */}
      {tab === 'proposals' && (
        <>
          {/* Status filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {['active', 'passed', 'rejected', 'all'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 800,
                  background: filterStatus === s ? (s === 'active' ? '#A3FF12' : s === 'passed' ? '#4FC3F7' : s === 'rejected' ? '#FF5252' : '#fff') : 'rgba(255,255,255,0.05)',
                  color: filterStatus === s ? '#000' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                {s}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.4)' }}>
              ⚡ Hydrating Proposals from Governance Smart Contract...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.3)', background: 'var(--bg-card)', borderRadius: 16 }}>
              📂 No proposals in this status on-chain.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map((proposal) => {
                const totalVotes = proposal.votesFor + proposal.votesAgainst;
                const forPct = totalVotes > 0 ? Math.round((proposal.votesFor / totalVotes) * 100) : 0;
                const againstPct = totalVotes > 0 ? Math.round((proposal.votesAgainst / totalVotes) * 100) : 0;
                const myVote = userVotes[proposal.id];
                const isExpanded = expanded === proposal.id;

                const isTimelockExpired = proposal.status === 2 && (proposal.timelockStartsAt > 0) && (Math.floor(Date.now() / 1000) > proposal.timelockStartsAt + 2 * 24 * 3600);
                const timeToExpire = proposal.status === 2 && (proposal.timelockStartsAt > 0) 
                  ? (proposal.timelockStartsAt + 2 * 24 * 3600) - Math.floor(Date.now() / 1000)
                  : 0;

                return (
                  <motion.div key={proposal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: 'rgba(22,27,34,0.95)', borderRadius: 16, overflow: 'hidden',
                      border: myVote ? '1px solid rgba(163,255,18,0.3)' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                    <div style={{ padding: 14, cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : proposal.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ flex: 1, paddingRight: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ background: `${STATUS_COLORS[proposal.status]}20`, color: STATUS_COLORS[proposal.status], fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 8 }}>
                              {STATUS_LABELS[proposal.status]}
                            </span>
                            <span style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 8 }}>#GP-{proposal.id}</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1.3, marginBottom: 3 }}>
                            Transfer {proposal.amount} BNB to {proposal.target.slice(0, 6)}...{proposal.target.slice(-4)}
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                            Proposer: Node #{proposal.proposerNodeId} · Date: {new Date(proposal.createdAt * 1000).toLocaleDateString()}
                          </div>
                        </div>
                        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: '0.2s' }}>›</span>
                      </div>

                      {/* Vote progress bars */}
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', gap: 3, height: 6, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${forPct}%`, background: '#A3FF12', transition: 'width 0.5s' }} />
                          <div style={{ width: `${againstPct}%`, background: '#FF5252', transition: 'width 0.5s' }} />
                          <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginTop: 4, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                          <span style={{ color: '#A3FF12' }}>FOR: {proposal.votesFor} ({forPct}%)</span>
                          <span>{totalVotes} total weight</span>
                          <span style={{ color: '#FF5252' }}>AGAINST: {proposal.votesAgainst} ({againstPct}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable actions */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: 14 }}>
                              <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 800, display: 'block', fontSize: 9, marginBottom: 4 }}>PURPOSE:</span>
                              {proposal.purpose}
                            </div>

                            {/* Active proposal voting actions */}
                            {proposal.status === 0 && (
                              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                                {myVote ? (
                                  <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(163,255,18,0.08)', borderRadius: 10, fontSize: 12, fontWeight: 800, color: '#A3FF12' }}>
                                    ✓ You already voted on this proposal on-chain
                                  </div>
                                ) : hasNode ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <button onClick={() => handleVote(proposal.id, true)}
                                      style={{ padding: '10px', borderRadius: 10, border: '1px solid rgba(163,255,18,0.4)', background: 'rgba(163,255,18,0.1)', color: '#A3FF12', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
                                      VOTE FOR (Weight: {votingPower})
                                    </button>
                                    <button onClick={() => handleVote(proposal.id, false)}
                                      style={{ padding: '10px', borderRadius: 10, border: '1px solid rgba(255,82,82,0.4)', background: 'rgba(255,82,82,0.1)', color: '#FF5252', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
                                      VOTE AGAINST
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                                    🔒 Node activation required to vote
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Succeeded proposal queue action */}
                            {proposal.status === 1 && (
                              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                                <button onClick={() => handleQueue(proposal.id)}
                                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#FFB74D', color: '#000', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
                                  ⚡ QUEUE PROPOSAL (Starts 48h Timelock)
                                </button>
                              </div>
                            )}

                            {/* Queued proposal execution action */}
                            {proposal.status === 2 && (
                              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                                {isTimelockExpired ? (
                                  <button onClick={() => handleExecute(proposal.id)}
                                    style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#A3FF12', color: '#000', fontSize: 12, fontWeight: 900, cursor: 'pointer', boxShadow: '0 0 15px rgba(163,255,18,0.3)' }}>
                                    🚀 EXECUTE PROPOSAL (Transfer Funds)
                                  </button>
                                ) : (
                                  <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,183,77,0.08)', borderRadius: 10, fontSize: 11, color: '#FFB74D', fontWeight: 800 }}>
                                    ⏳ TIMELOCK ACTIVE: Ends in {Math.ceil(timeToExpire / 3600)} hours
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TREASURY & DORMANCY TAB */}
      {tab === 'treasury' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Main treasury metrics */}
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(163,255,18,0.2)', borderRadius: 18, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#A3FF12', marginBottom: 14, letterSpacing: 1 }}>🏛️ DAO TREASURY COMMAND</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 18, fontWeight: 950, color: '#FFD700' }}>{parseFloat(daoTreasury).toFixed(4)} BNB</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginTop: 4, letterSpacing: 0.5 }}>DAO TREASURY BALANCE</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 18, fontWeight: 950, color: '#FF5252' }}>{parseFloat(totalMissed).toFixed(4)} BNB</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginTop: 4, letterSpacing: 0.5 }}>GLOBAL MISSED REWARDS</div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#4FC3F7' }}>{parseFloat(totalPending).toFixed(4)} BNB</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 800, marginTop: 4, letterSpacing: 0.5 }}>GLOBAL PENDING REWARDS</div>
            </div>
          </div>

          {/* User's treasury queue status */}
          {hasNode && (
            <div style={{ background: 'rgba(22,27,34,0.95)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>Your Treasury Queue Status</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: userInQueue ? 'rgba(163,255,18,0.15)' : 'rgba(255,255,255,0.05)', color: userInQueue ? '#A3FF12' : '#888', fontWeight: 900 }}>
                  {userInQueue ? 'QUEUED' : 'NOT IN QUEUE'}
                </span>
              </div>
              {userInQueue ? (
                <div style={{ background: 'rgba(163,255,18,0.05)', border: '1px solid rgba(163,255,18,0.2)', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>Queued for Tier {userQueuedTier} Upgrade</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Cost: {userQueuedCost} BNB (Funded by your accumulated treasury credit)</div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                  Your node gets queued automatically for free tier upgrades when you accumulate enough missed team rewards from matrix spillover.
                </div>
              )}

              <button onClick={handleProcessQueue}
                style={{ width: '100%', marginTop: 14, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--neon-lime)', color: '#000', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
                ⚙️ PROCESS PROTOCOL TREASURY QUEUE
              </button>
            </div>
          )}

          {/* Dormancy Auditor & Recovery */}
          <div style={{ background: 'rgba(22,27,34,0.95)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 12 }}>🔍 Dormancy Auditor & recovery</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input type="number" placeholder="Enter Node ID to audit" value={dormancyCheckNodeId} onChange={e => setDormancyCheckNodeId(e.target.value)}
                style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12, outline: 'none' }} />
              <button onClick={() => auditNodeDormancy(dormancyCheckNodeId)}
                style={{ background: '#4FC3F7', color: '#000', border: 'none', padding: '0 16px', borderRadius: 10, fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
                Audit
              </button>
            </div>

            {auditLoading && (
              <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Auditing node on-chain...</div>
            )}

            {auditedNode && (
              <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--neon-lime)' }}>Node #{auditedNode.id} Overview</span>
                  <span style={{ fontSize: 10, color: '#4FC3F7', fontWeight: 800 }}>Tier {auditedNode.tier}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>
                  <div>Owner Wallet: <span style={{ fontFamily: 'monospace', color: '#fff' }}>{auditedNode.wallet}</span></div>
                  <div>Last Activity: <span style={{ color: '#fff' }}>{auditedNode.lastActivity > 0 ? new Date(auditedNode.lastActivity * 1000).toLocaleString() : 'Never'}</span></div>
                  <div>Dormancy Status: <span style={{ fontWeight: 900, color: auditedNode.dormantSince > 0 ? '#FF5252' : '#A3FF12' }}>
                    {auditedNode.dormantSince > 0 ? 'DORMANT' : 'ACTIVE'}
                  </span></div>
                  {auditedNode.dormantSince > 0 && (
                    <div>Dormant Since: <span style={{ color: '#fff' }}>{new Date(auditedNode.dormantSince * 1000).toLocaleString()}</span></div>
                  )}
                  <div>Accumulated Missed Rewards: <span style={{ fontWeight: 900, color: '#FFD700' }}>{auditedNode.treasuryBalance} BNB</span></div>
                </div>

                {/* Dormancy actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Declare dormant action */}
                  {auditedNode.dormantSince === 0 && (
                    <button 
                      onClick={() => handleDeclareDormant(auditedNode.id)}
                      disabled={Math.floor(Date.now() / 1000) <= auditedNode.lastActivity + dormancyThresh}
                      style={{ 
                        width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                        background: Math.floor(Date.now() / 1000) > auditedNode.lastActivity + dormancyThresh ? '#FF5252' : 'rgba(255,255,255,0.05)',
                        color: Math.floor(Date.now() / 1000) > auditedNode.lastActivity + dormancyThresh ? '#fff' : 'rgba(255,255,255,0.2)',
                        fontWeight: 900, fontSize: 11, cursor: 'pointer' 
                      }}>
                      {Math.floor(Date.now() / 1000) > auditedNode.lastActivity + dormancyThresh 
                        ? '⚡ DECLARE NODE DORMANT' 
                        : `Inactive Threshold Met in: ${Math.ceil(((auditedNode.lastActivity + dormancyThresh) - Math.floor(Date.now() / 1000)) / (24 * 3600))} Days`}
                    </button>
                  )}

                  {/* Reclaim node action (owner only) */}
                  {auditedNode.dormantSince > 0 && auditedNode.wallet.toLowerCase() === walletAddress?.toLowerCase() && (
                    <button onClick={handleReclaimNode}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#A3FF12', color: '#000', fontWeight: 900, fontSize: 11, cursor: 'pointer' }}>
                      🛡️ RECLAIM DORMANT NODE (Recovery Window)
                    </button>
                  )}

                  {/* Abandon treasury action */}
                  {auditedNode.dormantSince > 0 && (
                    <button 
                      onClick={() => handleAbandonTreasury(auditedNode.id)}
                      disabled={Math.floor(Date.now() / 1000) <= auditedNode.dormantSince + 30 * 24 * 3600}
                      style={{ 
                        width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                        background: Math.floor(Date.now() / 1000) > auditedNode.dormantSince + 30 * 24 * 3600 ? '#FF5252' : 'rgba(255,255,255,0.05)',
                        color: Math.floor(Date.now() / 1000) > auditedNode.dormantSince + 30 * 24 * 3600 ? '#fff' : 'rgba(255,255,255,0.2)',
                        fontWeight: 900, fontSize: 11, cursor: 'pointer' 
                      }}>
                      {Math.floor(Date.now() / 1000) > auditedNode.dormantSince + 30 * 24 * 3600 
                        ? '🔥 ABANDON TREASURY (Payout to DAO)' 
                        : `Recovery Window Active. Abandon in: ${Math.ceil(((auditedNode.dormantSince + 30 * 24 * 3600) - Math.floor(Date.now() / 1000)) / (24 * 3600))} Days`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE PROPOSAL TAB */}
      {tab === 'create' && (
        <form onSubmit={handleCreateProposal}
          style={{ background: 'rgba(22,27,34,0.95)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#A3FF12', marginBottom: 4 }}>✍️ Create DAO Proposal</div>
          
          <div>
            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>TARGET WALLET / RECIPIENT</label>
            <input type="text" placeholder="0x..." value={targetAddress} onChange={e => setTargetAddress(e.target.value)} required
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12, outline: 'none' }} />
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>AMOUNT IN BNB</label>
            <input type="number" step="0.001" placeholder="e.g. 1.5" value={proposalAmount} onChange={e => setProposalAmount(e.target.value)} required
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12, outline: 'none', fontFamily: 'monospace' }} />
          </div>

          <div>
            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>PROPOSAL PURPOSE & SPECIFICATIONS</label>
            <textarea placeholder="Specify the details and target use of this allocation..." value={proposalPurpose} onChange={e => setProposalPurpose(e.target.value)} required rows={4}
              style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 12, outline: 'none', resize: 'vertical' }} />
          </div>

          {hasNode ? (
            <button type="submit"
              style={{ width: '100%', marginTop: 6, padding: '14px', borderRadius: 12, border: 'none', background: 'var(--neon-lime)', color: '#000', fontSize: 13, fontWeight: 900, cursor: 'pointer', boxShadow: '0 0 15px rgba(163,255,18,0.3)' }}>
              SUBMIT GOVERNANCE PROPOSAL
            </button>
          ) : (
            <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700 }}>
              🔒 Proposing requires a Node ID.
            </div>
          )}
        </form>
      )}
    </div>
  );
}
