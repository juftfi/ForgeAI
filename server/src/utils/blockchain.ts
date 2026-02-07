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

// Minimal ABI for contract reads
const AGENT_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getRarityTier(uint256 tokenId) view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function getLineage(uint256 tokenId) view returns (uint256 parent1, uint256 parent2, uint256 generation, uint8 houseId, bool sealed)',
];

// Multicall3 on BSC (standard address)
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])',
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
      const contract = new ethers.Contract(AGENT_CONTRACT, AGENT_ABI, provider);

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
      const contract = new ethers.Contract(AGENT_CONTRACT, AGENT_ABI, provider);

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

/**
 * Get the on-chain rarity tier for a token
 * @param tokenId The NFT token ID
 * @returns The rarity tier (0-4) or null if token doesn't exist
 */
export async function getOnChainRarityTier(tokenId: number): Promise<number | null> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(AGENT_CONTRACT, AGENT_ABI, provider);
      const tier = await contract.getRarityTier(tokenId);
      return Number(tier);
    } catch (error: any) {
      if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
        resetProvider();
        continue;
      }
      if (error?.code === 'CALL_EXCEPTION' || error?.message?.includes('revert')) {
        return null;
      }
      resetProvider();
    }
  }
  return null;
}

/**
 * Get total supply from the contract
 */
export async function getTotalSupply(): Promise<number | null> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const provider = getProvider();
      const contract = new ethers.Contract(AGENT_CONTRACT, AGENT_ABI, provider);
      const supply = await contract.totalSupply();
      return Number(supply);
    } catch (error: any) {
      if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
        resetProvider();
        continue;
      }
      resetProvider();
    }
  }
  return null;
}

// =============================================================
//  On-Chain Rarity Cache (immutable — loaded once)
// =============================================================

const TIER_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic'];

/** tokenId -> rarity name (e.g. "Common") */
let rarityCache: Map<number, string> | null = null;
let rarityCachePromise: Promise<Map<number, string>> | null = null;

/**
 * Batch query getRarityTier for a range of tokens using Multicall3.
 */
async function batchRarityTier(startId: number, endId: number): Promise<Map<number, string>> {
  const provider = getProvider();
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const agentIface = new ethers.Interface(AGENT_ABI);
  const result = new Map<number, string>();

  const CHUNK = 200;
  for (let from = startId; from <= endId; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, endId);
    const calls = [];
    for (let id = from; id <= to; id++) {
      calls.push({
        target: AGENT_CONTRACT,
        allowFailure: true,
        callData: agentIface.encodeFunctionData('getRarityTier', [id]),
      });
    }

    try {
      const responses: Array<{ success: boolean; returnData: string }> = await multicall.aggregate3(calls);
      for (let i = 0; i < responses.length; i++) {
        if (responses[i].success && responses[i].returnData !== '0x') {
          try {
            const [tier] = agentIface.decodeFunctionResult('getRarityTier', responses[i].returnData);
            const tierNum = Number(tier);
            if (tierNum >= 0 && tierNum < TIER_NAMES.length) {
              result.set(from + i, TIER_NAMES[tierNum]);
            }
          } catch {}
        }
      }
    } catch (error: any) {
      console.error(`[Blockchain] Rarity multicall batch ${from}-${to} failed:`, error?.message?.substring(0, 150));
    }
  }

  return result;
}

/**
 * Load all on-chain rarity tiers into cache. Minting is closed so this is immutable.
 */
async function loadRarityCache(): Promise<Map<number, string>> {
  const supply = await getTotalSupply();
  if (!supply) {
    throw new Error('Cannot get totalSupply for rarity cache');
  }

  console.log(`[Blockchain] Loading on-chain rarity cache for ${supply} tokens...`);
  const start = Date.now();
  const cache = await batchRarityTier(1, supply);
  console.log(`[Blockchain] Rarity cache loaded: ${cache.size} tokens in ${Date.now() - start}ms`);

  rarityCache = cache;
  return cache;
}

/**
 * Get the on-chain rarity name for a token. Uses permanent cache.
 * Returns e.g. "Common", "Epic", or null if token not found.
 */
export async function getOnChainRarity(tokenId: number): Promise<string | null> {
  if (!rarityCache) {
    if (!rarityCachePromise) {
      rarityCachePromise = loadRarityCache().finally(() => { rarityCachePromise = null; });
    }
    const cache = await rarityCachePromise;
    return cache.get(tokenId) ?? null;
  }
  return rarityCache.get(tokenId) ?? null;
}

/**
 * Get the full rarity cache map. Loads if not yet loaded.
 */
export async function getRarityCache(): Promise<Map<number, string>> {
  if (rarityCache) return rarityCache;
  if (!rarityCachePromise) {
    rarityCachePromise = loadRarityCache().finally(() => { rarityCachePromise = null; });
  }
  return rarityCachePromise;
}

// =============================================================
//  Ownership Cache + Multicall Batch Queries
// =============================================================

interface OwnershipCache {
  // tokenId -> owner address (lowercase)
  owners: Map<number, string>;
  supply: number;
  updatedAt: number;
}

let ownershipCache: OwnershipCache | null = null;
const CACHE_TTL = 30_000; // 30 seconds
let cacheRefreshPromise: Promise<OwnershipCache> | null = null;

/**
 * Batch query ownerOf for a range of tokens using Multicall3.
 * Returns a Map of tokenId -> owner address.
 */
async function batchOwnerOf(startId: number, endId: number): Promise<Map<number, string>> {
  const provider = getProvider();
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const agentIface = new ethers.Interface(AGENT_ABI);
  const result = new Map<number, string>();

  // Process in chunks of 200 to avoid RPC payload limits
  const CHUNK = 200;
  for (let from = startId; from <= endId; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, endId);
    const calls = [];
    for (let id = from; id <= to; id++) {
      calls.push({
        target: AGENT_CONTRACT,
        allowFailure: true,
        callData: agentIface.encodeFunctionData('ownerOf', [id]),
      });
    }

    try {
      const responses: Array<{ success: boolean; returnData: string }> = await multicall.aggregate3(calls);
      for (let i = 0; i < responses.length; i++) {
        if (responses[i].success && responses[i].returnData !== '0x') {
          try {
            const [owner] = agentIface.decodeFunctionResult('ownerOf', responses[i].returnData);
            result.set(from + i, (owner as string).toLowerCase());
          } catch {}
        }
      }
    } catch (error: any) {
      console.error(`[Blockchain] Multicall batch ${from}-${to} failed:`, error?.message?.substring(0, 150));
      // Fallback: skip this chunk (will be retried on next cache refresh)
    }
  }

  return result;
}

/**
 * Refresh the ownership cache using Multicall3.
 */
async function refreshOwnershipCache(): Promise<OwnershipCache> {
  const supply = await getTotalSupply();
  if (!supply) {
    throw new Error('Cannot get totalSupply');
  }

  console.log(`[Blockchain] Refreshing ownership cache for ${supply} tokens...`);
  const start = Date.now();
  const owners = await batchOwnerOf(1, supply);
  console.log(`[Blockchain] Cache refreshed: ${owners.size} owners in ${Date.now() - start}ms`);

  const cache: OwnershipCache = {
    owners,
    supply,
    updatedAt: Date.now(),
  };
  ownershipCache = cache;
  return cache;
}

/**
 * Get (or refresh) the ownership cache. Deduplicates concurrent refresh requests.
 */
async function getOwnershipCache(): Promise<OwnershipCache> {
  if (ownershipCache && Date.now() - ownershipCache.updatedAt < CACHE_TTL) {
    return ownershipCache;
  }

  // Deduplicate concurrent refresh calls
  if (!cacheRefreshPromise) {
    cacheRefreshPromise = refreshOwnershipCache().finally(() => {
      cacheRefreshPromise = null;
    });
  }
  return cacheRefreshPromise;
}

export interface UserToken {
  tokenId: number;
  houseId: number;
  generation: number;
  sealed: boolean;
  metadata?: any;
}

/**
 * Get all tokens owned by a specific address.
 * Uses cached ownership data + Multicall for lineage.
 */
export async function getUserTokens(userAddress: string): Promise<UserToken[]> {
  const cache = await getOwnershipCache();
  const addr = userAddress.toLowerCase();

  // Find all tokens owned by this address
  const tokenIds: number[] = [];
  for (const [tokenId, owner] of cache.owners) {
    if (owner === addr) tokenIds.push(tokenId);
  }

  if (tokenIds.length === 0) return [];

  // Batch query lineage via Multicall
  const provider = getProvider();
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const agentIface = new ethers.Interface(AGENT_ABI);

  const calls = tokenIds.map(id => ({
    target: AGENT_CONTRACT,
    allowFailure: true,
    callData: agentIface.encodeFunctionData('getLineage', [id]),
  }));

  const tokens: UserToken[] = [];

  try {
    const responses: Array<{ success: boolean; returnData: string }> = await multicall.aggregate3(calls);
    for (let i = 0; i < responses.length; i++) {
      if (responses[i].success) {
        try {
          const decoded = agentIface.decodeFunctionResult('getLineage', responses[i].returnData);
          tokens.push({
            tokenId: tokenIds[i],
            houseId: Number(decoded.houseId),
            generation: Number(decoded.generation),
            sealed: decoded.sealed,
          });
        } catch {
          tokens.push({ tokenId: tokenIds[i], houseId: 0, generation: 0, sealed: false });
        }
      }
    }
  } catch (error: any) {
    console.error(`[Blockchain] Lineage multicall failed:`, error?.message?.substring(0, 150));
    // Return token IDs without lineage as fallback
    for (const id of tokenIds) {
      tokens.push({ tokenId: id, houseId: 0, generation: 0, sealed: false });
    }
  }

  return tokens.sort((a, b) => a.tokenId - b.tokenId);
}
