import { ethers } from 'ethers';
import { getVaultService, VaultCreateResult } from './vault.js';
import {
  generateFusionMetadata,
  ParentInfo,
  GeneratedTraits,
  AgentMetadata,
} from './traitEngine.js';
import { computeFusionSeed, computeTraitsHash } from '../utils/hash.js';

// Contract ABIs (minimal)
const AGENT_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getMetadata(uint256 tokenId) view returns (tuple(string persona, string experience, string vaultURI, bytes32 vaultHash, bytes32 learningRoot, uint256 learningVersion, uint256 lastLearningUpdate))',
  'function getLineage(uint256 tokenId) view returns (tuple(uint256 parent1, uint256 parent2, uint256 generation, uint8 houseId, bool sealed))',
  'function isSealed(uint256 tokenId) view returns (bool)',
];

const FUSION_ABI = [
  'function commitFusion(uint256 parentA, uint256 parentB, bytes32 commitHash, uint8 mode)',
  'function revealFusion(uint256 parentA, uint256 parentB, bytes32 salt, string vaultURI, bytes32 vaultHash, bytes32 learningRoot, string offspringPersona, string offspringExperience, uint8 offspringHouseId) returns (uint256)',
  'function getCommit(address owner, uint256 parentA, uint256 parentB) view returns (tuple(bytes32 commitHash, uint256 commitBlock, bool revealed, uint8 mode))',
  'function hasActiveCommit(address owner, uint256 parentA, uint256 parentB) view returns (bool)',
  'function getCommitBlockHash(address owner, uint256 parentA, uint256 parentB) view returns (bytes32)',
];

export enum FusionMode {
  BURN_TO_MINT = 0,
  SEAL = 1,
}

export interface CommitInput {
  parentAId: number;
  parentBId: number;
  salt: string;
  mode: FusionMode;
  userAddress: string;
}

export interface RevealInput {
  parentAId: number;
  parentBId: number;
  salt: string;
  userAddress: string;
}

export interface CommitResult {
  commitHash: string;
  parentA: number;
  parentB: number;
  mode: FusionMode;
}

export interface RevealResult {
  offspringMetadata: AgentMetadata;
  vault: VaultCreateResult;
  offspringHouseId: number;
  traitsHash: string;
}

// House key to ID mapping
const HOUSE_KEY_TO_ID: Record<string, number> = {
  CLEAR: 1,
  MONSOON: 2,
  THUNDER: 3,
  FROST: 4,
  AURORA: 5,
  SAND: 6,
  ECLIPSE: 7,
};

const HOUSE_ID_TO_KEY: Record<number, string> = {
  1: 'CLEAR',
  2: 'MONSOON',
  3: 'THUNDER',
  4: 'FROST',
  5: 'AURORA',
  6: 'SAND',
  7: 'ECLIPSE',
};

/**
 * Fusion Orchestrator - coordinates off-chain trait generation with on-chain fusion
 */
export class FusionOrchestrator {
  private provider: ethers.Provider;
  private agentContract: ethers.Contract;
  private fusionContract: ethers.Contract;

  constructor(
    rpcUrl: string,
    agentAddress: string,
    fusionAddress: string
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.agentContract = new ethers.Contract(agentAddress, AGENT_ABI, this.provider);
    this.fusionContract = new ethers.Contract(fusionAddress, FUSION_ABI, this.provider);
  }

  /**
   * Prepare commit data (returns hash, user submits to contract)
   */
  async prepareCommit(input: CommitInput): Promise<CommitResult> {
    const { parentAId, parentBId, salt, mode, userAddress } = input;

    // Verify ownership
    const ownerA = await this.agentContract.ownerOf(parentAId);
    const ownerB = await this.agentContract.ownerOf(parentBId);

    if (ownerA.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error('User does not own parentA');
    }
    if (ownerB.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error('User does not own parentB');
    }

    // Check not sealed
    const sealedA = await this.agentContract.isSealed(parentAId);
    const sealedB = await this.agentContract.isSealed(parentBId);

    if (sealedA) throw new Error('ParentA is sealed');
    if (sealedB) throw new Error('ParentB is sealed');

    // Get current block
    const currentBlock = await this.provider.getBlockNumber();

    // Compute commit hash
    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'bytes32', 'uint256', 'address', 'uint8'],
        [parentAId, parentBId, salt, currentBlock, userAddress, mode]
      )
    );

    return {
      commitHash,
      parentA: parentAId,
      parentB: parentBId,
      mode,
    };
  }

  /**
   * Generate offspring data for reveal
   */
  async prepareReveal(input: RevealInput): Promise<RevealResult> {
    const { parentAId, parentBId, salt, userAddress } = input;

    // Get commit info
    const commit = await this.fusionContract.getCommit(userAddress, parentAId, parentBId);

    if (commit.commitBlock === 0n) {
      throw new Error('No commit found');
    }
    if (commit.revealed) {
      throw new Error('Already revealed');
    }

    // Get commit block hash
    const commitBlockHash = await this.fusionContract.getCommitBlockHash(userAddress, parentAId, parentBId);

    // Get parent info
    const parentA = await this.getParentInfo(parentAId);
    const parentB = await this.getParentInfo(parentBId);

    // Compute fusion seed
    const fusionSeed = computeFusionSeed(
      parentAId,
      parentBId,
      parentA.learningRoot,
      parentB.learningRoot,
      salt,
      commitBlockHash
    );

    // Generate offspring metadata using trait engine
    const offspringMetadata = generateFusionMetadata(
      0, // Token ID will be assigned by contract
      parentA,
      parentB,
      fusionSeed
    );

    // Create vault entry
    const vaultService = getVaultService();
    const vault = vaultService.create({
      parentAId,
      parentBId,
      parentALearningRoot: parentA.learningRoot,
      parentBLearningRoot: parentB.learningRoot,
      fusionVersion: '1.0.0',
      seed: fusionSeed,
      traits: offspringMetadata.traits,
      personaDelta: offspringMetadata.persona,
    });

    const offspringHouseId = HOUSE_KEY_TO_ID[offspringMetadata.traits.House];
    const traitsHash = computeTraitsHash(offspringMetadata.traits);

    return {
      offspringMetadata,
      vault,
      offspringHouseId,
      traitsHash,
    };
  }

  /**
   * Get parent info from contract
   */
  private async getParentInfo(tokenId: number): Promise<ParentInfo> {
    const metadata = await this.agentContract.getMetadata(tokenId);
    const lineage = await this.agentContract.getLineage(tokenId);

    const houseKey = HOUSE_ID_TO_KEY[lineage.houseId] || 'CLEAR';

    // Parse traits from vault (simplified - in production would fetch from vault service)
    // For now, create minimal traits structure
    const traits: GeneratedTraits = {
      Season: 'S0',
      House: houseKey,
      RarityTier: 'Common', // Would parse from experience or vault
      WeatherID: `S0-${houseKey}-0001`,
      FrameType: 'TitaniumBlack_Brushed',
      CoreMaterial: 'VolumetricCloud',
      LightSignature: 'Sunbeam',
      InstrumentMark: 'FineScale',
      Atmosphere: 'Clean',
      DioramaGeometry: 'Capsule',
      PaletteTemperature: 'Neutral',
      SurfaceAging: 'Pristine',
      MicroEngraving: 'SerialOnly',
      LensBloom: 'Soft',
    };

    // Try to get actual traits from vault service
    const vaultService = getVaultService();
    const vaultData = vaultService.getByTokenId(tokenId);
    if (vaultData) {
      Object.assign(traits, vaultData.traits);
    }

    return {
      tokenId,
      house: houseKey,
      rarity: traits.RarityTier,
      generation: Number(lineage.generation),
      traits,
      learningRoot: metadata.learningRoot,
    };
  }

  /**
   * Encode reveal call data for user to submit
   */
  encodeRevealCalldata(
    parentAId: number,
    parentBId: number,
    salt: string,
    revealResult: RevealResult
  ): string {
    const iface = new ethers.Interface(FUSION_ABI);
    return iface.encodeFunctionData('revealFusion', [
      parentAId,
      parentBId,
      salt,
      revealResult.vault.vaultURI,
      revealResult.vault.vaultHash,
      revealResult.vault.learningRoot,
      JSON.stringify(revealResult.offspringMetadata.persona),
      `Gen${revealResult.offspringMetadata.generation} | House ${revealResult.offspringMetadata.traits.House}`,
      revealResult.offspringHouseId,
    ]);
  }
}

// Singleton
let orchestratorInstance: FusionOrchestrator | null = null;

export function getFusionOrchestrator(
  rpcUrl?: string,
  agentAddress?: string,
  fusionAddress?: string
): FusionOrchestrator {
  if (!orchestratorInstance) {
    const url = rpcUrl || process.env.RPC_URL || 'http://localhost:8545';
    const agent = agentAddress || process.env.HOUSEFORGE_AGENT_ADDRESS || '';
    const fusion = fusionAddress || process.env.FUSION_CORE_ADDRESS || '';

    if (!agent || !fusion) {
      throw new Error('Contract addresses not configured');
    }

    orchestratorInstance = new FusionOrchestrator(url, agent, fusion);
  }
  return orchestratorInstance;
}
