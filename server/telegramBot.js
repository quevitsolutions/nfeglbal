import axios from 'axios';

/**
 * AIPCore Telegram Bot Service Engine
 * Native Bot API integration for Telegram Mini App & Notification Engine
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const APP_URL = process.env.APP_URL || 'https://aipcore.online';

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
 * Handle incoming Telegram Webhook / Message update
 */
export async function handleTelegramUpdate(update) {
  if (!update || !update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const user = msg.from;

  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const startParam = parts.length > 1 ? parts[1] : '';

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
    const refLink = `${APP_URL}/?ref=${user.id}`;
    const botRefLink = `https://t.me/AIPCoreBot?start=${user.id}`;

    const refMsg = `<b>🔗 Your AIPCore Referral Links</b>\n\n` +
      `• Web Link: <code>${refLink}</code>\n` +
      `• Bot Direct Link: <code>${botRefLink}</code>\n\n` +
      `Share this link with your friends. When they register, they lock into your 2x18 Matrix team!`;

    const keyboard = {
      inline_keyboard: [[
        { text: '📤 Share Link', url: `https://t.me/share/url?url=${encodeURIComponent(botRefLink)}&text=${encodeURIComponent('Join AIPCore FREE on BSC!')}` }
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
}

/**
 * Initialize Webhook or Polling if Bot Token exists
 */
export async function initTelegramBotEngine() {
  if (!BOT_TOKEN) {
    console.log(' [TELEGRAM BOT] No TELEGRAM_BOT_TOKEN provided — running in WebApp mode.');
    return;
  }

  try {
    const me = await axios.get(`${API_BASE}/getMe`);
    if (me.data?.ok) {
      console.log(` [TELEGRAM BOT] Bot Online: @${me.data.result.username} (${me.data.result.first_name})`);
    }
  } catch (e) {
    console.warn(' [TELEGRAM BOT] Initialization check failed:', e.message);
  }
}
