import axios from 'axios';

/**
 * AIPCore Telegram Bot Service Engine
 * Native Bot API integration for Telegram Mini App, Webhook / Polling & Notification Engine
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const APP_URL = process.env.APP_URL || 'https://aipcore.online';

let botUsername = 'aipcore_bot';
let pollingOffset = 0;
let isPollingActive = false;

// In-memory store for linked Telegram users
// Map<walletAddressLower, { telegramId, username, chatId, linkedAt }>
export const userTelegramBindings = new Map();
// Map<telegramId, walletAddressLower>
export const telegramToWalletMap = new Map();

/**
 * Send raw Telegram message via REST API
 */
export async function sendTelegramMessage(chatId, text, options = {}) {
  if (!BOT_TOKEN) {
    console.log(`[Telegram Bot (Simulated)] -> Chat ${chatId}: ${text.slice(0, 80)}...`);
    return { ok: false, simulated: true, reason: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_web_page_preview ?? false,
      reply_markup: options.reply_markup || undefined
    };

    const res = await axios.post(`${API_BASE}/sendMessage`, payload, { timeout: 10000 });
    return res.data;
  } catch (err) {
    console.error(`[Telegram Bot Error] Failed to send message to ${chatId}:`, err.response?.data || err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Broadcast notification to a linked wallet address
 */
export async function notifyUserByWallet(walletAddress, title, message, actionUrl = null) {
  if (!walletAddress) return false;
  const key = walletAddress.toLowerCase();
  const binding = userTelegramBindings.get(key);

  if (!binding || !binding.telegramId) {
    return false;
  }

  const formattedText = `<b>${title}</b>\n\n${message}\n\n🌐 <a href="${actionUrl || APP_URL}">Open AIPCore App</a>`;
  
  const reply_markup = actionUrl ? {
    inline_keyboard: [[
      { text: '🎮 Open AIPCore App', web_app: { url: actionUrl } }
    ]]
  } : undefined;

  return await sendTelegramMessage(binding.telegramId, formattedText, { reply_markup });
}

/**
 * Get user's referral token (Node ID, Wallet Address, or Telegram User ID)
 */
export function getUserReferralToken(telegramId) {
  if (!telegramId) return '1';
  const tidStr = String(telegramId);
  const boundWallet = telegramToWalletMap.get(tidStr);

  if (boundWallet) {
    const binding = userTelegramBindings.get(boundWallet);
    if (binding && binding.nodeId && Number(binding.nodeId) > 0) {
      return String(binding.nodeId);
    }
    return boundWallet;
  }

  return tidStr;
}

/**
 * Handle incoming Telegram Webhook / Polling update
 */
export async function handleTelegramUpdate(update) {
  if (!update) return;

  // Handle Callback Queries (inline button clicks)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const data = cb.data;

    // Answer callback query so button stops loading spinner
    axios.post(`${API_BASE}/answerCallbackQuery`, { callback_query_id: cb.id }).catch(() => {});

    if (data === 'cmd_stats') {
      const statsMsg = `<b>📊 AIPCore Global Network Stats</b>\n\n` +
        `• Network Chain: <b>BNB Smart Chain (BSC)</b>\n` +
        `• Core Contract: <code>0xE82239361FBE54731CFF90D8c2036a33743fFd4d</code>\n` +
        `• Distribution: <b>100% Community-Driven</b>\n\n` +
        `Launch the Mini App for real-time node metrics!`;

      const keyboard = {
        inline_keyboard: [[
          { text: '🎮 Open Dashboard', web_app: { url: APP_URL } }
        ]]
      };
      await sendTelegramMessage(chatId, statsMsg, { reply_markup: keyboard });
    } else if (data === 'cmd_ref') {
      const userId = cb.from.id;
      const refToken = getUserReferralToken(userId);
      const refLink = `${APP_URL}/?ref=${refToken}`;
      const botRefLink = `https://t.me/${botUsername}?start=${refToken}`;

      const refMsg = `<b>🔗 Your AIPCore Referral Links</b>\n\n` +
        `• Web Link:\n<code>${refLink}</code>\n\n` +
        `• Telegram Bot Link:\n<code>${botRefLink}</code>\n\n` +
        `Share this link with your friends to build your 2x18 Matrix team!`;

      const keyboard = {
        inline_keyboard: [[
          { text: '📤 Share Link', url: `https://t.me/share/url?url=${encodeURIComponent(botRefLink)}&text=${encodeURIComponent('🚀 Join AIPCore FREE on BSC!')}` }
        ]]
      };
      await sendTelegramMessage(chatId, refMsg, { reply_markup: keyboard });
    }
    return;
  }

  // Handle text messages & commands
  if (!update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const user = msg.from;

  if (text.startsWith('/start') || text.startsWith('/bind')) {
    const parts = text.split(' ');
    const param = parts.length > 1 ? parts[1] : '';

    // Handle account binding deep-link: /start bind_0x... or /bind 0x...
    let targetWallet = '';
    if (param.toLowerCase().startsWith('bind_')) {
      targetWallet = param.slice(5).trim();
    } else if (text.startsWith('/bind') && param) {
      targetWallet = param.trim();
    }

    if (targetWallet && /^(0x[a-fA-F0-9]{40})$/i.test(targetWallet)) {
      const key = targetWallet.toLowerCase();
      userTelegramBindings.set(key, {
        walletAddress: key,
        nodeId: 0,
        telegramId: user.id,
        username: user.username || user.first_name || '',
        nodeTier: 0,
        linkedAt: Date.now()
      });
      telegramToWalletMap.set(String(user.id), key);

      console.log(`[Telegram Bot] Wallet ${key} successfully bound to Telegram User ID ${user.id} (@${user.username})`);

      const boundMsg = `<b>🎉 Telegram Income Alerts Activated!</b>\n\n` +
        `Your Telegram account <b>@${user.username || user.first_name || user.id}</b> is now linked to wallet:\n` +
        `<code>${targetWallet}</code>\n\n` +
        `🔔 You will now receive instant push alerts whenever you earn referral commissions, matrix payouts, or tier upgrades!`;

      const keyboard = {
        inline_keyboard: [[
          { text: '🎮 Open AIPCore App', web_app: { url: APP_URL } }
        ]]
      };

      await sendTelegramMessage(chatId, boundMsg, { reply_markup: keyboard });
      return;
    }

    const startParam = param;
    const webAppUrl = startParam ? `${APP_URL}/?ref=${startParam}` : APP_URL;

    const welcomeMsg = `<b>🚀 Welcome to AIPCore Node Network!</b>\n\n` +
      `AIPCore is a 100% decentralized, node-driven passive income protocol on Binance Smart Chain (BSC).\n\n` +
      `✨ <b>Key Features:</b>\n` +
      `• Join FREE ($0 entry cost)\n` +
      `• 18 Upgrade Tiers ($5 to $327,680)\n` +
      `• 2x18 Binary Forced Matrix (70% payout)\n` +
      `• Direct Referral (10%) & 10-Layer Income (15%)\n` +
      `• Global Reward Pool (5%)\n\n` +
      (startParam ? `👥 <b>Invited by Sponsor #${startParam}</b>\n\n` : '') +
      `Tap the button below to launch the Mini App! 👇`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🚀 Launch AIPCore App', web_app: { url: webAppUrl } }
        ],
        [
          { text: '📊 Live Stats', callback_data: 'cmd_stats' },
          { text: '🔗 My Referral Link', callback_data: 'cmd_ref' }
        ],
        [
          { text: '📢 Telegram Group', url: 'https://t.me/nfeglobal' }
        ]
      ]
    };

    await sendTelegramMessage(chatId, welcomeMsg, { reply_markup: keyboard });
    return;
  }

  if (text.startsWith('/stats')) {
    const statsMsg = `<b>📊 AIPCore Global Network Stats</b>\n\n` +
      `• Network Chain: <b>BNB Smart Chain (BSC)</b>\n` +
      `• Core Contract: <code>0xE82239361FBE54731CFF90D8c2036a33743fFd4d</code>\n` +
      `• Distribution: <b>100% Community-Driven</b>\n\n` +
      `Launch the Mini App for real-time node metrics!`;

    const keyboard = {
      inline_keyboard: [[
        { text: '🎮 Open Dashboard', web_app: { url: APP_URL } }
      ]]
    };

    await sendTelegramMessage(chatId, statsMsg, { reply_markup: keyboard });
    return;
  }

  if (text.startsWith('/referral') || text.startsWith('/ref')) {
    const refToken = getUserReferralToken(user.id);
    const refLink = `${APP_URL}/?ref=${refToken}`;
    const botRefLink = `https://t.me/${botUsername}?start=${refToken}`;

    const refMsg = `<b>🔗 Your AIPCore Referral Links</b>\n\n` +
      `• Web Link:\n<code>${refLink}</code>\n\n` +
      `• Telegram Bot Link:\n<code>${botRefLink}</code>\n\n` +
      `Share this link with your friends. When they register, they lock into your 2x18 Matrix team!`;

    const keyboard = {
      inline_keyboard: [[
        { text: '📤 Share Link', url: `https://t.me/share/url?url=${encodeURIComponent(botRefLink)}&text=${encodeURIComponent('🚀 Join AIPCore FREE on BSC!')}` }
      ]]
    };

    await sendTelegramMessage(chatId, refMsg, { reply_markup: keyboard });
    return;
  }

  if (text.startsWith('/help')) {
    const helpMsg = `<b>❓ AIPCore Support & Info</b>\n\n` +
      `• Website: https://aipcore.online\n` +
      `• Telegram Group: @nfeglobal\n` +
      `• Smart Contracts: Deployed on BSC Mainnet (Chain ID 56)\n\n` +
      `For assistance, launch the Mini App or contact support in our group.`;

    await sendTelegramMessage(chatId, helpMsg);
    return;
  }

  // Default fallback for any other message
  const defaultMsg = `🤖 Welcome to <b>AIPCore Network Bot</b>!\n\n` +
    `Use the options below or tap <b>Launch AIPCore App</b> to access your dashboard.`;

  const defaultKeyboard = {
    inline_keyboard: [[
      { text: '🚀 Launch AIPCore App', web_app: { url: APP_URL } }
    ]]
  };

  await sendTelegramMessage(chatId, defaultMsg, { reply_markup: defaultKeyboard });
}

/**
 * Long-polling loop fallback if Webhook is not used
 */
async function startPollingLoop() {
  if (isPollingActive || !BOT_TOKEN) return;
  isPollingActive = true;
  console.log(' [TELEGRAM BOT] Starting Long-Polling fallback engine...');

  while (isPollingActive) {
    try {
      const res = await axios.get(`${API_BASE}/getUpdates`, {
        params: { offset: pollingOffset, timeout: 20 },
        timeout: 25000
      });

      if (res.data?.ok && Array.isArray(res.data.result)) {
        for (const update of res.data.result) {
          pollingOffset = update.update_id + 1;
          handleTelegramUpdate(update).catch(err => {
            console.error('[Telegram Update Error]:', err.message);
          });
        }
      }
    } catch (err) {
      // If polling encounters temporary network timeout, wait 3 seconds and retry
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

/**
 * Initialize Webhook or Polling Engine
 */
export async function initTelegramBotEngine() {
  if (!BOT_TOKEN) {
    console.log(' [TELEGRAM BOT] No TELEGRAM_BOT_TOKEN provided — running in WebApp mode.');
    return;
  }

  try {
    const me = await axios.get(`${API_BASE}/getMe`);
    if (me.data?.ok) {
      botUsername = me.data.result.username || 'aipcore_bot';
      console.log(` [TELEGRAM BOT] Bot Online: @${botUsername} (${me.data.result.first_name})`);

      // 1. Try to register Telegram Webhook to HTTPS domain
      const webhookUrl = `${APP_URL}/api/telegram/webhook`;
      try {
        const setWhRes = await axios.post(`${API_BASE}/setWebhook`, {
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query']
        });
        if (setWhRes.data?.ok) {
          console.log(` [TELEGRAM BOT] Webhook registered successfully: ${webhookUrl}`);
          return; // Webhook registered! No need for polling.
        }
      } catch (whErr) {
        console.warn(' [TELEGRAM BOT] Webhook setup failed, falling back to Long-Polling:', whErr.message);
      }

      // 2. If Webhook setup failed, use Long Polling as robust fallback
      startPollingLoop();
    }
  } catch (e) {
    console.warn(' [TELEGRAM BOT] Initialization check failed:', e.message);
  }
}
