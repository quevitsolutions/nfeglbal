import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { bsc } from 'wagmi/chains';
import { http } from 'wagmi';

export const projectId = import.meta.env.VITE_PROJECT_ID;

if (!projectId) {
  console.warn("VITE_PROJECT_ID is missing! Wallet connection may fail.");
}

export const config = getDefaultConfig({
  appName: 'AIPCore Hub',
  projectId: projectId || 'ad615b7c3d0dc4e3aee306104d15c745', // Legacy fallback only
  chains: [bsc],
  transports: {
    [bsc.id]: http('https://bsc-dataseed.binance.org/'),
  },
  ssr: true,
});
