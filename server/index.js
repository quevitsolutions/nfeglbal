import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// ── COLORFUL CONSOLE THEME CONSTANTS ──────────────────────────────────────
const F_CYAN = "\x1b[36m";
const F_PURPLE = "\x1b[35m";
const F_YELLOW = "\x1b[33m";
const F_GREEN = "\x1b[32m";
const F_RED = "\x1b[31m";
const F_BOLD = "\x1b[1m";
const F_RESET = "\x1b[0m";
const F_GRAY = "\x1b[90m";

function getTimestamp() {
  const now = new Date();
  return `${F_GRAY}[${now.toTimeString().split(' ')[0]}]${F_RESET}`;
}

const log = {
  info: (msg) => console.log(`${getTimestamp()} ${F_BOLD}${F_CYAN}[INFO]${F_RESET} ${msg}`),
  success: (msg) => console.log(`${getTimestamp()} ${F_BOLD}${F_GREEN}[SUCCESS]${F_RESET} ${msg}`),
  warn: (msg) => console.log(`${getTimestamp()} ${F_BOLD}${F_YELLOW}[WARN]${F_RESET} ${msg}`),
  error: (msg) => console.log(`${getTimestamp()} ${F_BOLD}${F_RED}[ERROR]${F_RESET} ${msg}`),
  blockchain: (msg) => console.log(`${getTimestamp()} ${F_BOLD}${F_PURPLE}[CHAIN ⛓️]${F_RESET} ${msg}`),
  api: (method, path, status, duration) => {
    const statusColor = status >= 400 ? F_RED : F_GREEN;
    console.log(
      `${getTimestamp()} ${F_BOLD}${F_CYAN}[API ⚡]${F_RESET} ${method} ${path} - ` +
      `${statusColor}${status}${F_RESET} (${duration}ms)`
    );
  }
};

const BANNER = `
${F_BOLD}${F_CYAN}
 _  _  ___  ___  ___  _    ___  ___   _   _    
| \\| || __|| __|/ __|| |  /   \\| _ ) /_\\ | |   
| .\` || _| | _| \\__ \\| |_|  O  | _ \\/ _ \\| |__ 
|_|\\_||_|  |___||___/|____\\___/|___/_/ \\_\\____|
${F_RESET}
`;

function printRow(label, value, valueColor = F_RESET) {
  const prefix = `  ${F_BOLD}${label}${F_RESET}: `;
  const innerLen = label.length + 4 + value.length; // "  " + label + ": " + value
  const spaces = ' '.repeat(Math.max(1, 47 - innerLen));
  console.log(`${F_GRAY}│${F_RESET}${prefix}${valueColor}${value}${F_RESET}${spaces}${F_GRAY}│${F_RESET}`);
}

function printStartupDashboard() {
  console.log(BANNER);
  console.log(`${F_GRAY}┌───────────────────────────────────────────────┐${F_RESET}`);
  console.log(`${F_GRAY}│${F_RESET}  ${F_BOLD}${F_GREEN}AIPCORE CORE CONTRACT ENGINE V3${F_RESET}            ${F_GRAY}│${F_RESET}`);
  console.log(`${F_GRAY}├───────────────────────────────────────────────┤${F_RESET}`);
  printRow("Port", PORT.toString());
  printRow("RPC Node", BSC_RPC.slice(0, 30) + (BSC_RPC.length > 30 ? "..." : ""));
  printRow("Core Addr", AIPCORE_ADDRESS.slice(0, 8) + "..." + AIPCORE_ADDRESS.slice(-8));
  printRow("Vault Addr", VESTINGVAULT_ADDRESS.slice(0, 8) + "..." + VESTINGVAULT_ADDRESS.slice(-8));
  printRow("Pool Addr", REWARDPOOL_ADDRESS.slice(0, 8) + "..." + REWARDPOOL_ADDRESS.slice(-8));
  printRow("Status", "ONLINE (DB-FREE)", F_GREEN);
  console.log(`${F_GRAY}└───────────────────────────────────────────────┘${F_RESET}\n`);
}

function printLeaderboardConsoleTable(list) {
  if (list.length === 0) return;
  console.log(`\n${F_GRAY}┌──────┬──────────┬──────────────┬──────────────┐${F_RESET}`);
  console.log(`${F_GRAY}│${F_RESET} ${F_BOLD}Rank${F_RESET} ${F_GRAY}│${F_RESET} ${F_BOLD}Node ID${F_RESET}  ${F_GRAY}│${F_RESET} ${F_BOLD}Wallet Address${F_RESET} ${F_GRAY}│${F_RESET} ${F_BOLD} Paid / Free │${F_RESET}`);
  console.log(`${F_GRAY}├──────┼──────────┼──────────────┼──────────────┤${F_RESET}`);
  list.slice(0, 5).forEach((item, idx) => {
    const rank = (idx + 1).toString().padEnd(4);
    const nodeId = `#${item.nodeId}`.padEnd(8);
    const wallet = (item.walletAddress.slice(0, 6) + '...' + item.walletAddress.slice(-4)).padEnd(12);
    const refs = `${item.paidRefs}P / ${item.freeRefs}F`.padEnd(12);
    console.log(`${F_GRAY}│${F_RESET} ${rank} ${F_GRAY}│${F_RESET} ${nodeId} ${F_GRAY}│${F_RESET} ${wallet}   ${F_GRAY}│${F_RESET} ${refs} ${F_GRAY}│${F_RESET}`);
  });
  console.log(`${F_GRAY}└──────┴──────────┴──────────────┴──────────────┘${F_RESET}\n`);
}

const app = express();
app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log.api(req.method, req.originalUrl, res.statusCode, duration);
  });
  next();
});

const PORT = process.env.PORT || 3001;
const BSC_RPC = process.env.VITE_RPC_URL || 'https://bsc-dataseed.binance.org/';

const AIPCORE_ADDRESS = '0xE82239361FBE54731CFF90D8c2036a33743fFd4d';
const REWARDPOOL_ADDRESS = '0x1705D309122269BF1265761725424123a4672846';
const VESTINGVAULT_ADDRESS = '0x9e1655eA63A9A10314B55A3c01bf2e23F28e52D8';

const provider = new ethers.JsonRpcProvider(BSC_RPC);

const AIPCORE_ABI = [
  "function _nextId() view returns (uint256)",
  "function totalNodes() view returns (uint256)",
  "function totalBNBDistributed() view returns (uint256)",
  "function nodeId(address user) view returns (uint256)",
  "function getNodeTier(uint256 nodeId) view returns (uint256)",
  "function getNodeStats(uint256 _userId) view returns (uint256 tier, uint256 directCount, uint256 matrixCount, uint256 totalRewards, uint256 totalContribution, uint256 daysActive)",
  "function nodes(uint256 nodeId) view returns (address wallet, uint88 nodeId_, uint256 sponsor, uint256 matrixParent, uint40 joinedAt, uint256 tier, uint256 directNodes, uint256 totalMatrixNodes, uint256 totalContribution)",
  "function missedRewardsByTier(uint256 nodeId, uint256 tier) view returns (uint256)",
  "function getIncomeBreakdown(uint256 _nodeId) view returns (uint256 total, uint256 referral, uint256 tier, uint256 binary, uint256 direct, uint256 lost, uint256 poolIncome)",
  "function totalFreeUsers() view returns (uint256)",
  "function totalFreeUpgraded() view returns (uint256)",
  "function levelFreeCount(uint256 nodeId, uint256 level) view returns (uint256)",
  "event NodeCreated(address indexed node, uint256 indexed userId, uint256 indexed referrerId, uint256 uplineId)",
  "event RewardDistributed(address indexed wallet, uint256 indexed nodeId, uint256 fromId, uint256 layer, uint256 amount, uint256 time, bool isMissed, uint256 rewardType, uint256 tier)"
];

const VESTINGVAULT_ABI = [
  "function getNodeSummary(uint256 nodeId) view returns (uint256 deposited, uint256 claimed, uint256 vestedClaimable, uint256 unvested, uint256 positionCount)",
  "event RewardDeposited(uint256 indexed nodeId, uint256 amount, uint64 startTime, uint64 endTime, uint256 positionIndex)",
  "event VestedClaimed(uint256 indexed nodeId, uint256 amount)",
  "event InstantWithdrawn(uint256 indexed nodeId, uint256 amount, uint256 penalty)",
  "event VestedDeducted(uint256 indexed nodeId, uint256 amount)"
];

const REWARDPOOL_ABI = [
  "function getPoolViewHelper(uint256 nodeId) view returns (uint8 currentPoolId, string poolName, uint256 claimable, uint256 totalEarned, uint256 totalClaimedAmount, uint256 remainingCap, uint256 lifetimeCap, uint256 totalDeposited, uint256 nfeTier, bool isQualifiedForNext, uint8 nextPoolId, uint256[3] missingRequirements)",
  "event RewardClaimed(uint256 nodeId, address wallet, uint256 amount)"
];

const aipcoreContract = new ethers.Contract(AIPCORE_ADDRESS, AIPCORE_ABI, provider);
const vestingVaultContract = new ethers.Contract(VESTINGVAULT_ADDRESS, VESTINGVAULT_ABI, provider);
const rewardPoolContract = new ethers.Contract(REWARDPOOL_ADDRESS, REWARDPOOL_ABI, provider);

// SSE Client list
const sseClients = new Set();
function broadcastEvent(type, payload) {
  const msg = `data: ${JSON.stringify({ type, payload, ts: Date.now() })}\n\n`;
  sseClients.forEach(res => {
    try { res.write(msg); } catch { sseClients.delete(res); }
  });
}

// Memory cache for recent activities
let recentActivities = [
  { wallet: '0x7c3...f2e1', action: 'registered', timeAgo: '2 min ago', timestamp: Date.now() - 120000 },
  { wallet: '0xa4b...8d3c', action: 'registered', timeAgo: '5 min ago', timestamp: Date.now() - 300000 },
  { wallet: '0x1f9...e7a2', action: 'registered', timeAgo: '8 min ago', timestamp: Date.now() - 480000 },
];

async function getRegistrations24h(totalNodeCount) {
  if (totalNodeCount <= 55555) return 0;
  
  const cutoff = Math.floor(Date.now() / 1000) - 86400; // 24h ago
  
  // Verify if the latest node is older than cutoff
  try {
    const latestNode = await aipcoreContract.nodes(totalNodeCount - 1).catch(() => null);
    if (!latestNode || Number(latestNode.joinedAt) < cutoff) {
      return 0; // Even the newest node is older than 24h
    }
  } catch (e) {
    return 0;
  }
  
  // Verify if the oldest node (55555) is newer than cutoff
  try {
    const oldestNode = await aipcoreContract.nodes(55555).catch(() => null);
    if (oldestNode && Number(oldestNode.joinedAt) >= cutoff) {
      return totalNodeCount - 55555; // All nodes registered in the last 24h
    }
  } catch (e) {}

  // Binary search for the first node registered in last 24h
  let low = 55555;
  let high = totalNodeCount - 1;
  let first24hId = totalNodeCount; // Default to none

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    try {
      const node = await aipcoreContract.nodes(mid);
      const joinedAt = Number(node.joinedAt);
      if (joinedAt >= cutoff) {
        first24hId = mid;
        high = mid - 1; // Try to find an even smaller ID
      } else {
        low = mid + 1; // Search the newer half
      }
    } catch (err) {
      break;
    }
  }

  return totalNodeCount - first24hId;
}

async function updateRecentActivities() {
  try {
    const nextId = await aipcoreContract._nextId().catch(() => 0n);
    const total = Number(nextId);
    if (total <= 55555) {
      recentActivities = [];
      return;
    }

    const start = Math.max(55555, total - 20);
    const promises = [];
    for (let nodeId = total - 1; nodeId >= start; nodeId--) {
      promises.push(
        aipcoreContract.nodes(nodeId).catch(() => null)
      );
    }

    const results = await Promise.all(promises);
    const formatted = results
      .filter(node => node && node.wallet !== '0x0000000000000000000000000000000000000000')
      .map(node => {
        const timestamp = Number(node.joinedAt) * 1000;
        const diffMs = Date.now() - timestamp;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        let timeAgo = 'some time ago';
        if (diffMin < 1) timeAgo = 'just now';
        else if (diffMin < 60) timeAgo = `${diffMin} min ago`;
        else if (diffHrs < 24) timeAgo = `${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`;
        else timeAgo = `${Math.floor(diffHrs / 24)} days ago`;

        const wallet = node.wallet;
        const shortened = wallet.length > 10 ? wallet.slice(0, 6) + '...' + wallet.slice(-4) : wallet;
        return {
          wallet: shortened,
          action: 'registered',
          timeAgo,
          timestamp
        };
      });

    if (formatted.length > 0) {
      recentActivities = formatted;
    }
  } catch (err) {
    log.error('Error updating recent activities: ' + err.message);
  }
}

// Initial fetch & set interval
setInterval(updateRecentActivities, 120000);
updateRecentActivities().catch(err => log.error('Initial activities fetch failed: ' + err.message));

// Memory cache for leaderboard
let leaderboardCache = [];

async function updateLeaderboard() {
  try {
    const nextId = await aipcoreContract._nextId().catch(() => 0n);
    const total = Number(nextId);
    if (total <= 55555) return;

    let list = [];
    const batchSize = 30;
    
    // Node IDs on-chain start at genesis 55555 and increment upwards
    for (let i = 55555; i < total; i += batchSize) {
      const batchPromises = [];
      const end = Math.min(total, i + batchSize);
      for (let nodeId = i; nodeId < end; nodeId++) {
        batchPromises.push(
          Promise.all([
            aipcoreContract.nodes(nodeId).catch(() => null),
            aipcoreContract.getNodeStats(nodeId).catch(() => null),
            aipcoreContract.levelFreeCount(nodeId, 0).catch(() => 0n)
          ]).then(([nodeInfo, statsInfo, freeRefsCount]) => {
            if (nodeInfo && nodeInfo.wallet !== '0x0000000000000000000000000000000000000000') {
              const totalRefs = Number(statsInfo ? statsInfo[1] : 0) || 0;
              const freeRefs = Number(freeRefsCount) || 0;
              const paidRefs = Math.max(0, totalRefs - freeRefs);
              return {
                nodeId: Number(nodeId),
                walletAddress: nodeInfo.wallet,
                activatedRefs: totalRefs,
                freeRefs: freeRefs,
                paidRefs: paidRefs,
                totalEarned: parseFloat(ethers.formatEther(statsInfo ? statsInfo[3] : 0n)) || 0.0
              };
            }
            return null;
          })
        );
      }
      const batchResults = await Promise.all(batchPromises);
      list.push(...batchResults.filter(Boolean));
    }

    // Sort descending by activatedRefs, then by totalEarned
    list.sort((a, b) => {
      if (b.activatedRefs !== a.activatedRefs) {
        return b.activatedRefs - a.activatedRefs;
      }
      return b.totalEarned - a.totalEarned;
    });

    leaderboardCache = list.slice(0, 50);
    log.info(`Leaderboard cache updated: ${leaderboardCache.length} members`);
    printLeaderboardConsoleTable(leaderboardCache);
  } catch (err) {
    log.error('Error updating leaderboard: ' + err.message);
  }
}

// Update every 5 minutes
setInterval(updateLeaderboard, 300000);
updateLeaderboard().catch(err => log.error('Initial leaderboard fetch failed: ' + err.message));



// Caches for heavy RPC endpoints
let cacheLiveStats = null;
let cacheLiveStatsTime = 0;

let cacheAdminOverview = null;
let cacheAdminOverviewTime = 0;

// ── API ROUTES ──

// GET /api/stats/live
app.get('/api/stats/live', async (req, res) => {
  const now = Date.now();
  if (cacheLiveStats && (now - cacheLiveStatsTime < 30000)) {
    return res.json(cacheLiveStats);
  }
  try {
    const [totalNodes, nextId, totalBnbDistributed, bnbPrice, totalFreeUsers, totalFreeUpgraded] = await Promise.all([
      aipcoreContract.totalNodes().catch(() => 0n),
      aipcoreContract._nextId().catch(() => 0n),
      aipcoreContract.totalBNBDistributed().catch(() => 0n),
      axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
        .then(r => parseFloat(r.data.price))
        .catch(() => 600.0),
      aipcoreContract.totalFreeUsers().catch(() => 0n),
      aipcoreContract.totalFreeUpgraded().catch(() => 0n),
    ]);

    const reg24h = await getRegistrations24h(Number(nextId));

    cacheLiveStats = {
      totalNodes: Number(totalNodes) || 0,
      registrations24h: reg24h || 0,
      totalBnbDistributed: parseFloat(ethers.formatEther(totalBnbDistributed)) || 0,
      bnbPrice: bnbPrice || 600.0,
      totalFreeUsers: Number(totalFreeUsers) || 0,
      totalFreeUpgraded: Number(totalFreeUpgraded) || 0
    };
    cacheLiveStatsTime = now;

    res.json(cacheLiveStats);
  } catch (err) {
    log.error('/api/stats/live error: ' + err.message);
    res.json({ totalNodes: 0, registrations24h: 0, totalBnbDistributed: 0, bnbPrice: 600.0, totalFreeUsers: 0, totalFreeUpgraded: 0 });
  }
});

// GET /api/activity/recent
app.get('/api/activity/recent', (req, res) => {
  res.json({ activity: recentActivities });
});

// GET /api/users/profile/:walletAddress
app.get('/api/users/profile/:walletAddress', async (req, res) => {
  try {
    const wallet = req.params.walletAddress;
    const nodeId = await aipcoreContract.nodeId(wallet).catch(() => 0n);

    if (nodeId === 0n) {
      return res.json({
        walletAddress: wallet,
        nodeTier: 0,
        lifetime_rewards: 0,
        withdrawable_balance: 0,
        upgrade_vault_balance: 0,
        lifetime_vault_deposits: 0,
        lifetime_vault_used: 0,
        daily_upgrade_count: 0
      });
    }

    const [stats, vaultSummary] = await Promise.all([
      aipcoreContract.getNodeStats(nodeId).catch(() => [0n, 0n, 0n, 0n, 0n, 0n]),
      vestingVaultContract.getNodeSummary(nodeId).catch(() => [0n, 0n, 0n, 0n, 0n])
    ]);

    res.json({
      walletAddress: wallet,
      nodeTier: Number(stats[0]) || 1,
      lifetime_rewards: parseFloat(ethers.formatEther(stats[3])) || 0.0,
      withdrawable_balance: parseFloat(ethers.formatEther(vaultSummary[2])) || 0.0,
      upgrade_vault_balance: parseFloat(ethers.formatEther(vaultSummary[2] + vaultSummary[3])) || 0.0,
      lifetime_vault_deposits: parseFloat(ethers.formatEther(vaultSummary[0])) || 0.0,
      lifetime_vault_used: parseFloat(ethers.formatEther(vaultSummary[1])) || 0.0,
      daily_upgrade_count: 0
    });
  } catch (err) {
    log.error('/api/users/profile error: ' + err.message);
    res.status(500).json({ error: 'Profile fetch failed' });
  }
});

// GET /api/users/vault/history/:walletAddress
app.get('/api/users/vault/history/:walletAddress', async (req, res) => {
  try {
    const wallet = req.params.walletAddress;
    const nodeId = await aipcoreContract.nodeId(wallet).catch(() => 0n);

    if (nodeId === 0n) {
      return res.json([]);
    }

    const currentBlock = await provider.getBlockNumber().catch(() => 0);
    if (currentBlock === 0) return res.json([]);

    const depositFilter = vestingVaultContract.filters.RewardDeposited(nodeId);
    const claimFilter = vestingVaultContract.filters.VestedClaimed(nodeId);
    const withdrawFilter = vestingVaultContract.filters.InstantWithdrawn(nodeId);
    const deductFilter = vestingVaultContract.filters.VestedDeducted(nodeId);

    const nodeInfo = await aipcoreContract.nodes(nodeId).catch(() => null);
    let startBlock = Math.max(0, currentBlock - 5000);
    if (nodeInfo) {
      const joinedAt = Number(nodeInfo.joinedAt);
      const approxRegBlock = currentBlock - Math.floor((Date.now() / 1000 - joinedAt) / 3);
      startBlock = Math.max(approxRegBlock - 100, currentBlock - 10000);
    }

    const [deposits, claims, withdraws, deducts] = await Promise.all([
      vestingVaultContract.queryFilter(depositFilter, startBlock, currentBlock).catch(() => []),
      vestingVaultContract.queryFilter(claimFilter, startBlock, currentBlock).catch(() => []),
      vestingVaultContract.queryFilter(withdrawFilter, startBlock, currentBlock).catch(() => []),
      vestingVaultContract.queryFilter(deductFilter, startBlock, currentBlock).catch(() => []),
    ]);

    let history = [];

    deposits.forEach(ev => {
      history.push({
        action: 'DEPOSIT',
        amountBnb: parseFloat(ethers.formatEther(ev.args?.amount || 0)),
        tier: '-',
        timestamp: Date.now() - (currentBlock - ev.blockNumber) * 3000
      });
    });

    claims.forEach(ev => {
      history.push({
        action: 'RELEASE',
        amountBnb: parseFloat(ethers.formatEther(ev.args?.amount || 0)),
        tier: '-',
        timestamp: Date.now() - (currentBlock - ev.blockNumber) * 3000
      });
    });

    withdraws.forEach(ev => {
      history.push({
        action: 'RELEASE',
        amountBnb: parseFloat(ethers.formatEther(ev.args?.amount || 0)),
        tier: '-',
        timestamp: Date.now() - (currentBlock - ev.blockNumber) * 3000
      });
    });

    deducts.forEach(ev => {
      history.push({
        action: 'UPGRADE',
        amountBnb: parseFloat(ethers.formatEther(ev.args?.amount || 0)),
        tier: '-',
        timestamp: Date.now() - (currentBlock - ev.blockNumber) * 3000
      });
    });

    history.sort((a, b) => b.timestamp - a.timestamp);
    res.json(history.slice(0, 50));
  } catch (err) {
    log.error('/api/users/vault/history error: ' + err.message);
    res.json([]);
  }
});

// GET /api/users/leaderboard
app.get('/api/users/leaderboard', (req, res) => {
  res.json(leaderboardCache);
});

// GET /api/rewards/summary/:walletAddress
app.get('/api/rewards/summary/:walletAddress', async (req, res) => {
  try {
    const wallet = req.params.walletAddress;
    const nodeId = await aipcoreContract.nodeId(wallet).catch(() => 0n);

    if (nodeId === 0n) {
      return res.json({
        totalEarnedBnb: 0.0,
        totalEarnedUsd: 0.0,
        totalMissedBnb: 0.0,
        breakdown: { referral: 0, layer: 0, matrix: 0, milestonePools: 0 }
      });
    }

    const [stats, breakdownRaw, bnbPrice] = await Promise.all([
      aipcoreContract.getNodeStats(nodeId).catch(() => [0n, 0n, 0n, 0n, 0n, 0n]),
      aipcoreContract.getIncomeBreakdown(nodeId).catch(() => [0n, 0n, 0n, 0n, 0n, 0n, 0n]),
      axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
        .then(r => parseFloat(r.data.price))
        .catch(() => 600.0),
    ]);

    let totalMissed = 0n;
    for (let tier = 1; tier <= 18; tier++) {
      const missed = await aipcoreContract.missedRewardsByTier(nodeId, tier).catch(() => 0n);
      totalMissed += missed;
    }

    const totalEarnedBnb = parseFloat(ethers.formatEther(stats[3])) || 0.0;
    const totalMissedBnb = parseFloat(ethers.formatEther(totalMissed)) || 0.0;

    res.json({
      totalEarnedBnb,
      totalEarnedUsd: totalEarnedBnb * bnbPrice,
      totalMissedBnb,
      breakdown: {
        referral: parseFloat(ethers.formatEther(breakdownRaw[1] || 0n)) || 0.0,
        layer: parseFloat(ethers.formatEther(breakdownRaw[2] || 0n)) || 0.0,
        matrix: parseFloat(ethers.formatEther(breakdownRaw[3] || 0n)) || 0.0,
        milestonePools: parseFloat(ethers.formatEther(breakdownRaw[6] || 0n)) || 0.0
      }
    });
  } catch (err) {
    log.error('/api/rewards/summary error: ' + err.message);
    res.json({
      totalEarnedBnb: 0.0,
      totalEarnedUsd: 0.0,
      totalMissedBnb: 0.0,
      breakdown: { referral: 0, layer: 0, matrix: 0, milestonePools: 0 }
    });
  }
});

// GET /api/rewards/chart/:walletAddress
app.get('/api/rewards/chart/:walletAddress', async (req, res) => {
  try {
    const wallet = req.params.walletAddress;
    const nodeId = await aipcoreContract.nodeId(wallet).catch(() => 0n);

    if (nodeId === 0n) {
      return res.json([]);
    }

    const [currentBlock, bnbPrice] = await Promise.all([
      provider.getBlockNumber().catch(() => 0),
      axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
        .then(r => parseFloat(r.data.price))
        .catch(() => 600.0),
    ]);

    if (currentBlock === 0) return res.json([]);

    const filter = aipcoreContract.filters.RewardDistributed(null, nodeId);
    const nodeInfo = await aipcoreContract.nodes(nodeId).catch(() => null);
    let startBlock = Math.max(0, currentBlock - 5000);
    if (nodeInfo) {
      const joinedAt = Number(nodeInfo.joinedAt);
      const approxRegBlock = currentBlock - Math.floor((Date.now() / 1000 - joinedAt) / 3);
      startBlock = Math.max(approxRegBlock - 100, currentBlock - 10000);
    }
    const events = await aipcoreContract.queryFilter(filter, startBlock, currentBlock).catch(() => []);

    const dailyMap = {};
    events.forEach(ev => {
      const blockDiff = currentBlock - ev.blockNumber;
      const timestamp = Date.now() - blockDiff * 3000;
      const dateStr = new Date(timestamp).toISOString().split('T')[0];
      const amount = parseFloat(ethers.formatEther(ev.args?.amount || 0n)) || 0.0;
      if (!dailyMap[dateStr]) dailyMap[dateStr] = 0;
      dailyMap[dateStr] += amount;
    });

    const chartData = Object.entries(dailyMap).map(([date, bnb]) => ({
      date,
      bnb,
      usd: bnb * bnbPrice
    })).sort((a, b) => b.date.localeCompare(a.date));

    res.json(chartData.slice(0, 30));
  } catch (err) {
    log.error('/api/rewards/chart error: ' + err.message);
    res.json([]);
  }
});

// POST /api/users/withdraw
app.post('/api/users/withdraw', (req, res) => {
  res.json({ success: true });
});

// GET /api/admin/overview
app.get('/api/admin/overview', async (req, res) => {
  const now = Date.now();
  if (cacheAdminOverview && (now - cacheAdminOverviewTime < 15000)) {
    return res.json(cacheAdminOverview);
  }
  try {
    const [
      totalNodes,
      nextId,
      totalBnbDistributed,
      bnbPrice,
      totalFreeUsers,
      totalFreeUpgraded,
      balanceCore,
      balanceRewardPool,
      balanceVestingVault,
      balanceLeaderboardPool,
      balanceFounderPool,
      balanceLeadership
    ] = await Promise.all([
      aipcoreContract.totalNodes().catch(() => 0n),
      aipcoreContract._nextId().catch(() => 0n),
      aipcoreContract.totalBNBDistributed().catch(() => 0n),
      axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
        .then(r => parseFloat(r.data.price))
        .catch(() => 600.0),
      aipcoreContract.totalFreeUsers().catch(() => 0n),
      aipcoreContract.totalFreeUpgraded().catch(() => 0n),
      provider.getBalance(AIPCORE_ADDRESS).catch(() => 0n),
      provider.getBalance(REWARDPOOL_ADDRESS).catch(() => 0n),
      provider.getBalance(VESTINGVAULT_ADDRESS).catch(() => 0n),
      provider.getBalance('0x45Bc0E983D013A6987042A4dDCbFe40257D9c2ac').catch(() => 0n),
      provider.getBalance('0x3ba1C975d8c9d9B38477c3c90d56c7Cb78DdB1C3').catch(() => 0n),
      provider.getBalance('0xd9988CB1c0339EDbBFdd7451B7aF4C2d40CEf463').catch(() => 0n),
    ]);

    const reg24h = await getRegistrations24h(Number(nextId));

    cacheAdminOverview = {
      totalNodes: Number(totalNodes) || 0,
      nextId: Number(nextId) || 0,
      registrations24h: reg24h || 0,
      totalBnbDistributed: parseFloat(ethers.formatEther(totalBnbDistributed)) || 0,
      bnbPrice: bnbPrice || 600.0,
      totalFreeUsers: Number(totalFreeUsers) || 0,
      totalFreeUpgraded: Number(totalFreeUpgraded) || 0,
      balances: {
        core: parseFloat(ethers.formatEther(balanceCore)) || 0,
        rewardPool: parseFloat(ethers.formatEther(balanceRewardPool)) || 0,
        vestingVault: parseFloat(ethers.formatEther(balanceVestingVault)) || 0,
        leaderboardPool: parseFloat(ethers.formatEther(balanceLeaderboardPool)) || 0,
        founderPool: parseFloat(ethers.formatEther(balanceFounderPool)) || 0,
        leadership: parseFloat(ethers.formatEther(balanceLeadership)) || 0,
      }
    };
    cacheAdminOverviewTime = now;

    res.json(cacheAdminOverview);
  } catch (err) {
    log.error('/api/admin/overview error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/node/:id
app.get('/api/admin/node/:id', async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const nodeRaw = await aipcoreContract.nodes(id).catch(() => null);
    if (!nodeRaw || nodeRaw.wallet === '0x0000000000000000000000000000000000000000') {
      return res.status(404).json({ error: 'Node not found' });
    }

    const [stats, vaultSummary, incomeBreakdown] = await Promise.all([
      aipcoreContract.getNodeStats(id).catch(() => [0n, 0n, 0n, 0n, 0n, 0n]),
      vestingVaultContract.getNodeSummary(id).catch(() => [0n, 0n, 0n, 0n, 0n]),
      aipcoreContract.getIncomeBreakdown(id).catch(() => [0n, 0n, 0n, 0n, 0n, 0n, 0n]),
    ]);

    // Resolve sponsor wallet
    let sponsorWallet = '0x0000000000000000000000000000000000000000';
    if (nodeRaw.sponsor > 0n) {
      const sp = await aipcoreContract.nodes(nodeRaw.sponsor).catch(() => null);
      if (sp) sponsorWallet = sp.wallet;
    }

    res.json({
      nodeId: Number(nodeRaw.nodeId_),
      wallet: nodeRaw.wallet,
      sponsor: Number(nodeRaw.sponsor),
      sponsorWallet,
      matrixParent: Number(nodeRaw.matrixParent),
      joinedAt: Number(nodeRaw.joinedAt),
      tier: Number(nodeRaw.tier),
      directNodes: Number(nodeRaw.directNodes),
      totalMatrixNodes: Number(nodeRaw.totalMatrixNodes),
      totalContribution: parseFloat(ethers.formatEther(nodeRaw.totalContribution)),
      daysActive: Number(stats[5]),
      income: {
        total: parseFloat(ethers.formatEther(incomeBreakdown[0])),
        referral: parseFloat(ethers.formatEther(incomeBreakdown[1])),
        tier: parseFloat(ethers.formatEther(incomeBreakdown[2])),
        binary: parseFloat(ethers.formatEther(incomeBreakdown[3])),
        direct: parseFloat(ethers.formatEther(incomeBreakdown[4])),
        lost: parseFloat(ethers.formatEther(incomeBreakdown[5])),
        poolIncome: parseFloat(ethers.formatEther(incomeBreakdown[6])),
      },
      vault: {
        deposited: parseFloat(ethers.formatEther(vaultSummary[0])),
        claimed: parseFloat(ethers.formatEther(vaultSummary[1])),
        vestedClaimable: parseFloat(ethers.formatEther(vaultSummary[2])),
        unvested: parseFloat(ethers.formatEther(vaultSummary[3])),
        positionCount: Number(vaultSummary[4]),
      }
    });
  } catch (err) {
    log.error(`/api/admin/node/${req.params.id} error: ` + err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/stream
app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Health check
app.get('/health', (req, res) => res.send('API is healthy'));

// Default fallbacks for all other routes
app.use((req, res) => {
  res.json({ success: true, data: [] });
});

app.listen(PORT, () => {
  printStartupDashboard();
});
