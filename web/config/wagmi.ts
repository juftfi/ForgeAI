import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { bsc, bscTestnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'HouseForge',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'houseforge-demo',
  chains: [bsc, bscTestnet],
  ssr: true,
});

export const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID === '56' ? 56 : 97;
