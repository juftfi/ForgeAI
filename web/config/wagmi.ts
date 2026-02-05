import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  walletConnectWallet,
  okxWallet,
  binanceWallet,
  coinbaseWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { bsc } from 'wagmi/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'houseforge-demo';

const connectors = connectorsForWallets(
  [
    {
      groupName: '推荐',
      wallets: [
        binanceWallet,
        okxWallet,
        metaMaskWallet,
      ],
    },
    {
      groupName: '更多钱包',
      wallets: [
        trustWallet,
        coinbaseWallet,
        walletConnectWallet,
      ],
    },
  ],
  {
    appName: 'KinForge',
    projectId,
  }
);

export const config = createConfig({
  connectors,
  chains: [bsc],
  transports: {
    [bsc.id]: http(),
  },
  ssr: true,
});

export const CHAIN_ID = 56;  // BSC Mainnet only
