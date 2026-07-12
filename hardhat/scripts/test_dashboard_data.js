const { ethers } = require("hardhat");

async function main() {
  const address = "0xA237A82f0623b0214e49CE33ec55132D2f579053";

  // Replicate constants
  const CONTRACTS = {
    AIPCORE:     "0x4ea93b8Cd18b66c027AdBaa63CCF06B240dA1dFA",
    AIPCOREVIEW: "0x4ea93b8Cd18b66c027AdBaa63CCF06B240dA1dFA",
    REWARDPOOL:    "0x8c9eD734447ae7a54ba4466373a399668E1DE9A4",
  };

  const AIPCORE_ABI = [
    "function nodeId(address user) view returns (uint256)",
    "function nodes(uint256 nodeId) view returns (address wallet, uint88 nodeId_, uint256 sponsor, uint256 matrixParent, uint40 joinedAt, uint256 tier, uint256 directNodes, uint256 totalMatrixNodes, uint256 totalContribution)",
    "function isFreeRegistered(uint256 nodeId) view returns (bool)",
    "function isNodeActive(uint256 nodeId) view returns (bool)",
    "function pendingReward(address user) view returns (uint256)",
    "function getNodeStats(uint256 _userId) view returns (uint256 tier, uint256 directCount, uint256 matrixCount, uint256 totalRewards, uint256 totalContribution, uint256 daysActive)"
  ];

  const AIPCORE_VIEWS_ABI = [
    "function getNodeStats(uint256 nodeId) view returns (uint256 totalEarned, uint256 teamSize, uint256 directRefs, uint256 level)",
    "function getIncomeBreakdown(uint256 nodeId) view returns (uint256 direct, uint256 matrix, uint256 pool, uint256 pending)"
  ];

  const REWARDPOOL_ABI = [
    "function getClaimable(uint256 nodeId) view returns (uint256 fromCurrentPool, uint256 fromExitedPools, uint256 total)",
    "function getPoolViewHelper(uint256 nodeId) view returns (uint8 currentPoolId, string poolName, uint256 claimable, uint256 totalEarned, uint256 totalClaimedAmount, uint256 remainingCap, uint256 lifetimeCap, uint256 totalDeposited, uint256 nfeTier, bool isQualifiedForNext, uint8 nextPoolId, uint256[3] missingRequirements)",
    "function getCapInfo(uint256 nodeId) view returns (uint256 capMultiplier, uint256 totalDeposited, uint256 lifetimeCap, uint256 claimed, uint256 remaining)"
  ];

  const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");

  const core = new ethers.Contract(CONTRACTS.AIPCORE, AIPCORE_ABI, provider);
  const view = new ethers.Contract(CONTRACTS.AIPCOREVIEW, AIPCORE_VIEWS_ABI, provider);
  const pool = new ethers.Contract(CONTRACTS.REWARDPOOL, REWARDPOOL_ABI, provider);

  console.log("Starting query...");

  try {
    const nId = await core.nodeId(address);
    console.log("nId:", nId.toString());

    if (!nId || Number(nId) === 0) {
      console.log("No Node ID found.");
      return;
    }

    const [viewStats, coreStats, nodeRaw, isActive, pending, poolData, viewBreakdown, poolClaimableData, capInfo, isFreeActive] =
      await Promise.all([
        view.getNodeStats(nId).catch((e) => { console.log("viewStats failed:", e.message); return null; }),
        core.getNodeStats(nId).catch((e) => { console.log("coreStats failed:", e.message); return null; }),
        core.nodes(nId).catch((e) => { console.log("nodeRaw failed:", e.message); return null; }),
        core.isNodeActive(nId).catch((e) => { console.log("isActive failed:", e.message); return false; }),
        core.pendingReward(address).catch((e) => { console.log("pending failed:", e.message); return 0n; }),
        pool.getPoolViewHelper(nId).catch((e) => { console.log("poolData failed:", e.message); return null; }),
        view.getIncomeBreakdown(nId).catch((e) => { console.log("viewBreakdown failed:", e.message); return null; }),
        pool.getClaimable(nId).catch((e) => { console.log("poolClaimableData failed:", e.message); return null; }),
        pool.getCapInfo(nId).catch((e) => { console.log("capInfo failed:", e.message); return null; }),
        core.isFreeRegistered(nId).catch((e) => { console.log("isFreeActive failed:", e.message); return false; }),
      ]);

    console.log("Fetched values:");
    console.log("viewStats:", viewStats);
    console.log("coreStats:", coreStats);
    console.log("nodeRaw:", nodeRaw);
    console.log("isActive:", isActive);
    console.log("pending:", pending.toString());
    console.log("poolData:", poolData);
    console.log("viewBreakdown:", viewBreakdown);
    console.log("poolClaimableData:", poolClaimableData);
    console.log("capInfo:", capInfo);
    console.log("isFreeActive:", isFreeActive);

    const t1 = viewStats ? Number(viewStats[3]) : 0;
    const t2 = coreStats ? Number(coreStats[0]) : 0;
    const t3 = nodeRaw ? Number(nodeRaw[5]) : 0;
    const t4 = poolData ? Number(poolData[8]) : 0;

    console.log("Waterfall tiers: t1=", t1, "t2=", t2, "t3=", t3, "t4=", t4);

    const tier = (isFreeActive || (t1 === 0 && t2 === 0 && t3 === 0 && t4 === 0))
      ? 0
      : (t1 > 0 ? t1 : t2 > 0 ? t2 : t3 > 0 ? t3 : t4 > 0 ? t4 : 1);

    console.log("Computed tier:", tier);

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

    const pendingFromView = viewBreakdown ? viewBreakdown[3] : null;
    const finalPending = (pendingFromView && BigInt(pendingFromView) > 0n)
      ? BigInt(pendingFromView)
      : (pending || 0n);

    const poolClaimTotal = poolClaimableData ? poolClaimableData[2] : null;
    const finalPoolClaimable = (poolClaimTotal && BigInt(poolClaimTotal) > 0n)
      ? BigInt(poolClaimTotal)
      : (poolData?.[2] || 0n);

    const poolEarned = viewBreakdown && BigInt(viewBreakdown[2] || 0n) > 0n
      ? viewBreakdown[2]
      : (poolData?.[3] || 0n);

    const poolClaimed = capInfo && BigInt(capInfo[3] || 0n) > 0n
      ? capInfo[3]
      : (poolData?.[4] || 0n);

    const result = {
      hasNode: tier > 0,
      isFreeActive: isFreeActive || (tier === 0),
      nodeId: Number(nId),
      tier,
      directRefs,
      teamSize,
      totalEarned,
      pendingReward: ethers.formatEther(finalPending),
      poolClaimable: ethers.formatEther(finalPoolClaimable),
      poolName: poolData ? poolData[7] : "None",
      isPoolQualified: poolData ? poolData[0] : false,
      totalDeposited: capInfo ? ethers.formatEther(capInfo[1]) : "0",
      totalPoolEarned: ethers.formatEther(poolEarned),
      totalPoolClaimed: ethers.formatEther(poolClaimed),
      remainingCap: capInfo ? ethers.formatEther(capInfo[4]) : "0",
      lifetimeCap: capInfo ? ethers.formatEther(capInfo[2]) : "0",
      missingDirects: poolData ? Number(poolData[9]) : 0,
      missingTier: poolData ? Number(poolData[10]) : 0,
      missingTeam: poolData ? Number(poolData[11]) : 0,
      nodeActive: isActive,
    };

    console.log("Final Returned Object:", result);

  } catch (err) {
    console.error("Query script failed:", err);
  }
}

main().catch(console.error);
