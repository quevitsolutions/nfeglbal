import { useState, useEffect } from 'react';
import { blockchain } from '../services/blockchain.js';

let _cachedPrice = 0;
let _subscriberCount = 0;
const _listeners = new Set();

const notifyAll = (price) => _listeners.forEach(fn => fn(price));

/**
 * Shared Native Token/USD price hook — reads from the on-chain AIPCore oracle.
 * Single fetch per page load, shared across all mounted consumers.
 */
export function useNativePrice() {
  const [price, setPrice] = useState(_cachedPrice);

  useEffect(() => {
    const listener = (p) => setPrice(p);
    _listeners.add(listener);
    _subscriberCount++;

    if (_cachedPrice > 0) {
      setPrice(_cachedPrice);
    } else {
      // First subscriber triggers the fetch
      blockchain._getNativeUsdPrice().then(p => {
        _cachedPrice = p;
        notifyAll(p);
      }).catch(() => {});
    }

    return () => {
      _listeners.delete(listener);
      _subscriberCount--;
    };
  }, []);

  return price;
}

// Keep useBnbPrice as an alias for compatibility
export const useBnbPrice = useNativePrice;

/** Formats native token + inline $ equivalent string */
export const formatNativeUsd = (amount, priceUsd) => {
  const num = parseFloat(amount) || 0;
  const usd = priceUsd > 0 ? (num * priceUsd).toFixed(2) : null;
  return { amount: num.toFixed(4), usd };
};

export const formatBnbUsd = formatNativeUsd;

let _cachedSymbol = '';
const _symbolListeners = new Set();
const notifyAllSymbols = (sym) => _symbolListeners.forEach(fn => fn(sym));

export function useNativeTokenSymbol() {
  const [symbol, setSymbol] = useState(_cachedSymbol || 'BNB');

  useEffect(() => {
    const listener = (s) => setSymbol(s);
    _symbolListeners.add(listener);

    const fallbackSymbol = async () => {
      try {
        const provider = blockchain._getProvider();
        const net = await provider.getNetwork();
        const chainId = Number(net.chainId);
        let sym = 'BNB';
        if (chainId === 137 || chainId === 80001 || chainId === 80002) sym = 'POL';
        else if (chainId === 8453 || chainId === 84531 || chainId === 84532 || chainId === 42161 || chainId === 421613 || chainId === 421614) sym = 'ETH';
        else if (chainId === 43114 || chainId === 43113) sym = 'AVAX';
        _cachedSymbol = sym;
        notifyAllSymbols(sym);
      } catch {
        _cachedSymbol = 'BNB';
        notifyAllSymbols('BNB');
      }
    };

    if (_cachedSymbol) {
      setSymbol(_cachedSymbol);
    } else {
      if (typeof blockchain.core.nativeTokenSymbol === 'function') {
        blockchain.core.nativeTokenSymbol().then(sym => {
          if (sym) {
            _cachedSymbol = sym;
            notifyAllSymbols(sym);
          }
        }).catch(async () => {
          await fallbackSymbol();
        });
      } else {
        fallbackSymbol();
      }
    }

    return () => {
      _symbolListeners.delete(listener);
    };
  }, []);

  return symbol;
}

