/**
 * Blockchain Utilities
 * Functions for interacting with smart contracts on BSC
 */

import { ethers } from 'ethers';

// BSC Mainnet RPC
const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed.binance.org/';

// HouseForgeAgent contract address
const AGENT_CONTRACT = process.env.HOUSEFORGE_AGENT_ADDRESS || '0xeAcf52Cb95e511EDe5107f9F33fEE0B7B77F9E2B';

// Minimal ABI for ownership check
const OWNER_OF_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
];

// Cache provider instance
let providerInstance: ethers.JsonRpcProvider | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!providerInstance) {
    providerInstance = new ethers.JsonRpcProvider(RPC_URL);
  }
  return providerInstance;
}

/**
 * Check if an address owns a specific token
 * @param tokenId The NFT token ID
 * @param userAddress The wallet address to check
 * @returns true if the address owns the token, false otherwise
 */
export async function verifyTokenOwnership(tokenId: number, userAddress: string): Promise<boolean> {
  try {
    const provider = getProvider();
    const contract = new ethers.Contract(AGENT_CONTRACT, OWNER_OF_ABI, provider);

    const owner = await contract.ownerOf(tokenId);

    // Compare addresses (case-insensitive)
    return owner.toLowerCase() === userAddress.toLowerCase();
  } catch (error: any) {
    // Token might not exist yet or other RPC error
    console.error(`Ownership check failed for token ${tokenId}:`, error?.message);
    return false;
  }
}

/**
 * Get the owner address of a token
 * @param tokenId The NFT token ID
 * @returns The owner address or null if token doesn't exist
 */
export async function getTokenOwner(tokenId: number): Promise<string | null> {
  try {
    const provider = getProvider();
    const contract = new ethers.Contract(AGENT_CONTRACT, OWNER_OF_ABI, provider);

    const owner = await contract.ownerOf(tokenId);
    return owner;
  } catch (error: any) {
    console.error(`Failed to get owner for token ${tokenId}:`, error?.message);
    return null;
  }
}
