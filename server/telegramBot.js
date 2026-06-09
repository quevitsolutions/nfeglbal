/**
 * NFEGlobal Telegram Bot
 * Handles user notifications, marketing broadcasts, and referral deep links.
 * Uses polling (no webhook needed — simpler Docker setup).
 */
import TelegramBot from 'node-telegram-bot-api';
import { query } from './db.js';
import { ethers } from 'ethers';

// Hardcoded for backend Docker context isolation
const NFEGLOBAL_ADDRESS   = '0xda0d24aAd1685F59614c1a347826fA1100aBd9F6';
const REWARDPOOL_ADDRESS = '0x582a725c49B10024bd50C73c1063270fCC6fD4A9';
const BSC_RPC = (process.env.VITE_RPC_URL || 'https://bsc-testnet.bnbchain.org').trim();

const NFEGLOBAL_ABI = [
  'function nodeId(address user) view returns (uint256)',
  'function getNodeStats(uint256 _userId) view returns (uint256 tier, uint256 directCount, uint256 matrixCount, uint256 totalRewards, uint256 totalContribution, uint256 daysActive)'
];
const REWARDPOOL_ABI = [
  'function getPoolViewHelper(uint256 nodeId) view returns (uint8, string, uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool, uint8, uint256[3])'
];

const BOT_TOKEN    = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const BOT_USERNAME = 'nfeglobal_bot';
const APP_URL      = (process.env.APP_URL || 'https://nfeglobal.online').trim();

let bot = null;

// ── Initialise Bot ─────────────────────────────────────────────────────────────
export function initTelegramBot() {
  if (!BOT_TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not set — bot disabled.');
    return null;
  }

  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  console.log('🤖 Telegram bot started (@' + BOT_USERNAME + ')');

  // Set the menu button to show commands (hamburger menu)
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ menu_button: { type: 'commands' } })
  }).catch(err => console.warn('Failed to set chat menu button:', err.message));

  // Set default bot commands
  bot.setMyCommands([
    { command: 'start',  description: 'Open your dashboard' },
    { command: 'status', description: 'Check your node and balance' },
    { command: 'team',   description: 'View your team network' },
    { command: 'refer',  description: 'Get your referral links' }
  ]).catch(err => console.warn('Failed to set bot commands:', err.message));

  const getDashboardKeyboard = () => ({
    keyboard: [
      [{ text: '📊 My Status' }, { text: '👥 My Team' }],
      [{ text: '🔗 Share Referral' }, { text: 'ℹ️ About NFEGlobal' }]
    ],
    resize_keyboard: true,
    is_persistent: true
  });

  // ── /start [walletAddress] ─────────────────────────────────────────────────
  bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
    const chatId     = msg.chat.id;
    const telegramId = msg.from.id;
    const firstName  = msg.from.first_name || 'Operator';
    const walletArg  = match[1] ? match[1].trim() : null;

    // conn_0x... means user clicked "Connect Telegram" in the app
    if (walletArg && walletArg.startsWith('conn_0x')) {
      const actualWallet = walletArg.replace('conn_', '');
      try {
        await query(
          `UPDATE users SET telegram_id = $1 WHERE LOWER(wallet_address) = LOWER($2)`,
          [telegramId, actualWallet]
        );
        await bot.sendMessage(chatId,
          `✅ *Wallet Connected!*\n\nHey ${firstName}! Your wallet \`${actualWallet.slice(0,6)}...${actualWallet.slice(-4)}\` is now linked to this Telegram account.\n\n🔔 You will receive:\n• Node activation alerts\n• Reward notifications\n• New team member alerts\n• Exclusive promotions\n\nUse the buttons below to explore NFEGlobal 👇`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📊 My Status', callback_data: `status:${actualWallet}` }, { text: '👥 My Team', callback_data: `team:${actualWallet}` }],
                [{ text: '🔗 Share Referral', callback_data: `share:${actualWallet}` }]
              ]
            }
          }
        );
        bot.sendMessage(chatId, '🎛 Dashboard Menu enabled!', { reply_markup: getDashboardKeyboard() });
      } catch (err) {
        console.error('Telegram /start wallet link error:', err.message);
        await bot.sendMessage(chatId, '❌ Could not link wallet. Please try again from the app.');
      }
    } else if (walletArg && walletArg.startsWith('0x')) {
      // Referral deep link
      await bot.sendMessage(chatId,
        `👋 *Welcome to NFEGlobal Hub!*\n\nYou've been invited by \`${walletArg.slice(0,6)}...${walletArg.slice(-4)}\` to join the ultimate BNB earnings network.\n\n⚡ Build a global team for free and activate your node to earn 24/7 passive matrix income.\n\nClick the button below to connect your wallet and lock your position in their team 👇`,
        { parse_mode: 'Markdown', reply_markup: getDashboardKeyboard() }
      );
    } else {
      // Generic welcome — no deep link
      await bot.sendMessage(chatId,
        `👋 *Welcome to NFEGlobal Hub!*\n\n⚡ The decentralized BNB earnings network where free users build global teams and activate their income stream.\n\nTo connect your wallet and get notifications, visit the app and click *"🔔 Connect Telegram"* on your profile page.`,
        { parse_mode: 'Markdown', reply_markup: getDashboardKeyboard() }
      );
    }
  });

  // ── /status ────────────────────────────────────────────────────────────────
  const handleStatus = async (msg) => {
    const chatId     = msg.chat.id;
    const telegramId = msg.from.id;
    try {
      // Step 1: read from DB (fast — no chain call)
      const result = await query(
        `SELECT wallet_address, node_id, node_tier, local_reward,
                (SELECT COUNT(*) FROM users WHERE referrer_id = u.id) as directs
         FROM users u WHERE telegram_id = $1 ORDER BY node_tier DESC LIMIT 1`,
        [telegramId]
      );
      if (result.rows.length === 0) {
        return bot.sendMessage(chatId, '❌ No wallet linked. Open the app and click "Connect Telegram" on your profile page first.');
      }

      let u = result.rows[0];

      // Step 2: if DB shows node_tier=0, request a background chain-sync then re-read
      if (Number(u.node_tier) === 0) {
        try {
          const INTERNAL_API = (process.env.API_INTERNAL_URL || 'http://localhost:3001').trim();
          const syncRes = await fetch(`${INTERNAL_API}/api/internal/chain-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: u.wallet_address })
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData.synced) {
              const refreshed = await query(
                `SELECT wallet_address, node_id, node_tier, local_reward,
                        (SELECT COUNT(*) FROM users WHERE referrer_id = u.id) as directs
                 FROM users u WHERE telegram_id = $1 ORDER BY node_tier DESC LIMIT 1`,
                [telegramId]
              );
              if (refreshed.rows.length > 0) u = refreshed.rows[0];
            }
          }
        } catch (syncErr) {
          console.warn('Auto chain-sync failed (non-critical):', syncErr.message);
        }
      }

      // Step 3: Build message from DB
      const nodeTier    = Number(u.node_tier) || 0;
      const nodeId      = Number(u.node_id)   || 0;
      const walletShort = `${u.wallet_address.slice(0,6)}...${u.wallet_address.slice(-4)}`;
      const nfeglobal         = parseFloat(u.local_reward || 0).toFixed(0);
      const directs     = Number(u.directs) || 0;
      const tierLabel   = nodeTier > 0 ? `✅ Tier ${nodeTier} Node` : '⏳ Free User (Not Activated)';
      const nodeLabel   = nodeTier > 0 ? (nodeId > 0 ? `#${nodeId}` : 'Activated') : 'Not Activated';

      // Team stats (cycle-safe recursive CTE)
      let teamTotal = 0, teamFree = 0, teamActivated = 0;
      try {
        const teamRes = await query(`
          WITH RECURSIVE tree AS (
            SELECT id, 0 as depth, ARRAY[id] AS visited FROM users WHERE id = $1
            UNION ALL
            SELECT u.id, t.depth + 1, t.visited || u.id
            FROM users u INNER JOIN tree t ON u.referrer_id = t.id
            WHERE t.depth < 18 AND NOT (u.id = ANY(t.visited))
          )
          SELECT
            COUNT(DISTINCT u.id) FILTER (WHERE t.depth > 0)                    AS total,
            COUNT(DISTINCT u.id) FILTER (WHERE t.depth > 0 AND u.node_tier > 0) AS activated,
            COUNT(DISTINCT u.id) FILTER (WHERE t.depth = 1)                    AS directs_count
          FROM tree t JOIN users u ON u.id = t.id
        `, [u.id]);
        teamTotal     = parseInt(teamRes.rows[0]?.total      || 0);
        teamActivated = parseInt(teamRes.rows[0]?.activated  || 0);
        teamFree      = teamTotal - teamActivated;
      } catch (e) { /* non-critical */ }

      // Step 4: Pool check — only if user has a node (avoid wasting RPC for free users)
      let poolText = '🔒 Pool: Not Qualified';
      if (nodeId > 0) {
        try {
          const provider    = new ethers.JsonRpcProvider(BSC_RPC);
          const poolContract = new ethers.Contract(REWARDPOOL_ADDRESS, REWARDPOOL_ABI, provider);
          const poolData    = await poolContract.getPoolViewHelper(nodeId);
          const currentPoolId = Number(poolData[0]);
          const poolName      = String(poolData[1]);
          const isQualified   = Boolean(poolData[9]);
          if (currentPoolId > 0) {
            poolText = `🏆 Pool: Active in ${poolName}`;
          } else if (isQualified) {
            poolText = `🏆 Pool: QUALIFIED ✅ — Visit nfeglobal.online to register!`;
          }
        } catch (poolErr) {
          console.warn('Pool check failed (non-critical):', poolErr.message);
        }
      }

      const footer = nodeTier === 0
        ? '⚠️ Activate your node to start earning real BNB!'
        : '🎉 You are earning BNB from your network!';

      await bot.sendMessage(chatId,
        `📊 *Your NFEGlobal Status*\n\n` +
        `👛 Wallet: \`${walletShort}\`\n` +
        `⬡ Node: ${nodeLabel}\n` +
        `🏆 Status: ${tierLabel}\n` +
        `💎 $NFEGLOBAL Balance: ${Number(nfeglobal).toLocaleString()}\n` +
        `👥 Direct Refs: ${directs}\n` +
        `🌳 Team (18 lvls): ${teamTotal} total | ✅ ${teamActivated} active | ⏳ ${teamFree} free\n` +
        `${poolText}\n\n${footer}`,
        { parse_mode: 'Markdown', reply_markup: getDashboardKeyboard() }
      );
    } catch (err) {
      console.error('Telegram /status error:', err.message);
      bot.sendMessage(chatId, '❌ Failed to fetch status. Try again later.');
    }
  };
  bot.onText(/\/status/, handleStatus);

  // ── /team ──────────────────────────────────────────────────────────────────
  const handleTeam = async (msg) => {
    const chatId     = msg.chat.id;
    const telegramId = msg.from.id;
    try {
      const result = await query(
        `SELECT id, wallet_address, node_tier FROM users WHERE telegram_id = $1 ORDER BY node_tier DESC LIMIT 1`,
        [telegramId]
      );
      if (result.rows.length === 0) {
        return bot.sendMessage(chatId, '❌ No wallet linked. Connect your Telegram from the app first.');
      }
      const userId = result.rows[0].id;

      const countRes = await query(`
        WITH RECURSIVE tree AS (
          SELECT id, 0 as depth, ARRAY[id] AS visited FROM users WHERE id = $1
          UNION ALL
          SELECT u.id, t.depth + 1, t.visited || u.id
          FROM users u INNER JOIN tree t ON u.referrer_id = t.id
          WHERE t.depth < 18 AND NOT (u.id = ANY(t.visited))
        )
        SELECT
          COUNT(DISTINCT u.id) FILTER (WHERE t.depth > 0)                     AS total_team,
          COUNT(DISTINCT u.id) FILTER (WHERE t.depth = 1)                     AS directs,
          COUNT(DISTINCT u.id) FILTER (WHERE t.depth > 0 AND u.node_tier > 0) AS activated,
          COUNT(DISTINCT u.id) FILTER (WHERE t.depth > 0 AND (u.node_tier IS NULL OR u.node_tier = 0) AND u.created_at > NOW() - INTERVAL '30 days') AS in_trial,
          COUNT(DISTINCT u.id) FILTER (WHERE t.depth > 0 AND (u.node_tier IS NULL OR u.node_tier = 0) AND u.created_at <= NOW() - INTERVAL '30 days') AS expired
        FROM tree t JOIN users u ON u.id = t.id
      `, [userId]);

      const c        = countRes.rows[0];
      const total    = parseInt(c.total_team || 0);
      const directs  = parseInt(c.directs    || 0);
      const activated = parseInt(c.activated || 0);
      const inTrial  = parseInt(c.in_trial   || 0);
      const expired  = parseInt(c.expired    || 0);
      const free     = total - activated;
      const convRate = total > 0 ? ((activated / total) * 100).toFixed(1) : '0.0';

      await bot.sendMessage(chatId,
        `👥 *Your Team Network*\n\n` +
        `📏 Total (18 levels): ${total}\n` +
        `👤 Direct Referrals: ${directs}\n` +
        `✅ Activated Nodes: ${activated}\n` +
        `🔵 In Free Trial: ${inTrial}\n` +
        `⏰ Trial Expired: ${expired}\n` +
        `📈 Conversion Rate: ${convRate}%\n\n` +
        `${free > 0 ? `💡 ${free} free users waiting to be converted!` : '🏆 Amazing! Your whole team is activated!'}`,
        { parse_mode: 'Markdown', reply_markup: getDashboardKeyboard() }
      );
    } catch (err) {
      console.error('Telegram /team error:', err.message);
      bot.sendMessage(chatId, '❌ Failed to fetch team data.');
    }
  };
  bot.onText(/\/team/, handleTeam);

  // ── /refer ────────────────────────────────────────────────────────────────
  const handleRefer = async (msg) => {
    const chatId     = msg.chat.id;
    const telegramId = msg.from.id;
    try {
      const result = await query('SELECT wallet_address FROM users WHERE telegram_id = $1 LIMIT 1', [telegramId]);
      if (result.rows.length === 0) return bot.sendMessage(chatId, '❌ No wallet linked.');
      const wallet  = result.rows[0].wallet_address;
      const refLink = `${APP_URL}?ref=${wallet}`;
      const botLink = `https://t.me/${BOT_USERNAME}?start=${wallet}`;
      await bot.sendMessage(chatId,
        `🔗 <b>Your Referral Links</b>\n\n🌐 <b>App Link:</b>\n${refLink}\n\n🤖 <b>Bot Link (share this!):</b>\n${botLink}\n\n📤 Share these links to grow your free user base. When they activate, you earn BNB!`,
        { parse_mode: 'HTML', reply_markup: getDashboardKeyboard() }
      );
    } catch (err) {
      bot.sendMessage(chatId, '❌ Error fetching referral links.');
    }
  };
  bot.onText(/\/refer/, handleRefer);

  // ── /info / About ──────────────────────────────────────────────────────────
  const handleInfo = async (msg) => {
    bot.sendMessage(msg.chat.id,
      `ℹ️ *About NFEGlobal Hub*\n\nNFEGlobal is a decentralized BNB-earning network running on BNB Smart Chain.\n\n🔹 *Free Users* can join and build a team for free (30-day trial)\n🔹 *Node Holders* earn real BNB from their 18-level deep network\n🔹 The more users in your team, the more you earn\n\n🚀 Activate your node and start earning today!`,
      { parse_mode: 'Markdown', reply_markup: getDashboardKeyboard() }
    );
  };

  // ── Persistent keyboard text handler ──────────────────────────────────────
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    switch (msg.text) {
      case '📊 My Status':    return handleStatus(msg);
      case '👥 My Team':      return handleTeam(msg);
      case '🔗 Share Referral': return handleRefer(msg);
      case 'ℹ️ About NFEGlobal': return handleInfo(msg);
    }
  });

  // ── Callback Queries (inline buttons) ─────────────────────────────────────
  bot.on('callback_query', async (callbackQuery) => {
    const msg    = callbackQuery.message;
    const data   = callbackQuery.data;
    const chatId = msg.chat.id;

    await bot.answerCallbackQuery(callbackQuery.id);

    const fakeMsg = {
      chat: { id: chatId },
      from: { id: callbackQuery.from.id }
    };

    if (data === 'info')                  await handleInfo(fakeMsg);
    else if (data.startsWith('share:'))   await handleRefer(fakeMsg);
    else if (data.startsWith('status:'))  await handleStatus(fakeMsg);
    else if (data.startsWith('team:'))    await handleTeam(fakeMsg);
  });

  // ── Polling error handler ──────────────────────────────────────────────────
  bot.on('polling_error', (err) => {
    console.error('Telegram polling error:', err.message);
  });

  return bot;
}

// ── Public API: Send notification to a single user ──────────────────────────
export async function sendNotification(telegramId, message, options = {}) {
  if (!bot || !telegramId) return;
  try {
    await bot.sendMessage(telegramId, message, { parse_mode: 'Markdown', ...options });
  } catch (err) {
    if (!err.message.includes('blocked') && !err.message.includes('not found')) {
      console.error('Telegram send error:', err.message);
    }
  }
}

// ── Public API: Broadcast to a filtered set of users ───────────────────────
export async function broadcastToUsers({ filter = 'all', message, imageUrl = null, buttonUrl = null, buttonLabel = null }) {
  if (!bot || !message) throw new Error('Bot not initialised or no message');

  let sqlFilter = 'telegram_id IS NOT NULL';
  if (filter === 'free')      sqlFilter += ' AND node_tier = 0';
  if (filter === 'activated') sqlFilter += ' AND node_tier > 0';

  const users = await query(`SELECT telegram_id FROM users WHERE ${sqlFilter}`);
  let sent = 0, failed = 0;

  const replyMarkup = buttonUrl ? {
    reply_markup: {
      inline_keyboard: [[{ text: buttonLabel || '🌐 Open App', url: buttonUrl }]]
    }
  } : {};

  for (const u of users.rows) {
    try {
      if (imageUrl) {
        await bot.sendPhoto(u.telegram_id, imageUrl, { caption: message, parse_mode: 'Markdown', ...replyMarkup });
      } else {
        await bot.sendMessage(u.telegram_id, message, { parse_mode: 'Markdown', ...replyMarkup });
      }
      sent++;
      await new Promise(r => setTimeout(r, 35)); // 30 msg/sec Telegram rate limit
    } catch {
      failed++;
    }
  }

  try {
    await query(
      `INSERT INTO telegram_broadcasts (message, target_filter, sent_count) VALUES ($1, $2, $3)`,
      [message, filter, sent]
    );
  } catch {}

  return { sent, failed, total: users.rows.length };
}

// ── Expiring Trial Notifications ──────────────────────────────────────────────
// Called periodically from index.js (every 12h).
// Finds free users whose 30-day trial expires in exactly 3 days or 1 day,
// notifies them directly AND notifies their sponsor.
export async function checkExpiringTrials() {
  if (!bot) return;
  try {
    // Find free users expiring in ~3 days (27–28 days old) or ~1 day (29–30 days old)
    const expiring = await query(`
      SELECT
        u.wallet_address, u.telegram_id, u.created_at,
        GREATEST(0, 30 - EXTRACT(DAY FROM (NOW() - COALESCE(u.created_at, NOW())))::int) AS days_left,
        s.telegram_id  AS sponsor_tg,
        s.wallet_address AS sponsor_wallet,
        s.node_id        AS sponsor_node_id
      FROM users u
      LEFT JOIN users s ON s.id = u.referrer_id
      WHERE (u.node_tier IS NULL OR u.node_tier = 0)
        AND u.created_at IS NOT NULL
        AND EXTRACT(DAY FROM (NOW() - u.created_at)) BETWEEN 27 AND 30
    `);

    let notified = 0;
    for (const row of expiring.rows) {
      const daysLeft = Number(row.days_left);
      if (daysLeft !== 3 && daysLeft !== 1) continue; // only exact 3d and 1d alerts

      const walletShort = `${row.wallet_address.slice(0,6)}...${row.wallet_address.slice(-4)}`;
      const appUrl = `${APP_URL}/?ref=${row.wallet_address}`;

      // 1. Notify the free user themselves (if they have Telegram linked)
      if (row.telegram_id) {
        const userMsg = daysLeft === 3
          ? `⚠️ *Free Trial Expiring in 3 Days!*\n\nHey! Your NFEGlobal free trial ends in *3 days*.\n\n🔒 After expiry, your spot in the network will be lost and you'll need to start over.\n\n✅ *Activate your node now* to secure your position and start earning real BNB from your team!\n\n👇 [Open NFEGlobal](${APP_URL})`
          : `🚨 *LAST DAY — Trial Expires Tomorrow!*\n\nThis is your final reminder — your NFEGlobal free trial expires *tomorrow*.\n\n⚡ Don't lose your network position! Activate your node today to:\n• Earn real BNB 24/7\n• Keep your team's referral earnings\n• Access the 18-tier matrix\n\n👇 [Activate Now](${APP_URL})`;
        await sendNotification(row.telegram_id, userMsg);
        notified++;
      }

      // 2. Notify the sponsor (so they can follow up and convert)
      if (row.sponsor_tg) {
        const sponsorMsg = daysLeft === 3
          ? `👤 *Free Trial Alert — 3 Days Left*\n\nYour team member \`${walletShort}\` has *3 days* left in their free trial.\n\n💡 Reach out and encourage them to activate — when they do, you earn BNB from their node!\n\n📱 Share your referral link again to give them the nudge they need.`
          : `🚨 *Urgent — Team Member Expires Tomorrow!*\n\n\`${walletShort}\` is in your team and their free trial expires *tomorrow*.\n\n⚡ This is your last chance to convert them! Send them your referral link now:\n${APP_URL}/?ref=${row.sponsor_node_id || row.sponsor_wallet}`;
        await sendNotification(row.sponsor_tg, sponsorMsg);
        notified++;
      }

      // Throttle to respect Telegram rate limits
      await new Promise(r => setTimeout(r, 50));
    }

    if (notified > 0) {
      console.log(`📬 Expiring trial alerts sent: ${notified} notifications for ${expiring.rows.length} users`);
    }
  } catch (err) {
    console.error('checkExpiringTrials error:', err.message);
  }
}

export async function verifyTelegramMembership(telegramId, channelUrl) {
  if (!bot || !telegramId) return false;
  try {
    let channelHandle = channelUrl.split('/').pop().split('?')[0];
    if (!channelHandle.startsWith('@')) channelHandle = '@' + channelHandle;
    const member = await bot.getChatMember(channelHandle, telegramId);
    return ['creator', 'administrator', 'member', 'restricted'].includes(member.status);
  } catch (err) {
    if (err.response && err.response.statusCode === 400) {
      if (err.response.body && err.response.body.description.includes('user not found')) return false;
    }
    console.warn(`Telegram verify warning for ${telegramId} in ${channelUrl}:`, err.message);
    return false;
  }
}
