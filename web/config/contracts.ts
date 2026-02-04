import { Address } from 'viem';

// Contract addresses - BSC Mainnet only (not deployed on testnet)
export const CONTRACTS = {
  HouseForgeAgent: {
    56: '0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f' as Address, // BSC Mainnet (V3 - new economics)
  },
  FusionCore: {
    56: '0xa62E109Db724308FEB530A0b00431cf47BBC1f6E' as Address, // BSC Mainnet (V3 - tiered fees)
  },
} as const;

export const HOUSE_FORGE_AGENT_ABI = [
  // ERC721 standard
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isApprovedForAll',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setApprovalForAll',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenOfOwnerByIndex',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // HouseForge specific - Public mint (S3 strategy: all params at mint)
  {
    type: 'function',
    name: 'mintGenesisPublic',
    inputs: [
      { name: 'houseId', type: 'uint8' },
      { name: 'persona', type: 'string' },
      { name: 'experience', type: 'string' },
      { name: 'vaultURI', type: 'string' },
      { name: 'vaultHash', type: 'bytes32' },
      { name: 'learningRoot', type: 'bytes32' },
      { name: 'traitsHash', type: 'bytes32' },
      { name: 'rarityTier', type: 'uint8' },
      { name: 'merkleProof', type: 'bytes32[]' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'payable',
  },
  // Admin mint
  {
    type: 'function',
    name: 'mintGenesis',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'houseId', type: 'uint8' },
      { name: 'persona', type: 'string' },
      { name: 'experience', type: 'string' },
      { name: 'vaultURI', type: 'string' },
      { name: 'vaultHash', type: 'bytes32' },
      { name: 'learningRoot', type: 'bytes32' },
      { name: 'traitsHash', type: 'bytes32' },
      { name: 'rarityTier', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Mint price functions
  {
    type: 'function',
    name: 'publicPrice',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowlistPrice',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'publicMintActive',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowlistActive',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'perWalletLimit',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMintCount',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getWalletLimit',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'specialWallet',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'specialWalletLimit',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'mintOffspring',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'parent1', type: 'uint256' },
      { name: 'parent2', type: 'uint256' },
      { name: 'houseId', type: 'uint8' },
      { name: 'persona', type: 'string' },
      { name: 'vaultURI', type: 'string' },
      { name: 'vaultHash', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getMetadata',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'persona', type: 'string' },
          { name: 'experience', type: 'string' },
          { name: 'vaultURI', type: 'string' },
          { name: 'vaultHash', type: 'bytes32' },
          { name: 'learningRoot', type: 'bytes32' },
          { name: 'learningVersion', type: 'uint256' },
          { name: 'lastLearningUpdate', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLineage',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'parent1', type: 'uint256' },
          { name: 'parent2', type: 'uint256' },
          { name: 'generation', type: 'uint256' },
          { name: 'houseId', type: 'uint8' },
          { name: 'isSealed', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getState',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'seal',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'burn',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateLearning',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'newRoot', type: 'bytes32' },
      { name: 'newVersion', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'GenesisMinted',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'houseId', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OffspringMinted',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'parent1', type: 'uint256', indexed: true },
      { name: 'parent2', type: 'uint256', indexed: true },
      { name: 'generation', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Sealed',
    inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'Burned',
    inputs: [{ name: 'tokenId', type: 'uint256', indexed: true }],
  },
] as const;

export const FUSION_CORE_ABI = [
  {
    type: 'function',
    name: 'commitFusion',
    inputs: [
      { name: 'parentA', type: 'uint256' },
      { name: 'parentB', type: 'uint256' },
      { name: 'commitHash', type: 'bytes32' },
      { name: 'mode', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revealFusion',
    inputs: [
      { name: 'parentA', type: 'uint256' },
      { name: 'parentB', type: 'uint256' },
      { name: 'salt', type: 'bytes32' },
      { name: 'vaultURI', type: 'string' },
      { name: 'vaultHash', type: 'bytes32' },
      { name: 'learningRoot', type: 'bytes32' },
      { name: 'offspringPersona', type: 'string' },
      { name: 'offspringExperience', type: 'string' },
      { name: 'offspringHouseId', type: 'uint8' },
      { name: 'offspringTraitsHash', type: 'bytes32' },
      { name: 'offspringRarityTier', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getFusionFee',
    inputs: [
      { name: 'parentA', type: 'uint256' },
      { name: 'parentB', type: 'uint256' },
    ],
    outputs: [
      { name: 'totalFee', type: 'uint256' },
      { name: 'baseAmount', type: 'uint256' },
      { name: 'rareAmount', type: 'uint256' },
      { name: 'mythicAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cancelFusion',
    inputs: [
      { name: 'parentA', type: 'uint256' },
      { name: 'parentB', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hasActiveCommit',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'parentA', type: 'uint256' },
      { name: 'parentB', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCommit',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'parentA', type: 'uint256' },
      { name: 'parentB', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'commitHash', type: 'bytes32' },
          { name: 'commitBlock', type: 'uint256' },
          { name: 'revealed', type: 'bool' },
          { name: 'mode', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'REVEAL_WINDOW',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_REVEAL_DELAY',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'FusionCommitted',
    inputs: [
      { name: 'parentA', type: 'uint256', indexed: true },
      { name: 'parentB', type: 'uint256', indexed: true },
      { name: 'commitHash', type: 'bytes32', indexed: false },
      { name: 'mode', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FusionRevealed',
    inputs: [
      { name: 'parentA', type: 'uint256', indexed: true },
      { name: 'parentB', type: 'uint256', indexed: true },
      { name: 'offspringId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'FusionCancelled',
    inputs: [
      { name: 'parentA', type: 'uint256', indexed: true },
      { name: 'parentB', type: 'uint256', indexed: true },
    ],
  },
] as const;

// Fusion modes
export enum FusionMode {
  BURN_TO_MINT = 0,
  SEAL = 1,
}

// Agent states
export enum AgentState {
  ACTIVE = 0,
  SEALED = 1,
  BURNED = 2,
}

// House mapping
export const HOUSES = {
  1: { name: 'CLEAR', color: '#60A5FA' },
  2: { name: 'MONSOON', color: '#34D399' },
  3: { name: 'THUNDER', color: '#A78BFA' },
  4: { name: 'FROST', color: '#93C5FD' },
  5: { name: 'AURORA', color: '#F472B6' },
  6: { name: 'SAND', color: '#FBBF24' },
  7: { name: 'ECLIPSE', color: '#6B7280' },
} as const;
