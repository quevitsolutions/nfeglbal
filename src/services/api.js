/**
 * NFEGlobal API Service (Mocked/Decoupled)
 * Completely decoupled from PostgreSQL database / REST server.
 * All operations now occur directly on-chain.
 */
class ApiService {
  constructor() {
    this.baseUrl = '';
  }

  async fetchUser(walletAddress, referrerId = null) {
    return {
      walletAddress,
      node_id: 0,
      node_tier: 0,
      taps: 0,
      local_reward: 0,
      energy: 0,
      direct_refs: 0,
      team_size: 0,
      is_premium: false,
      daily_streak: 0,
      claimed_milestones: '[]',
      is_new: false
    };
  }

  async syncState(data) {
    return { success: true };
  }

  async confirmNode(walletAddress, nodeId, tier, txHash = null) {
    return { success: true, nodeId, tier };
  }

  async fetchLeaderboard() {
    return [];
  }

  async fetchReferralList(walletAddress) {
    return [];
  }

  async fetchFreeUserLevels(walletAddress) {
    return { levels: {}, total: 0, maxLevel: 0 };
  }

  async trackReferral(walletAddress, refToken) {
    return { linked: false };
  }

  async claimMining(walletAddress) {
    return { success: true };
  }

  async claimDailyReward(walletAddress) {
    return { success: true };
  }

  async upgradeTier(walletAddress, { tier, isPremium, nodeId } = {}) {
    return { success: true };
  }

  async fetchUserConversions(walletAddress) {
    return [];
  }

  async fetchIncomeHistory(walletAddress) {
    return [];
  }

  async fetchGlobalHistory() {
    return [];
  }

  async fetchTasks(walletAddress) {
    return [];
  }

  async claimTask(walletAddress, taskId) {
    return { success: true };
  }

  async claimMilestone(walletAddress, milestoneThreshold) {
    return { success: true };
  }

  async claimFreeMilestone(walletAddress, milestoneThreshold) {
    return { success: true };
  }

  async claimSignupBonus(walletAddress) {
    return { success: true };
  }

  async fetchReferralStats(walletAddress) {
    return { direct_count: 0, total_team: 0, active_referrals: 0 };
  }

  async fetchAdminOverview(adminWallet) {
    return null;
  }

  async createSnapshot(adminWallet, name) {
    return { success: true };
  }

  async fetchSnapshots(adminWallet) {
    return [];
  }

  async fetchSnapshotData(adminWallet, id) {
    return [];
  }

  async fetchNetworkLevelMembers(walletAddress, level) {
    return [];
  }

  async fetchReferralLevelMembers(walletAddress, level) {
    return [];
  }

  async fetchNetworkCounts(walletAddress) {
    return [];
  }

  async createAdminTask(adminWallet, payload) {
    return { success: true };
  }

  async deleteAdminTask(adminWallet, taskId) {
    return { success: true };
  }

  async fetchAdminUserDetails(adminWallet, userWallet) {
    return null;
  }

  async adjustUserReward(adminWallet, userWallet, amount, reason = '') {
    return { success: true };
  }

  async fetchAdminAdjustmentHistory(adminWallet) {
    return [];
  }

  async fetchGlobalStats() {
    return { total_users: 0, total_volume_bnb: 0, active_nodes: 0 };
  }

  async initAdminTasksDB(adminWallet) {
    return { success: true };
  }

  async fetchEvents(walletAddress) {
    return [];
  }

  async bookEvent(walletAddress, eventId) {
    return { success: true };
  }

  async createAdminEvent(adminWallet, eventData) {
    return { success: true };
  }

  async syncNetworkMembers(members, parentNodeId) {
    return { success: true };
  }

  async fetchSystemStatus(adminWallet) {
    return null;
  }

  async triggerSystemUpgrade(adminWallet, { forceReset = false } = {}) {
    return { success: true };
  }

  async fetchTargetedUsers(adminWallet) {
    return [];
  }

  async setTargetedUser(adminWallet, walletAddress, status) {
    return { success: true };
  }

  async fetchTreasuryNodes(adminWallet) {
    return [];
  }

  async addTreasuryNode(adminWallet, nodeId, maxTier = 18, label = '') {
    return { success: true };
  }

  async removeTreasuryNode(adminWallet, nodeId) {
    return { success: true };
  }

  async fetchTreasuryLog(adminWallet) {
    return [];
  }

  async triggerTreasuryKeeper(adminWallet) {
    return { success: true };
  }
}

export const api = new ApiService();
