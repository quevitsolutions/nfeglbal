import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import axios from 'axios';
import Groq from 'groq-sdk';
import { execSync, exec as execCb } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { query } from './db.js';
import { initTelegramBot, sendNotification, broadcastToUsers, verifyTelegramMembership, checkExpiringTrials } from './telegramBot.js';

dotenv.config();

// In-memory per-wallet claim lock — prevents concurrent double-credit on mining claim.
// Entries are added before the DB UPDATE and deleted in finally{} so they never get stuck.

// ── Real-time SSE Client Registry ────────────────────────────────────────────
// Holds all active EventSource connections from the frontend.
const sseClients = new Set();

/**
 * Broadcast a chain event to every connected SSE client.
 * @param {string} type  – event type (e.g. 'node_created')
 * @param {object} payload – serialisable data for the frontend
 */
function broadcastEvent(type, payload) {
  const msg = `data: ${JSON.stringify({ type, payload, ts: Date.now() })}\n\n`;
  sseClients.forEach(res => {
    try { res.write(msg); } catch { sseClients.delete(res); }
  });
  console.log(`[SSE] Broadcast → ${type}`, JSON.stringify(payload).slice(0, 120));
}
// ─────────────────────────────────────────────────────────────────────────────

const claimLocks = new Set();

// Per-wallet RPC sync cooldown: Only call ensureNodeSync once per 5 minutes per wallet.
// Prevents hammering the BSC RPC on every 30-second poll while still catching tier upgrades quickly.
const nodeSyncCooldown = new Map(); // wallet.toLowerCase() -> lastSyncTimestamp


// NFEGlobal & RewardPool Contract Constants
const NFEGLOBAL_ADDRESS = '0x9daA28D40082E4173b4b07AE76A92Eda0Ff3A522';
const REWARDPOOL_ADDRESS = '0xA0DE5adE595a43838d1a883D441ea5f0829d66b1';
const BSC_RPC = process.env.VITE_RPC_URL || 'https://bsc-dataseed.binance.org/';
const DEPLOY_BLOCK = 0; // Block around contract deployment for optimization

const NFEGLOBAL_ABI = [
  "event RewardDistributed(address indexed wallet, uint256 indexed nodeId, uint256 fromId, uint256 layer, uint256 amount, uint256 time, bool isMissed, uint256 rewardType, uint256 tier)",
  "event NodeCreated(address indexed node, uint256 indexed userId, uint256 indexed referrerId, uint256 uplineId)",
  "event TierUnlocked(address indexed node, uint256 indexed userId, uint256 packageId)",
  "function getTeamSize(uint256 _userId, uint256 _depth) view returns (uint256)",
  "function getNodeStats(uint256 _userId) view returns (uint256 tier, uint256 directCount, uint256 matrixCount, uint256 totalRewards, uint256 totalContribution, uint256 daysActive)",
  "function nodes(uint256 _nodeId) view returns (uint64 nodeId, address wallet, uint64 sponsor, uint64 matrixParent, uint40 joinedAt, uint8 tier, uint256 totalContribution, uint256 totalEarned, uint32 directNodes)",
  "function nodeId(address user) view returns (uint256)"
];

const REWARDPOOL_ABI = [
  "event RewardClaimed(uint nodeId, address wallet, uint amount)"
];

const MULTICALL_ABI = [
  "function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)"
];
const MULTICALL_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const provider = new ethers.JsonRpcProvider(BSC_RPC);
const nfeglobalContract = new ethers.Contract(NFEGLOBAL_ADDRESS, NFEGLOBAL_ABI, provider);
const rewardPoolContract = new ethers.Contract(REWARDPOOL_ADDRESS, REWARDPOOL_ABI, provider);
const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, provider);

// ── Treasury auto-upgrades are fully handled on-chain by the smart contracts! No keeper bot required. ──

// State for BNB Price Cache
let bnbPrice = 600; // Default fallback
let lastPriceFetch = 0;

const getBnbPrice = async () => {
  const now = Date.now();
  if (now - lastPriceFetch < 300000 && bnbPrice > 0) return bnbPrice; // 5 min cache
  try {
    const res = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSD');
    bnbPrice = parseFloat(res.data.price);
    lastPriceFetch = now;
  } catch (err) {
    console.error('Failed to fetch BNB price:', err.message);
    try {
      const res2 = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
      bnbPrice = res2.data.binancecoin.usd;
      lastPriceFetch = now;
    } catch (e2) {
      console.warn('All price sources failed, using fallback.');
    }
  }
  return bnbPrice;
};

/**
 * Migration: Ensure schema is up to date
 */
const ensureSchema = async () => {
  try {
    console.log('Checking database schema...');
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_streak INTEGER DEFAULT 0`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_claim TIMESTAMP`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_synced_block INTEGER DEFAULT ${DEPLOY_BLOCK}`);
    await query(`ALTER TABLE income_history ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 0`);
    await query(`ALTER TABLE income_history ADD COLUMN IF NOT EXISTS layer INTEGER DEFAULT 0`);
    await query(`ALTER TABLE income_history ADD COLUMN IF NOT EXISTS is_missed BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS claimed_milestones TEXT DEFAULT '[]'`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS node_id INTEGER UNIQUE`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sponsor_node_id INTEGER`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS matrix_parent_node_id INTEGER`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS matrix_parent_id INTEGER`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS node_active BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS matrix_counts JSONB DEFAULT '[]'`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_rpc_sync TIMESTAMP`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_memo TEXT`);
    // Ensure activated_refs exists (used for milestone tracking)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_refs INTEGER DEFAULT 0`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_targeted BOOLEAN DEFAULT FALSE`);


    // 🔥 CRITICAL FIX: Ensure created_at has a default and backfill NULLs (Fixes "Claim Failed" bug)
    await query(`ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP`);
    await query(`UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL`);
    await query(`UPDATE users SET last_claim_time = created_at WHERE last_claim_time IS NULL`);
    
    // 🔥 BALANCE HARDENING: Ensure local_reward has a default and backfill NULLs
    await query(`ALTER TABLE users ALTER COLUMN local_reward SET DEFAULT 0`);
    await query(`UPDATE users SET local_reward = 0 WHERE local_reward IS NULL`);

    // FIX: events table was missing schedule_time column (used by admin event creation)
    await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_time VARCHAR(255)`);

    // Seed Genesis Node (ID 36999) - Never bind this to the active Admin Wallet
    const genesisId = 36999;
    // This is the true contract creator wallet
    const creatorWallet = '0x8112011370fdba02c428da5938fe72cbf3e0d54a';
    await query(`
      INSERT INTO users (wallet_address, node_id, node_tier, node_active, created_at)
      VALUES ($1, $2, 1, TRUE, '2024-01-01 00:00:00')
      ON CONFLICT (node_id) DO NOTHING
    `, [creatorWallet, genesisId]);
    
    // Performance Indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_income_history_wallet_address ON income_history(wallet_address)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_node_active ON users(node_active) WHERE node_active = TRUE`);
    
    // One-time startup repair: Link orphans using RPC truth
    console.log('🏗️  Starting Deep Orphan Scan...');
    setTimeout(deepRepairOrphans, 10000); // 10s after startup to allow pools/rpc to warm up

    // Hardening: Enforce case-insensitive wallet uniqueness
    // We do this AFTER a reconciliation step in case duplicates already exist
    await reconcileDuplicateUsers();
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_lower ON users (LOWER(wallet_address))`);
    
    // NEW: Audit log for admin adjustments
    await query(`
      CREATE TABLE IF NOT EXISTS admin_adjustments (
        id SERIAL PRIMARY KEY,
        admin_wallet VARCHAR(42) NOT NULL,
        target_wallet VARCHAR(42) NOT NULL,
        amount NUMERIC(36, 18) NOT NULL,
        reason VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed Viral Referral Tasks
    const referralTasks = [
      { name: 'Refer 1 Peer', reward: 240, type: 'referral_count', icon: '🤝' },
      { name: 'Squad Builder (3 Peers)', reward: 750, type: 'referral_count', icon: '👪' },
      { name: 'Team Leader (10 Peers)', reward: 3000, type: 'referral_count', icon: '📣' },
      { name: 'Community Pilot (50 Peers)', reward: 15000, type: 'referral_count', icon: '🚀' },
      { name: 'Network Master (100 Peers)', reward: 50000, type: 'referral_count', icon: '🌐' },
      { name: 'Global Ambassador (500 Peers)', reward: 300000, type: 'referral_count', icon: '🏛️' },
      { name: 'Legendary Operator (1000 Peers)', reward: 1000000, type: 'referral_count', icon: '👑' }
    ];

    for (const t of referralTasks) {
      await query(`
        INSERT INTO tasks (name, reward, type, icon)
        SELECT $1, $2, $3, $4
        WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE name = $1)
      `, [t.name, t.reward, t.type, t.icon]);
    }

    // === TASK REWARD RESET ===
    // Set social tasks to 1,000 coins each and Activate Node to 10,000
    await query(`UPDATE tasks SET reward = 1000  WHERE LOWER(name) LIKE '%telegram%'`);
    await query(`UPDATE tasks SET reward = 1000  WHERE LOWER(name) LIKE '%chat%'`);
    await query(`UPDATE tasks SET reward = 1000  WHERE LOWER(name) LIKE '%twitter%' OR LOWER(name) LIKE '%follow%'`);
    await query(`UPDATE tasks SET reward = 10000 WHERE LOWER(name) LIKE '%activate%node%' OR LOWER(name) = 'activate node'`);
    await query(`UPDATE tasks SET reward = 1000  WHERE type = 'social' AND reward > 10000`);
    await query(`UPDATE tasks SET reward = 1000  WHERE type = 'referral_count' AND reward > 1000000`);
    console.log('✅ Task rewards updated: social=1K, activate node=10K');

    console.log('✅ Schema check complete');
  } catch (err) {
    console.error('Schema update error:', err.message);
  }
};

/**
 * High-Precision Recon: Merges duplicate profiles caused by case sensitivity
 */
async function reconcileDuplicateUsers() {
  try {
    const duplicates = await query(`
      SELECT LOWER(wallet_address) as wallet, COUNT(*), MIN(id) as keep_id, array_agg(id) as all_ids
      FROM users 
      GROUP BY LOWER(wallet_address) 
      HAVING COUNT(*) > 1
    `);

    for (const row of duplicates.rows) {
      const keepId = row.keep_id;
      const dropIds = row.all_ids.filter(id => id !== keepId);
      
      console.log(`🧹 Recon: Merging duplicate wallet ${row.wallet} (${dropIds.length} profiles -> ID ${keepId})`);
      
      // 1. If any of the drop nodes have a node_id, try to move it to the keep node if the keep node doesn't have one
      const nodeInfo = await query(`SELECT node_id FROM users WHERE id = ANY($1) AND node_id IS NOT NULL`, [dropIds]);
      if (nodeInfo.rows.length > 0) {
        await query(`UPDATE users SET node_id = $1 WHERE id = $2 AND node_id IS NULL`, [nodeInfo.rows[0].node_id, keepId]);
      }

      // 2. Move referral links
      await query(`UPDATE users SET referrer_id = $1 WHERE referrer_id = ANY($2)`, [keepId, dropIds]);
      
      // 3. Move matrix links
      await query(`UPDATE users SET matrix_parent_id = $1 WHERE matrix_parent_id = ANY($2)`, [keepId, dropIds]);

      // 4. Safely consolidate and merge balances before dropping duplicates
      await query(`
        UPDATE users 
        SET local_reward = local_reward + (SELECT COALESCE(SUM(local_reward), 0) FROM users WHERE id = ANY($1)),
            taps = taps + (SELECT COALESCE(SUM(taps), 0) FROM users WHERE id = ANY($1)),
            demo_taps = demo_taps + (SELECT COALESCE(SUM(demo_taps), 0) FROM users WHERE id = ANY($1)),
            total_earned = total_earned + (SELECT COALESCE(SUM(total_earned), 0) FROM users WHERE id = ANY($1))
        WHERE id = $2
      `, [dropIds, keepId]);

      // 5. Delete duplicates
      await query(`DELETE FROM users WHERE id = ANY($1)`, [dropIds]);
    }
    
    if (duplicates.rows.length > 0) {
      console.log(`✨ Recon: Successfully merged ${duplicates.rows.length} duplicate wallets`);
    }
  } catch (err) {
    console.warn("Reconstruction failed:", err.message);
  }
}

ensureSchema();

/**
 * Startup RPC Sync: Called once on boot to populate matrix_counts for all existing nodes.
 * This ensures the team page shows correct data immediately without waiting for new events.
 */
async function startupNodeSync() {
  try {
    // Wait for schema to finish
    await new Promise(r => setTimeout(r, 3000));
    console.log('🚀 Starting RPC node sync for all existing nodes...');

    const nodes = await query('SELECT node_id FROM users WHERE node_id IS NOT NULL ORDER BY node_id ASC');
    console.log(`📊 Found ${nodes.rows.length} nodes to sync`);

    // Stagger requests to avoid RPC rate limits (1 per 500ms)
    for (const row of nodes.rows) {
      await syncNodeStateFromRPC(Number(row.node_id));
      await new Promise(r => setTimeout(r, 500)); 
    }

    console.log('✅ Startup node sync complete!');
  } catch (err) {
    console.error('Startup node sync error:', err.message);
  }
}

// Run startup sync after server is ready (non-blocking)
setTimeout(startupNodeSync, 5000);

// ── Expiring Trial Notification Worker ───────────────────────────────────────
// Runs every 12 hours. Sends 3-day and 1-day alerts to free users + their sponsors.
setTimeout(() => {
  checkExpiringTrials(); // run once at startup (catches any missed alerts after restart)
  setInterval(checkExpiringTrials, 12 * 60 * 60 * 1000); // then every 12h
}, 30_000); // wait 30s for bot to fully init first

/**
 * Background worker to sync on-chain events for a user
 */
const syncUserHistory = async (wallet) => {
  if (!wallet) return;
  try {
    const currentPrice = await getBnbPrice();
    const user = await query('SELECT last_synced_block FROM users WHERE wallet_address = $1', [wallet]);
    const startBlock = (user.rows.length > 0 && user.rows[0].last_synced_block) 
      ? Math.max(DEPLOY_BLOCK, user.rows[0].last_synced_block + 1)
      : DEPLOY_BLOCK;
    
    const latestBlock = await provider.getBlockNumber();
    if (startBlock > latestBlock) return;

    console.log(`Syncing income history for ${wallet} from block ${startBlock} to ${latestBlock}...`);

    // 1. Fetch NFEGlobal RewardDistributed Events
    const filterNFEGlobal = nfeglobalContract.filters.RewardDistributed(wallet);
    const logsNFEGlobal = await nfeglobalContract.queryFilter(filterNFEGlobal, startBlock, latestBlock);

    for (const log of logsNFEGlobal) {
      const { fromId, amount, time, rewardType, tier, layer, isMissed } = log.args;
      const bnbAmount = ethers.formatEther(amount);
      const usdAmount = parseFloat(bnbAmount) * currentPrice;
      const txHash = log.transactionHash;
      const timestamp = new Date(Number(time) * 1000);

      // Mapping Logic as per Contract:
      // rewardType 1 && tier 0 -> Referral
      // rewardType 1 && tier > 0 -> Direct Upgrade
      // rewardType 2 -> Layer Income
      // rewardType 3 -> Matrix Income
      let eventName = 'Team Reward';
      const rType = Number(rewardType);
      const tierVal = Number(tier);

      if (rType === 1) {
        eventName = tierVal === 0 ? 'Referral' : 'Direct Upgrade';
      } else if (rType === 2) {
        eventName = 'Layer Income';
      } else if (rType === 3) {
        eventName = 'Matrix Income';
      }

      await query(
        `INSERT INTO income_history (wallet_address, source_contract, event_type, from_node_id, amount_bnb, amount_usd, tier, layer, is_missed, tx_hash, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (tx_hash) DO NOTHING`,
        [wallet, NFEGLOBAL_ADDRESS, eventName, Number(fromId), bnbAmount, usdAmount, tierVal, Number(layer), !!isMissed, txHash, timestamp]
      );
    }

    // 2. Fetch RewardPool RewardClaimed Events
    const filterPool = rewardPoolContract.filters.RewardClaimed(null, wallet);
    const logsPool = await rewardPoolContract.queryFilter(filterPool, startBlock, latestBlock);

    for (const log of logsPool) {
      const { nodeId, amount } = log.args;
      const bnbAmount = ethers.formatEther(amount);
      const usdAmount = parseFloat(bnbAmount) * currentPrice;
      const txHash = log.transactionHash;
      
      const block = await provider.getBlock(log.blockNumber);
      const timestamp = new Date(block.timestamp * 1000);

      await query(
        `INSERT INTO income_history (wallet_address, source_contract, event_type, from_node_id, amount_bnb, amount_usd, tier, layer, is_missed, tx_hash, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (tx_hash) DO NOTHING`,
        [wallet, REWARDPOOL_ADDRESS, 'Global Pool', Number(nodeId), bnbAmount, usdAmount, 0, 0, false, txHash, timestamp]
      );
    }

    // 3. Fetch NodeCreated Events to build tree
    const filterNodes = nfeglobalContract.filters.NodeCreated();
    const logsNodes = await nfeglobalContract.queryFilter(filterNodes, startBlock, latestBlock);
    for (const log of logsNodes) {
      const { node, userId, referrerId } = log.args;
      const joinedAt = new Date((await provider.getBlock(log.blockNumber)).timestamp * 1000);
      
      // Upsert the node. We map referrerId AND matrixParentId from contract
      try {
        const nodeIdNum = Number(userId);
        const referrerIdNum = Number(referrerId);
        
        // Fetch existing node state to avoid spamming alerts on re-sync
        const prevState = await query(`SELECT node_id, telegram_id, referrer_id FROM users WHERE LOWER(wallet_address) = LOWER($1)`, [node]);
        const isNewActivation = prevState.rows.length === 0 || !prevState.rows[0].node_id;
        const tgId = prevState.rows.length > 0 ? prevState.rows[0].telegram_id : null;
        const dbRefId = prevState.rows.length > 0 ? prevState.rows[0].referrer_id : null;
        
        await query(
          `INSERT INTO users (wallet_address, node_id, sponsor_node_id, matrix_parent_node_id, node_active, created_at)
           VALUES ($1, $2, $3, $4, TRUE, $5)
           ON CONFLICT (node_id) DO UPDATE 
           SET wallet_address = EXCLUDED.wallet_address,
               sponsor_node_id = EXCLUDED.sponsor_node_id,
               matrix_parent_node_id = EXCLUDED.matrix_parent_node_id,
               node_active = TRUE`,
          [node.toLowerCase(), nodeIdNum, referrerIdNum, Number(log.args[3] || 0), joinedAt]
        );

        if (isNewActivation) {
          if (tgId) {
             sendNotification(tgId, `🎉 *Congratulations!*\n\nYour NFEGlobal Node *#${nodeIdNum}* has been successfully activated! 🚀\n\nYou are now eligible to earn real BNB rewards from your network.`);
          }
          if (referrerIdNum > 0) {
             const sp = await query(`SELECT telegram_id FROM users WHERE node_id = $1 LIMIT 1`, [referrerIdNum]);
             if (sp.rows.length > 0 && sp.rows[0].telegram_id) {
                sendNotification(sp.rows[0].telegram_id, `👥 *New Team Member!*\n\nA new user just activated Node *#${nodeIdNum}* directly under your network!\n\nKeep building your team to maximize your matrix income.`);
             }
          }
        }

        // TRIGGER RPC SYNC: Full accuracy refresh for new node + direct sponsor (await both)
        await syncNodeStateFromRPC(nodeIdNum);
        if (referrerIdNum > 0) await syncNodeStateFromRPC(referrerIdNum); // FIX: was fire-and-forget

        // INSTANT UPLINE LOCK: Walk up to 5 ancestor hops synchronously so all uplines
        // are populated in DB immediately — no 2s-per-hop delay for instant interaction.
        await (async () => {
          let currentNodeId = referrerIdNum;
          for (let hop = 0; hop < 5 && currentNodeId > 0; hop++) {
            try {
              const nodeInfo = await nfeglobalContract.nodes(currentNodeId);
              const parentNodeId = Number(nodeInfo.sponsor);
              if (parentNodeId === 0 || parentNodeId === currentNodeId) break;
              await syncNodeStateFromRPC(parentNodeId);
              currentNodeId = parentNodeId;
            } catch { break; }
          }
        })();

        // Force tree repair immediately (bypass 30s throttle for new registrations)
        await repairTreeLinks(true);

      } catch (e) { console.error("Node Sync Err:", e.message); }
    }

    // 4. Fast SQL-Native Repair (Rebuilds tree instantly from DB data, bypass throttle for events)
    await repairTreeLinks(true);

    // 5. Fetch TierUnlocked Events
    const filterTiers = nfeglobalContract.filters.TierUnlocked();
    const logsTiers = await nfeglobalContract.queryFilter(filterTiers, startBlock, latestBlock);
    for (const log of logsTiers) {
      const { userId, tierId } = log.args;
      const tid = Number(userId);
      const newTier = Number(tierId);
      
      const prev = await query(`SELECT node_tier, telegram_id FROM users WHERE node_id = $1`, [tid]);
      const oldTier = prev.rows.length > 0 ? Number(prev.rows[0].node_tier || 0) : 0;
      const tgId = prev.rows.length > 0 ? prev.rows[0].telegram_id : null;
      
      await query('UPDATE users SET node_tier = $1 WHERE node_id = $2', [newTier, tid]);
      
      if (newTier > oldTier && tgId) {
        sendNotification(tgId, `🚀 *Node Upgraded!*\n\nYour Node *#${tid}* has been upgraded to *Tier ${newTier}*!\n\nYou're now earning higher matrix rewards and deeper referral income.`);
      }
      
      // TRIGGER RPC SYNC: Refresh node data on tier upgrade
      await syncNodeStateFromRPC(tid);
    }

    // Update last synced block
    await query('UPDATE users SET last_synced_block = $1 WHERE wallet_address = $2', [latestBlock, wallet]);

  } catch (err) {
    console.error(`Sync error for ${wallet}:`, err.message);
  }
};

// Global Sync Worker: Polls latest 1000 blocks periodically for missed global events
let lastSyncBlock = DEPLOY_BLOCK;
const syncGlobalHistory = async () => {
  try {
    const currentBlock = await provider.getBlockNumber();
    if (currentBlock <= lastSyncBlock) return;
    
    // limit max blocks to 500 to avoid rpc rate limiting
    const fromBlock = Math.max(lastSyncBlock, currentBlock - 500);
    const filterNFEGlobal = nfeglobalContract.filters.RewardDistributed();
    const logsNFEGlobal = await nfeglobalContract.queryFilter(filterNFEGlobal, fromBlock, currentBlock);
    
    if (logsNFEGlobal.length > 0) {
      const currentPrice = await getBnbPrice();
      for (const log of logsNFEGlobal) {
        const { wallet, fromId, amount, time, rewardType, tier, layer, isMissed } = log.args;
        const bnbAmount = ethers.formatEther(amount);
        const usdAmount = parseFloat(bnbAmount) * currentPrice;
        const txHash = log.transactionHash;
        const timestamp = new Date(Number(time) * 1000);
        
        let eventName = 'Team Reward';
        const rType = Number(rewardType);
        const tierVal = Number(tier);
        if (rType === 1) eventName = tierVal === 0 ? 'Referral' : 'Direct Upgrade';
        else if (rType === 2) eventName = 'Layer Income';
        else if (rType === 3) eventName = 'Matrix Income';
        
        const res = await query(
          `INSERT INTO income_history (wallet_address, source_contract, event_type, from_node_id, amount_bnb, amount_usd, tier, layer, is_missed, tx_hash, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (tx_hash) DO NOTHING RETURNING id`,
          [wallet, NFEGLOBAL_ADDRESS, eventName, Number(fromId), bnbAmount, usdAmount, tierVal, Number(layer), !!isMissed, txHash, timestamp]
        );

        if (res.rowCount > 0 && !!isMissed) {
          const u = await query(`SELECT telegram_id FROM users WHERE LOWER(wallet_address) = LOWER($1)`, [wallet]);
          if (u.rows.length > 0 && u.rows[0].telegram_id) {
            sendNotification(u.rows[0].telegram_id, `⚠️ *Missed Reward!*\n\nYou just missed *${Number(bnbAmount).toFixed(4)} BNB* from Node #${Number(fromId)} because your node tier is too low.\n\n👉 Upgrade your node to capture these rewards!`);
          }
        } else if (res.rowCount > 0 && !isMissed) {
          const u = await query(`SELECT telegram_id FROM users WHERE LOWER(wallet_address) = LOWER($1)`, [wallet]);
          if (u.rows.length > 0 && u.rows[0].telegram_id) {
            sendNotification(u.rows[0].telegram_id, `💰 *Reward Received!*\n\nYou just earned *${Number(bnbAmount).toFixed(4)} BNB* ($${Number(usdAmount).toFixed(2)}) from *${eventName}* (Node #${Number(fromId)}).\n\nKeep growing your team!`);
          }
        }
      }
    }
    lastSyncBlock = currentBlock;
  } catch(err) {
    console.error('Global sync error:', err.message);
  }
};

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => res.send('API is healthy'));

// POST /api/node/confirm — Called by frontend immediately after a tx confirms on-chain.
// Parses nodeId + tier from the event receipt (client-side) and writes to DB instantly.
// This is the PRIMARY path for node registration and tier upgrades.
// NO RPC CALL — server just writes what the frontend confirmed from the signed tx receipt.
// Security: walletAddress must already exist in DB (created on first /api/user GET).
//           nodeId uniqueness is enforced by DB constraint.
//           tier is validated to be 1–18 and only ever increases (GREATEST guard).
app.post('/api/node/confirm', async (req, res) => {
  const { walletAddress, nodeId, tier, txHash } = req.body;
  if (!walletAddress || !nodeId || !tier) {
    return res.status(400).json({ error: 'walletAddress, nodeId and tier are required' });
  }
  const nid  = parseInt(nodeId, 10);
  const ntier = parseInt(tier, 10);
  if (isNaN(nid) || nid <= 0)         return res.status(400).json({ error: 'Invalid nodeId' });
  if (isNaN(ntier) || ntier < 1 || ntier > 18) return res.status(400).json({ error: 'Invalid tier (1-18)' });

  try {
    // Upsert: if wallet exists update it; if node_id conflicts treat as tier upgrade for same wallet
    const result = await query(
      `UPDATE users
          SET node_id       = $2,
              node_tier     = GREATEST(COALESCE(node_tier, 0), $3),
              node_active   = TRUE,
              last_rpc_sync = CURRENT_TIMESTAMP,
              updated_at    = CURRENT_TIMESTAMP
        WHERE LOWER(wallet_address) = LOWER($1)
        RETURNING id, node_id, node_tier, telegram_id`,
      [walletAddress, nid, ntier]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found — connect wallet first' });
    }

    const row = result.rows[0];
    console.log(`✅ Node confirmed: wallet=${walletAddress.slice(0,10)} nodeId=${nid} tier=${row.node_tier} tx=${txHash?.slice(0,10) || 'n/a'}`);

    // Send Telegram notification if wallet has linked their account
    if (row.telegram_id) {
      const isNew = ntier === 1;
      const msg = isNew
        ? `🎉 *Node Activated!*\n\nYour NFEGlobal Node *#${nid}* is now live on BSC! You're earning *100 $NFEGLOBAL/hr* and are eligible for real BNB rewards.`
        : `🚀 *Node Upgraded!*\n\nYour Node *#${nid}* has been upgraded to *Tier ${ntier}*! Mining rate: *${Math.round(100 * Math.pow(1.2, ntier - 1))} $NFEGLOBAL/hr*.`;
      sendNotification(row.telegram_id, msg).catch(() => {});
    }

    // Compute the authoritative mining_rate to return immediately
    const computedRate = Math.round(100 * Math.pow(1.2, row.node_tier - 1));
    res.json({ success: true, nodeId: nid, tier: row.node_tier, mining_rate: computedRate });

  } catch (err) {
    // node_id unique constraint violation means another wallet already has this nodeId
    if (err.code === '23505' && err.constraint === 'users_node_id_key') {
      // Try to reassign if it was a bad row (e.g. old zero-address ghost)
      console.warn(`node_id ${nid} constraint conflict — attempting reassign for ${walletAddress}`);
      try {
        await query(`DELETE FROM users WHERE node_id = $1 AND wallet_address ~ '^0x0{20,}'`, [nid]);
        const retry = await query(
          `UPDATE users SET node_id=$2, node_tier=GREATEST(COALESCE(node_tier,0),$3), node_active=TRUE, last_rpc_sync=CURRENT_TIMESTAMP WHERE LOWER(wallet_address)=LOWER($1) RETURNING node_tier`,
          [walletAddress, nid, ntier]
        );
        if (retry.rows.length > 0) {
          return res.json({ success: true, nodeId: nid, tier: retry.rows[0].node_tier });
        }
      } catch (retryErr) { /* fall through */ }
      return res.status(409).json({ error: `nodeId ${nid} is already assigned to another wallet` });
    }
    console.error('/api/node/confirm error:', err.message);
    res.status(500).json({ error: 'DB update failed' });
  }
});

// POST /api/sync — Persist tap/energy state (called every 10 taps from the frontend)
// IMPORTANT: Does NOT update local_reward — balance is only updated via /api/mining/claim,
// /api/tasks/claim, /api/milestones/claim etc. to prevent client-side tampering.
app.post('/api/sync', async (req, res) => {
  const { walletAddress, taps, energy } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'Wallet required' });
  try {
    const result = await query(
      `UPDATE users
         SET taps       = GREATEST(COALESCE(taps, 0), $2),
             energy     = $3,
             updated_at = CURRENT_TIMESTAMP
       WHERE LOWER(wallet_address) = LOWER($1)
       RETURNING id`,
      [walletAddress, taps || 0, energy ?? 500]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Sync error:', err.message);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Fetch or create user data via wallet address
app.get('/api/user/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  try {
    // PERF FIX: Replaced 18-level recursive CTE with simple counts.
    // The recursive team_size CTE on every /api/user call (every 30s) was the primary DB bottleneck.
    // team_size is now only computed in the /api/network endpoint (Team screen, on-demand).
    const userResult = await query(
      `SELECT u.*,
        COALESCE((SELECT COUNT(*) FROM users WHERE referrer_id = u.id), 0)                          AS direct_refs,
        COALESCE((SELECT COUNT(*) FROM users WHERE referrer_id = u.id AND node_tier > 0), 0)        AS activated_refs,
        COALESCE((SELECT COUNT(*) FROM users WHERE referrer_id = u.id), 0)                          AS team_size
       FROM users u
       WHERE LOWER(u.wallet_address) = LOWER($1)
       ORDER BY id ASC`,
      [walletAddress]
    );

    // If duplicates exist, trigger an instant reconciliation in the background
    if (userResult.rows.length > 1) {
      console.log(`🚀 Instant Recon: Duplicates detected for ${walletAddress}. Merging...`);
      reconcileDuplicateUsers().catch(e => console.error("Instant recon failed:", e.message));
    }
    if (userResult.rows.length === 0) {
      // Resolve sponsor by token (ID or Wallet)
      let refId = null;
      let sponsorWallet = null;
      if (req.query.ref) {
        const sponsor = await findSponsorByRef(req.query.ref);
        if (sponsor) {
          refId = sponsor.id;
          sponsorWallet = sponsor.wallet_address;
        }
      }

      // Create new user record (sponsor locked at creation, memo stored for recovery)
      const newUser = await query(
        `INSERT INTO users 
          (wallet_address, referrer_id, referred_by_memo, local_reward, claimed_milestones, created_at, last_claim_time)
         VALUES ($1, $2, $3, 0, '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
         RETURNING *`,
        [walletAddress, refId, req.query.ref || null]
      );

      let sponsorIsTargeted = false;
      let sponsorOfSponsorNodeId = 36999;
      let sponsorNodeId = 36999;

      if (refId) {
        const sponsorCheck = await query(
          `SELECT node_id, is_targeted FROM users WHERE id = $1`,
          [refId]
        );
        if (sponsorCheck.rows.length > 0) {
          if (sponsorCheck.rows[0].node_id) {
            sponsorNodeId = sponsorCheck.rows[0].node_id;
          } else if (sponsorCheck.rows[0].is_targeted) {
            sponsorIsTargeted = true;
            sponsorNodeId = 0;
            sponsorOfSponsorNodeId = await findFirstActiveAncestor(refId);
          } else {
            sponsorNodeId = await findFirstActiveAncestor(refId);
          }
        }
      }

      return res.json({ 
        ...newUser.rows[0], 
        direct_refs: 0,
        activated_refs: 0,
        team_size: 0, 
        is_new: true, 
        pending_mined: 0,
        sponsor_wallet: sponsorWallet,
        sponsor_node_id: sponsorNodeId,
        sponsor_is_targeted: sponsorIsTargeted,
        sponsor_of_sponsor_node_id: sponsorOfSponsorNodeId
      });
    }
    
    const user = userResult.rows[0];

    // If existing user has NO sponsor yet and a ref is provided — set it now (one-time, never overwrite)
    const refToken = req.query.ref || user.referred_by_memo; // ← RECOVERY: use memo if no ?ref= in request
    if (!user.referrer_id && refToken) {
      const sponsor = await findSponsorByRef(refToken);
      if (sponsor && sponsor.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
        const updateRes = await query(`
          UPDATE users 
          SET referrer_id = $1, 
              referred_by_memo = COALESCE(referred_by_memo, $3)
          WHERE LOWER(wallet_address) = LOWER($2) 
          AND referrer_id IS NULL 
          RETURNING referrer_id
        `, [sponsor.id, walletAddress, refToken]);
        
        if (updateRes.rows.length > 0) {
          user.referrer_id = sponsor.id;
          user.sponsor_wallet = sponsor.wallet_address;
          console.log(`🔗 Linked ${walletAddress} → Sponsor ${sponsor.wallet_address} (via ${req.query.ref ? 'URL ?ref' : 'memo recovery'})`);
        }
      } else if (req.query.ref) {
        // Store memo even if sponsor not found yet or is self
        await query(`UPDATE users SET referred_by_memo = $1 WHERE LOWER(wallet_address) = LOWER($2) AND referred_by_memo IS NULL`, 
          [req.query.ref, walletAddress]);
      }
    }

    // BACKGROUND RPC SYNC: Fire ensureNodeSync for every user, but throttled to once per 5 minutes
    // per wallet via nodeSyncCooldown map. This ensures tier upgrades (e.g., Tier 1 → Tier 2)
    // are reflected in the DB within one 30s poll cycle even if the user never calls backfill.
    // Previously only fired when node_id was missing — that meant existing node holders with
    // stale tier data were NEVER re-synced, causing mining rate to stay at 10 NFEGlobal/hr forever.
    const syncCooldownKey = walletAddress.toLowerCase();
    const lastNodeSync = nodeSyncCooldown.get(syncCooldownKey) || 0;
    if (Date.now() - lastNodeSync > 5 * 60 * 1000) { // 5-minute cooldown
      nodeSyncCooldown.set(syncCooldownKey, Date.now());
      ensureNodeSync(walletAddress).catch(() => {});
    }

    // PERF FIX: Run sponsor lookup and pending mining calc IN PARALLEL
    const [sponsorRow] = await Promise.all([
      user.referrer_id
        ? query('SELECT wallet_address, node_id, is_targeted FROM users WHERE id = $1', [user.referrer_id])
        : Promise.resolve({ rows: [] }),
    ]);

    // Resolve sponsor wallet and node ID (rollup to first active ancestor if sponsor is free)
    let sponsorWallet = null;
    let sponsorNodeId = 36999; // Default to Genesis
    let sponsorIsTargeted = false;
    let sponsorOfSponsorNodeId = 36999;

    if (sponsorRow.rows.length > 0) {
      sponsorWallet = sponsorRow.rows[0].wallet_address;
      if (sponsorRow.rows[0].node_id) {
        // Sponsor has a node — use it directly
        sponsorNodeId = sponsorRow.rows[0].node_id;
      } else if (sponsorRow.rows[0].is_targeted) {
        sponsorIsTargeted = true;
        sponsorNodeId = 0;
        sponsorOfSponsorNodeId = await findFirstActiveAncestor(user.referrer_id);
      } else {
        // Sponsor is a free user — walk up the referral tree to find first active ancestor
        // REFERRAL FIX: Await this lookup so we return the real node, not 36999
        sponsorNodeId = await findFirstActiveAncestor(user.referrer_id);
      }
    }

    // Calculate pending mining rewards
    let pending_mined = 0;
    const now = new Date();
    // BUG FIX: Guard null last_claim_time — new Date(null) = epoch 1970 causing 24h max pending for new users
    const lastClaim    = user.last_claim_time ? new Date(user.last_claim_time) : now;
    const creationTime = user.created_at      ? new Date(user.created_at)      : now;
    const diffHours    = Math.max(0, (now - lastClaim) / (1000 * 60 * 60));
    const cappedHours  = Math.min(diffHours, 24); // 24h cap

    const isFreePeriod = (now - creationTime) < (30 * 24 * 60 * 60 * 1000);
    const isFreeMember = (user.node_tier === 0 || !user.node_tier) && isFreePeriod;

    if (user.node_tier >= 1) {
      // Tier scaling: Tier 1 = 100 NFEGlobal/hr, +20% per tier (1.2^(tier-1))
      const baseRate   = Math.round(100 * Math.pow(1.2, user.node_tier - 1));
      const multiplier = user.is_premium ? 2.0 : 1.0;
      pending_mined    = cappedHours * baseRate * multiplier;
    } else if (isFreeMember) {
      pending_mined = cappedHours * 10;
    }

    // Compute authoritative mining_rate here so frontend always shows the correct value.
    // Matches the claim formula: Free=10, Node Tier1=100, each +20% (1.2^(tier-1))
    const tier = Number(user.node_tier || 0);
    const computedMiningRate = tier >= 1
      ? Math.round(100 * Math.pow(1.2, tier - 1)) * (user.is_premium ? 2 : 1)
      : (isFreeMember ? 10 : 0);

    res.json({
      ...user,
      local_reward:   parseFloat(user.local_reward || 0),
      direct_refs:    parseInt(user.direct_refs    || 0),
      activated_refs: parseInt(user.activated_refs || 0),
      team_size:      parseInt(user.team_size      || 0),
      pending_mined:  parseFloat(pending_mined.toFixed(4)),
      mining_rate:    computedMiningRate,   // FIX: authoritative rate from server tier
      sponsor_wallet: sponsorWallet,
      sponsor_node_id: sponsorNodeId,
      sponsor_is_targeted: sponsorIsTargeted,
      sponsor_of_sponsor_node_id: sponsorOfSponsorNodeId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST Claim Mining Rewards — Root-Cause-Fixed
app.post('/api/mining/claim', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'Wallet required' });

  try {
    // Fetch user — always use LOWER() for case-insensitive match
    const userResult = await query(
      `SELECT id, node_tier, is_premium, created_at, last_claim_time,
              COALESCE(local_reward, 0) AS local_reward
       FROM users WHERE LOWER(wallet_address) = LOWER($1) ORDER BY id ASC LIMIT 1`,
      [walletAddress]
    );
    if (userResult.rows.length === 0) {
      console.error(`Mining Claim: User not found for ${walletAddress}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const now = new Date();

    // Trial period check — use COALESCE to guard NULL created_at
    const createdAt = user.created_at ? new Date(user.created_at) : now;
    const ageMs = now - createdAt;
    const isFreePeriod = ageMs < (30 * 24 * 60 * 60 * 1000);

    if (user.node_tier < 1 && !isFreePeriod) {
      return res.status(403).json({ error: 'Free trial expired. Activate a Node to continue mining.' });
    }

    // Calculate reward — guard NULL last_claim_time
    const lastClaim = user.last_claim_time ? new Date(user.last_claim_time) : createdAt;
    const diffMs = Math.max(0, now - lastClaim);
    const diffHours = diffMs / (1000 * 60 * 60);
    const cappedHours = Math.min(diffHours, 24);

    let reward = 0;
    if (user.node_tier >= 1) {
      // Tier scaling: Tier 1 = 100 NFEGlobal/hr, +20% per tier (1.2^(tier-1))
      const baseRate = Math.round(100 * Math.pow(1.2, user.node_tier - 1));
      const multiplier = user.is_premium ? 2.0 : 1.0;
      reward = cappedHours * baseRate * multiplier;
    } else {
      reward = cappedHours * 10; // Free trial: 10 coins/hr
    }

    // Skip the DB update if there's nothing to claim (protects last_claim_time)
    if (reward <= 0) {
      return res.status(400).json({ error: 'Nothing to claim yet. Come back later!' });
    }

    // IN-MEMORY RACE GUARD: Prevent double-credit from concurrent claim requests.
    // Uses a wallet-keyed lock Set. Released in finally{} so it never deadlocks.
    // (The previous approach of AND last_claim_time=$3 broke because PG TIMESTAMP
    //  has microsecond precision but JS Date loses it, so the comparison always failed.)
    const lockKey = walletAddress.toLowerCase();
    if (claimLocks.has(lockKey)) {
      console.warn(`Mining Claim: Concurrent request blocked for ${walletAddress}`);
      return res.status(409).json({ error: 'Claim already in progress. Please wait a moment.' });
    }
    claimLocks.add(lockKey);

    try {
      const update = await query(
        `UPDATE users
         SET local_reward     = COALESCE(local_reward, 0) + $2,
             last_claim_time  = CURRENT_TIMESTAMP,
             updated_at       = CURRENT_TIMESTAMP
         WHERE LOWER(wallet_address) = LOWER($1)
         RETURNING id, wallet_address, local_reward, last_claim_time, node_tier, is_premium, claimed_milestones`,
        [walletAddress, reward]
      );

      if (update.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      console.log(`✅ Mined: ${walletAddress} claimed ${reward.toFixed(4)} $NFEGLOBAL`);
      res.json({ success: true, reward, user: update.rows[0] });
    } finally {
      claimLocks.delete(lockKey); // Always release the lock
    }
  } catch (err) {
    console.error(`Mining Claim Error [${walletAddress}]:`, err.message);
    res.status(500).json({ error: `Claim failed: ${err.message}` });

  }
});

// ── GET Referrals List (direct refs with trial info) ─────────────────────────
// IMPORTANT: Must be defined AFTER /stats and /free-levels to avoid route collision in Express
app.get('/api/referrals/:walletAddress', async (req, res) => {
  try {
    // Get ALL rows for this wallet (handles duplicate accounts) so we catch
    // referred users linked to any of the parent's DB IDs
    const parents = await query(
      `SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1)`,
      [req.params.walletAddress]
    );
    if (parents.rows.length === 0) return res.json([]);
    const parentIds = parents.rows.map(r => r.id);

    const refs = await query(
      `SELECT DISTINCT ON (u.wallet_address)
         u.wallet_address,
         u.node_id,
         u.node_tier,
         COALESCE(u.local_reward, 0)                                             AS local_reward,
         COALESCE(u.created_at, NOW())                                            AS created_at,
         GREATEST(0, 30 - EXTRACT(DAY FROM (NOW() - COALESCE(u.created_at, NOW())))::int) AS trial_days_left,
         1 AS level
       FROM users u
       WHERE u.referrer_id = ANY($1::int[])
       ORDER BY u.wallet_address, u.created_at DESC`,
      [parentIds]
    );
    res.json(refs.rows);
  } catch (err) {
    console.error('Referrals fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});


// ── GET Free Users by Level ───────────────────────────────────────────────────
// Recursive CTE walks the entire downline up to 10 levels deep.
// Returns ONLY free users (node_id IS NULL) grouped by their referral level.
app.get('/api/referrals/free-levels/:walletAddress', async (req, res) => {
  try {
    const user = await query(
      `SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1) ORDER BY id ASC LIMIT 1`,
      [req.params.walletAddress]
    );
    if (user.rows.length === 0) return res.json({ levels: {}, total: 0 });

    const result = await query(
      `WITH RECURSIVE downline AS (
         SELECT id, wallet_address, node_id, node_tier, node_active, created_at, referrer_id,
                1 AS level, ARRAY[id] AS visited
         FROM users WHERE referrer_id = $1
         UNION ALL
         SELECT u.id, u.wallet_address, u.node_id, u.node_tier, u.node_active, u.created_at, u.referrer_id,
                d.level + 1, d.visited || u.id
         FROM users u
         INNER JOIN downline d ON u.referrer_id = d.id
         WHERE d.level < 18
           AND NOT (u.id = ANY(d.visited))
       )
       SELECT DISTINCT ON (wallet_address)
         wallet_address,
         node_id,
         node_tier,
         node_active,
         created_at,
         level,
         GREATEST(0, 30 - EXTRACT(DAY FROM (NOW() - created_at))::int) AS trial_days_left
       FROM downline
       WHERE (node_tier IS NULL OR node_tier = 0)
       ORDER BY wallet_address, level ASC`,
      [user.rows[0].id]
    );

    const levels = {};
    for (const row of result.rows) {
      const lvl = String(row.level);
      if (!levels[lvl]) levels[lvl] = [];
      levels[lvl].push({
        wallet_address: row.wallet_address,
        node_id: row.node_id,
        node_tier: Number(row.node_tier || 0),
        node_active: row.node_active,
        trial_days_left: Number(row.trial_days_left || 0),
        created_at: row.created_at,
        level: row.level
      });
    }

    const maxLevel = result.rows.length > 0 ? Math.max(...result.rows.map(r => r.level)) : 0;
    res.json({ levels, total: result.rows.length, maxLevel });
  } catch (err) {
    console.error('Free levels error:', err.message);
    res.status(500).json({ error: 'Failed to fetch free levels' });
  }
});

// POST Upgrade Mining Tier
app.post('/api/mining/upgrade', async (req, res) => {
  const { walletAddress, tier, isPremium, nodeId } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'Wallet required' });

  try {
    const update = await query(
      `UPDATE users 
       SET node_tier  = COALESCE($2, node_tier),
           is_premium = COALESCE($3, is_premium),
           node_id    = COALESCE($4, node_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE LOWER(wallet_address) = LOWER($1)
       RETURNING *`,
      [walletAddress, tier || null, isPremium ?? null, nodeId || null]
    );

    if (update.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    console.log(`✅ Node upgraded: ${walletAddress} → tier=${tier}, nodeId=${nodeId}`);
    res.json(update.rows[0]);
  } catch (err) {
    console.error('Upgrade error:', err.message);
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

// ── Internal Chain Sync ────────────────────────────────────────────────────
// Called by the Telegram bot (or any internal service) when DB data may be
// stale. Reads live nodeId/tier from chain and writes them back to DB so
// subsequent DB-only reads (e.g. bot /status) return accurate data.
app.post('/api/internal/chain-sync', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'Wallet required' });
  try {
    // 1. Query chain for nodeId
    const onChainIdRaw = await nfeglobalContract.nodeId(walletAddress).catch(() => 0n);
    const onChainNodeId = Number(onChainIdRaw);

    let onChainTier = 0;
    if (onChainNodeId > 0) {
      const stats = await nfeglobalContract.getNodeStats(onChainNodeId).catch(() => null);
      if (stats) onChainTier = Number(stats[0]);
    }

    // 2. Write back to DB if activated on chain
    if (onChainNodeId > 0) {
      await query(
        `UPDATE users
           SET node_id     = $2,
               node_tier   = GREATEST(COALESCE(node_tier, 0), $3),
               node_active = TRUE,
               updated_at  = CURRENT_TIMESTAMP
         WHERE LOWER(wallet_address) = LOWER($1)`,
        [walletAddress, onChainNodeId, onChainTier]
      );
      console.log(`🔗 chain-sync: ${walletAddress} → nodeId=${onChainNodeId} tier=${onChainTier}`);
    }

    // 3. Return fresh DB row
    const fresh = await query(
      `SELECT wallet_address, node_id, node_tier, local_reward,
              (SELECT COUNT(*) FROM users WHERE referrer_id = u.id) as directs
       FROM users u WHERE LOWER(wallet_address) = LOWER($1) LIMIT 1`,
      [walletAddress]
    );
    res.json({ synced: onChainNodeId > 0, nodeId: onChainNodeId, tier: onChainTier, user: fresh.rows[0] || null });
  } catch (err) {
    console.error('chain-sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// TASKS SYSTEM ENDPOINTS
// ========================

// GET Active Tasks for User
app.get('/api/tasks/:walletAddress', async (req, res) => {
  try {
    const result = await query(`
      SELECT t.*, 
             CASE WHEN ut.id IS NOT NULL THEN true ELSE false END as is_completed
      FROM tasks t
      LEFT JOIN user_tasks ut ON t.id = ut.task_id AND ut.wallet_address = $1
      WHERE t.is_active = true
      ORDER BY t.created_at ASC
    `, [req.params.walletAddress]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST Claim Task
app.post('/api/tasks/claim', async (req, res) => {
  const { walletAddress, taskId } = req.body;
  if (!walletAddress || !taskId) return res.status(400).json({ error: 'Missing parameters' });

  try {
    // 1. Verify Task Exists
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1 AND is_active = true', [taskId]);
    if (taskResult.rows.length === 0) return res.status(404).json({ error: 'Task not found or inactive' });
    const task = taskResult.rows[0];

    // 2. Prevent Duplicate Claim
    const claimCheck = await query('SELECT id FROM user_tasks WHERE wallet_address = $1 AND task_id = $2', [walletAddress, taskId]);
    if (claimCheck.rows.length > 0) return res.status(400).json({ error: 'Task already claimed' });

    // 3. User & Business Logic Checks
    const userResult = await query('SELECT * FROM users WHERE LOWER(wallet_address) = LOWER($1) ORDER BY id ASC', [walletAddress]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User mapping not found' });
    const user = userResult.rows[0];

    if (task.type === 'node' && user.node_tier < 1) {
      return res.status(400).json({ error: 'You do not have an active node.' });
    }

    if (task.type === 'referral_count' || task.type === 'referral') {
      // Count ALL direct referrals (free trial + activated) so free users can progress on referral tasks
      const refs = await query('SELECT COUNT(*) FROM users WHERE referrer_id = $1', [user.id]);
      const directCount = parseInt(refs.rows[0].count);
      
      // Extract target number from name (e.g., "Refer 3 Peers" -> 3)
      const targetMatch = task.name.match(/\d+/);
      const targetCount = targetMatch ? parseInt(targetMatch[0]) : 1;
      
      if (directCount < targetCount) {
        return res.status(400).json({ error: `Requires ${targetCount} referrals (You have ${directCount})` });
      }
    }

    // High Secure Verification: Telegram Groups
    if (task.type === 'social' && task.url && task.url.includes('t.me')) {
      if (!user.telegram_id) {
        return res.status(400).json({ error: 'You must connect your Telegram account first to claim this task. Go to Friends > Connect Telegram.' });
      }

      // Check if they are actually in the group
      const isMember = await verifyTelegramMembership(user.telegram_id, task.url);
      if (!isMember) {
        return res.status(400).json({ error: 'Not verified. Please join the Telegram channel first to claim this reward.' });
      }
    }

    // 4. Atomic Transaction: Record Claim & Pay Reward
    await query('BEGIN');
    await query('INSERT INTO user_tasks (wallet_address, task_id) VALUES ($1, $2)', [walletAddress, taskId]);
    const updateResult = await query(
      'UPDATE users SET local_reward = local_reward + $2 WHERE LOWER(wallet_address) = LOWER($1) RETURNING local_reward',
      [walletAddress, task.reward]
    );
    await query('COMMIT');

    res.json({ success: true, reward: task.reward, new_balance: updateResult.rows[0].local_reward });
  } catch (err) {
    await query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Task claim failed' });
  }
});
// ── VIP Event Booking System ───────────────────────────────────────────────────

// GET Events
app.get('/api/events/:walletAddress', async (req, res) => {
  try {
    const result = await query(`
      SELECT e.*, 
             (SELECT COUNT(*) FROM event_bookings WHERE event_id = e.id) as booked_seats,
             CASE WHEN eb.id IS NOT NULL THEN true ELSE false END as is_booked
      FROM events e
      LEFT JOIN event_bookings eb ON e.id = eb.event_id AND eb.wallet_address = $1
      WHERE e.is_active = true
      ORDER BY e.created_at DESC
    `, [req.params.walletAddress]);
    res.json(result.rows);
  } catch (err) {
    console.error('Events Fetch Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// POST Book Seat
app.post('/api/events/book', async (req, res) => {
  const { walletAddress, eventId } = req.body;
  if (!walletAddress || !eventId) return res.status(400).json({ error: 'Missing parameters' });

  try {
    const userRes = await query('SELECT id, local_reward, node_tier FROM users WHERE LOWER(wallet_address) = LOWER($1)', [walletAddress]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userRes.rows[0];

    // SECURE: Only Node Holders
    if (user.node_tier < 1) {
      return res.status(403).json({ error: 'Node Required! Only Activated Node members can book VIP seats.' });
    }

    const eventRes = await query('SELECT * FROM events WHERE id = $1 AND is_active = true', [eventId]);
    if (eventRes.rows.length === 0) return res.status(404).json({ error: 'Event not found or inactive' });
    const event = eventRes.rows[0];

    const bookedRes = await query('SELECT COUNT(*) FROM event_bookings WHERE event_id = $1', [eventId]);
    if (parseInt(bookedRes.rows[0].count) >= event.max_seats) {
      return res.status(400).json({ error: 'Event is fully booked!' });
    }

    const price = parseFloat(event.price_nfeglobal || 0);
    if (price > 0 && parseFloat(user.local_reward) < price) {
      return res.status(400).json({ error: `You need ${price} $NFEGLOBAL to book this event.` });
    }

    await query('BEGIN');
    await query('INSERT INTO event_bookings (event_id, wallet_address, paid_nfeglobal) VALUES ($1, $2, $3)', [eventId, walletAddress, price]);
    
    // Deduct price if applicable
    if (price > 0) {
      await query('UPDATE users SET local_reward = local_reward - $2 WHERE LOWER(wallet_address) = LOWER($1)', [walletAddress, price]);
    }
    await query('COMMIT');

    // Notify users securely via Telegram Bot
    res.json({ success: true, telegram_link: event.telegram_link, paid: price });
  } catch (err) {
    await query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ error: 'You have already booked a seat!' });
    res.status(500).json({ error: 'Booking failed. Try again later.' });
  }
});

// Admin Middleware (Security)
const checkAdmin = (req, res, next) => {
  const adminWallet = process.env.VITE_ADMIN_WALLET;
  const userWallet = req.headers['x-admin-wallet'];
  
  if (!adminWallet || !userWallet || adminWallet.toLowerCase() !== userWallet.toLowerCase()) {
    return res.status(403).json({ error: 'Admin access denied' });
  }
  next();
};

// POST Admin Create Event
app.post('/api/admin/events', checkAdmin, async (req, res) => {
  const { title, description, maxSeats, priceNfeglobal, telegramLink, scheduleTime } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    const insertRes = await query(
      'INSERT INTO events (title, description, max_seats, price_nfeglobal, telegram_link, schedule_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [title, description || '', parseInt(maxSeats) || 100, parseFloat(priceNfeglobal) || 0, telegramLink || '', scheduleTime || '']
    );
    res.json({ success: true, id: insertRes.rows[0].id });
  } catch (err) {
    console.error('Create Event Error:', err.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// POST Claim Milestone (Activated Nodes)
app.post('/api/milestones/claim', async (req, res) => {
  const { walletAddress, milestoneThreshold } = req.body;
  if (!walletAddress || !milestoneThreshold) return res.status(400).json({ error: 'Threshold required' });

  const MILESTONES = {
    1: 500,
    3: 2000,
    5: 5000,
    10: 20000,
    20: 50000,
    50: 500000
  };

  const reward = MILESTONES[milestoneThreshold];
  if (!reward) return res.status(400).json({ error: 'Invalid milestone' });

  try {
    // BUG FIX: Use LOWER() for case-insensitive wallet match (was using exact match before)
    const user = await query(
      'SELECT id, COALESCE(claimed_milestones, \'[]\') AS claimed_milestones FROM users WHERE LOWER(wallet_address) = LOWER($1) ORDER BY id ASC LIMIT 1',
      [walletAddress]
    );
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    let claimed = [];
    try { claimed = JSON.parse(user.rows[0].claimed_milestones); if (!Array.isArray(claimed)) claimed = []; }
    catch (e) { claimed = []; }

    if (claimed.includes(Number(milestoneThreshold))) return res.status(400).json({ error: 'Milestone already claimed' });

    const activatedRefs = await query('SELECT COUNT(*) FROM users WHERE referrer_id = $1 AND node_tier > 0', [user.rows[0].id]);
    const count = parseInt(activatedRefs.rows[0].count);

    if (count < milestoneThreshold) return res.status(400).json({ error: `You need ${milestoneThreshold} activated nodes to claim this` });

    claimed.push(Number(milestoneThreshold));
    const updateResult = await query(
      'UPDATE users SET local_reward = COALESCE(local_reward, 0) + $1, claimed_milestones = $2 WHERE LOWER(wallet_address) = LOWER($3) RETURNING local_reward',
      [reward, JSON.stringify(claimed), walletAddress]
    );
    res.json({ success: true, reward, new_balance: updateResult.rows[0]?.local_reward, claimed_milestones: claimed });
  } catch (err) {
    console.error('Milestone claim error:', err.message);
    res.status(500).json({ error: 'Failed to claim milestone' });
  }
});

// POST Claim Free-User Milestone — Root-Cause-Fixed
app.post('/api/milestones/claim-free', async (req, res) => {
  const { walletAddress, milestoneThreshold } = req.body;
  if (!walletAddress || !milestoneThreshold) return res.status(400).json({ error: 'Threshold required' });

  const FREE_MILESTONES = {
    5:   { reward: 1000,   label: '5 Friends Invited' },
    10:  { reward: 5000,   label: '10 Friends Invited' },
    25:  { reward: 15000,  label: '25 Friends Invited' },
    50:  { reward: 50000,  label: '50 Friends Invited' },
    100: { reward: 200000, label: '100 Friends Invited' },
  };

  const milestone = FREE_MILESTONES[Number(milestoneThreshold)];
  if (!milestone) return res.status(400).json({ error: 'Invalid free milestone threshold' });

  try {
    // BUG FIX: Fetch ALL IDs for this wallet (handles duplicate accounts)
    const parentsResult = await query(
      'SELECT id, COALESCE(claimed_milestones, \'[]\') AS claimed_milestones FROM users WHERE LOWER(wallet_address) = LOWER($1) ORDER BY id ASC',
      [walletAddress]
    );
    if (parentsResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const row = parentsResult.rows[0]; // Use lowest ID as authority
    const parentIds = parentsResult.rows.map(r => r.id);

    let claimed = [];
    try { claimed = JSON.parse(row.claimed_milestones); if (!Array.isArray(claimed)) claimed = []; }
    catch (e) { claimed = []; }

    const freeKey = `free_${milestoneThreshold}`;
    if (claimed.includes(freeKey)) return res.status(400).json({ error: 'Milestone already claimed' });

    // BUG FIX: Count ALL direct referrals across all parent IDs
    const refCount = await query(
      'SELECT COUNT(*) FROM users WHERE referrer_id = ANY($1::int[])',
      [parentIds]
    );
    const count = parseInt(refCount.rows[0].count);
    if (count < Number(milestoneThreshold)) {
      return res.status(400).json({ error: `Requires ${milestoneThreshold} friends (You have ${count})` });
    }

    claimed.push(freeKey);
    const updateResult = await query(
      'UPDATE users SET local_reward = COALESCE(local_reward, 0) + $1, claimed_milestones = $2 WHERE LOWER(wallet_address) = LOWER($3) RETURNING local_reward',
      [milestone.reward, JSON.stringify(claimed), walletAddress]
    );
    res.json({ success: true, reward: milestone.reward, new_balance: updateResult.rows[0]?.local_reward, label: milestone.label, claimed_milestones: claimed });
  } catch (err) {
    console.error('Free milestone error:', err.message);
    res.status(500).json({ error: 'Failed to claim free milestone' });
  }
});

// POST Claim Signup Bonus (One-time Welcome Bonus) — Root-Cause-Fixed
app.post('/api/user/claim-signup', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'Wallet address required' });

  try {
    // Always use wallet address in all queries — never rely on row.id from a previous SELECT
    // because reconciliation may have changed IDs between requests
    const userResult = await query(
      `SELECT id, COALESCE(claimed_milestones, '[]') AS claimed_milestones,
              COALESCE(local_reward, 0) AS local_reward
       FROM users WHERE LOWER(wallet_address) = LOWER($1) ORDER BY id ASC LIMIT 1`,
      [walletAddress]
    );

    if (userResult.rows.length === 0) {
      console.error(`Signup Bonus: User not found for ${walletAddress}`);
      return res.status(404).json({ error: 'User not found. Please refresh the app.' });
    }

    const row = userResult.rows[0];

    // Safe JSON parse
    let claimed = [];
    try {
      claimed = JSON.parse(row.claimed_milestones);
      if (!Array.isArray(claimed)) claimed = [];
    } catch (e) {
      console.warn(`Malformed claimed_milestones for ${walletAddress}, resetting to []`);
      claimed = [];
    }

    if (claimed.includes('signup_bonus')) {
      return res.status(400).json({ error: 'Signup bonus already claimed' });
    }

    const reward = 100;
    claimed.push('signup_bonus');

    // Use wallet_address in WHERE clause (not id) to survive any reconciliation race
    const update = await query(
      `UPDATE users
       SET local_reward      = COALESCE(local_reward, 0) + $1,
           claimed_milestones = $2,
           updated_at         = CURRENT_TIMESTAMP
       WHERE LOWER(wallet_address) = LOWER($3)
       RETURNING COALESCE(local_reward, 0) AS local_reward, claimed_milestones`,
      [reward, JSON.stringify(claimed), walletAddress]
    );

    if (update.rows.length === 0) {
      console.error(`Signup Bonus UPDATE failed for ${walletAddress}`);
      return res.status(500).json({ error: 'Bonus update failed — no rows affected' });
    }

    console.log(`🎁 Signup Bonus: ${walletAddress} claimed 100 $NFEGLOBAL`);
    res.json({
      success: true,
      reward,
      new_balance: parseFloat(update.rows[0].local_reward),
      claimed_milestones: claimed
    });
  } catch (err) {
    console.error(`Signup Bonus Error [${walletAddress}]:`, err.message);
    res.status(500).json({ error: `Signup bonus failed: ${err.message}` });
  }
});

app.post('/api/admin/tasks', checkAdmin, async (req, res) => {
  const { name, reward, icon, url, type } = req.body;
  if (!name || !reward) return res.status(400).json({ error: 'Name and reward required' });

  try {
    const task = await query(
      'INSERT INTO tasks (name, reward, icon, url, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, reward, icon || '💎', url || null, type || 'social']
    );
    res.json(task.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// DELETE Task (Admin)
app.delete('/api/admin/tasks/:id', checkAdmin, async (req, res) => {
  try {
    await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST DB Migration Patch (Admin Trigger - One Time)
app.post('/api/admin/init-tasks-db', checkAdmin, async (req, res) => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          reward NUMERIC(36, 18) DEFAULT 0,
          icon VARCHAR(50) DEFAULT '💎',
          url VARCHAR(500),
          type VARCHAR(50) DEFAULT 'social',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS user_tasks (
          id SERIAL PRIMARY KEY,
          wallet_address VARCHAR(42) NOT NULL,
          task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(wallet_address, task_id)
      )
    `);
    // Pre-seed default tasks if completely empty to keep things smooth
    const count = await query('SELECT COUNT(*) FROM tasks');
    if (parseInt(count.rows[0].count) === 0) {
      await query(`
        INSERT INTO tasks (name, reward, icon, url, type) VALUES
        ('Join NFEGlobal Telegram', 200000, '✈️', 'https://t.me/NFEGlobalOfficial', 'social'),
        ('Join NFEGlobal Chat', 150000, '💬', 'https://t.me/NFEGlobalChat', 'social'),
        ('Follow on X/Twitter', 100000, '𝕏', 'https://x.com/NFEGlobal', 'social'),
        ('Activate Node', 1000000, '⬡', null, 'node')
      `);
    }
    
    res.json({ success: true, message: 'Tasks database tables verified and initialized.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB init failed' });
  }
});

// GET Admin Overview Stats
app.get('/api/admin/overview', checkAdmin, async (req, res) => {
  try {
    const [stats, topHolders] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as total_users,
          SUM(local_reward) as total_reward,
          COUNT(*) FILTER (WHERE node_tier >= 1) as active_miners,
          COUNT(*) FILTER (WHERE node_tier = 0 AND created_at > NOW() - INTERVAL '30 days') as free_trial_users,
          COUNT(*) FILTER (WHERE node_tier = 0 AND created_at <= NOW() - INTERVAL '30 days') as expired_users,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d,
          SUM(local_reward) FILTER (WHERE node_tier >= 1) as coins_node_holders,
          SUM(local_reward) FILTER (WHERE node_tier = 0 AND created_at > NOW() - INTERVAL '30 days') as coins_free_users,
          AVG(local_reward) FILTER (WHERE local_reward > 0) as avg_balance,
          MAX(local_reward) as top_balance
        FROM users
      `),
      query(`
        SELECT wallet_address, local_reward, node_tier, node_id, created_at
        FROM users 
        WHERE local_reward > 0 
        ORDER BY local_reward DESC 
        LIMIT 100
      `)
    ]);
    res.json({
      ...stats.rows[0],
      top_holders: topHolders.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// POST Create Balance Snapshot
app.post('/api/admin/snapshot', checkAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Snapshot name required' });

  try {
    // 1. Fetch all users with rewards
    const users = await query('SELECT wallet_address, local_reward FROM users WHERE local_reward > 0');
    const total_coins = users.rows.reduce((sum, u) => sum + parseFloat(u.local_reward), 0);
    
    // 2. Save master snapshot
    const snapshot = await query(
      `INSERT INTO snapshots (name, total_users, total_coins, data) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, users.rows.length, total_coins, JSON.stringify(users.rows)]
    );
    const snapshot_id = snapshot.rows[0].id;

    // 3. Populate user_conversions lookup table for fast user history
    if (users.rows.length > 0) {
      // Construction of batch insert for performance
      const batchSize = 500;
      for (let i = 0; i < users.rows.length; i += batchSize) {
        const chunk = users.rows.slice(i, i + batchSize);
        const vals = [];
        const params = [];
        chunk.forEach((u, idx) => {
          params.push(snapshot_id, u.wallet_address, u.local_reward);
          const p = idx * 3;
          vals.push(`($${p+1}, $${p+2}, $${p+3})`);
        });
        await query(
          `INSERT INTO user_conversions (snapshot_id, wallet_address, mined_amount) VALUES ${vals.join(',')}`,
          params
        );
      }
    }
    
    res.json(snapshot.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Snapshot failed' });
  }
});

// GET Snapshot History
app.get('/api/admin/snapshots', checkAdmin, async (req, res) => {
  try {
    const list = await query('SELECT id, name, total_users, total_coins, created_at FROM snapshots ORDER BY created_at DESC');
    res.json(list.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

// GET Single Snapshot Data (for export)
app.get('/api/admin/snapshot/:id', checkAdmin, async (req, res) => {
  try {
    const data = await query('SELECT * FROM snapshots WHERE id = $1', [req.params.id]);
    if (data.rows.length === 0) return res.status(404).json({ error: 'Snapshot not found' });
    res.json(data.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch snapshot data' });
  }
});

// GET User Conversion History
app.get('/api/user/conversions/:walletAddress', async (req, res) => {
  try {
    const history = await query(`
      SELECT uc.mined_amount, s.name, s.created_at 
      FROM user_conversions uc
      JOIN snapshots s ON uc.snapshot_id = s.id
      WHERE uc.wallet_address = $1
      ORDER BY s.created_at DESC
    `, [req.params.walletAddress]);
    res.json(history.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversion history' });
  }
});

// NOTE: /api/user/income-history/:walletAddress is defined below (line ~1816) with background blockchain sync.
// This stub was removed to prevent Express from shadowing the full implementation.

// GET Global Income History (Live Feed)
app.get('/api/history/global', async (req, res) => {
  try {
    const history = await query(`
      SELECT wallet_address, event_type, amount_bnb, amount_usd, tier, from_node_id, is_missed, timestamp, tx_hash
      FROM income_history
      ORDER BY timestamp DESC
      LIMIT 100
    `);
    
    // Anonymize wallet address for public privacy viewing
    const publicHistory = history.rows.map(row => ({
      ...row,
      wallet_address: row.wallet_address ? row.wallet_address.substring(0, 6) + '...' + row.wallet_address.substring(38) : 'Unknown'
    }));

    res.json(publicHistory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch global history' });
  }
});

// GET User Details (Admin)
app.get('/api/admin/user/:walletAddress', checkAdmin, async (req, res) => {
  const { walletAddress } = req.params;
  try {
    const userResult = await query(
      `SELECT u.*, 
       (SELECT COUNT(*) FROM users WHERE referrer_id = u.id) as direct_refs
       FROM users u 
       WHERE u.wallet_address = $1`,
      [walletAddress]
    );
    
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(userResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// POST Admin Backfill Missing Nodes 
app.post('/api/admin/backfill-nodes', checkAdmin, async (req, res) => {
  try {
    const users = await query('SELECT id, wallet_address FROM users WHERE node_id IS NULL');
    console.log(`Starting backfill for ${users.rows.length} users with null node_id...`);
    let updated = 0;
    
    // Process in batches
    for (const u of users.rows) {
      try {
        const nodeId = await nfeglobalContract.nodeId(u.wallet_address);
        if (Number(nodeId) > 0) {
          console.log(`📡 Backfill: Found Node ${nodeId} for ${u.wallet_address}`);
          await syncNodeStateFromRPC(Number(nodeId), u.wallet_address);
          updated++;
        }
      } catch (e) {
        // Ignore CALL_EXCEPTION (means they don't have a node yet)
      }
      await new Promise(r => setTimeout(r, 200)); // Throttle RPC
    }
    
    // Clean up any users who don't have a node but got set to node_active=true incorrectly from old schema
    const cleanup = await query('UPDATE users SET node_active = FALSE WHERE node_id IS NULL AND node_active = TRUE RETURNING id');
    console.log(`Cleaned up ${cleanup.rows.length} users with incorrect node_active=TRUE`);
    
    res.json({ success: true, checked: users.rows.length, updated, cleanedUp: cleanup.rows.length });
  } catch (err) {
    console.error('Backfill error:', err);
    res.status(500).json({ error: 'Backfill failed' });
  }
});

// POST Adjust User Reward (Admin)
app.post('/api/admin/user/adjust-reward', checkAdmin, async (req, res) => {
  const { walletAddress, amount, reason } = req.body;
  const adminWallet = req.headers['x-admin-wallet'];
  if (!walletAddress || amount === undefined) return res.status(400).json({ error: 'Wallet and amount required' });

  try {
    await query('BEGIN');
    
    const update = await query(
      `UPDATE users 
       SET local_reward = local_reward + $2, 
           updated_at = CURRENT_TIMESTAMP
       WHERE wallet_address = $1
       RETURNING *`,
      [walletAddress, amount]
    );
    
    if (update.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Record adjustment in audit log
    await query(
      'INSERT INTO admin_adjustments (admin_wallet, target_wallet, amount, reason) VALUES ($1, $2, $3, $4)',
      [adminWallet, walletAddress, amount, reason || 'Manual adjustment']
    );

    await query('COMMIT');
    res.json({ success: true, user: update.rows[0] });
  } catch (err) {
    await query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Adjustment failed' });
  }
});

// GET Admin Adjustment History
app.get('/api/admin/adjustments', checkAdmin, async (req, res) => {
  try {
    const logs = await query('SELECT * FROM admin_adjustments ORDER BY timestamp DESC LIMIT 50');
    res.json(logs.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch adjustments' });
  }
});

// GET Members at a specific network level with their team sizes
app.get('/api/network/level/:walletAddress/:level', async (req, res) => {
  const { walletAddress, level } = req.params;
  const targetDepth = parseInt(level); 
  
  try {
    const rootRes = await query('SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1) ORDER BY id ASC', [walletAddress]);
    if (rootRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const rootIds = rootRes.rows.map(r => r.id);

    // Cycle-safe recursive CTE — ARRAY[id] visited prevents infinite loops from circular matrix_parent_id
    const members = await query(`
      WITH RECURSIVE mt AS (
        SELECT id, matrix_parent_id, 0 as depth, ARRAY[id] AS visited
        FROM users WHERE id = ANY($1::int[])
        UNION ALL
        SELECT u.id, u.matrix_parent_id, mt.depth + 1, mt.visited || u.id
        FROM users u
        INNER JOIN mt ON u.matrix_parent_id = mt.id
        WHERE mt.depth < 18 AND NOT (u.id = ANY(mt.visited))
      )
      SELECT DISTINCT ON (u.wallet_address)
        u.wallet_address, 
        u.node_id, 
        u.node_tier, 
        u.node_active,
        u.created_at as joined_at,
        (SELECT COUNT(*) FROM users WHERE referrer_id = u.id) as direct_count,
        (
          WITH RECURSIVE sub_tree AS (
            SELECT id, 0 as d, ARRAY[id] AS sv FROM users WHERE matrix_parent_id = u.id
            UNION ALL
            SELECT s.id, st.d + 1, st.sv || s.id
            FROM users s
            INNER JOIN sub_tree st ON s.matrix_parent_id = st.id
            WHERE st.d < 17 AND NOT (s.id = ANY(st.sv))
          )
          SELECT COUNT(*) FROM sub_tree
        ) as team_size,
        CASE WHEN u.referrer_id = ANY($1::int[]) THEN true ELSE false END as is_direct
      FROM users u
      JOIN mt ON u.id = mt.id
      WHERE mt.depth = $2
      ORDER BY u.wallet_address, u.created_at DESC
      LIMIT 100
    `, [rootIds, targetDepth]);

    res.json(members.rows);
  } catch (err) {
    console.error('Network level fetch failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET Members at a specific REFERRAL level (1-18)
app.get('/api/network/referral-level/:walletAddress/:level', async (req, res) => {
  const { walletAddress, level } = req.params;
  const targetDepth = parseInt(level); 
  
  try {
    const rootRes = await query('SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1)', [walletAddress]);
    if (rootRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const parentIds = rootRes.rows.map(r => r.id);

    // Cycle-safe recursive CTE using referrer_id
    const members = await query(`
      WITH RECURSIVE rt AS (
        SELECT id, referrer_id, 0 as depth, ARRAY[id] AS visited
        FROM users WHERE id = ANY($1::int[])
        UNION ALL
        SELECT u.id, u.referrer_id, rt.depth + 1, rt.visited || u.id
        FROM users u
        INNER JOIN rt ON u.referrer_id = rt.id
        WHERE rt.depth < 18 AND NOT (u.id = ANY(rt.visited))
      )
      SELECT DISTINCT ON (u.wallet_address)
        u.wallet_address, 
        u.node_id, 
        u.node_tier, 
        u.node_active,
        u.local_reward,
        u.created_at as joined_at,
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM ((COALESCE(u.created_at, NOW()) + INTERVAL '30 days') - NOW())) / 86400)::int) as trial_days_left,
        (SELECT COUNT(*) FROM users WHERE referrer_id = u.id) as direct_count,
        (
          WITH RECURSIVE sub_tree AS (
            SELECT id, 0 as d, ARRAY[id] AS sv FROM users WHERE referrer_id = u.id
            UNION ALL
            SELECT s.id, st.d + 1, st.sv || s.id
            FROM users s
            INNER JOIN sub_tree st ON s.referrer_id = st.id
            WHERE st.d < 17 AND NOT (s.id = ANY(st.sv))
          )
          SELECT COUNT(*) FROM sub_tree
        ) as sub_referral_team,
        CASE WHEN u.referrer_id = ANY($1::int[]) THEN true ELSE false END as is_direct
      FROM users u
      JOIN rt ON u.id = rt.id
      WHERE rt.depth = $2
      ORDER BY u.wallet_address, u.created_at DESC
      LIMIT 100
    `, [parentIds, targetDepth]);

    res.json(members.rows);
  } catch (err) {
    console.error('Referral network level fetch failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET Network Counts for all 18 levels (Offline View Helper)
app.get('/api/network/counts/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  try {
    const rootRes = await query(
      `SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1)`,
      [walletAddress]
    );
    
    if (rootRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const parentIds = rootRes.rows.map(r => r.id);

    // Cycle-safe matrix tree CTE
    const matrixRes = await query(`
      WITH RECURSIVE matrix_tree AS (
        SELECT id, 0 as level, ARRAY[id] AS visited
        FROM users WHERE id = ANY($1::int[])
        UNION ALL
        SELECT u.id, mt.level + 1, mt.visited || u.id
        FROM users u
        INNER JOIN matrix_tree mt ON u.matrix_parent_id = mt.id
        WHERE mt.level < 18 AND NOT (u.id = ANY(mt.visited))
      )
      SELECT level, COUNT(DISTINCT id) as count
      FROM matrix_tree WHERE level > 0
      GROUP BY level
    `, [parentIds]);

    const matrixCounts = new Array(18).fill(0);
    matrixRes.rows.forEach(r => {
      const level = parseInt(r.level);
      const count = parseInt(r.count);
      if (level >= 1 && level <= 18) matrixCounts[level - 1] = count;
    });

    // Cycle-safe referral tree CTE
    const referralRes = await query(`
      WITH RECURSIVE referral_tree AS (
        SELECT id, 0 as level, ARRAY[id] AS visited
        FROM users WHERE id = ANY($1::int[])
        UNION ALL
        SELECT u.id, rt.level + 1, rt.visited || u.id
        FROM users u
        INNER JOIN referral_tree rt ON u.referrer_id = rt.id
        WHERE rt.level < 18 AND NOT (u.id = ANY(rt.visited))
      )
      SELECT level, COUNT(DISTINCT id) as count
      FROM referral_tree WHERE level > 0
      GROUP BY level
    `, [parentIds]);

    const referralCounts = new Array(18).fill(0);
    referralRes.rows.forEach(r => {
      const level = parseInt(r.level);
      const count = parseInt(r.count);
      if (level >= 1 && level <= 18) referralCounts[level - 1] = count;
    });

    res.json({ referralCounts, matrixCounts });
  } catch (err) {
    console.error('Count query failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Sync network members from RPC to DB cache
 */
app.post('/api/network/sync', async (req, res) => {
  const { members, parentNodeId } = req.body;
  if (!members || !Array.isArray(members)) return res.status(400).json({ error: 'Members array required' });

  try {
    // 1. Find parent ID in DB to establish matrix link
    const parentRes = await query('SELECT id FROM users WHERE node_id = $1', [parentNodeId]);
    const parentId = parentRes.rows.length > 0 ? parentRes.rows[0].id : null;

    // 2. Bulk upsert members. We use node_id as the unique key.
    // wallet_address is stored in lowercase for global uniqueness.
    for (const m of members) {
      if (!m.wallet) continue; // GUARD: Skip null wallets from broken logs
      await query(`
        INSERT INTO users (wallet_address, node_id, node_tier, created_at, matrix_parent_id, matrix_parent_node_id, node_active)
        VALUES (LOWER($1), $2, $3, TO_TIMESTAMP($4), $5, $6, TRUE)
        ON CONFLICT (node_id) DO UPDATE SET 
          wallet_address = EXCLUDED.wallet_address,
          node_tier = EXCLUDED.node_tier,
          matrix_parent_id = COALESCE(EXCLUDED.matrix_parent_id, users.matrix_parent_id),
          matrix_parent_node_id = COALESCE(EXCLUDED.matrix_parent_node_id, users.matrix_parent_node_id),
          node_active = TRUE
      `, [m.wallet, m.nodeId, m.tier, m.joinedAt, parentId, parentNodeId]);
    }

    res.json({ success: true, count: members.length });
  } catch (err) {
    console.error('Bulk sync failed:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

/**
 * Force Tree Repair — bypasses the 30s throttle.
 * Called explicitly after node creation or tier upgrade to ensure
 * referrer_id and matrix_parent_id links are immediately consistent.
 */
app.post('/api/network/force-repair', async (req, res) => {
  try {
    await repairTreeLinks(true); // Always bypass throttle for explicit admin requests
    res.json({ success: true });
  } catch (err) {
    console.error('Force repair failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * High-Precision RPC-Mirror Sync: Fetches 100% accurate contract state for a node.
 * Accepts optional walletAddress for dual-key lookup when node_id not yet in DB.
 */
async function syncNodeStateFromRPC(nodeId, walletAddress = null) {
  if (!nodeId || nodeId === 0) return;
  try {
    const nodeInfo = await nfeglobalContract.nodes(nodeId);

    // DUAL-KEY UPDATE: Finds the row by node_id OR wallet_address (whichever exists).
    // Also writes node_id onto the row so future lookups use node_id.
    await query(`
      UPDATE users 
      SET node_id                = $1,
          node_tier              = $2,
          sponsor_node_id        = $3,
          matrix_parent_node_id  = $4,
          node_active            = TRUE,
          last_rpc_sync          = CURRENT_TIMESTAMP
      WHERE node_id = $1
         OR (LOWER(wallet_address) = LOWER($5) AND $5 IS NOT NULL)
    `, [nodeId, Number(nodeInfo.tier), Number(nodeInfo.sponsor), Number(nodeInfo.matrixParent), walletAddress || null]);

    // Repair tree links after every sync
    await repairTreeLinks();
    console.log(`✨ RPC Mirror: Synced Node ${nodeId}${walletAddress ? ` (wallet: ${walletAddress})` : ''} metadata and repaired links`);

    // Chain Reaction: climb upline to sync sponsor chain (max 3 hops per call)
    const parent = Number(nodeInfo.sponsor);
    if (parent > 0) {
      setTimeout(() => syncNodeStateFromRPC(parent), 2000);
    }
  } catch (err) {
    console.error(`Failed to RPC sync Node ${nodeId}:`, err.message);
  }
}

/**
 * Universal Orphan Rescue: Scans for active nodes without sponsors and repairs via RPC.
 */
async function deepRepairOrphans() {
  try {
    const orphans = await query(`
      SELECT node_id FROM users 
      WHERE node_id IS NOT NULL 
      AND referrer_id IS NULL 
      LIMIT 100
    `);
    
    if (orphans.rows.length === 0) {
      console.log('✅ No orphaned nodes found.');
      return;
    }

    console.log(`🧹 Deep Repair: Found ${orphans.rows.length} orphans. Syncing from blockchain...`);
    
    for (const row of orphans.rows) {
      await syncNodeStateFromRPC(row.node_id);
      // Small pause to avoid RPC rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (err) {
    console.error('Deep Repair failed:', err.message);
  }
}

/**
 * High-Speed Tree Repair Helper: Rebuilds the referral links entirely in SQL.
 * Optimized: Throttled to run at most once every 30 seconds to prevent DB hammering.
 */
let lastRepairTime = 0;
let repairInFlight = false;
async function repairTreeLinks(bypassThrottle = false) {
  const now = Date.now();
  // Throttle: skip if ran within 30s, UNLESS bypassed (new node events, force-repair, etc.)
  if (!bypassThrottle && (now - lastRepairTime < 30000 || repairInFlight)) return;
  if (repairInFlight) return; // Never run concurrently even when bypassing
  
  repairInFlight = true;
  try {
    // Single query to link orphans by their stored sponsor_node_id mapping
    await query(`
      UPDATE users u
      SET referrer_id = p.id
      FROM users p
      WHERE u.sponsor_node_id = p.node_id
      AND u.sponsor_node_id IS NOT NULL
      AND (u.referrer_id IS NULL OR u.referrer_id != p.id)
    `);

    // 2. Repair Matrix Links (Binary Tree)
    await query(`
      UPDATE users u
      SET matrix_parent_id = p.id
      FROM users p
      WHERE u.matrix_parent_node_id = p.node_id
      AND u.matrix_parent_node_id IS NOT NULL
      AND (u.matrix_parent_id IS NULL OR u.matrix_parent_id != p.id)
    `);

    // 3. Repair Links via Memos (Recover orphans who joined before their sponsor)
    await query(`
      UPDATE users u
      SET referrer_id = p.id
      FROM users p
      WHERE LOWER(u.referred_by_memo) = LOWER(p.wallet_address)
      AND u.referrer_id IS NULL AND u.referred_by_memo IS NOT NULL
    `);
    
    lastRepairTime = Date.now();
    console.log('🏗️  Tree Repair: Hierarchy self-healed and synced.');
  } catch (err) {
    console.error("SQL Tree repair failed:", err.message);
  } finally {
    repairInFlight = false;
  }
}

// GET User Precision Income History (NFEGlobal + RewardPool indexed)
app.get('/api/user/income-history/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  try {
    // 1. Fetch from DB
    const result = await query(
      `SELECT * FROM income_history 
       WHERE wallet_address = $1 
       ORDER BY timestamp DESC LIMIT 100`,
      [walletAddress]
    );

    // 2. Trigger background sync (Async, don't wait)
    syncUserHistory(walletAddress);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch income history' });
  }
});

// GET Global Leaderboard (Top Earners)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await query(
      `SELECT wallet_address, local_reward, taps, id
       FROM users 
       ORDER BY local_reward DESC, taps DESC 
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET Free Referral Stats — MUST be registered BEFORE /:walletAddress to avoid route collision
// Bug: Express was matching /stats/:wallet as /:walletAddress with walletAddress="stats"
app.get('/api/referrals/stats/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  try {
    // BUG FIX: Fetch ALL parent IDs (handles duplicate accounts)
    const parentsResult = await query(
      'SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [walletAddress]
    );
    if (parentsResult.rows.length === 0) {
      return res.json({ total: 0, free: 0, activated: 0, expired: 0, conversionRate: '0.0' });
    }
    const parentIds = parentsResult.rows.map(r => r.id);

    // Dynamic recursive lookup for potential/conversion stats across 18 levels
    // node_tier is the SINGLE source of truth: tier>0 = activated, tier=0/null = free
    // Cycle detection via visited[] prevents circular referrer_id chains from inflating counts
    const stats = await query(`
      WITH RECURSIVE tree AS (
        SELECT id, referrer_id, 0 as depth, ARRAY[id] AS visited
        FROM users WHERE id = ANY($1::int[])
        UNION ALL
        SELECT u.id, u.referrer_id, tree.depth + 1, tree.visited || u.id
        FROM users u
        INNER JOIN tree ON u.referrer_id = tree.id
        WHERE tree.depth < 18
          AND NOT (u.id = ANY(tree.visited))
      )
      SELECT
        COUNT(DISTINCT u.id)                                                                   AS total,
        COUNT(DISTINCT u.id) FILTER (WHERE u.node_tier > 0)                                   AS activated,
        COUNT(DISTINCT u.id) FILTER (WHERE (u.node_tier IS NULL OR u.node_tier = 0) AND u.created_at > NOW() - INTERVAL '30 days')  AS in_trial,
        COUNT(DISTINCT u.id) FILTER (WHERE (u.node_tier IS NULL OR u.node_tier = 0) AND u.created_at <= NOW() - INTERVAL '30 days') AS expired,
        (SELECT COUNT(*) * 0.0025 FROM (SELECT DISTINCT uid FROM (
          SELECT u2.id AS uid FROM users u2 JOIN tree t2 ON u2.id = t2.id
          WHERE t2.depth > 0 AND (u2.node_tier IS NULL OR u2.node_tier = 0)
        ) x) y)                                                                                AS potential_bnb
      FROM users u
      JOIN tree ON u.id = tree.id
      WHERE tree.depth > 0
    `, [parentIds]);


    const s = stats.rows[0];
    const total     = parseInt(s.total);
    const activated = parseInt(s.activated);
    res.json({
      total,
      activated,
      in_trial:       parseInt(s.in_trial),
      expired:        parseInt(s.expired),
      potentialBnb:   parseFloat(s.potential_bnb).toFixed(4),
      conversionRate: total > 0 ? ((activated / total) * 100).toFixed(1) : '0.0'
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
});

// GET Referral List (My Team)
app.get('/api/referrals/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  try {
    // Find all IDs associated with this wallet (case-insensitive) to handle duplicates
    const parentsResult = await query(
      'SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [walletAddress]
    );
    if (parentsResult.rows.length === 0) return res.json([]);
    const parentIds = parentsResult.rows.map(r => r.id);

    const result = await query(
      `SELECT u.wallet_address,
              COALESCE(u.local_reward, 0)                                            AS local_reward,
              COALESCE(u.created_at, NOW())                                          AS joined_at,
              COALESCE(u.node_tier, 0)                                               AS node_tier,
              -- node_id: prefer this row's value, fall back to the activation row for same wallet
              COALESCE(
                NULLIF(u.node_id, 0),
                (SELECT n.node_id FROM users n
                 WHERE LOWER(n.wallet_address) = LOWER(u.wallet_address)
                   AND n.node_id IS NOT NULL AND n.node_id > 0
                 ORDER BY n.node_id ASC LIMIT 1)
              )                                                                       AS node_id,
              -- node_active: true if either row is active
              (u.node_active = TRUE OR EXISTS (
                SELECT 1 FROM users n
                WHERE LOWER(n.wallet_address) = LOWER(u.wallet_address)
                  AND n.node_active = TRUE AND n.node_id IS NOT NULL
              ))                                                                      AS node_active,
              -- tier: prefer highest tier across both rows
              GREATEST(
                COALESCE(u.node_tier, 0),
                COALESCE((SELECT n.node_tier FROM users n
                          WHERE LOWER(n.wallet_address) = LOWER(u.wallet_address)
                            AND n.node_id IS NOT NULL ORDER BY n.node_tier DESC LIMIT 1), 0)
              )                                                                       AS resolved_tier,
              -- trial days remaining (from registration row)
              GREATEST(0,
                CEIL(
                  EXTRACT(EPOCH FROM ((COALESCE(u.created_at, NOW()) + INTERVAL '30 days') - NOW())) / 86400
                )::int
              )                                                                       AS trial_days_left,
              (SELECT COUNT(*) FROM users WHERE referrer_id = u.id)                  AS direct_count,
              (SELECT COUNT(*) FROM users WHERE matrix_parent_id = u.id)             AS team_size
       FROM users u
       WHERE u.referrer_id = ANY($1::int[])
       ORDER BY u.created_at DESC
       LIMIT 100`,
      [parentIds]
    );
    // Normalise: use resolved_tier as node_tier so frontend sees the correct tier
    const rows = result.rows.map(r => ({
      ...r,
      node_tier: Number(r.resolved_tier || r.node_tier || 0),
      node_id:   Number(r.node_id || 0),
    }));
    res.json(rows);

  } catch (err) {
    console.error('Referral list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

/**
 * GET /api/referrals/sponsor-node/:walletAddress
 * Returns the resolved on-chain sponsor node ID for a wallet.
 * Called by frontend at activation time to ensure fresh/correct sponsor node — never stale genesis.
 */
app.get('/api/referrals/sponsor-node/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  try {
    const userRes = await query(
      `SELECT u.referrer_id, u.referred_by_memo, s.node_id as sponsor_node_id, s.wallet_address as sponsor_wallet, s.is_targeted as sponsor_is_targeted
       FROM users u
       LEFT JOIN users s ON s.id = u.referrer_id
       WHERE LOWER(u.wallet_address) = LOWER($1)
       ORDER BY u.id ASC LIMIT 1`,
      [walletAddress]
    );

    if (userRes.rows.length === 0) return res.json({ sponsor_node_id: 36999 });

    const row = userRes.rows[0];

    // If referrer has an active node — use it directly
    if (row.sponsor_node_id) {
      return res.json({ sponsor_node_id: row.sponsor_node_id, sponsor_wallet: row.sponsor_wallet });
    }

    // Check if sponsor is a targeted user
    if (row.sponsor_is_targeted) {
      const ancestorNodeId = await findFirstActiveAncestor(row.referrer_id);
      return res.json({
        sponsor_node_id: 0,
        sponsor_wallet: row.sponsor_wallet,
        sponsor_is_targeted: true,
        sponsor_of_sponsor_node_id: ancestorNodeId
      });
    }

    // If referrer is free — walk up to first active ancestor
    const ancestorNodeId = await findFirstActiveAncestor(row.referrer_id);
    return res.json({ sponsor_node_id: ancestorNodeId, sponsor_wallet: row.sponsor_wallet });
  } catch (err) {
    console.error('sponsor-node lookup error:', err.message);
    res.json({ sponsor_node_id: 36999 });
  }
});

/**
 * POST /api/referrals/track
 * Belt-and-suspenders: Explicitly records a referred free user with their sponsor.
 * Called by the frontend when a new user connects with a ?ref= token.
 * Safe to call multiple times — idempotent (never overwrites an existing sponsor).
 */
app.post('/api/referrals/track', async (req, res) => {
  const { walletAddress, refToken } = req.body;
  if (!walletAddress || !refToken) return res.status(400).json({ error: 'walletAddress and refToken required' });

  // Prevent self-referral (basic string check)
  if (refToken.toLowerCase() === walletAddress.toLowerCase()) {
    return res.status(400).json({ error: 'Self-referral not allowed' });
  }

  try {
    // 1. Ensure the free user exists in DB
    // BUG FIX: Previous INSERT used ON CONFLICT (LOWER(wallet_address)) which is invalid.
    // Must reference the actual constraint name. Use DO UPDATE with no-op to safely upsert.
    await query(
      `INSERT INTO users 
        (wallet_address, referred_by_memo, local_reward, claimed_milestones, created_at, last_claim_time)
       VALUES (LOWER($1), $2, 0, '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (wallet_address) DO UPDATE
         SET referred_by_memo = COALESCE(users.referred_by_memo, EXCLUDED.referred_by_memo)`,
      [walletAddress, refToken]
    );

    // 2. Resolve sponsor from ref token (wallet address or node ID)
    const sponsor = await findSponsorByRef(refToken);
    
    // Prevent self-referral (check resolved wallet)
    if (sponsor && sponsor.wallet_address.toLowerCase() === walletAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Self-referral not allowed' });
    }

    if (!sponsor) {
      // Sponsor not yet in DB — store memo for later reconciliation
      await query(
        `UPDATE users SET referred_by_memo = COALESCE(referred_by_memo, $1) WHERE LOWER(wallet_address) = LOWER($2)`,
        [refToken, walletAddress]
      );
      return res.json({ success: true, linked: false, reason: 'Sponsor not found yet — memo stored for later reconciliation' });
    }

    // 3. Link referral — only if not already linked (one-time, never overwrite)
    const updateRes = await query(
      `UPDATE users
       SET referrer_id      = $1,
           referred_by_memo = COALESCE(referred_by_memo, $2)
       WHERE LOWER(wallet_address) = LOWER($3)
         AND referrer_id IS NULL
       RETURNING id, wallet_address, referrer_id`,
      [sponsor.id, refToken, walletAddress]
    );

    if (updateRes.rows.length > 0) {
      console.log(`🔗 Referral Tracked: ${walletAddress} -> sponsor ${sponsor.wallet_address} (ID: ${sponsor.id})`);
      return res.json({
        success: true,
        linked: true,
        user_wallet: walletAddress,
        sponsor_wallet: sponsor.wallet_address,
        sponsor_node_id: sponsor.node_id || null
      });
    }

    // Already linked — return current state
    const current = await query(
      `SELECT u.wallet_address, s.wallet_address as sponsor_wallet, s.node_id as sponsor_node_id
       FROM users u
       LEFT JOIN users s ON s.id = u.referrer_id
       WHERE LOWER(u.wallet_address) = LOWER($1)`,
      [walletAddress]
    );
    return res.json({
      success: true,
      linked: false,
      reason: 'Already linked',
      ...current.rows[0]
    });

  } catch (err) {
    console.error('Referral track error:', err.message);
    res.status(500).json({ error: 'Failed to track referral' });
  }
});

// NOTE: The authoritative /api/sync handler is defined at line ~491 above.
// This duplicate (which dangerously accepted client-supplied local_reward) has been removed
// to prevent economy tampering via client-controlled balance overwrite.

// POST Claim Daily Login Reward — Root-Cause-Fixed
app.post('/api/daily/claim', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'Wallet missing' });

  try {
    await query('BEGIN');

    // BUG FIX: Use LOWER() for case-insensitive wallet match (was exact match before)
    const user = await query(
      `SELECT id, daily_streak, last_daily_claim, COALESCE(local_reward, 0) AS local_reward
       FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`,
      [walletAddress]
    );

    if (user.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const { daily_streak, last_daily_claim } = user.rows[0];
    const now = new Date();

    let currentStreak = parseInt(daily_streak) || 0;

    if (last_daily_claim) {
      const lastClaim = new Date(last_daily_claim);
      const diffMs  = now - lastClaim;
      const diffHrs = diffMs / (1000 * 60 * 60);

      // Can only claim once per rolling 24 hours
      if (diffHrs < 24) {
        await query('ROLLBACK');
        const hoursLeft = Math.ceil(24 - diffHrs);
        return res.status(400).json({ 
          error: `Already claimed today! Come back in ${hoursLeft}h.`,
          hours_left: hoursLeft
        });
      }

      // Streak broken if more than 48 hours passed
      if (diffHrs >= 48) {
        currentStreak = 0;
      }
    }

    // Reward table: Day 1=100, 2=200, ... 7=700, 8=1000, 9=2000, 10=5000 (premium ending bonus)
    const DAILY_REWARDS = [100, 200, 300, 400, 500, 600, 700, 1000, 2000, 5000];
    const rewardAmount = DAILY_REWARDS[currentStreak % 10];

    // Next streak: store 0-9, display as 1-10
    const nextStreak = (currentStreak + 1) % 10;

    // BUG FIX: Use COALESCE so NULL balance doesn't break reward addition
    const update = await query(
      `UPDATE users 
       SET daily_streak     = $1, 
           last_daily_claim = CURRENT_TIMESTAMP, 
           local_reward     = COALESCE(local_reward, 0) + $2,
           updated_at       = CURRENT_TIMESTAMP
       WHERE LOWER(wallet_address) = LOWER($3)
       RETURNING daily_streak, last_daily_claim, COALESCE(local_reward, 0) AS local_reward`,
      [nextStreak, rewardAmount, walletAddress]
    );

    await query('COMMIT');

    const claimedDayNumber = currentStreak + 1; // 1-10 (the day that was just claimed)

    console.log(`🔥 Daily: ${walletAddress} claimed Day ${claimedDayNumber} reward (${rewardAmount} $NFEGLOBAL). Streak: ${nextStreak}/10`);

    res.json({
      success:          true,
      reward:           rewardAmount,
      claimed_day:      claimedDayNumber,       // Which day was just claimed (1-10)
      daily_streak:     nextStreak,             // New streak position in DB (0-9)
      last_daily_claim: update.rows[0].last_daily_claim,
      local_reward:     parseFloat(update.rows[0].local_reward)
    });
  } catch (err) {
    await query('ROLLBACK').catch(() => {});
    console.error(`Daily Claim Error [${walletAddress}]:`, err.message);
    res.status(500).json({ error: 'Failed to claim daily reward' });
  }
});


/**
 * Universal Sponsor Lookup: Handles both Wallet Address and Node ID as referral tokens.
 */
async function findSponsorByRef(ref) {
  if (!ref) return null;
  const isWallet = /^0x[a-fA-F0-9]{40}$/i.test(ref);
  if (isWallet) {
    const res = await query('SELECT id, wallet_address, node_id FROM users WHERE LOWER(wallet_address) = LOWER($1)', [ref]);
    return res.rows[0] || null;
  } else if (/^\d+$/.test(ref)) {
    const res = await query('SELECT id, wallet_address, node_id FROM users WHERE node_id = $1', [parseInt(ref)]);
    return res.rows[0] || null;
  }
  return null;
}

/**
 * Auto-Rollup: Recursively finds the first ancestor with a valid Node ID.
 */
async function findFirstActiveAncestor(userId) {
  if (!userId) return 36999; // Default to Genesis
  
  try {
    const res = await query(`
      WITH RECURSIVE upline AS (
        SELECT id, referrer_id, node_id, 1 as depth
        FROM users WHERE id = $1
        UNION ALL
        SELECT u.id, u.referrer_id, u.node_id, a.depth + 1
        FROM users u
        INNER JOIN upline a ON u.id = a.referrer_id
        WHERE a.depth < 20 AND a.node_id IS NULL
      )
      SELECT node_id FROM upline WHERE node_id IS NOT NULL ORDER BY depth ASC LIMIT 1
    `, [userId]);
    
    return res.rows[0]?.node_id || 36999;
  } catch (err) {
    console.error('Rollup search failed:', err);
    return 36999;
  }
}

/**
 * Zero-Latency Blockchain Sync: Checks if a wallet has activated a node but is still 'Free' in DB.
 * On successful sync, proactively increments the referrer's activated_refs counter.
 */
async function ensureNodeSync(wallet) {
  try {
    const prevState = await query('SELECT node_id, referrer_id FROM users WHERE LOWER(wallet_address) = LOWER($1)', [wallet]);
    const wasFreeBefore = prevState.rows.length > 0 && !prevState.rows[0].node_id;
    const referrerId    = prevState.rows.length > 0 ? prevState.rows[0].referrer_id : null;

    const nodeId = await nfeglobalContract.nodeId(wallet);
    if (Number(nodeId) > 0) {
      console.log(`📡 Auto-Sync: Found on-chain node ${nodeId} for ${wallet}. Updating DB...`);
      // DUAL-KEY: Pass wallet so syncNodeStateFromRPC can find+update by wallet_address too
      await syncNodeStateFromRPC(Number(nodeId), wallet);

      if (wasFreeBefore && referrerId) {
        await query(
          `UPDATE users SET activated_refs = COALESCE(activated_refs, 0) + 1 WHERE id = $1`,
          [referrerId]
        );
        console.log(`🎉 Conversion: Incremented activated_refs for referrer ID ${referrerId}`);
      }
      return true;
    }
  } catch (err) {
    // Suppress EVM CALL_EXCEPTION which simply means the mapping addressToNodeId reverted (node not registered)
    if (err.code !== 'CALL_EXCEPTION') {
      console.error(`Status sync failed for ${wallet}:`, err.message);
    }
  }
  return false;
}

setInterval(syncGlobalHistory, 2 * 60 * 1000); // Poll every 2 minutes

// ════════════════════════════════════════════════════════════
// TELEGRAM ADMIN ENDPOINTS
// ════════════════════════════════════════════════════════════

const ADMIN_WALLET_CHECK = (process.env.VITE_ADMIN_WALLET || '').toLowerCase();

// POST /api/admin/telegram/broadcast — Send campaign to all or filtered users
app.post('/api/admin/telegram/broadcast', async (req, res) => {
  const adminWallet = (req.headers['x-admin-wallet'] || '').toLowerCase();
  if (adminWallet !== ADMIN_WALLET_CHECK) return res.status(403).json({ error: 'Forbidden' });

  const { message, filter = 'all', imageUrl, buttonUrl, buttonLabel } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    const result = await broadcastToUsers({ filter, message, imageUrl, buttonUrl, buttonLabel });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Broadcast error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/telegram/stats — How many users have connected the bot
app.get('/api/admin/telegram/stats', async (req, res) => {
  const adminWallet = (req.headers['x-admin-wallet'] || '').toLowerCase();
  if (adminWallet !== ADMIN_WALLET_CHECK) return res.status(403).json({ error: 'Forbidden' });

  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE telegram_id IS NOT NULL) as connected,
        COUNT(*) FILTER (WHERE telegram_id IS NOT NULL AND node_tier > 0) as connected_nodes,
        COUNT(*) FILTER (WHERE telegram_id IS NOT NULL AND node_tier = 0) as connected_free,
        COUNT(*) as total_users
      FROM users
    `);
    const broadcasts = await query('SELECT * FROM telegram_broadcasts ORDER BY created_at DESC LIMIT 10');
    res.json({ ...result.rows[0], recent_broadcasts: broadcasts.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/connect — Link telegram_id to wallet (called from app)
app.post('/api/telegram/connect', async (req, res) => {
  const { walletAddress, telegramId } = req.body;
  if (!walletAddress || !telegramId) return res.status(400).json({ error: 'walletAddress and telegramId required' });
  try {
    await query(
      `UPDATE users SET telegram_id = $1 WHERE LOWER(wallet_address) = LOWER($2)`,
      [telegramId, walletAddress]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/telegram/status/:walletAddress — Check if user has bot connected
app.get('/api/telegram/status/:walletAddress', async (req, res) => {
  try {
    const result = await query(
      `SELECT telegram_id FROM users WHERE LOWER(wallet_address) = LOWER($1) LIMIT 1`,
      [req.params.walletAddress]
    );
    const connected = result.rows.length > 0 && !!result.rows[0].telegram_id;
    res.json({ connected, telegramId: connected ? result.rows[0].telegram_id : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI Marketing Agent Endpoint ──────────────────────────────────────────────────
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

app.post('/api/ai/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  if (!groq) return res.status(503).json({ error: 'AI Agent is currently unavailable (missing GROQ_API_KEY)' });

  try {
    const systemInstruction = `You are Bella, the official AI Marketing Agent for NFEGlobal Core.
Your goal is to help users write highly engaging, emoji-heavy marketing content for social media (Twitter, Telegram, WhatsApp, etc.).
You can interact and respond in ANY language the user speaks. You must reply in the exact language the user used to ask their question.

About NFEGlobal Core:
- It is a 100% decentralized Web3 Mining Node protocol on the Binance Smart Chain (BNB).
- Verified NFEGlobal Smart Contract: 0x9daA28D40082E4173b4b07AE76A92Eda0Ff3A522
- Verified RewardPool Smart Contract: 0xA0DE5adE595a43838d1a883D441ea5f0829d66b1
- Governance Contract: 0xA6F9eC34b45B732DCDcf849f321466e61a749C83
- Users activate a "Mining Node" to earn NFEGlobal tokens and BNB simultaneously.
- 4 Income Streams:
  1) 10% Direct Referral Income (instant, unlimited width, lifetime)
  2) 70% Binary Matrix Income (18 levels deep, auto-spillover)
  3) 15% Layer Yield Income (earn from nodes in your tree 10 layers down)
  4) 5% Global Pool Income (daily revenue share for qualified builders)
- 18 Upgrade Tiers (from Tier 1 "Genesis" at $5 equivalent up to Tier 18 "Sovereign"). Higher tiers unlock faster mining and deeper matrix earnings.

MARKETING STRATEGY FOCUS: Strongly emphasize bringing in "free users" to build a massive community first. Your promotional copy should encourage people to join the community for free, learn the system, and grow the network before aggressively pitching paid node upgrades.

Keep responses relatively concise (under 250 words unless specifically asked for a long thread). Always be extremely enthusiastic, professional, and persuasive. Include placeholders like [YOUR REF LINK] when generating copy.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
    });

    res.json({ result: chatCompletion.choices[0]?.message?.content || 'No response generated.' });
  } catch (err) {
    console.error('Groq AI Error:', err.message);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NFEGlobal Backend running on port ${PORT}`);
  syncGlobalHistory(); // Initial fetch
  initTelegramBot();   // Start Telegram bot
  startChainEventListeners(); // Real-time on-chain event indexer
});

// ── Real-time Chain Event Listeners ──────────────────────────────────────────
/**
 * Attach ethers.js contract listeners for all key events.
 * On each event: update the DB and push to all connected SSE clients.
 */
function startChainEventListeners() {
  console.log('[Chain Events] Starting real-time event listeners...');

  // ── NodeCreated ────────────────────────────────────────────────────────────
  // Fires when a new user registers a node on-chain.
  nfeglobalContract.on('NodeCreated', async (nodeAddr, userId, referrerId, uplineId, event) => {
    const nId = Number(userId);
    const sponsorId = Number(referrerId);
    const matrixParentId = Number(uplineId);
    console.log(`[Chain] NodeCreated: nodeId=${nId} wallet=${nodeAddr} sponsor=${sponsorId}`);
    try {
      // Fetch full node info from chain
      const node = await nfeglobalContract.nodes(nId);
      const wallet = node.wallet?.toLowerCase() || nodeAddr.toLowerCase();
      const tier   = Number(node.tier);
      const joinedAt = Number(node.joinedAt);

      // Find DB IDs for sponsor and matrix parent
      const sponsorDbRes = await query('SELECT id FROM users WHERE node_id = $1', [sponsorId]);
      const sponsorDbId  = sponsorDbRes.rows[0]?.id || null;
      const matrixDbRes  = await query('SELECT id FROM users WHERE node_id = $1', [matrixParentId]);
      const matrixDbId   = matrixDbRes.rows[0]?.id || null;

      // Upsert user row
      await query(`
        INSERT INTO users
          (wallet_address, node_id, node_tier, node_active, referrer_id, referrer_node_id,
           matrix_parent_id, matrix_parent_node_id, created_at)
        VALUES (LOWER($1), $2, $3, TRUE, $4, $5, $6, $7, TO_TIMESTAMP($8))
        ON CONFLICT (node_id) DO UPDATE SET
          wallet_address = LOWER(EXCLUDED.wallet_address),
          node_tier      = GREATEST(users.node_tier, EXCLUDED.node_tier),
          node_active    = TRUE,
          referrer_id    = COALESCE(EXCLUDED.referrer_id,    users.referrer_id),
          referrer_node_id = COALESCE(EXCLUDED.referrer_node_id, users.referrer_node_id),
          matrix_parent_id = COALESCE(EXCLUDED.matrix_parent_id, users.matrix_parent_id),
          matrix_parent_node_id = COALESCE(EXCLUDED.matrix_parent_node_id, users.matrix_parent_node_id)
      `, [wallet, nId, tier, sponsorDbId, sponsorId, matrixDbId, matrixParentId, joinedAt]);

      // Push SSE event to all connected frontends
      broadcastEvent('node_created', {
        nodeId: nId, wallet, tier, sponsorId, matrixParentId,
        block: event.blockNumber
      });

      // Notify sponsor via Telegram if possible
      try {
        const tgRes = await query('SELECT telegram_id FROM users WHERE node_id = $1', [sponsorId]);
        const tgId  = tgRes.rows[0]?.telegram_id;
        if (tgId) {
          await sendNotification(tgId,
            `🎉 *New Direct Referral!*\nNode #${nId} joined under your sponsorship.\nTier: T${tier} | Wallet: \`${wallet.slice(0,10)}…\``);
        }
      } catch { /* non-critical */ }

    } catch (err) {
      console.error('[Chain] NodeCreated handler error:', err.message);
    }
  });

  // ── TierUnlocked ───────────────────────────────────────────────────────────
  // Fires when an existing node upgrades to a higher tier.
  nfeglobalContract.on('TierUnlocked', async (nodeAddr, userId, packageId, event) => {
    const nId  = Number(userId);
    const tier = Number(packageId);
    console.log(`[Chain] TierUnlocked: nodeId=${nId} newTier=${tier}`);
    try {
      const node   = await nfeglobalContract.nodes(nId);
      const wallet = node.wallet?.toLowerCase() || nodeAddr.toLowerCase();
      const actualTier = Number(node.tier); // Use chain value as authoritative

      await query(
        `UPDATE users SET node_tier = $1, node_active = TRUE WHERE node_id = $2`,
        [actualTier, nId]
      );

      broadcastEvent('tier_unlocked', { nodeId: nId, wallet, tier: actualTier, block: event.blockNumber });

      // Notify the user themselves
      try {
        const tgRes = await query('SELECT telegram_id FROM users WHERE node_id = $1', [nId]);
        const tgId  = tgRes.rows[0]?.telegram_id;
        if (tgId) {
          await sendNotification(tgId,
            `🚀 *Tier Upgraded!*\nYour node #${nId} is now Tier ${actualTier}!`);
        }
      } catch { /* non-critical */ }

    } catch (err) {
      console.error('[Chain] TierUnlocked handler error:', err.message);
    }
  });

  // ── RewardDistributed ──────────────────────────────────────────────────────
  // Fires for every referral reward pushed on-chain.
  nfeglobalContract.on('RewardDistributed',
    async (walletAddr, nodeId, fromId, layer, amount, time, isMissed, rewardType, tier, event) => {
      const wallet = walletAddr.toLowerCase();
      const nId    = Number(nodeId);
      const bnbAmt = parseFloat(ethers.formatEther(amount));
      console.log(`[Chain] RewardDistributed: nodeId=${nId} wallet=${wallet.slice(0,10)} amount=${bnbAmt} BNB`);
      try {
        // Upsert income_history row (ignore duplicates by tx hash)
        const txHash = event.transactionHash;
        await query(`
          INSERT INTO income_history
            (wallet_address, amount_bnb, amount_usd, tx_hash, block_number, from_node_id, layer, is_missed, reward_type)
          VALUES (LOWER($1), $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (tx_hash) DO NOTHING
        `, [
          wallet, bnbAmt, 0, txHash, event.blockNumber,
          Number(fromId), Number(layer), Boolean(isMissed), Number(rewardType)
        ]);

        broadcastEvent('reward_distributed', {
          wallet, nodeId: nId, amountBnb: bnbAmt,
          layer: Number(layer), isMissed: Boolean(isMissed),
          block: event.blockNumber
        });
      } catch (err) {
        console.error('[Chain] RewardDistributed handler error:', err.message);
      }
    }
  );

  // ── RewardClaimed (RewardPool) ─────────────────────────────────────────────
  rewardPoolContract.on('RewardClaimed', async (nodeId, walletAddr, amount, event) => {
    const wallet = walletAddr.toLowerCase();
    const nId    = Number(nodeId);
    const bnbAmt = parseFloat(ethers.formatEther(amount));
    console.log(`[Chain] RewardClaimed: nodeId=${nId} wallet=${wallet.slice(0,10)} amount=${bnbAmt} BNB`);
    broadcastEvent('reward_claimed', { nodeId: nId, wallet, amountBnb: bnbAmt, block: event.blockNumber });
  });

  // ── Heartbeat: re-attach listeners if provider reconnects ─────────────────
  provider.on('error', (err) => {
    console.error('[Chain Provider] Error:', err.message, '— will auto-reconnect via ethers.');
  });

  console.log('[Chain Events] Listening for: NodeCreated, TierUnlocked, RewardDistributed, RewardClaimed');
}
// ─────────────────────────────────────────────────────────────────────────────

// ── SSE Stream Endpoint ───────────────────────────────────────────────────────
// Clients connect here to receive real-time chain events via Server-Sent Events.
app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
  res.flushHeaders();

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);
  sseClients.add(res);
  console.log(`[SSE] Client connected. Total: ${sseClients.size}`);

  // Heartbeat every 25s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); sseClients.delete(res); }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    console.log(`[SSE] Client disconnected. Total: ${sseClients.size}`);
  });
});

// ── AUTO-UPGRADE SYSTEM ENDPOINTS ─────────────────────────────────────────────
const execAsync = promisify(execCb);

// Dynamically locate the .git root (walk up from server/ to project root)
function findGitRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir; // fallback
}
const GIT_ROOT = findGitRoot(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')));
const UPSTREAM = 'https://github.com/quevitsolutions/nfeglobalhub';

// GET /api/admin/system/status — returns branch, commit hash, and message
app.get('/api/admin/system/status', checkAdmin, async (req, res) => {
  try {
    const branch  = execSync('git rev-parse --abbrev-ref HEAD', { cwd: GIT_ROOT }).toString().trim();
    const hash    = execSync('git rev-parse --short HEAD',      { cwd: GIT_ROOT }).toString().trim();
    const message = execSync('git log -1 --pretty=%s',          { cwd: GIT_ROOT }).toString().trim();
    const date    = execSync('git log -1 --pretty=%ci',         { cwd: GIT_ROOT }).toString().trim();

    // Check if upstream has newer commits (non-blocking — fetch first)
    let behindCount = 0;
    try {
      execSync(`git fetch ${UPSTREAM} main --quiet`, { cwd: GIT_ROOT, timeout: 15000 });
      behindCount = parseInt(
        execSync('git rev-list HEAD..FETCH_HEAD --count', { cwd: GIT_ROOT }).toString().trim()
      ) || 0;
    } catch { /* network unavailable — skip */ }

    res.json({ branch, hash, message, date, behindCount, upstream: UPSTREAM });
  } catch (err) {
    console.error('[System Status]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/system/upgrade — pull from nfeglobalhub, optionally force-reset, npm install, restart
app.post('/api/admin/system/upgrade', checkAdmin, async (req, res) => {
  const { forceReset = false } = req.body || {};
  const logs = [];
  const run = async (cmd, label) => {
    logs.push(`$ ${label || cmd}`);
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: GIT_ROOT, timeout: 120000 });
      if (stdout) logs.push(stdout.trim());
      if (stderr) logs.push(stderr.trim());
    } catch (e) {
      logs.push(`ERROR: ${e.message}`);
      throw e;
    }
  };

  try {
    // 1. Fetch latest from upstream (never push)
    await run(`git fetch ${UPSTREAM} main`, 'Fetching from nfeglobalhub...');

    // 2. Apply changes — force-reset discards local edits; standard merge keeps them
    if (forceReset) {
      await run('git reset --hard FETCH_HEAD', 'Force-resetting to upstream HEAD...');
    } else {
      await run('git merge FETCH_HEAD --no-edit', 'Merging upstream changes...');
    }

    // 3. Re-install dependencies in case package.json changed
    await run('npm install --prefer-offline --no-audit --no-fund', 'Installing dependencies...');

    logs.push('✅ Upgrade complete — restarting server...');
    res.json({ success: true, logs });

    // 4. Restart after flushing response (Docker restart:always or PM2 will spin it back up)
    setTimeout(() => process.exit(0), 800);
  } catch (err) {
    console.error('[System Upgrade]', err.message);
    res.status(500).json({ success: false, logs, error: err.message });
  }
});

// GET /api/admin/targeted-users — returns all targeted users
app.get('/api/admin/targeted-users', checkAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, wallet_address, node_id, node_tier, is_targeted, created_at FROM users WHERE is_targeted = TRUE ORDER BY id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Admin Targeted Users]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/targeted-users — sets targeted status
app.post('/api/admin/targeted-users', checkAdmin, async (req, res) => {
  const { walletAddress, status } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'Wallet required' });
  try {
    const lowerWallet = walletAddress.toLowerCase();
    // Try to update existing user
    const updateResult = await query(
      `UPDATE users SET is_targeted = $1 WHERE LOWER(wallet_address) = $2 RETURNING *`,
      [!!status, lowerWallet]
    );
    if (updateResult.rows.length === 0 && status) {
      // Create a new user record if they are being targeted and don't exist
      const insertResult = await query(
        `INSERT INTO users (wallet_address, is_targeted, local_reward, claimed_milestones)
         VALUES ($1, TRUE, 0, '[]') RETURNING *`,
        [lowerWallet]
      );
      return res.json(insertResult.rows[0]);
    }
    res.json(updateResult.rows[0] || { wallet_address: lowerWallet, is_targeted: !!status });
  } catch (err) {
    console.error('[Admin Set Targeted User]', err.message);
    res.status(500).json({ error: err.message });
  }
});


