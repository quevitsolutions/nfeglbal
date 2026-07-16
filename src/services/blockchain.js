import { ethers } from "ethers";
import { CONTRACTS, RPC_NODES } from "../config/constants.js";
import {
  AIPCORE_ABI,
  AIPCORE_VIEWS_ABI,
  REWARDPOOL_ABI,
} from "../../contracts/abi.js";
import { api } from "./api.js"; // zero-RPC post-tx DB confirm

const MULTICALL_ABI = [
  "function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)"
];
const MULTICALL_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
import { config } from "../config/wagmi.js";
import { getEthersProvider, getEthersSigner } from "../utils/ethers-adapter.js";

/**
 * AIPCore Blockchain Service (Ethers v6) - 4-source Tier Waterfall
 *   Sources (priority order):
 *   1. AIPCOREVIEW  getNodeStats(nId)[3]  → 'level'  (independent view contract)
 *   2. AIPCORE  getNodeStats(nId)[0]  → 'tier'   (core stats)
 *   3. AIPCORE  nodes(nId)[5]        → struct tier field (raw)
 *   4. REWARDPOOL getPoolViewHelper(nId)[8] → nfeTier
 */
class BlockchainService {
  constructor() {
    const providers = RPC_NODES.map(url => new ethers.JsonRpcProvider(url, undefined, { staticNetwork: true }));
    this.staticProvider = new ethers.FallbackProvider(providers);
    this._core = new ethers.Contract(
      CONTRACTS.AIPCORE,
      AIPCORE_ABI,
      this.staticProvider,
    );
    this._view = new ethers.Contract(
      CONTRACTS.AIPCOREVIEW,
      AIPCORE_VIEWS_ABI,
      this.staticProvider,
    );
    this._pool = new ethers.Contract(
      CONTRACTS.REWARDPOOL,
      REWARDPOOL_ABI,
      this.staticProvider,
    );
    this._multicall = new ethers.Contract(
      MULTICALL_ADDRESS,
      MULTICALL_ABI,
      this.staticProvider
    );
  }

  _getProvider() {
    return getEthersProvider(config) || this.staticProvider;
  }

  get core() {
    return this._core.connect(this._getProvider());
  }

  get view() {
    return this._view.connect(this._getProvider());
  }

  get pool() {
    return this._pool.connect(this._getProvider());
  }

  get multicall() {
    return this._multicall.connect(this._getProvider());
  }

  async getOwner() {
    return this.core.owner();
  }

  // ── Full dashboard hydration ──────────────────────────────────────────────
  async getFullDashboardData(address) {
    try {
      const nId = await this.core.nodeId(address);
      if (!nId || Number(nId) === 0) return { nodeId: 0, hasNode: false };

      // All calls are isolated — one failure cannot break others
      const [viewStats, coreStats, nodeRaw, isActive, pending, poolData, viewBreakdown, poolClaimableData, capInfo, isFreeActive] =
        await Promise.all([
          this.view.getNodeStats(nId).catch(() => null),         // AIPCOREVIEW  → [totalEarned, teamSize, directRefs, level]
          this.core.getNodeStats(nId).catch(() => null),         // AIPCORE  → [tier, directCount, matrixCount, ...]
          this.core.nodes(nId).catch(() => null),                // raw struct → index 5 = tier
          true,                                                  // active (since nId > 0, the node exists and is registered)
          this.core.pendingReward(address).catch(() => 0n),      // AIPCORE pending (by wallet)
          this.pool.getPoolViewHelper(nId).catch(() => null),    // full pool view
          this.view.getIncomeBreakdown(nId).catch(() => null),   // AIPCOREVIEW → [direct,matrix,pool,pending] ← pool income
          this.pool.getClaimable(nId).catch(() => null),         // REWARDPOOL → [fromCurrentPool,fromExited,total]
          this.pool.getCapInfo(nId).catch(() => null),           // REWARDPOOL → [capMult,deposited,lifetimeCap,claimed,remaining]
          this.core.isFreeRegistered(nId).catch(() => false),
        ]);

      // ── 4-source tier waterfall ──
      const t1 = viewStats ? Number(viewStats[3]) : 0; // AIPCOREVIEW  level   (index 3)
      const t2 = coreStats ? Number(coreStats[0]) : 0; // AIPCORE  tier    (index 0)
      const t3 = nodeRaw ? Number(nodeRaw[5]) : 0; // nodes()  tier    (index 5)
      const t4 = poolData ? Number(poolData[8]) : 0; // pool     nfeTier (index 8)

      const tier = (isFreeActive || (t1 === 0 && t2 === 0 && t3 === 0 && t4 === 0))
        ? 0
        : (t1 > 0 ? t1 : t2 > 0 ? t2 : t3 > 0 ? t3 : t4 > 0 ? t4 : 1);

      console.debug(
        `[Tier] nId=${Number(nId)} AIPCOREVIEW=${t1} CoreStats=${t2} nodes[5]=${t3} pool.nfeTier=${t4} isFree=${isFreeActive} → FINAL=${tier}`,
      );

      // ── directRefs / teamSize: prefer coreStats, fallback viewStats ──
      const directRefs = coreStats
        ? Number(coreStats[1])
        : viewStats
          ? Number(viewStats[2])
          : 0;
      const teamSize = coreStats
        ? Number(coreStats[2])
        : viewStats
          ? Number(viewStats[1])
          : 0;
      const totalEarned = coreStats
        ? ethers.formatEther(coreStats[3] || 0n)
        : "0";

      // ── pendingReward: prefer AIPCOREVIEW breakdown[3] → fallback AIPCORE pendingReward ──
      // AIPCOREVIEW gives per-node pending; AIPCORE pendingReward(address) can be 0 if already claimed on-chain
      const pendingFromView = viewBreakdown ? viewBreakdown[3] : null;
      const finalPending = (pendingFromView && BigInt(pendingFromView) > 0n)
        ? BigInt(pendingFromView)
        : (pending || 0n);

      // ── poolClaimable: prefer getClaimable()[2] (total) → fallback getPoolViewHelper[2] ──
      // getClaimable() is the dedicated function; getPoolViewHelper[2] may lag for unclaimed exits
      const poolClaimTotal = poolClaimableData ? poolClaimableData[2] : null;
      const finalPoolClaimable = (poolClaimTotal && BigInt(poolClaimTotal) > 0n)
        ? BigInt(poolClaimTotal)
        : (poolData?.[2] || 0n);

      // ── totalPoolEarned: AIPCOREVIEW getIncomeBreakdown()[2] = pool income (most accurate) ──
      // Falls back to getPoolViewHelper[3] if AIPCOREVIEW unavailable
      const poolEarned = viewBreakdown && BigInt(viewBreakdown[2] || 0n) > 0n
        ? viewBreakdown[2]
        : (poolData?.[3] || 0n);

      // ── totalPoolClaimed: getCapInfo()[3] = claimed against cap (dedicated tracker) ──
      // Falls back to getPoolViewHelper[4] if getCapInfo unavailable
      const poolClaimed = capInfo && BigInt(capInfo[3] || 0n) > 0n
        ? capInfo[3]
        : (poolData?.[4] || 0n);

      return {
        hasNode: tier > 0,
        isFreeActive: isFreeActive || (tier === 0),
        nodeId: Number(nId),
        tier,
        directRefs,
        teamSize,
        totalEarned,
        nodeActive: isActive,
        pendingReward:    ethers.formatEther(finalPending),
        poolClaimable:    ethers.formatEther(finalPoolClaimable),
        poolName:         String(poolData?.[1] || "None"),
        totalDeposited:   ethers.formatEther(capInfo?.[1] || poolData?.[7] || 0n),
        isPoolQualified:  Boolean(poolData?.[9]),
        totalPoolEarned:  ethers.formatEther(poolEarned),
        totalPoolClaimed: ethers.formatEther(poolClaimed),
        remainingCap:     ethers.formatEther(capInfo?.[4] || poolData?.[5] || 0n),
        lifetimeCap:      ethers.formatEther(capInfo?.[2] || poolData?.[6] || 0n),
        missingTier:      Number(poolData?.[11]?.[0] || 0),
        missingDirects:   Number(poolData?.[11]?.[1] || 0),
        missingTeam:      Number(poolData?.[11]?.[2] || 0),
      };
    } catch (err) {
      console.error("getFullDashboardData failed:", err);
      throw err;
    }
  }

  async getBnbBalance(address) {
    const p = this._getProvider();
    const bal = await p.getBalance(address);
    return ethers.formatEther(bal);
  }

  async _getNativeUsdPrice() {
    // Simple in-memory cache (5 min TTL)
    const now = Date.now();
    if (this._nativePrice && now - this._nativePriceFetchedAt < 5 * 60 * 1000) {
      return this._nativePrice;
    }

    // Primary: On-chain oracle from AIPCore contract (8 decimal uint, e.g. 60000000000 = $600)
    try {
      const raw = await this.core.nativePrice();
      const price = Number(raw) / 1e8;
      if (price > 0) {
        this._nativePrice = price;
        this._nativePriceFetchedAt = now;
        return this._nativePrice;
      }
    } catch { /* fall through */ }

    // Fallback 1: Binance REST API
    try {
      const res = await fetch(
        "https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT",
      );
      const json = await res.json();
      this._nativePrice = parseFloat(json.price);
      this._nativePriceFetchedAt = now;
      return this._nativePrice;
    } catch { /* fall through */ }

    // Fallback 2: CoinGecko
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd",
      );
      const json = await res.json();
      this._nativePrice = json?.binancecoin?.usd || 600;
      this._nativePriceFetchedAt = now;
      return this._nativePrice;
    } catch { /* fall through */ }

    // Last resort: use stale value or hardcoded default
    this._nativePrice = this._nativePrice || 600;
    return this._nativePrice;
  }

  async _getBnbUsdPrice() {
    return this._getNativeUsdPrice();
  }

  async fetchTeamHistoryOnChain(nodeId, length = 50) {
    try {
      if (!nodeId || Number(nodeId) === 0) return [];

      const [historyItems, nativePrice] = await Promise.all([
        this.core.getIncome(nodeId, length),
        this._getNativeUsdPrice(),
      ]);

      // FIX: Filter nullish entries; use index access as primary (more reliable than named in ethers v6)
      return historyItems
        .filter(item => item != null)
        .map((item) => {
          const rType  = Number(item[5] ?? item.rewardType ?? 0);
          const tierVal = Number(item[6] ?? item.tier ?? 0);
          let eventName = "Team Reward";

          if (rType === 1)
            eventName = tierVal === 0 ? "Referral" : "Direct Upgrade";
          else if (rType === 2) eventName = "Layer Income";
          else if (rType === 3) eventName = "Matrix Income";

          const bnbAmount = ethers.formatEther(item[2] ?? item.amount ?? 0n);

          return {
            // FIX: Use index [0] as primary fallback — named .id can be undefined in some ethers builds
            from_node_id: Number(item[0] ?? item.id ?? 0),
            event_type: eventName,
            amount_bnb: bnbAmount,
            amount_native: bnbAmount,
            amount_usd: (parseFloat(bnbAmount) * nativePrice).toFixed(2),
            timestamp: new Date(Number(item[3] ?? item.time ?? 0) * 1000).toISOString(),
            is_missed: Boolean(item[4] ?? item.isMissed ?? false),
            layer: Number(item[1] ?? item.layer ?? 0),
            tier: tierVal,
          };
        });
    } catch (err) {
      console.warn(
        "fetchTeamHistoryOnChain failed (AIPCore contract might not support getIncome if very old):",
        err.message,
      );
      return null; // Signals failure so we can fallback to API
    }
  }

  // ── WRITE ACTIONS ─────────────────────────────────────────────────────────

  async createNode(sponsorId = 55555) {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    const walletAddress = await signer.getAddress();
    const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, signer);

    // SELF-HEAL: If DB missed the registration, the contract will revert with no reason.
    // Check on-chain first to gracefully recover and sync.
    const existingNodeId = await core.nodeId(walletAddress).catch(() => 0n);
    if (existingNodeId > 0n) {
      console.log("Self-healing: Node already exists on-chain", Number(existingNodeId));
      await api.confirmNode(walletAddress, Number(existingNodeId), 1, "0xsync").catch(() => {});
      return Number(existingNodeId);
    }

    const cost = await core
      .getRegistrationFee()
      .catch(() => 0n);
      
    const bufferCost = cost > 0n ? (cost * 105n) / 100n : 0n;
    
    let estimatedGas;
    try {
      estimatedGas = await core.createNode.estimateGas(sponsorId, { value: bufferCost });
      estimatedGas = (estimatedGas * 130n) / 100n; // 30% safety buffer
    } catch {
      estimatedGas = 1200000n; // safe fallback
    }
    
    const tx = await core.createNode(sponsorId, { value: bufferCost, gasLimit: estimatedGas });
    const receipt = await tx.wait();

    // Parse NodeCreated event to get the assigned nodeId
    let nid = 0;
    try {
      const iface = new ethers.Interface(AIPCORE_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === 'NodeCreated') {
            nid = Number(parsed.args[1]); // userId = second indexed param
            break;
          }
        } catch { /* not this event */ }
      }
    } catch (e) {
      console.warn("NodeCreated event parse failed:", e.message);
    }

    if (nid > 0) {
      // Auto-register in Reward Pool
      try {
        const pool = new ethers.Contract(CONTRACTS.REWARDPOOL, REWARDPOOL_ABI, signer);
        await (await pool.registerNode(nid)).wait();
      } catch (e) {
        console.warn("Pool registration skipped:", e.message);
      }

      // ✅ INSTANT DB UPDATE — zero RPC on server side
      // Tier 1 is always the result of createNode()
      await api.confirmNode(walletAddress, nid, 1, receipt.hash).catch(() => {});

      return nid;
    }
    return 1;
  }

  async createNodeWithSponsorAddress(sponsorAddress, sponsorOfSponsor = 1) {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    const walletAddress = await signer.getAddress();
    const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, signer);

    // Self-heal: if already registered, return existing
    const existingNodeId = await core.nodeId(walletAddress).catch(() => 0n);
    if (existingNodeId > 0n) {
      await api.confirmNode(walletAddress, Number(existingNodeId), 1, "0xsync").catch(() => {});
      return Number(existingNodeId);
    }

    const cost = await core.getRegistrationFee().catch(() => 0n);
    const bufferCost = cost > 0n ? (cost * 105n) / 100n : 0n;

    let estimatedGas;
    try {
      estimatedGas = await core.createNodeWithSponsorAddress.estimateGas(
        sponsorAddress,
        { value: bufferCost }
      );
      estimatedGas = (estimatedGas * 130n) / 100n; // 30% safety buffer
    } catch {
      estimatedGas = 1500000n; // safe fallback
    }

    const tx = await core.createNodeWithSponsorAddress(
      sponsorAddress,
      { value: bufferCost, gasLimit: estimatedGas }
    );
    const receipt = await tx.wait();

    let nid = 0;
    try {
      const iface = new ethers.Interface(AIPCORE_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === 'NodeCreated') {
            // Find the NodeCreated for OUR wallet (not the sponsor's auto-registration)
            if (parsed.args[0]?.toLowerCase() === walletAddress.toLowerCase()) {
              nid = Number(parsed.args[1]);
              break;
            }
          }
        } catch { /* not this event */ }
      }
    } catch (e) {
      console.warn("NodeCreated event parse failed:", e.message);
    }

    if (nid > 0) {
      try {
        const pool = new ethers.Contract(CONTRACTS.REWARDPOOL, REWARDPOOL_ABI, signer);
        await (await pool.registerNode(nid)).wait();
      } catch (e) {
        console.warn("Pool registration skipped:", e.message);
      }
      await api.confirmNode(walletAddress, nid, 1, receipt.hash).catch(() => {});
      return nid;
    }
    return 1;
  }

  async claimRewards() {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    return (
      await new ethers.Contract(
        CONTRACTS.AIPCORE,
        AIPCORE_ABI,
        signer,
      ).withdraw()
    ).wait();
  }

  async claimPool(nodeId) {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    return (
      await new ethers.Contract(
        CONTRACTS.REWARDPOOL,
        REWARDPOOL_ABI,
        signer,
      ).claim(nodeId)
    ).wait();
  }

  async registerPool(nodeId) {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    return (
      await new ethers.Contract(
        CONTRACTS.REWARDPOOL,
        REWARDPOOL_ABI,
        signer,
      ).registerNode(nodeId)
    ).wait();
  }

  async unlockTier(nodeId, toTier) {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    const walletAddress = await signer.getAddress();
    const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, signer);
    
    // Fetch all tier costs and select the correct one (fallback to calculate if RPC fails)
    let cost;
    try {
      const costs = await core.getTierCosts();
      cost = costs[toTier - 1];
    } catch {
      // Fallback calculation if RPC call fails: 0.008 BNB base, roughly +20% per tier
      // Usually Tier 2 is 0.01 BNB, Tier 3 is 0.012 BNB, etc.
      const baseCost = 0.008;
      const calcCost = baseCost * Math.pow(1.2, toTier - 1);
      cost = ethers.parseEther(calcCost.toFixed(4).toString());
    }

    // Add a 5% buffer to prevent 'Low BNB' reverts if the oracle price updates 
    // exactly during our transaction, or if the fallback math is slightly off.
    // The smart contract automatically refunds any excess BNB sent.
    const bufferCost = (cost * 105n) / 100n;

    let estimatedGas;
    try {
      estimatedGas = await core.unlockTier.estimateGas(nodeId, toTier, { value: bufferCost });
      estimatedGas = (estimatedGas * 130n) / 100n; // 30% safety buffer
    } catch {
      estimatedGas = 1500000n; // safe fallback
    }

    const tx = await core.unlockTier(nodeId, toTier, { value: bufferCost, gasLimit: estimatedGas });
    const receipt = await tx.wait();

    // Parse TierUnlocked event to get the confirmed tier
    // event TierUnlocked(address indexed node, uint256 indexed userId, uint256 packageId)
    // packageId = the new tier index (1-based)
    let confirmedTier = toTier; // fallback to what we requested
    try {
      const iface = new ethers.Interface(AIPCORE_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === 'TierUnlocked') {
            confirmedTier = Number(parsed.args[2]); // packageId = new tier
            break;
          }
        } catch { /* not this event */ }
      }
    } catch (e) {
      console.warn("TierUnlocked event parse failed:", e.message);
    }

    // ✅ INSTANT DB UPDATE — zero RPC on server side
    await api.confirmNode(walletAddress, nodeId, confirmedTier, receipt.hash).catch(() => {});

    return receipt;
  }

  // ── REPORTING ─────────────────────────────────────────────────────────────
  // ── REPORTING ─────────────────────────────────────────────────────────────
  async getReferralCounts(nodeId) {
    try {
      const calls = Array.from({ length: 18 }, (_, i) => ({
        target: CONTRACTS.AIPCORE,
        callData: this.core.interface.encodeFunctionData("getTeamSize", [nodeId, i])
      }));

      const [, returnData] = await this.multicall.aggregate(calls);
      
      return returnData.map(data => {
        try {
          return Number(this.core.interface.decodeFunctionResult("getTeamSize", data)[0]);
        } catch {
          return 0;
        }
      });
    } catch (err) {
      console.error("Multicall failed, falling back to sequential:", err);
      const counts = [];
      for(let i=0; i<18; i++) {
        const c = await this.core.getTeamSize(nodeId, i).catch(() => 0n);
        counts.push(Number(c));
      }
      return counts;
    }
  }

  async getLevelWiseTeamStats(nodeId) {
    try {
      const stats = await this.view.getLevelWiseTeamStats(nodeId);
      return {
        freeUsers: Array.from(stats[0]).map(Number),
        paidUsers: Array.from(stats[1]).map(Number),
        teamSize: Array.from(stats[2]).map(Number),
        treasuryGenerated: Array.from(stats[3]).map(val => ethers.formatEther(val)),
        treasuryUsed: Array.from(stats[4]).map(val => ethers.formatEther(val)),
        conversions: Array.from(stats[5]).map(Number),
        rewardsDistributed: Array.from(stats[6]).map(val => ethers.formatEther(val))
      };
    } catch (err) {
      console.error("getLevelWiseTeamStats failed:", err);
      return {
        freeUsers: new Array(10).fill(0),
        paidUsers: new Array(10).fill(0),
        teamSize: new Array(10).fill(0),
        treasuryGenerated: new Array(10).fill("0.0"),
        treasuryUsed: new Array(10).fill("0.0"),
        conversions: new Array(10).fill(0),
        rewardsDistributed: new Array(10).fill("0.0")
      };
    }
  }

  async getMatrixLevelCounts(nodeId) {
    try {
      // Contract uses 0-indexed layers (Layer 0 = Level 1, Layer 17 = Level 18)
      // Split into two multicall batches to avoid block-gas / payload limits
      const batch1 = Array.from({ length: 9 }, (_, i) => ({
        target: CONTRACTS.AIPCORE,
        callData: this.core.interface.encodeFunctionData("getMatrixUsers", [nodeId, i, 0, 50])
      }));
      const batch2 = Array.from({ length: 9 }, (_, i) => ({
        target: CONTRACTS.AIPCORE,
        callData: this.core.interface.encodeFunctionData("getMatrixUsers", [nodeId, i + 9, 0, 50])
      }));

      const [[, data1], [, data2]] = await Promise.all([
        this.multicall.aggregate(batch1),
        this.multicall.aggregate(batch2),
      ]);

      const matrixCounts = new Array(18).fill(0);
      [...data1, ...data2].forEach((data, i) => {
        try {
          const members = this.core.interface.decodeFunctionResult("getMatrixUsers", data)[0];
          matrixCounts[i] = members.length;
        } catch {
          matrixCounts[i] = 0;
        }
      });
      return matrixCounts;
    } catch (err) {
      console.error("Matrix count multicall failed:", err);
      return new Array(18).fill(0);
    }
  }


  async getDirectReferrals(nodeId, num = 100) {
    try {
      if (!nodeId || Number(nodeId) === 0) return [];
      const members = await this.core.getNetworkNodes(nodeId, 0, num);
      return members.map(m => ({
        wallet_address: m.wallet,
        nodeId: Number(m.nodeId), // raw nodeId for MemberCard component mapping
        node_id: Number(m.nodeId), // db standard mapping
        node_tier: Number(m.tier),
        joined_at: Number(m.joinedAt),
        joinedAt: Number(m.joinedAt),
        direct_count: Number(m.directNodes),
        team_size: Number(m.totalMatrixNodes),
        node_active: true,
        is_direct: true
      }));
    } catch (err) {
      console.warn("getDirectReferrals failed:", err.message);
      return [];
    }
  }

  async getMatrixMembers(nodeId, layer, num = 50) {
    const members = await this.core.getMatrixUsers(nodeId, layer, 0, num);
    const basic = members.map((m) => ({
      wallet: m.wallet,
      nodeId: Number(m.nodeId),
      sponsor: Number(m.sponsor),
      tier: Number(m.tier),
      joinedAt: Number(m.joinedAt),
    }));

    if (basic.length === 0) return basic;

    // Enrich with per-member stats (directs + sub-team) via a single multicall batch
    try {
      const calls = basic.map(m => ({
        target: CONTRACTS.AIPCORE,
        callData: this.core.interface.encodeFunctionData("getNodeStats", [m.nodeId])
      }));
      const [, returnData] = await this.multicall.aggregate(calls);
      return basic.map((m, i) => {
        try {
          const decoded = this.core.interface.decodeFunctionResult("getNodeStats", returnData[i]);
          // getNodeStats → [tier, directCount, matrixCount, totalRewards, totalContribution, daysActive]
          return {
            ...m,
            directNodes:      Number(decoded[1] || 0), // directCount
            totalMatrixNodes: Number(decoded[2] || 0), // matrixCount (sub-team)
          };
        } catch {
          return { ...m, directNodes: 0, totalMatrixNodes: 0 };
        }
      });
    } catch (err) {
      console.warn("Member stats multicall failed, using plain list:", err.message);
      return basic.map(m => ({ ...m, directNodes: 0, totalMatrixNodes: 0 }));
    }
  }

  // ── Targeted User Helpers ──────────────────────────────────────────────────
  async isTargetedUser(wallet) {
    try {
      return await this.core.isTargetedUser(wallet);
    } catch {
      return false;
    }
  }

  async setTargetedUser(wallet, status) {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    const coreWithSigner = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, signer);
    const tx = await coreWithSigner.setTargetedUser(wallet, status);
    return await tx.wait();
  }

  async addressToNodeId(wallet) {
    try {
      const nid = await this.core.nodeId(wallet);
      return Number(nid);
    } catch {
      return 0;
    }
  }

  async getPendingUpgradeRewards(nodeId) {
    try {
      const rewards = await this.core.getPendingUpgradeRewards(nodeId);
      return ethers.formatEther(rewards);
    } catch {
      return "0";
    }
  }

  async isTreasuryNode(nodeId) {
    try {
      return await this.core.isTreasuryNode(nodeId);
    } catch {
      return false;
    }
  }

  // ── Treasury Node Management (on-chain, owner/oracleAdmin only) ───────────

  /**
   * Returns the list of node IDs currently enrolled in auto-upgrade.
   */
  async getTreasuryNodes() {
    try {
      const ids = await this.core.getTreasuryNodes();
      return ids.map(Number);
    } catch {
      return [];
    }
  }

  /**
   * Returns the contract's treasury BNB balance breakdown:
   * { totalBalance, reserved, available } — all in ETH (human-readable).
   */
  async getTreasuryBalance() {
    try {
      const result = await this.core.getTreasuryBalance();
      return {
        totalBalance: ethers.formatEther(result.totalBalance),
        reserved:     ethers.formatEther(result.reserved),
        available:    ethers.formatEther(result.available),
      };
    } catch {
      return { totalBalance: '0', reserved: '0', available: '0' };
    }
  }

  /**
   * For each enrolled treasury node, returns fund status:
   * [{ nodeId, currentTier, nextTierCost (BNB), canUpgrade }]
   */
  async getTreasuryFundStatus() {
    try {
      const result = await this.core.getTreasuryFundStatus();
      const len = result.nodeIds.length;
      return Array.from({ length: len }, (_, i) => ({
        nodeId:       Number(result.nodeIds[i]),
        currentTier:  Number(result.currentTiers[i]),
        nextTierCost: ethers.formatEther(result.nextTierCosts[i]),
        canUpgrade:   result.canUpgrade[i],
      }));
    } catch {
      return [];
    }
  }

  /**
   * Enrols a node ID for automatic treasury tier promotion.
   * Fires on every createNode / unlockTier call inside the same tx.
   */
  async addTreasuryNode(nodeId) {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, signer);
    const tx = await core.addTreasuryNode(nodeId, { gasLimit: 300000 });
    return await tx.wait();
  }

  /**
   * Removes a node from the auto-upgrade list.
   */
  async removeTreasuryNode(nodeId) {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, signer);
    const tx = await core.removeTreasuryNode(nodeId, { gasLimit: 300000 });
    return await tx.wait();
  }

  /**
   * Manual one-off treasury upgrade (owner/oracleAdmin only).
   * Promotes the node by exactly one tier with no BNB payment.
   */
  async treasuryUnlockTier(nodeId) {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, signer);
    const tx = await core.treasuryUnlockTier(nodeId, { gasLimit: 500000 });
    const receipt = await tx.wait();

    // Parse confirmed tier from event
    let confirmedTier = 0;
    try {
      const iface = new ethers.Interface(AIPCORE_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === 'TierUnlocked') {
            confirmedTier = Number(parsed.args[2]);
            break;
          }
        } catch { /* skip */ }
      }
    } catch (e) {
      console.warn("TierUnlocked parse failed:", e.message);
    }

    if (confirmedTier > 0) {
      try {
        const nodeRaw = await this.core.nodes(nodeId);
        const nodeWallet = nodeRaw[0];
        await api.confirmNode(nodeWallet, nodeId, confirmedTier, receipt.hash).catch(() => {});
      } catch (e) {
        console.warn("DB sync after treasuryUnlockTier failed:", e.message);
      }
    }

    return { receipt, confirmedTier };
  }

  async selfUpgrade() {
    const signer = await getEthersSigner(config);
    if (!signer) throw new Error("Wallet not connected");
    const walletAddress = await signer.getAddress();
    const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, signer);
    
    // Fetch next tier cost
    const nodeId = await core.nodeId(walletAddress);
    const nodeRaw = await core.nodes(nodeId);
    const currentTier = Number(nodeRaw[5]);
    
    let cost = 0n;
    try {
      cost = await core.getTierCost(currentTier);
    } catch {
      cost = ethers.parseEther("0.008");
    }
    
    // Check if caller has enough reserved missed rewards on-chain to cover the cost
    let reservedRewards = 0n;
    try {
      reservedRewards = await core.missedRewardsByTier(nodeId, currentTier);
    } catch {
      reservedRewards = 0n;
    }

    let valueToSend = 0n;
    if (reservedRewards < cost) {
      // If reserved missed rewards are less than cost, caller must pay in BNB (with a 5% price buffer)
      valueToSend = (cost * 105n) / 100n;
    }
    
    let estimatedGas;
    try {
      estimatedGas = await core.selfUpgrade.estimateGas({ value: valueToSend });
      estimatedGas = (estimatedGas * 130n) / 100n; // 30% safety buffer
    } catch {
      estimatedGas = 1200000n; // safe fallback
    }
    
    const tx = await core.selfUpgrade({ value: valueToSend, gasLimit: estimatedGas });
    const receipt = await tx.wait();
    
    let confirmedTier = currentTier + 1;
    try {
      const iface = new ethers.Interface(AIPCORE_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === 'TierUnlocked') {
            confirmedTier = Number(parsed.args[2]);
            break;
          }
        } catch { /* skip */ }
      }
    } catch (e) {
      console.warn("TierUnlocked parse failed:", e.message);
    }
    
    await api.confirmNode(walletAddress, Number(nodeId), confirmedTier, receipt.hash).catch(() => {});
    return { receipt, confirmedTier };
  }
}

export const blockchain = new BlockchainService();
