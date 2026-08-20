import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../services/api.js";
import axios from "axios";

const DEMO_TAP_LIMIT = 20;
const MAX_ENERGY = 500;
const ENERGY_REGEN_INTERVAL = 3000; // ms per 1 energy
const BASE_MINING_RATE = 10;

const RESET_STATE = {
  hasNode: false, nodeId: null, nodeTier: 0, nodeActive: false, isPremium: false,
  isFreeActive: false, createdAt: null, initialLoaded: false, pendingMined: 0,
  lastSyncTime: null, sponsorWallet: null, sponsorNodeId: null, localReward: 0,
  taps: 0, demoTaps: 0, teamSize: 0, directRefs: 0, totalEarned: 0, streak: 0,
  lastClaimDate: null, teamHistory: [], leaderboard: [], isAdmin: false,
  adminStats: null, claimedMilestones: [], activatedRefs: 0,
  isFetchingUser: false, isSyncing: false, lastBackendSync: null,
  isRegistering: false
};

export const useGameStore = create(
  persist(
    (set, get) => ({
      // Wallet
      walletAddress: null,
      isConnected: false,
      bnbBalance: "0.00",
      isAdmin: false,
      leaderboard: [],
      referralList: [],
      conversionHistory: [],
      adminStats: null,
      snapshotHistory: [],
      adjustmentLogs: [],
      globalStats: { total_users: 0, total_volume_bnb: 0, active_nodes: 0 },
      teamHistory: [],
      globalHistory: [],
      isHistoryLoading: false,
      sponsorWallet: null,   // wallet address of who referred this user
      isNewUser: false,      // true only on very first connect (for welcome banner)

      // Backend Sync
      isSyncing: false,
      isFetchingUser: false,
      isProcessing: false,
      processingLabel: "",
      initialLoaded: false,
      lastBackendSync: null,
      loadingReferrals: false,

      // Node
      hasNode: false,
      nodeId: null,
      nodeTier: 0,
      isPremium: false,
      nodeActive: false,
      isFreeActive: false,
      createdAt: null,

      // Tap engine
      taps: 0,
      demoTaps: 0,
      localReward: 0,
      energy: MAX_ENERGY,
      maxEnergy: MAX_ENERGY,
      miningRate: BASE_MINING_RATE,
      isLocked: false,
      showNodePopup: false,

      // Earnings
      totalEarned: 0,
      pendingReward: 0,
      teamSize: 0,
      directRefs: 0,
      poolClaimable: 0,
      activatedRefs: 0,
      claimedMilestones: [],

      // V2 Hybrid Upgrade Vault
      withdrawableBalance: 0,
      upgradeVaultBalance: 0,
      lifetimeRewards: 0,
      lifetimeVaultDeposits: 0,
      lifetimeVaultUsed: 0,
      dailyUpgradeCount: 0,
      vaultHistory: [],

      // Streak
      streak: 0,
      lastClaimDate: null,
      showDailyPopup: false,

      // Mining Logic
      lastClaimTime: Date.now(),
      pendingMined: 0,

      // Tasks & Events
      tasks: [],
      events: [],

      // Pool Qualification
      poolQual: {
        poolName: "None",
        isQualified: false,
        isPoolQualified: false,
        nextPoolId: 0,
        totalDeposited: 0,
        totalPoolEarned: 0,
        totalPoolClaimed: 0,
        remainingCap: 0,
        lifetimeCap: 0,
        missingDirects: 0,
        missingTier: 0,
        missingTeam: 0,
        totalEarned: 0,
      },

      // UI & Theme
      activeTab: "prelaunch",
      showUpgradePopup: false,
      theme: typeof window !== 'undefined' && localStorage.getItem('aipcore_theme') ? localStorage.getItem('aipcore_theme') : 'dark',

      toggleTheme: () => {
        const currentTheme = get().theme || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        if (typeof window !== 'undefined') {
          localStorage.setItem('aipcore_theme', newTheme);
          document.documentElement.setAttribute('data-theme', newTheme);
        }
        set({ theme: newTheme });
      },
      setTheme: (newTheme) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('aipcore_theme', newTheme);
          document.documentElement.setAttribute('data-theme', newTheme);
        }
        set({ theme: newTheme });
      },

      // Referral
      referrerId: null,
      referralCode: null,

      // Actions
      setWallet: (address) => {
        const current = get().walletAddress;
        // If connecting a different wallet while one is already in state, wipe the slate clean
        const isSwitching = address && current && address.toLowerCase() !== current.toLowerCase();

        set({
          walletAddress: address,
          isConnected: !!address,
          ...(address ? (isSwitching ? RESET_STATE : {}) : RESET_STATE),
        });
      },

      setBnbBalance: (balance) => set({ bnbBalance: balance }),

      disconnectWallet: () => {
        set({
          walletAddress: null,
          isConnected: false,
          bnbBalance: "0.00",
          ...RESET_STATE
        });
        localStorage.removeItem("aipcore-game-state");
      },

      setProcessing: (isProcessing, processingLabel = "") =>
        set({ isProcessing, processingLabel }),

      setNodeData: (data) => {
        const rawTier = data.tier !== undefined ? Number(data.tier) : 0;
        const tier = rawTier;
        const isActive = data.nodeId && Number(data.nodeId) > 0;
        const isFreeActive = isActive && tier === 0;
        const hasNode = isActive && tier > 0;

        // TIER SCALING: Tier 1 = 100 NFE/hr, each tier +20% (1.2^(tier-1))
        // Free users: 10 NFE/hr base, no exponential scaling
        const baseRate = hasNode ? 100 : BASE_MINING_RATE;
        const newMiningRate = hasNode 
          ? Math.round(baseRate * Math.pow(1.2, Math.max(0, tier - 1)))
          : BASE_MINING_RATE;
        
        const newMaxEnergy  = 500 + Math.max(0, tier - 1) * 200;

        set({
          hasNode:    hasNode,
          isFreeActive: isFreeActive,
          nodeId:     isActive ? Number(data.nodeId) : null,
          nodeTier:   tier,
          nodeActive: data.active,
          miningRate: newMiningRate,
          maxEnergy:  newMaxEnergy,
          energy:     Math.min(newMaxEnergy, get().energy),
          isLocked:   !isActive,
          demoTaps:   0,
        });
      },

      handleTap: () => {
        const state = get();
        if (state.energy <= 0) return { status: "NO_ENERGY" };

        if (!state.hasNode && !state.isFreeActive) {
          if (state.demoTaps >= DEMO_TAP_LIMIT) {
            set({ isLocked: true, showNodePopup: true });
            return { status: "LOCKED" };
          }
          // BALANCE CHANGE: Do NOT increment localReward in real-time — credit only on Claim
          set((s) => ({
            demoTaps: s.demoTaps + 1,
            taps: s.taps + 1,
            energy: Math.max(0, s.energy - 1),
          }));
          return { status: "DEMO", taps: get().taps };
        }

        // BALANCE CHANGE: Tap only costs energy and increments taps — NO real-time balance
        set((s) => ({
          taps: s.taps + 1,
          energy: Math.max(0, s.energy - 1),
        }));

        // Trigger background sync every 10 taps
        if (get().taps % 10 === 0) get().syncWithBackend();

        return { status: "SUCCESS", taps: get().taps };
      },

      rechargeEnergy: () => {
        const state = get();
        // Elite Sync: Node owners recharge 3x faster (3 per tick vs 1)
        const amount = state.hasNode ? 3 : 1;
        set((s) => ({ energy: Math.min(s.maxEnergy, s.energy + amount) }));
      },

      claimMined: async () => {
        const { walletAddress, pendingMined: previousPending } = get();
        if (!walletAddress) return false;

        // Optimistically clear the display — but remember the old value to restore on failure
        set({ pendingMined: 0 });

        try {
          const res = await api.claimMining(walletAddress);
          if (res?.success && res?.user) {
            set({
              localReward: parseFloat(res.user.local_reward || 0),
              lastClaimTime: new Date(res.user.last_claim_time).getTime(),
              lastSyncTime: Date.now(),
              lastBackendSync: Date.now(),
              pendingMined: 0, // Confirmed: keep at 0
            });
            return true; // Signal success
          }
          // API returned but success=false — restore pending
          set({ pendingMined: previousPending });
          return false;
        } catch (err) {
          // Network/server error — restore pending so user doesn't lose their display
          set({ pendingMined: previousPending });
          console.warn("Claim API failed:", err.message);
          return false;
        }
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
      setShowNodePopup: (v) => set({ showNodePopup: v }),
      setShowUpgradePopup: (v) => set({ showUpgradePopup: v }),
      setShowDailyPopup: (v) => set({ showDailyPopup: v }),
      setReferrerId: (id) => set({ referrerId: id }),

      claimStreak: async (day) => {
        const { hasNode } = get();
        const baseRewards = [100, 250, 450, 700, 1000, 1800, 2500];
        const multiplier = hasNode ? 10 : 1;
        const reward = baseRewards[Math.min(day - 1, 6)] * multiplier;
        try {
          await get().claimDailyReward();
        } catch {
          // Fallback: optimistic local update (still better than silent failure)
          set((s) => ({
            localReward: s.localReward + reward,
            streak: day,
            lastClaimDate: Date.now(),
            lastBackendSync: Date.now(),
            showDailyPopup: false,
          }));
        }
        set({ showDailyPopup: false });
        return reward;
      },

      updateChainData: (data) =>
        set((s) => ({
          pendingReward: data.pendingReward ?? s.pendingReward,
          teamSize: data.teamSize ?? s.teamSize,
          directRefs: data.directRefs ?? s.directRefs,
          totalEarned: data.totalEarned ?? s.totalEarned,
          poolClaimable: data.poolClaimable ?? s.poolClaimable,
          poolQual: {
            ...s.poolQual,
            poolName:         data.poolName         ?? s.poolQual.poolName,
            totalDeposited:   data.totalDeposited   ?? s.poolQual.totalDeposited,
            isPoolQualified:  data.isPoolQualified  ?? s.poolQual.isPoolQualified,
            totalPoolEarned:  data.totalPoolEarned  ?? s.poolQual.totalPoolEarned,
            totalPoolClaimed: data.totalPoolClaimed ?? s.poolQual.totalPoolClaimed,
            remainingCap:     data.remainingCap     ?? s.poolQual.remainingCap,
            lifetimeCap:      data.lifetimeCap      ?? s.poolQual.lifetimeCap,
            missingDirects:   data.missingDirects   ?? s.poolQual.missingDirects,
            missingTier:      data.missingTier      ?? s.poolQual.missingTier,
            missingTeam:      data.missingTeam      ?? s.poolQual.missingTeam,
          },
        })),

      syncWithBackend: async () => {
        // No-op for 100% on-chain operation
      },

      addLocalReward: (amount) => {
        // No-op
      },

      fetchUserData: async (forcedReferrer = null) => {
        const { walletAddress, isFetchingUser } = get();
        if (!walletAddress || isFetchingUser) return;

        set({ isFetchingUser: true, isSyncing: !get().initialLoaded });

        try {
          const { blockchain } = await import("../services/blockchain.js");
          const data = await blockchain.getFullDashboardData(walletAddress);

          let backendData = null;
          try {
            const res = await axios.get(`/api/users/profile/${walletAddress}`);
            backendData = res.data;
          } catch (e) {
            console.warn("Backend profile fetch failed:", e.message);
          }
          
          if (data && (data.hasNode || data.isFreeActive)) {
            const rawTier = data.tier !== undefined ? Number(data.tier) : 0;
            const tier = backendData && backendData.nodeTier !== undefined ? backendData.nodeTier : rawTier;
            const isActive = data.nodeId && Number(data.nodeId) > 0;
            const hasNode = isActive && tier > 0;
            
            const baseRate = hasNode ? 100 : BASE_MINING_RATE;
            const newMiningRate = hasNode 
              ? Math.round(baseRate * Math.pow(1.2, Math.max(0, tier - 1)))
              : BASE_MINING_RATE;
            
            const newMaxEnergy  = 500 + Math.max(0, tier - 1) * 200;

            set({
              hasNode: data.hasNode,
              isFreeActive: data.isFreeActive,
              nodeId: data.nodeId,
              nodeTier: tier,
              nodeActive: data.nodeActive,
              miningRate: newMiningRate,
              maxEnergy: newMaxEnergy,
              energy: Math.min(newMaxEnergy, get().energy),
              isLocked: !isActive,
              demoTaps: 0,
              directRefs: data.directRefs,
              teamSize: data.teamSize,
              totalEarned: backendData ? (backendData.lifetime_rewards + backendData.withdrawable_balance) : data.totalEarned,
              pendingReward: data.pendingReward,
              poolClaimable: data.poolClaimable,

              // V2 Upgrade Vault Account Values
              withdrawableBalance: backendData ? backendData.withdrawable_balance : 0,
              upgradeVaultBalance: backendData ? backendData.upgrade_vault_balance : 0,
              lifetimeRewards: backendData ? backendData.lifetime_rewards : 0,
              lifetimeVaultDeposits: backendData ? backendData.lifetime_vault_deposits : 0,
              lifetimeVaultUsed: backendData ? backendData.lifetime_vault_used : 0,
              dailyUpgradeCount: backendData ? backendData.daily_upgrade_count : 0,

              poolQual: {
                poolName: data.poolName,
                totalDeposited: data.totalDeposited,
                isPoolQualified: data.isPoolQualified,
                totalPoolEarned: data.totalPoolEarned,
                totalPoolClaimed: data.totalPoolClaimed,
                remainingCap: data.remainingCap,
                lifetimeCap: data.lifetimeCap,
                missingDirects: data.missingDirects,
                missingTier: data.missingTier,
                missingTeam: data.missingTeam,
                totalEarned: data.totalEarned
              },
              initialLoaded: true,
              lastBackendSync: Date.now(),
              lastSyncTime: Date.now(),
            });
          } else {
            set({
              hasNode: false,
              isFreeActive: false,
              nodeId: null,
              nodeTier: 0,
              nodeActive: false,
              initialLoaded: true,
              lastBackendSync: Date.now(),
              lastSyncTime: Date.now(),
            });
          }
        } catch (err) {
          console.warn('fetchUserData failed:', err.message);
        } finally {
          set({ isFetchingUser: false, isSyncing: false, initialLoaded: true });
        }
      },

      fetchLeaderboardData: async () => {
        // No-op - leaderboard is empty on-chain
        set({ leaderboard: [] });
      },

      fetchReferralData: async () => {
        const { walletAddress, nodeId } = get();
        if (!walletAddress || !nodeId) return;
        set({ loadingReferrals: true });
        try {
          const { blockchain } = await import("../services/blockchain.js");
          const data = await blockchain.getDirectReferrals(nodeId);
          set({ referralList: Array.isArray(data) ? data : [] });
        } catch (err) {
          console.warn("Referral List Fetch Failed:", err.message);
          set({ referralList: [] });
        } finally {
          set({ loadingReferrals: false });
        }
      },

      fetchTasksData: async () => {
        // Tasks are disabled
        set({ tasks: [] });
      },

      claimTaskAction: async (taskId) => {
        // Tasks are disabled
        return { success: false };
      },

      fetchEventsAction: async () => {
        // Events are disabled
        set({ events: [] });
      },

      bookEventAction: async (eventId) => {
        // Events are disabled
        return { success: false };
      },

      claimMilestoneAction: async (threshold) => {
        // Milestones are disabled
        return { success: false };
      },

      claimFreeMilestoneAction: async (threshold) => {
        // Milestones are disabled
        return { success: false };
      },

      claimSignupBonusAction: async () => {
        // Signup bonus is disabled
        return { success: false };
      },

      claimDailyReward: async () => {
        // Daily rewards are disabled
        return { success: false };
      },

      // Admin Actions
      fetchAdminStatus: async () => {
        const { walletAddress } = get();
        if (!walletAddress) return;
        try {
          const { blockchain } = await import("../services/blockchain.js");
          const owner = await blockchain.getOwner();
          const isAdmin = owner && walletAddress.toLowerCase() === owner.toLowerCase();

          set({ isAdmin });
          if (isAdmin) {
            get().fetchAdminOverview();
          }
          get().fetchGlobalProtocolStats();
        } catch (e) {
          console.warn("Admin Status Check Failed:", e.message);
        }
      },

      fetchAdminOverview: async () => {
        // Admin overview no-op
        set({ adminStats: null });
      },

      fetchAdminAdjustments: async () => {
        set({ adjustmentLogs: [] });
      },

      fetchGlobalProtocolStats: async () => {
        try {
          const { blockchain } = await import("../services/blockchain.js");
          const price = await blockchain._getNativeUsdPrice();
          const [rawStats, freeUsers, freeUpgraded] = await Promise.all([
            blockchain.core.getConfig().catch(() => null),
            blockchain.core.totalFreeUsers().catch(() => 0n),
            blockchain.core.totalFreeUpgraded().catch(() => 0n)
          ]);
          
          if (rawStats) {
            set({
              globalStats: {
                total_users: Number(rawStats[1] || 0),
                total_volume_bnb: 0, // contract doesn't track cumulative bnbVolume, handled on frontend via view calls
                active_nodes: Number(rawStats[1] || 0),
                total_free_users: Number(freeUsers || 0),
                total_free_upgraded: Number(freeUpgraded || 0)
              }
            });
          }
        } catch (e) {
          console.warn("Global Stats Fetch Failed:", e.message);
        }
      },

      takeSnapshot: async (name) => {
        // Snapshots disabled
      },

      loadSnapshots: async () => {
        set({ snapshotHistory: [] });
      },

      fetchUserConversions: async () => {
        set({ conversionHistory: [] });
      },

      fetchTeamHistory: async () => {
        const { walletAddress } = get();
        if (!walletAddress) return;
        set({ isHistoryLoading: true });
        try {
          let list = null;
          let { nodeId } = get();
          
          if (!nodeId || nodeId === 0) {
            const { blockchain } = await import('../services/blockchain.js');
            const data = await blockchain.getFullDashboardData(walletAddress);
            if (data?.hasNode && data.nodeId > 0) {
              nodeId = data.nodeId;
            }
          }

          if (nodeId && nodeId > 0) {
            const { blockchain } = await import('../services/blockchain.js');
            list = await blockchain.fetchTeamHistoryOnChain(nodeId, 100);
          }

          set({ teamHistory: Array.isArray(list) ? list : [] });
        } catch (e) {
          console.warn("Team History Fetch Failed:", e.message);
          set({ teamHistory: [] });
        } finally {
          set({ isHistoryLoading: false });
        }
      },

      fetchGlobalHistory: async () => {
        set({ globalHistory: [] });
      },

      withdrawBalance: async () => {
        const { walletAddress } = get();
        if (!walletAddress) return false;
        try {
          const res = await axios.post("/api/users/withdraw", { walletAddress });
          if (res.data && res.data.success) {
            await get().fetchUserData();
            await get().fetchVaultHistory();
            return true;
          }
          return false;
        } catch (err) {
          console.warn("Withdrawal request failed:", err.message);
          return false;
        }
      },

      fetchVaultHistory: async () => {
        const { walletAddress } = get();
        if (!walletAddress) return;
        try {
          const res = await axios.get(`/api/users/vault/history/${walletAddress}`);
          if (res.data && res.data.success) {
            set({ vaultHistory: res.data.data || [] });
          }
        } catch (err) {
          console.warn("Fetch vault history failed:", err.message);
        }
      },

      reset: () =>
        set({
          taps: 0,
          demoTaps: 0,
          localReward: 0,
          conversionHistory: [],
          energy: MAX_ENERGY,
          isLocked: false,
          showNodePopup: false,
        }),
    }),
    {
      name: "aipcore-game-state",
      version: 2,
      partialize: (s) => ({
        walletAddress: s.walletAddress,
        isConnected: s.isConnected,
        hasNode: s.hasNode,
        isFreeActive: s.isFreeActive,
        nodeId: s.nodeId,
        nodeTier: s.nodeTier,
        nodeActive: s.nodeActive,
        referrerId: s.referrerId,
        sponsorWallet: s.sponsorWallet,
      }),
    },
  ),
);
