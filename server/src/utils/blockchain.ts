/**
 * Blockchain Utilities
 * Functions for interacting with smart contracts on BSC
 */

import { ethers } from 'ethers';

// BSC Mainnet RPC URLs (fallback list)
const BSC_RPC_URLS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.binance.org/',
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/',
];

// Get RPC URL - use env var only if it's a valid BSC mainnet URL
function getRpcUrl(): string {
  const envUrl = process.env.RPC_URL;
  // Only use env URL if it looks like a mainnet URL (not testnet)
  if (envUrl && !envUrl.includes('testnet') && !envUrl.includes('blast')) {
    return envUrl;
  }
  return BSC_RPC_URLS[0];
}

// HouseForgeAgent contract address (V3 - new economics)
const AGENT_CONTRACT = process.env.HOUSEFORGE_AGENT_ADDRESS || '0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f';

// Minimal ABI for ownership check
const OWNER_OF_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
];

// Cache provider instance
let providerInstance: ethers.JsonRpcProvider | null = null;
let currentRpcIndex = 0;

function getProvider(): ethers.JsonRpcProvider {
  if (!providerInstance) {
    const rpcUrl = getRpcUrl();
    console.log(`[Blockchain] Using RPC: ${rpcUrl}`);
    providerInstance = new ethers.JsonRpcProvider(rpcUrl);
  }
  return providerInstance;
}

// Reset provider and try next RPC on failure
function resetProvider(): void {
  providerInstance = null;
  currentRpcIndex = (currentRpcIndex + 1) % BSC_RPC_URLS.length;
}

/**
 * Check if an address owns a specific token
 * @param tokenId The NFT token ID
 * @param userAddress The wallet address to check
 * @returns true if the address owns the token, false otherwise
 */
export async function verifyTokenOwnership(tokenId: number, userAddress: string): Promise<boolean> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(AGENT_CONTRACT, OWNER_OF_ABI, provider);

      console.log(`[Blockchain] Checking ownership: token=${tokenId}, user=${userAddress.substring(0, 10)}...`);
      const owner = await contract.ownerOf(tokenId);
      console.log(`[Blockchain] Token ${tokenId} owner: ${owner}`);

      // Compare addresses (case-insensitive)
      const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
      console.log(`[Blockchain] Ownership match: ${isOwner}`);
      return isOwner;
    } catch (error: any) {
      console.error(`[Blockchain] Attempt ${attempt + 1} failed for token ${tokenId}:`, error?.message?.substring(0, 200));

      // If it's a network error, try a different RPC
      if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
        resetProvider();
        console.log(`[Blockchain] Switching to backup RPC...`);
        continue;
      }

      // If token doesn't exist (revert), return false
      if (error?.code === 'CALL_EXCEPTION' || error?.message?.includes('revert')) {
        console.log(`[Blockchain] Token ${tokenId} does not exist or was burned`);
        return false;
      }

      // Unknown error - try again
      resetProvider();
    }
  }

  console.error(`[Blockchain] All ${maxRetries} attempts failed for token ${tokenId}`);
  return false;
}

/**
 * Get the owner address of a token
 * @param tokenId The NFT token ID
 * @returns The owner address or null if token doesn't exist
 */
export async function getTokenOwner(tokenId: number): Promise<string | null> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(AGENT_CONTRACT, OWNER_OF_ABI, provider);

      const owner = await contract.ownerOf(tokenId);
      return owner;
    } catch (error: any) {
      console.error(`[Blockchain] getTokenOwner attempt ${attempt + 1} failed:`, error?.message?.substring(0, 200));

      // If it's a network error, try a different RPC
      if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
        resetProvider();
        continue;
      }

      // Token doesn't exist
      if (error?.code === 'CALL_EXCEPTION' || error?.message?.includes('revert')) {
        return null;
      }

      resetProvider();
    }
  }

  return null;
}
