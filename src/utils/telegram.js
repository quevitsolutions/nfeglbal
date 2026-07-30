/**
 * AIPCore Telegram WebApp & Helper Module
 * Provides integration with Telegram Mini App WebApp SDK,
 * Haptic Feedback, Deep Linking, and Sharing utilities.
 */

// Safe accessor for Telegram WebApp object
export const getTelegramWebApp = () => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
};

// Check if running inside Telegram Mini App environment
export const isTelegramMiniApp = () => {
  const tg = getTelegramWebApp();
  return !!(tg && tg.initData && tg.initData.length > 0);
};

// Get current Telegram user profile (if launched inside Telegram)
export const getTelegramUser = () => {
  const tg = getTelegramWebApp();
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    return tg.initDataUnsafe.user;
  }
  return null;
};

// Parse deep-link referral parameter from Telegram WebApp
export const getTelegramStartParam = () => {
  const tg = getTelegramWebApp();
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
    return tg.initDataUnsafe.start_param;
  }
  return null;
};

// Initialize and configure Telegram WebApp UI
export const initTelegramApp = () => {
  const tg = getTelegramWebApp();
  if (!tg) return false;

  try {
    tg.ready();
    tg.expand();

    // Set theme colors matching AIPCore dark styling
    if (tg.setHeaderColor) tg.setHeaderColor('#020305');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#020305');
    if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();

    return true;
  } catch (e) {
    console.warn('[Telegram] Mini App init error:', e);
    return false;
  }
};

// Haptic feedback engine
export const triggerHaptic = (type = 'light') => {
  const tg = getTelegramWebApp();
  if (!tg || !tg.HapticFeedback) return;

  try {
    switch (type) {
      case 'light':
      case 'medium':
      case 'heavy':
      case 'rigid':
      case 'soft':
        tg.HapticFeedback.impactOccurred(type);
        break;
      case 'error':
      case 'success':
      case 'warning':
        tg.HapticFeedback.notificationOccurred(type);
        break;
      case 'selection':
        tg.HapticFeedback.selectionChanged();
        break;
      default:
        tg.HapticFeedback.impactOccurred('light');
    }
  } catch (e) {
    // Ignore haptic errors in browser
  }
};

// Share referral link directly on Telegram
export const shareOnTelegram = (shareUrl, text = '') => {
  const tg = getTelegramWebApp();
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(text);

  const telegramShareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;

  if (tg && tg.openTelegramLink) {
    try {
      tg.openTelegramLink(telegramShareUrl);
      return;
    } catch (e) {
      // Fallback to window open if openTelegramLink fails
    }
  }

  if (typeof window !== 'undefined') {
    window.open(telegramShareUrl, '_blank', 'noopener,noreferrer');
  }
};

// Open bot chat directly
export const openTelegramBot = (botUsername = 'AIPCoreBot', startParam = '') => {
  const tg = getTelegramWebApp();
  const botUrl = startParam 
    ? `https://t.me/${botUsername}?start=${startParam}`
    : `https://t.me/${botUsername}`;

  if (tg && tg.openTelegramLink) {
    try {
      tg.openTelegramLink(botUrl);
      return;
    } catch (e) {
      // Fallback
    }
  }

  if (typeof window !== 'undefined') {
    window.open(botUrl, '_blank', 'noopener,noreferrer');
  }
};
