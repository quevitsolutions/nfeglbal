/**
 * AIPCore API Service
 * Handles data synchronization with the PostgreSQL backend
 */
class ApiService {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async fetchUser(walletAddress, referrerId = null) {
    const url = referrerId 
      ? `${this.baseUrl}/user/${walletAddress}?ref=${referrerId}` 
      : `${this.baseUrl}/user/${walletAddress}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  }

  async syncState(data) {
    const res = await fetch(`${this.baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Sync failed');
    return res.json();
  }

  // Called immediately after createNode() or unlockTier() tx confirms.
  // Sends the nodeId + tier parsed from the tx receipt event logs to the server.
  // Server updates DB instantly — zero RPC calls on the backend.
  async confirmNode(walletAddress, nodeId, tier, txHash = null) {
    try {
      const res = await fetch(`${this.baseUrl}/node/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, nodeId, tier, txHash })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('confirmNode failed:', err.error);
        return null;
      }
      return res.json(); // { success, nodeId, tier, mining_rate }
    } catch (err) {
      console.warn('confirmNode network error:', err.message);
      return null;
    }
  }

  async fetchLeaderboard() {
    const res = await fetch(`${this.baseUrl}/leaderboard`);
    if (!res.ok) throw new Error('Failed to fetch leaderboard');
    return res.json();
  }

  async fetchReferralList(walletAddress) {
    const res = await fetch(`${this.baseUrl}/referrals/${walletAddress}`);
    if (!res.ok) throw new Error('Failed to fetch referrals');
    return res.json();
  }

  // Returns free users (no node) organized by referral level (1=direct, 2=level2 etc.)
  // Response: { levels: { "1": [...], "2": [...] }, total: N, maxLevel: N }
  async fetchFreeUserLevels(walletAddress) {
    try {
      const res = await fetch(`${this.baseUrl}/referrals/free-levels/${walletAddress}`);
      if (!res.ok) return { levels: {}, total: 0, maxLevel: 0 };
      return res.json();
    } catch {
      return { levels: {}, total: 0, maxLevel: 0 };
    }
  }

  async trackReferral(walletAddress, refToken) {
    try {
      const res = await fetch(`${this.baseUrl}/referrals/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, refToken })
      });
      return res.json();
    } catch (err) {
      console.warn('Referral track silently failed:', err.message);
      return null;
    }
  }

  async claimMining(walletAddress) {
    const res = await fetch(`${this.baseUrl}/mining/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Claim failed');
    }
    return res.json();
  }

  async claimDailyReward(walletAddress) {
    const res = await fetch(`${this.baseUrl}/daily/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress })
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Daily claim failed');
    }
    return res.json();
  }

  async upgradeTier(walletAddress, { tier, isPremium, nodeId } = {}) {
    const res = await fetch(`${this.baseUrl}/mining/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, tier: tier || null, isPremium: isPremium ?? null, nodeId: nodeId || null })
    });
    if (!res.ok) throw new Error('Upgrade failed');
    return res.json();
  }

  async fetchUserConversions(walletAddress) {
    const res = await fetch(`${this.baseUrl}/user/conversions/${walletAddress}`);
    if (!res.ok) throw new Error('History fetch failed');
    return res.json();
  }

  async fetchIncomeHistory(walletAddress) {
    const res = await fetch(`${this.baseUrl}/user/income-history/${walletAddress}`);
    if (!res.ok) throw new Error('Income history fetch failed');
    return res.json();
  }

  async fetchGlobalHistory() {
    const res = await fetch(`${this.baseUrl}/history/global`);
    if (!res.ok) throw new Error('Global history fetch failed');
    return res.json();
  }

  // Task Endpoints
  async fetchTasks(walletAddress) {
    const res = await fetch(`${this.baseUrl}/tasks/${walletAddress}`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  }

  async claimTask(walletAddress, taskId) {
    const res = await fetch(`${this.baseUrl}/tasks/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, taskId })
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Task claim failed');
    }
    return res.json();
  }

  async claimMilestone(walletAddress, milestoneThreshold) {
    const res = await fetch(`${this.baseUrl}/milestones/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, milestoneThreshold })
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Milestone claim failed');
    }
    return res.json();
  }

  async claimFreeMilestone(walletAddress, milestoneThreshold) {
    const res = await fetch(`${this.baseUrl}/milestones/claim-free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, milestoneThreshold })
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Free milestone claim failed');
    }
    return res.json();
  }

  async claimSignupBonus(walletAddress) {
    const res = await fetch(`${this.baseUrl}/user/claim-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress })
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Signup bonus claim failed');
    }
    return res.json();
  }

  async fetchReferralStats(walletAddress) {
    const res = await fetch(`${this.baseUrl}/referrals/stats/${walletAddress}`);
    if (!res.ok) throw new Error('Failed to fetch referral stats');
    return res.json();
  }

  // Admin Endpoints
  async fetchAdminOverview(adminWallet) {
    const res = await fetch(`${this.baseUrl}/admin/overview`, {
      headers: { 'x-admin-wallet': adminWallet }
    });
    if (!res.ok) throw new Error('Access denied');
    return res.json();
  }

  async createSnapshot(adminWallet, name) {
    const res = await fetch(`${this.baseUrl}/admin/snapshot`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-wallet': adminWallet 
      },
      body: JSON.stringify({ name })
    });
    return res.json();
  }

  async fetchSnapshots(adminWallet) {
    const res = await fetch(`${this.baseUrl}/admin/snapshots`, {
      headers: { 'x-admin-wallet': adminWallet }
    });
    return res.json();
  }

  async fetchSnapshotData(adminWallet, id) {
    const res = await fetch(`${this.baseUrl}/admin/snapshot/${id}`, {
      headers: { 'x-admin-wallet': adminWallet }
    });
    return res.json();
  }

  async fetchNetworkLevelMembers(walletAddress, level) {
    const res = await fetch(`${this.baseUrl}/network/level/${walletAddress}/${level}`);
    if (!res.ok) throw new Error('Failed to fetch network level members');
    return res.json();
  }

  async fetchReferralLevelMembers(walletAddress, level) {
    const res = await fetch(`${this.baseUrl}/network/referral-level/${walletAddress}/${level}`);
    if (!res.ok) throw new Error('Failed to fetch referral level members');
    return res.json();
  }

  async fetchNetworkCounts(walletAddress) {
    const res = await fetch(`${this.baseUrl}/network/counts/${walletAddress}`);
    if (!res.ok) throw new Error('Failed to fetch network counts');
    return res.json();
  }

  async createAdminTask(adminWallet, payload) {
    const res = await fetch(`${this.baseUrl}/admin/tasks`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-wallet': adminWallet 
      },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async deleteAdminTask(adminWallet, taskId) {
    const res = await fetch(`${this.baseUrl}/admin/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { 'x-admin-wallet': adminWallet }
    });
    return res.json();
  }

  async fetchAdminUserDetails(adminWallet, userWallet) {
    const res = await fetch(`${this.baseUrl}/admin/user/${userWallet}`, {
      headers: { 'x-admin-wallet': adminWallet }
    });
    if (!res.ok) throw new Error('User not found');
    return res.json();
  }

  async adjustUserReward(adminWallet, userWallet, amount, reason = '') {
    const res = await fetch(`${this.baseUrl}/admin/user/adjust-reward`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-wallet': adminWallet 
      },
      body: JSON.stringify({ walletAddress: userWallet, amount, reason })
    });
    if (!res.ok) throw new Error('Adjustment failed');
    return res.json();
  }

  async fetchAdminAdjustmentHistory(adminWallet) {
    const res = await fetch(`${this.baseUrl}/admin/adjustments`, {
      headers: { 'x-admin-wallet': adminWallet }
    });
    return res.json();
  }

  async fetchGlobalStats() {
    const res = await fetch(`${this.baseUrl}/stats/global`);
    return res.json();
  }

  async initAdminTasksDB(adminWallet) {
    const res = await fetch(`${this.baseUrl}/admin/init-tasks-db`, {
      method: 'POST',
      headers: { 'x-admin-wallet': adminWallet }
    });
    return res.json();
  }

  // NOTE: fetchNetworkCounts and fetchNetworkLevelMembers are defined above (lines 210-219)
  // Removed duplicate definitions that were silently overriding the originals.

  async fetchReferrals(walletAddress) {
    const res = await fetch(`${this.baseUrl}/referrals/${walletAddress}`);
    if (!res.ok) throw new Error('Failed to fetch referrals');
    return res.json();
  }

  // ── VIP Event Booking API ──────────────────────────────────────────────────
  async fetchEvents(walletAddress) {
    const res = await fetch(`${this.baseUrl}/events/${walletAddress}`);
    if (!res.ok) throw new Error('Failed to fetch events');
    return res.json();
  }

  async bookEvent(walletAddress, eventId) {
    const res = await fetch(`${this.baseUrl}/events/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, eventId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to book event');
    return data;
  }

  async createAdminEvent(adminWallet, eventData) {
    const res = await fetch(`${this.baseUrl}/admin/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-wallet': adminWallet
      },
      body: JSON.stringify(eventData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create event');
    return data;
  }

  async syncNetworkMembers(members, parentNodeId) {
    try {
      const response = await fetch(`${this.baseUrl}/network/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members, parentNodeId })
      });
      return await response.json();
    } catch (err) {
      console.error('Sync failed:', err);
      return null;
    }
  }

  // ── System Auto-Upgrade ───────────────────────────────────────────────────
  async fetchSystemStatus(adminWallet) {
    const res = await fetch(`${this.baseUrl}/admin/system/status`, {
      headers: { 'x-admin-wallet': adminWallet }
    });
    if (!res.ok) throw new Error('Failed to fetch system status');
    return res.json();
  }

  async triggerSystemUpgrade(adminWallet, { forceReset = false } = {}) {
    const res = await fetch(`${this.baseUrl}/admin/system/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-wallet': adminWallet
      },
      body: JSON.stringify({ forceReset })
    });
    return res.json();
  }
}

export const api = new ApiService();
