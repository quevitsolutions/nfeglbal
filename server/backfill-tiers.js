/**
 * NFEGlobal Tier Backfill — eth_call Sequential Scan (Correct ABI)
 * Scans nodeIds sequentially using contract.nodes(id) and nodeId(wallet).
 * Pure eth_call — NOT affected by eth_getLogs rate limits.
 *
 * Usage: docker exec nfeglobal-api node backfill-tiers.js
 */
import { ethers } from 'ethers';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || 'db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'nfeglobal_pass',
  database: process.env.DB_NAME     || 'nfeglobal_game',
  port:     Number(process.env.DB_PORT || 5432),
});

const NFEGLOBAL_ADDRESS = '0x4ea93b8Cd18b66c027AdBaa63CCF06B240dA1dFA';

// CORRECT ABI from frontend abi.js:
// nodes(nodeId) returns (address wallet, uint88 nodeId_, uint256 sponsor,
//   uint256 matrixParent, uint40 joinedAt, uint256 tier, ...)
// nodeId(address user) returns (uint256)
const NFEGLOBAL_ABI = [
  'function nodes(uint256 nodeId) view returns (address wallet, uint88 nodeId_, uint256 sponsor, uint256 matrixParent, uint40 joinedAt, uint256 tier, uint256 directNodes, uint256 totalMatrixNodes, uint256 totalContribution)',
  'function nodeId(address user) view returns (uint256)',
  'function getNodeStats(uint256 _userId) view returns (uint256 tier, uint256 directCount, uint256 matrixCount, uint256 totalRewards, uint256 totalContribution, uint256 daysActive)'
];

const RPC_LIST = [
  'https://bsc-testnet.bnbchain.org',
  'https://data-seed-prebsc-1-s1.binance.org:8545/',
  'https://data-seed-prebsc-2-s1.binance.org:8545/',
  'https://data-seed-prebsc-1-s2.binance.org:8545/',
  'https://data-seed-prebsc-2-s2.binance.org:8545/',
  process.env.VITE_RPC_URL,
].filter(r => r && r.trim() !== '');

// NodeId ranges to scan — all nodes appear to be in the 55555+ range
// 55555 = genesis. New nodes increment from there.
// Scan 55555..55700 covers current deployment. Extend if needed.
const SCAN_RANGES = [
  { from: 55555, to: 55700 }
];

const ZERO = '0x0000000000000000000000000000000000000000';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getProvider() {
  for (const rpc of RPC_LIST) {
    try {
      const p = new ethers.JsonRpcProvider(rpc.trim());
      await p.getBlockNumber();
      console.log(`✅ RPC: ${rpc.trim()}`);
      return p;
    } catch {
      console.log(`  skip ${rpc.trim()}`);
    }
  }
  throw new Error('All RPCs failed');
}

async function run() {
  console.log('\n🔧 NFEGlobal Tier Backfill (correct ABI)\n' + '─'.repeat(55));

  const provider = await getProvider();
  const contract = new ethers.Contract(NFEGLOBAL_ADDRESS, NFEGLOBAL_ABI, provider);
  const client   = await pool.connect();
  console.log('✅ DB connected\n');

  // Load all wallets in DB
  const { rows: dbUsers } = await client.query(
    `SELECT id, wallet_address, node_id, node_tier FROM users ORDER BY id`
  );
  console.log(`📋 ${dbUsers.length} wallets in DB\n`);

  // Build lookup maps
  const walletToDbRow = new Map();
  for (const u of dbUsers) walletToDbRow.set(u.wallet_address.toLowerCase(), u);

  const discovered = []; // { nodeId, wallet, tier }

  try {
    // ── Phase 1: Scan nodeIds sequentially ──────────────────────────────────
    for (const range of SCAN_RANGES) {
      console.log(`🔍 Scanning node IDs ${range.from}–${range.to}...`);
      let emptyStreak = 0;

      for (let nid = range.from; nid <= range.to; nid++) {
        try {
          const info   = await contract.nodes(nid);
          const wallet = info[0].toLowerCase(); // address wallet (field 0)
          const tier   = Number(info[5]);       // uint256 tier (field 5)

          if (wallet === ZERO) {
            process.stdout.write('_');
            emptyStreak++;
            if (emptyStreak > 30) {
              process.stdout.write(' [end of range]\n');
              break;
            }
            await sleep(100);
            continue;
          }

          emptyStreak = 0;
          discovered.push({ nodeId: nid, wallet, tier: Math.max(tier, 1) });
          process.stdout.write(`[#${nid} T${tier}]`);
          await sleep(200);

        } catch {
          process.stdout.write('·');
          emptyStreak++;
          if (emptyStreak > 30) {
            process.stdout.write(' [end]\n');
            break;
          }
          await sleep(150);
        }
      }
      console.log('');
    }

    // ── Phase 2: For each DB wallet missing a node, query nodeId() directly ─
    console.log('\n🔍 Checking DB wallets missing node_id via nodeId(wallet)...');
    const missing = dbUsers.filter(u => !u.node_id);
    console.log(`   ${missing.length} wallets to check\n`);

    for (const u of missing) {
      const wallet = u.wallet_address.toLowerCase();
      // Skip if already found in Phase 1
      if (discovered.some(d => d.wallet === wallet)) continue;

      try {
        const rawId = await contract.nodeId(wallet);
        const nid = Number(rawId);
        if (nid > 0) {
          // Get tier from getNodeStats
          try {
            const stats = await contract.getNodeStats(nid);
            const tier = Math.max(Number(stats[0]), 1);
            discovered.push({ nodeId: nid, wallet, tier });
            console.log(`  Found: ${wallet.slice(0,14)}... Node #${nid} Tier ${tier}`);
          } catch {
            discovered.push({ nodeId: nid, wallet, tier: 1 });
            console.log(`  Found (tier=1 fallback): ${wallet.slice(0,14)}... Node #${nid}`);
          }
          await sleep(300);
        } else {
          process.stdout.write('·'); // No node
        }
      } catch {
        process.stdout.write('x');
        await sleep(300);
      }
    }
    console.log('\n');

    // ── Phase 3: Update DB ───────────────────────────────────────────────────
    console.log(`📡 Found ${discovered.length} nodes total. Updating DB...\n`);

    let updated = 0, skipped = 0, inserted = 0;

    for (const { nodeId, wallet, tier } of discovered) {
      const dbRow = walletToDbRow.get(wallet);

      if (!dbRow) {
        await client.query(
          `INSERT INTO users (wallet_address, node_id, node_tier, node_active, created_at, last_claim_time, last_rpc_sync)
           VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (LOWER(wallet_address)) DO UPDATE
             SET node_id = EXCLUDED.node_id,
                 node_tier = GREATEST(users.node_tier, EXCLUDED.node_tier),
                 node_active = TRUE,
                 last_rpc_sync = CURRENT_TIMESTAMP`,
          [wallet, nodeId, tier]
        );
        console.log(`  ➕ INSERTED  ${wallet.slice(0,16)}... Node #${nodeId} Tier ${tier}`);
        inserted++;
        continue;
      }

      if (Number(dbRow.node_id) === nodeId && Number(dbRow.node_tier) === tier) {
        process.stdout.write('·');
        skipped++;
        continue;
      }

      // Only upgrade tier — never downgrade (use GREATEST)
      await client.query(
        `UPDATE users
         SET node_id       = $2,
             node_tier     = GREATEST(node_tier, $3),
             node_active   = TRUE,
             last_rpc_sync = CURRENT_TIMESTAMP,
             updated_at    = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [dbRow.id, nodeId, tier]
      );
      console.log(`\n  ✅ UPDATED  ${wallet.slice(0,16)}... Node #${nodeId} Tier ${tier}  (was node_id=${dbRow.node_id} tier=${dbRow.node_tier})`);
      updated++;
    }

    if (skipped > 0) console.log(`\n  (${skipped} already correct)\n`);

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log(`\n${'─'.repeat(55)}`);
    console.log(`✅ Updated   : ${updated}`);
    console.log(`➕ Inserted  : ${inserted}`);
    console.log(`⏭  Skipped   : ${skipped}`);
    console.log(`${'─'.repeat(55)}`);

    const { rows: final } = await client.query(
      `SELECT wallet_address, node_id, node_tier
       FROM users WHERE node_id IS NOT NULL ORDER BY node_tier DESC, node_id ASC`
    );
    console.log(`\n📊 All nodes in DB (${final.length}):`);
    final.forEach(r =>
      console.log(`  ${r.wallet_address}  Node #${r.node_id}  Tier ${r.node_tier}`)
    );
    console.log('\n🏁 Done!\n');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
