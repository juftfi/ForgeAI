import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { bsc } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'KinForge',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'houseforge-demo',
  chains: [bsc],  // Only BSC Mainnet - contract not deployed on testnet
  ssr: true,
});

export const CHAIN_ID = 56;  // BSC Mainnet only
