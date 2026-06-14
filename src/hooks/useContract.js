import { useMemo, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { blockchain } from '../services/blockchain.js';
import { useGameStore } from "../store/gameStore.js";
import toast from "react-hot-toast";

/**
 * NFEGlobal Contract Hook (Clean Wrapper)
 */
export const useContract = () => {
  const setNodeData = useGameStore(s => s.setNodeData);
  const updateChainData = useGameStore(s => s.updateChainData);
  const setBnbBalance = useGameStore(s => s.setBnbBalance);
  const setProcessing = useGameStore(s => s.setProcessing);
  
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();

  const loadNodeData = async (address, retries = 2) => {
    if (!address) return;
    try {
      const data = await blockchain.getFullDashboardData(address);
      if (data.hasNode || data.isFreeActive) {
        // ANTI-FLICKER: Only skip setNodeData if DB already has BOTH hasNode/isFreeActive AND nodeId.
        // If nodeId is null (DB has tier but no node_id yet), we still need blockchain data.
        const storeState = useGameStore.getState();
        const dbFullyLoaded = (storeState.hasNode || storeState.isFreeActive) && storeState.nodeId && Number(storeState.nodeId) > 0;
        if (!dbFullyLoaded) {
          setNodeData({ nodeId: data.nodeId, tier: data.tier, active: data.nodeActive });
        }

        // Always update chain-specific data — additive, not overwriting node identity
        updateChainData({
          totalEarned:      parseFloat(data.totalEarned    || 0),
          teamSize:         data.teamSize,
          directRefs:       data.directRefs,
          pendingReward:    parseFloat(data.pendingReward  || 0),
          poolClaimable:    parseFloat(data.poolClaimable  || 0),
          poolName:         data.poolName        || 'None',
          totalDeposited:   parseFloat(data.totalDeposited || 0),
          isPoolQualified:  Boolean(data.isPoolQualified),
          totalPoolEarned:  parseFloat(data.totalPoolEarned  || 0),
          totalPoolClaimed: parseFloat(data.totalPoolClaimed || 0),
          remainingCap:     parseFloat(data.remainingCap    || 0),
          lifetimeCap:      parseFloat(data.lifetimeCap     || 0),
          missingDirects:   data.missingDirects  || 0,
          missingTier:      data.missingTier     || 0,
          missingTeam:      data.missingTeam     || 0,
        });
        return data.nodeId;
      } else {
        // STABILITY: Never downgrade if DB already shows the user has a node.
        const storeState = useGameStore.getState();
        const currentTier = storeState.nodeTier || 0;
        const currentFree = storeState.isFreeActive || false;
        if (currentTier === 0 && !currentFree) {
          setNodeData({ nodeId: 0, tier: 0, active: false });
        }
        return 0;
      }
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return loadNodeData(address, retries - 1);
      }
    }
  };

  const fetchBnbBalance = async (address) => {
    if (!address) return;
    const bal = await blockchain.getBnbBalance(address);
    setBnbBalance(parseFloat(bal).toFixed(4));
    return bal;
  };

  return useMemo(() => ({
    loadNodeData, fetchBnbBalance, 
    connectWallet: () => {
      // Clear explicit-disconnect flag so auto-reconnect is allowed again
      try { localStorage.removeItem('nfeglobal_disconnected'); } catch(e) {}
      openConnectModal?.();
    },
    disconnectWallet: () => disconnect(),
    createNode: async (sponsorId = 1) => {
      const tid = toast.loading("Activating Node...");
      setProcessing(true, "Activating Node...");
      try {
        // blockchain.createNode() now calls api.confirmNode() internally
        // DB is updated before this line returns — no extra fetch needed
        const nid = await blockchain.createNode(sponsorId);

        const walletAddress = useGameStore.getState().walletAddress;
        if (walletAddress && nid > 0) {
          Promise.all([
            loadNodeData(walletAddress),
            fetchBnbBalance(walletAddress),
          ]).catch(() => {});
        }

        toast.success("🚀 Node Activated! Welcome to the Protocol.", { id: tid, duration: 5000 });
        setProcessing(false);
        return nid;
      } catch (e) {
        if (
          e?.message?.includes('insufficient funds') ||
          e?.message?.includes('INSUFFICIENT_FUNDS') ||
          e?.code === -32000
        ) {
          toast.error('⚠️ Not enough BNB — Fund your wallet to activate.', { id: tid, duration: 8000 });
        } else if (e?.code === 4001 || e?.message?.includes('rejected')) {
          toast.error('Transaction cancelled.', { id: tid });
        } else {
          let errMsg = e?.shortMessage || e?.message || 'Activation failed.';
          if (errMsg.toLowerCase().includes('insufficient funds')) errMsg = 'Insufficient BNB balance for transaction & gas.';
          else if (errMsg.includes('user rejected')) errMsg = 'Transaction rejected by user.';
          else errMsg = errMsg.slice(0, 80);
          toast.error(errMsg, { id: tid });
        }
        setProcessing(false);
        return false;
      }
    },
    createNodeWithSponsorAddress: async (sponsorAddress, sponsorOfSponsor = 1) => {
      const tid = toast.loading("Activating Node (Auto-Sponsor)...");
      setProcessing(true, "Activating Node...");
      try {
        const nid = await blockchain.createNodeWithSponsorAddress(sponsorAddress, sponsorOfSponsor);
        const walletAddress = useGameStore.getState().walletAddress;
        if (walletAddress && nid > 0) {
          Promise.all([
            loadNodeData(walletAddress),
            fetchBnbBalance(walletAddress),
          ]).catch(() => {});
        }
        toast.success("🚀 Node Activated! Welcome to the Protocol.", { id: tid, duration: 5000 });
        setProcessing(false);
        return nid;
      } catch (e) {
        if (e?.message?.includes('insufficient funds') || e?.code === -32000) {
          toast.error('⚠️ Not enough BNB — Fund your wallet to activate.', { id: tid, duration: 8000 });
        } else if (e?.code === 4001 || e?.message?.includes('rejected')) {
          toast.error('Transaction cancelled.', { id: tid });
        } else {
          let errMsg = e?.shortMessage || e?.message || 'Activation failed.';
          errMsg = errMsg.slice(0, 80);
          toast.error(errMsg, { id: tid });
        }
        setProcessing(false);
        return false;
      }
    },
    claimRewards: async () => {
      const tid = toast.loading("Withdrawing rewards...");
      setProcessing(true, "Withdrawing Rewards...");
      try {
        await blockchain.claimRewards();
        toast.success("✅ Rewards claimed!", { id: tid });
        setProcessing(false);
        return true;
      } catch (e) {
        toast.error("Claim failed", { id: tid });
        setProcessing(false);
        return false;
      }
    },
    claimPool: async (nodeId) => {
      if (!nodeId) return;
      const tid = toast.loading("Claiming Pool Rewards...");
      setProcessing(true, "Claiming Pool...");
      try {
        await blockchain.claimPool(nodeId);
        toast.success("✅ Pool Rewards Claimed!", { id: tid });
        const walletAddress = useGameStore.getState().walletAddress;
        setTimeout(() => loadNodeData(walletAddress), 1500);
        setProcessing(false);
        return true;
      } catch (e) {
        toast.error("Claim failed: " + e.message.slice(0, 40), { id: tid });
        setProcessing(false);
        return false;
      }
    },
    registerPool: async (nodeId) => {
      if (!nodeId) return;
      const tid = toast.loading("Registering into Reward Pool...");
      setProcessing(true, "Registering...");
      try {
        await blockchain.registerPool(nodeId);
        toast.success("🏆 Successfully registered for the Reward Pool!", { id: tid });
        const walletAddress = useGameStore.getState().walletAddress;
        setTimeout(() => loadNodeData(walletAddress), 1500);
        setProcessing(false);
        return true;
      } catch (e) {
        let msg = e.message;
        if (msg.includes("insufficient funds")) msg = "Insufficient BNB to pay gas for registration.";
        toast.error("Registration failed: " + msg.slice(0, 50), { id: tid });
        setProcessing(false);
        return false;
      }
    },
    unlockTier: async (nodeId, toTier) => {
      if (!nodeId) return toast.error('Node ID missing — reconnect wallet') && false;
      const tid = toast.loading(`Upgrading to Tier ${toTier}...`);
      setProcessing(true, `Upgrading to Tier ${toTier}...`);
      try {
        // blockchain.unlockTier() calls api.confirmNode() internally
        // DB has the new tier by the time this await resolves
        await blockchain.unlockTier(nodeId, toTier);

        const walletAddress = useGameStore.getState().walletAddress;
        if (walletAddress) {
          Promise.all([
            loadNodeData(walletAddress),
            fetchBnbBalance(walletAddress),
          ]).catch(() => {});
        }

        toast.success(`🚀 Tier ${toTier} Unlocked! Mining rate updated.`, { id: tid, duration: 5000 });
        setProcessing(false);
        return true;
      } catch (e) {
        if (e?.message?.includes('insufficient funds') || e?.code === -32000) {
          toast.error('⚠️ Not enough BNB for this upgrade.', { id: tid, duration: 8000 });
        } else if (e?.code === 4001 || e?.message?.includes('rejected')) {
          toast.error('Transaction cancelled.', { id: tid });
        } else {
          toast.error(e?.shortMessage || e?.message?.slice(0, 80) || 'Upgrade failed', { id: tid });
        }
        setProcessing(false);
        return false;
      }
    },
    fetchTeamCounts: (nid) => blockchain.getReferralCounts(nid),
    fetchLevelWiseTeamStats: (nid) => blockchain.getLevelWiseTeamStats(nid),
    fetchMatrixCounts: (nid) => blockchain.getMatrixLevelCounts(nid),
    fetchTeamLevelMembers: (nid, layer) => blockchain.getMatrixMembers(nid, layer),
    fetchDirectMembers: (nid) => blockchain.getDirectReferrals(nid),
    addressToNodeId: (wallet) => blockchain.addressToNodeId(wallet),
    getPendingUpgradeRewards: (nid) => blockchain.getPendingUpgradeRewards(nid),
    selfUpgrade: async () => {
      const walletAddress = useGameStore.getState().walletAddress;
      if (!walletAddress) return toast.error('Wallet not connected') && false;
      const tid = toast.loading(`Upgrading Node...`);
      setProcessing(true, `Upgrading Node...`);
      try {
        const { confirmedTier } = await blockchain.selfUpgrade();
        
        Promise.all([
          loadNodeData(walletAddress),
          fetchBnbBalance(walletAddress),
        ]).catch(() => {});
        
        toast.success(`🚀 Promoted to Tier ${confirmedTier}`, { id: tid, duration: 5000 });
        setProcessing(false);
        return confirmedTier;
      } catch (e) {
        if (e?.message?.includes('insufficient funds') || e?.code === -32000) {
          toast.error('⚠️ Not enough BNB for this upgrade.', { id: tid, duration: 8000 });
        } else if (e?.code === 4001 || e?.message?.includes('rejected')) {
          toast.error('Transaction cancelled.', { id: tid });
        } else {
          toast.error(e?.shortMessage || e?.message?.slice(0, 80) || 'Upgrade failed', { id: tid });
        }
        setProcessing(false);
        return false;
      }
    },
  }), [setNodeData, updateChainData, setBnbBalance, openConnectModal, disconnect]);

};

export const useWalletLifecycle = () => {
  const { address, isConnected, status } = useAccount();
  const { disconnect } = useDisconnect();
  const { setWallet, disconnectWallet, fetchUserData, fetchAdminStatus, fetchUserConversions, fetchTeamHistory } = useGameStore();
  const { loadNodeData, fetchBnbBalance } = useContract();

  useEffect(() => {
    // STABILITY FIX: Accept both 'connected' AND 'reconnecting' status.
    // On page refresh with a saved wallet, Wagmi starts as 'reconnecting' — blocking
    // on 'connected' only means fetchUserData never fires and the app shows all nulls.
    // Block only 'connecting' (unconfirmed first-connect attempt).
    if (!isConnected || !address || status === 'connecting') return;

    // DISCONNECT FIX: If the user explicitly disconnected, block wagmi's auto-reconnect.
    // wagmi re-emits 'connected' on mount when it restores a saved connector.
    // We intercept that here and force-disconnect again.
    const wasExplicitlyDisconnected = (() => {
      try { return localStorage.getItem('nfeglobal_disconnected') === '1'; } catch(e) { return false; }
    })();
    if (wasExplicitlyDisconnected) {
      disconnect(); // re-disconnect wagmi so it clears its own saved state
      return;
    }

    // Clear the flag on a genuine user-initiated connect
    try { localStorage.removeItem('nfeglobal_disconnected'); } catch(e) {}

    // Set wallet first (synchronous)
    setWallet(address);

    // Parallel: load node data and balance immediately from on-chain RPC
    Promise.all([
      loadNodeData(address),
      fetchBnbBalance(address),
      fetchAdminStatus(),
    ]).catch(() => {});

  }, [isConnected, address, status]);

  // Separate disconnect handler — isolated to prevent re-runs on status flicker
  useEffect(() => {
    if (status === 'disconnected') {
      disconnectWallet();
    }
  }, [status]);

  return {
    setupListeners: () => {}, 
    removeListeners: () => {}
  };
};
