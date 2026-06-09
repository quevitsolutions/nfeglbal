export const formatNumber = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Number(n).toLocaleString();
};

export const shortAddr = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

export const formatBNB = (wei, symbol = "BNB") => {
  try {
    return parseFloat(wei).toFixed(4) + " " + symbol;
  } catch {
    return "0 " + symbol;
  }
};

export const getRefLink = (userId) =>
  `https://t.me/NFEGlobalBot?start=ref_${userId}`;

export const getWebAppRefLink = (userId) =>
  `https://t.me/NFEGlobalBot/app?startapp=ref_${userId}`;

