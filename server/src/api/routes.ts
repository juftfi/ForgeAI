import { Router, Request, Response } from 'express';
import { getVaultService } from '../services/vault.js';
// traitEngine is dynamically imported where needed
import { loadGenesis } from '../utils/yaml.js';
import { getChatService } from '../services/chat.js';
import { getMemoryService } from '../services/memory.js';
import { getLearningService } from '../services/learning.js';
import { getMoodService, MOOD_CONFIG } from '../services/mood.js';
import { getRelationshipService, RELATIONSHIP_LEVELS } from '../services/relationship.js';
import { getTopicService, TOPIC_CONFIG } from '../services/topic.js';
import { getKeyPool } from '../services/keyPool.js';
import { verifyTokenOwnership, getTokenOwner } from '../utils/blockchain.js';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const router = Router();

// =============================================================
//                      SYSTEM ROUTES
// =============================================================

/**
 * GET /system/key-pool
 * 获取 API Key Pool 状态（仅管理员）
 */
router.get('/system/key-pool', (req: Request, res: Response) => {
  try {
    // 简单的密钥验证（生产环境应使用更安全的方式）
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_API_KEY && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const keyPool = getKeyPool();
    const status = keyPool.getStatus();

    res.json({
      openai: {
        total: keyPool.getTotalCount('openai'),
        available: keyPool.getAvailableCount('openai'),
        keys: status.openai,
      },
      anthropic: {
        total: keyPool.getTotalCount('anthropic'),
        available: keyPool.getAvailableCount('anthropic'),
        keys: status.anthropic,
      },
    });
  } catch (error) {
    console.error('Key pool status error:', error);
    res.status(500).json({ error: 'Failed to get key pool status' });
  }
});

// =============================================================
//                      VAULT ROUTES
// =============================================================

/**
 * POST /vault/create
 * Create a new vault entry
 */
router.post('/vault/create', (req: Request, res: Response) => {
  try {
    const { tokenId, parentAId, parentBId, parentALearningRoot, parentBLearningRoot,
            fusionVersion, seed, traits, personaDelta, summary } = req.body;

    if (!traits || typeof traits !== 'object') {
      return res.status(400).json({ error: 'traits is required and must be an object' });
    }

    const vaultService = getVaultService();
    const result = vaultService.create({
      tokenId,
      parentAId,
      parentBId,
      parentALearningRoot,
      parentBLearningRoot,
      fusionVersion,
      seed,
      traits,
      personaDelta,
      summary,
    });

    res.json(result);
  } catch (error) {
    console.error('Vault create error:', error);
    res.status(500).json({ error: 'Failed to create vault' });
  }
});

/**
 * GET /vault/:id
 * Get vault by ID
 */
router.get('/vault/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const vaultService = getVaultService();
    const vault = vaultService.getById(id);

    if (!vault) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    res.json(vault);
  } catch (error) {
    console.error('Vault get error:', error);
    res.status(500).json({ error: 'Failed to get vault' });
  }
});

/**
 * GET /vault/token/:tokenId
 * Get vault by token ID
 */
router.get('/vault/token/:tokenId', (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const vaultService = getVaultService();
    const vault = vaultService.getByTokenId(tokenId);

    if (!vault) {
      return res.status(404).json({ error: 'Vault not found for token' });
    }

    res.json(vault);
  } catch (error) {
    console.error('Vault get by token error:', error);
    res.status(500).json({ error: 'Failed to get vault' });
  }
});

// =============================================================
//                    METADATA ROUTES
// =============================================================

// Metadata is in server/data/metadata for Railway deployment
const METADATA_DIR = path.resolve(process.cwd(), 'data/metadata');
const RENDER_OUTPUT_DIR = path.resolve(process.cwd(), 'data/render/output');
const RENDER_RECIPES_DIR = path.resolve(process.cwd(), 'data/render/recipes');

/**
 * GET /metadata/:tokenId
 * Get token metadata (OpenSea format)
 */
router.get('/metadata/:tokenId', (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId) || tokenId < 1) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Helper to get working image URL (absolute URL for NFT marketplaces)
    // Always return PNG for maximum wallet compatibility (WebP not supported by all wallets)
    const API_BASE = process.env.API_BASE_URL || 'https://houseforgeserver-production.up.railway.app';
    const getImageUrl = (tid: number): string => {
      // Check for rendered images - prefer PNG for wallet compatibility
      const webpPath = path.join(RENDER_OUTPUT_DIR, `${tid}.webp`);
      const pngPath = path.join(RENDER_OUTPUT_DIR, `${tid}.png`);
      if (fs.existsSync(pngPath)) {
        return `${API_BASE}/images/${tid}.png`;
      }
      // If only WebP exists, return PNG URL (server will auto-convert)
      if (fs.existsSync(webpPath)) {
        return `${API_BASE}/images/${tid}.png`;
      }
      // Fall back to placeholder SVG
      return `${API_BASE}/placeholder/${tid}.svg`;
    };

    // Try to read from file first
    const filepath = path.join(METADATA_DIR, `${tokenId}.json`);
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf8');
      const metadata = JSON.parse(content);
      // Override image URL to use working URL
      metadata.image = getImageUrl(tokenId);
      return res.json(metadata);
    }

    // Try to get from vault
    const vaultService = getVaultService();
    const vault = vaultService.getByTokenId(tokenId);

    if (vault) {
      // Generate metadata from vault
      const metadata = {
        name: `KinForge Agent #${tokenId} — ${vault.traits.House} 家族`,
        description: '在 KinForge 诞生的可交易非同质化智能体。',
        image: getImageUrl(tokenId),
        attributes: Object.entries(vault.traits).map(([trait_type, value]) => ({
          trait_type,
          value,
        })),
      };
      return res.json(metadata);
    }

    res.status(404).json({ error: 'Metadata not found' });
  } catch (error) {
    console.error('Metadata get error:', error);
    res.status(500).json({ error: 'Failed to get metadata' });
  }
});

/**
 * GET /metadata/collection
 * Get collection metadata
 */
router.get('/metadata/collection', (_req: Request, res: Response) => {
  try {
    const filepath = path.join(METADATA_DIR, 'collection.json');
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf8');
      return res.json(JSON.parse(content));
    }

    // Default collection metadata
    res.json({
      name: 'KinForge Genesis',
      description: 'KinForge 非同质化智能体创世系列。',
      image: '/placeholder/collection.svg',
      external_link: 'https://kinforge.io',
    });
  } catch (error) {
    console.error('Collection metadata error:', error);
    res.status(500).json({ error: 'Failed to get collection metadata' });
  }
});

// =============================================================
//                    FUSION ROUTES
// =============================================================

/**
 * POST /fusion/prepare-commit
 * Prepare commit data for fusion
 */
router.post('/fusion/prepare-commit', async (req: Request, res: Response) => {
  try {
    const { parentAId, parentBId, salt, mode, userAddress } = req.body;

    if (!parentAId || !parentBId || !salt || mode === undefined || !userAddress) {
      return res.status(400).json({
        error: 'Missing required fields: parentAId, parentBId, salt, mode, userAddress'
      });
    }

    // In a real implementation, this would use the FusionOrchestrator
    // For demo, we just return the computed commit hash
    const { ethers } = await import('ethers');
    const currentBlock = Date.now(); // Placeholder for block number

    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'bytes32', 'uint256', 'address', 'uint8'],
        [parentAId, parentBId, salt, currentBlock, userAddress, mode]
      )
    );

    res.json({
      commitHash,
      parentA: parentAId,
      parentB: parentBId,
      mode,
      estimatedBlock: currentBlock,
    });
  } catch (error) {
    console.error('Prepare commit error:', error);
    res.status(500).json({ error: 'Failed to prepare commit' });
  }
});

/**
 * POST /fusion/prepare-reveal
 * Prepare reveal data for fusion (generates offspring traits)
 */
router.post('/fusion/prepare-reveal', async (req: Request, res: Response) => {
  try {
    const { parentAId, parentBId, salt, commitBlock, commitBlockHash } = req.body;

    // Accept either commitBlock (number) or commitBlockHash (hash)
    const blockIdentifier = commitBlockHash || (commitBlock ? `0x${BigInt(commitBlock).toString(16).padStart(64, '0')}` : null);

    if (!parentAId || !parentBId || !salt || !blockIdentifier) {
      return res.status(400).json({
        error: 'Missing required fields: parentAId, parentBId, salt, commitBlock or commitBlockHash'
      });
    }

    // Get parent info from vault
    const vaultService = getVaultService();
    const parentAVault = vaultService.getByTokenId(parentAId);
    const parentBVault = vaultService.getByTokenId(parentBId);

    // Create mock parent info if vaults don't exist (for demo)
    const mockParentInfo = (id: number, houseKey: string) => ({
      tokenId: id,
      house: houseKey,
      rarity: 'Common',
      generation: 0,
      traits: {
        Season: 'S0',
        House: houseKey,
        RarityTier: 'Common',
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
      },
      learningRoot: '0x' + '0'.repeat(64),
    });

    const parentA = parentAVault
      ? {
          tokenId: parentAId,
          house: parentAVault.traits.House || 'CLEAR',
          rarity: parentAVault.traits.RarityTier || 'Common',
          generation: 0,
          traits: parentAVault.traits as any,
          learningRoot: '0x' + '0'.repeat(64),
        }
      : mockParentInfo(parentAId, 'CLEAR');

    const parentB = parentBVault
      ? {
          tokenId: parentBId,
          house: parentBVault.traits.House || 'MONSOON',
          rarity: parentBVault.traits.RarityTier || 'Common',
          generation: 0,
          traits: parentBVault.traits as any,
          learningRoot: '0x' + '0'.repeat(64),
        }
      : mockParentInfo(parentBId, 'MONSOON');

    // Import and use trait engine
    const { generateFusionMetadata, toOpenSeaMetadata } = await import('../services/traitEngine.js');
    const { computeFusionSeed, computeTraitsHash } = await import('../utils/hash.js');

    // Compute fusion seed
    const fusionSeed = computeFusionSeed(
      parentAId,
      parentBId,
      parentA.learningRoot,
      parentB.learningRoot,
      salt,
      blockIdentifier
    );

    // Generate offspring
    const offspringMetadata = generateFusionMetadata(0, parentA, parentB, fusionSeed);

    // Create vault for offspring
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

    const HOUSE_KEY_TO_ID: Record<string, number> = {
      CLEAR: 1, MONSOON: 2, THUNDER: 3, FROST: 4, AURORA: 5, SAND: 6, ECLIPSE: 7
    };

    const offspringHouseId = HOUSE_KEY_TO_ID[offspringMetadata.traits.House] || 1;
    const traitsHash = computeTraitsHash(offspringMetadata.traits);

    // Map rarity to tier number
    const RARITY_TO_TIER: Record<string, number> = {
      Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Mythic: 4
    };
    const offspringRarityTier = RARITY_TO_TIER[offspringMetadata.traits.RarityTier] || 0;

    res.json({
      offspring: toOpenSeaMetadata(offspringMetadata),
      vault: {
        vaultId: vault.vaultId,
        vaultURI: vault.vaultURI,
        vaultHash: vault.vaultHash,
        learningRoot: vault.learningRoot,
      },
      offspringHouseId,
      offspringPersona: JSON.stringify(offspringMetadata.persona),
      offspringExperience: `Offspring of #${parentAId} and #${parentBId}`,
      offspringRarityTier,
      traitsHash,
      isMythic: offspringMetadata.isMythic,
      mythicKey: offspringMetadata.mythicKey,
    });
  } catch (error: any) {
    console.error('Prepare reveal error:', error);
    res.status(500).json({
      error: 'Failed to prepare reveal',
      details: error?.message || String(error)
    });
  }
});

// =============================================================
//                    LINEAGE ROUTES
// =============================================================

// Minimal ABI for getLineage
const AGENT_ABI_LINEAGE = [
  'function getLineage(uint256 tokenId) view returns (tuple(uint256 parent1, uint256 parent2, uint256 generation, uint8 houseId, bool isSealed))',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

/**
 * GET /lineage/:tokenId
 * Get lineage data for a token from the blockchain (with caching for burned tokens)
 */
router.get('/lineage/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId) || tokenId < 1) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const vaultService = getVaultService();
    const db = vaultService.getDatabase();

    // House ID to name mapping
    const HOUSE_ID_TO_NAME: Record<number, string> = {
      1: 'CLEAR', 2: 'MONSOON', 3: 'THUNDER', 4: 'FROST',
      5: 'AURORA', 6: 'SAND', 7: 'ECLIPSE'
    };

    // Check cache first
    const cached = db.prepare('SELECT * FROM lineage_cache WHERE token_id = ?').get(tokenId) as any;

    // Try to fetch from blockchain
    let lineageData: any = null;

    try {
      const { ethers } = await import('ethers');
      // Use BSC mainnet RPC, ignore testnet URLs from env
      const envRpc = process.env.RPC_URL || '';
      const rpcUrl = (envRpc && !envRpc.includes('testnet') && !envRpc.includes('blast'))
        ? envRpc
        : 'https://bsc-dataseed.binance.org/';
      const agentAddress = process.env.HOUSEFORGE_AGENT_ADDRESS || '0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f';

      console.log(`[Lineage] Fetching token ${tokenId} from ${rpcUrl}`);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(agentAddress, AGENT_ABI_LINEAGE, provider);

      const lineage = await contract.getLineage(tokenId);
      const houseId = Number(lineage.houseId);

      lineageData = {
        tokenId,
        parent1: Number(lineage.parent1),
        parent2: Number(lineage.parent2),
        generation: Number(lineage.generation),
        houseId: houseId,
        houseName: HOUSE_ID_TO_NAME[houseId] || 'UNKNOWN',
        sealed: Boolean(lineage.isSealed),
        isSealed: Boolean(lineage.isSealed),
        isBurned: false,
      };

      // Update cache
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR REPLACE INTO lineage_cache
        (token_id, parent1, parent2, generation, house_id, house_name, is_sealed, is_burned, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        tokenId,
        lineageData.parent1,
        lineageData.parent2,
        lineageData.generation,
        lineageData.houseId,
        lineageData.houseName,
        lineageData.sealed ? 1 : 0,
        cached?.created_at || now,
        now
      );
    } catch (chainError: any) {
      // Chain call failed - token might be burned
      console.log(`Chain call failed for token ${tokenId}:`, chainError?.message?.substring(0, 100));

      if (cached) {
        // Return cached data, mark as burned if not already
        if (!cached.is_burned) {
          db.prepare('UPDATE lineage_cache SET is_burned = 1, updated_at = ? WHERE token_id = ?')
            .run(new Date().toISOString(), tokenId);
        }

        lineageData = {
          tokenId: cached.token_id,
          parent1: cached.parent1,
          parent2: cached.parent2,
          generation: cached.generation,
          houseId: cached.house_id,
          houseName: cached.house_name,
          sealed: Boolean(cached.is_sealed),
          isSealed: Boolean(cached.is_sealed),
          isBurned: true,
        };
      }
    }

    if (lineageData) {
      return res.json(lineageData);
    }

    // No data from chain and no cache
    return res.status(404).json({ error: 'Token not found or has no lineage data' });
  } catch (error: any) {
    console.error('Lineage get error:', error);
    res.status(500).json({ error: 'Failed to get lineage data', details: error?.message });
  }
});

// =============================================================
//                    STATS ROUTES
// =============================================================

// =============================================================
//                    GENESIS PREVIEW ROUTES
// =============================================================

/**
 * GET /genesis/preview/:house or /preview/:house
 * Get a random pre-generated genesis agent for preview (no wallet required)
 */
router.get('/preview/:house', (req: Request, res: Response) => {
  // Redirect to /genesis/preview/:house
  res.redirect(`/genesis/preview/${req.params.house}`);
});

router.get('/genesis/preview/:house', (req: Request, res: Response) => {
  try {
    const { house } = req.params;
    const houseUpper = house.toUpperCase();

    // Validate house - support both old (weather) and new (Kin) names
    const validHouses = ['CLEAR', 'MONSOON', 'THUNDER', 'FROST', 'AURORA', 'SAND', 'ECLIPSE',
                         'ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA', 'OMEGA'];
    if (!validHouses.includes(houseUpper)) {
      return res.status(400).json({ error: 'Invalid house name' });
    }

    // Map new Kin names to old weather names for metadata lookup
    const KIN_TO_WEATHER: Record<string, string> = {
      'ALPHA': 'CLEAR', 'BETA': 'MONSOON', 'GAMMA': 'THUNDER', 'DELTA': 'FROST',
      'EPSILON': 'AURORA', 'ZETA': 'SAND', 'OMEGA': 'ECLIPSE'
    };
    const lookupHouse = KIN_TO_WEATHER[houseUpper] || houseUpper;

    // Find all metadata files for this house
    if (!fs.existsSync(METADATA_DIR)) {
      return res.status(404).json({ error: 'No genesis agents found' });
    }

    const files = fs.readdirSync(METADATA_DIR)
      .filter(f => f.endsWith('.json') && f !== 'collection.json');

    // Find agents matching this house
    const matchingAgents: { tokenId: number; metadata: any }[] = [];
    for (const file of files) {
      const tokenId = parseInt(file.replace('.json', ''), 10);
      if (isNaN(tokenId)) continue;

      const content = fs.readFileSync(path.join(METADATA_DIR, file), 'utf8');
      const metadata = JSON.parse(content);

      // Check house attribute
      const houseAttr = metadata.attributes?.find((a: any) => a.trait_type === 'House');
      if (houseAttr?.value === houseUpper) {
        matchingAgents.push({ tokenId, metadata });
      }

      // Limit search for performance
      if (matchingAgents.length >= 100) break;
    }

    if (matchingAgents.length === 0) {
      return res.status(404).json({ error: 'No agents found for this house' });
    }

    // Pick a random agent for preview
    const randomAgent = matchingAgents[Math.floor(Math.random() * matchingAgents.length)];

    // Check if render exists (webp or png)
    const webpPath = path.join(RENDER_OUTPUT_DIR, `${randomAgent.tokenId}.webp`);
    const pngPath = path.join(RENDER_OUTPUT_DIR, `${randomAgent.tokenId}.png`);
    const hasWebp = fs.existsSync(webpPath);
    const hasPng = fs.existsSync(pngPath);
    const hasRender = hasWebp || hasPng;
    const imageExt = hasWebp ? 'webp' : 'png';

    // Always provide an image URL - use placeholder if no render
    const imageUrl = hasRender
      ? `/images/${randomAgent.tokenId}.${imageExt}`
      : `/placeholder/${randomAgent.tokenId}.svg`;

    // Update metadata.image to use working URL
    randomAgent.metadata.image = imageUrl;

    res.json({
      tokenId: randomAgent.tokenId,
      metadata: randomAgent.metadata,
      hasRender,
      imageUrl,
      previewOnly: true,
    });
  } catch (error) {
    console.error('Genesis preview error:', error);
    res.status(500).json({ error: 'Failed to get preview agent' });
  }
});

/**
 * GET /genesis/available/:house
 * Get list of available (unminted) genesis agents for a house
 */
router.get('/genesis/available/:house', (req: Request, res: Response) => {
  try {
    const { house } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const houseUpper = house.toUpperCase();

    // Validate house
    const validHouses = ['CLEAR', 'MONSOON', 'THUNDER', 'FROST', 'AURORA', 'SAND', 'ECLIPSE'];
    if (!validHouses.includes(houseUpper)) {
      return res.status(400).json({ error: 'Invalid house name' });
    }

    if (!fs.existsSync(METADATA_DIR)) {
      return res.status(404).json({ error: 'No genesis agents found' });
    }

    const files = fs.readdirSync(METADATA_DIR)
      .filter(f => f.endsWith('.json') && f !== 'collection.json');

    // Find agents matching this house
    const availableAgents: { tokenId: number; rarity: string; weatherId: string }[] = [];
    for (const file of files) {
      const tokenId = parseInt(file.replace('.json', ''), 10);
      if (isNaN(tokenId)) continue;

      const content = fs.readFileSync(path.join(METADATA_DIR, file), 'utf8');
      const metadata = JSON.parse(content);

      const houseAttr = metadata.attributes?.find((a: any) => a.trait_type === 'House');
      if (houseAttr?.value === houseUpper) {
        const rarityAttr = metadata.attributes?.find((a: any) => a.trait_type === 'RarityTier');
        const weatherIdAttr = metadata.attributes?.find((a: any) => a.trait_type === 'WeatherID');
        availableAgents.push({
          tokenId,
          rarity: rarityAttr?.value || 'Common',
          weatherId: weatherIdAttr?.value || `S0-${houseUpper}-${tokenId}`,
        });
      }

      if (availableAgents.length >= limit) break;
    }

    res.json({
      house: houseUpper,
      available: availableAgents,
      total: availableAgents.length,
    });
  } catch (error) {
    console.error('Genesis available error:', error);
    res.status(500).json({ error: 'Failed to get available agents' });
  }
});

/**
 * POST /genesis/reserve
 * 方案B: 动态生成 - 不绑定特定 tokenId
 *
 * 用户选择 house → 动态生成 traits → 铸造后 finalize 确定实际 tokenId
 */
router.post('/genesis/reserve', async (req: Request, res: Response) => {
  try {
    const { house } = req.body;

    // Map house to ID
    const HOUSE_KEY_TO_ID: Record<string, number> = {
      CLEAR: 1, MONSOON: 2, THUNDER: 3, FROST: 4, AURORA: 5, SAND: 6, ECLIPSE: 7
    };

    // Map rarity to tier number
    const RARITY_TO_TIER: Record<string, number> = {
      Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Mythic: 4
    };

    if (!house) {
      return res.status(400).json({ error: 'house is required' });
    }

    const houseUpper = house.toUpperCase();
    if (!HOUSE_KEY_TO_ID[houseUpper]) {
      return res.status(400).json({ error: 'Invalid house name' });
    }

    // 动态导入 traitEngine
    const { generateGenesisTraits } = await import('../services/traitEngine.js');
    const genesis = loadGenesis().genesis;

    // 随机选择稀有度（基于分布概率）
    const rarityRoll = Math.random();
    let cumulativeProb = 0;
    let selectedRarity = 'Common';
    for (const [rarity, prob] of Object.entries(genesis.rarity_distribution)) {
      cumulativeProb += prob as number;
      if (rarityRoll < cumulativeProb) {
        selectedRarity = rarity;
        break;
      }
    }

    // 生成随机种子和序列号
    const randomSeed = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    const randomSerial = Math.floor(Math.random() * 9999) + 1;

    // 动态生成 traits（tokenId 用 0 作为占位符，finalize 时更新）
    const traits = generateGenesisTraits(0, houseUpper, selectedRarity, randomSerial, randomSeed);

    // 添加 Generation trait
    const fullTraits: Record<string, string> = {
      ...traits,
      Generation: '0',
    };

    // Compute traits hash
    const { computeTraitsHash } = require('../utils/hash.js');
    const traitsHash = computeTraitsHash(fullTraits);

    // 创建临时 vault（tokenId 用 -1 表示待定）
    const vaultService = getVaultService();
    const vault = vaultService.create({
      tokenId: -1, // 待定，finalize 时更新
      traits: fullTraits,
      summary: `Genesis agent (pending) | House: ${houseUpper} | Rarity: ${selectedRarity}`,
    });

    // 构建预览元数据（不保存文件）
    const previewMetadata = {
      name: `KinForge Agent — ${houseUpper}`,
      description: `在 KinForge 诞生的可交易非同质化智能体。血脉和学习记录可通过 vaultHash/learningRoot 验证；详细信息存储在保险库中。`,
      image: `ipfs://PENDING`,
      attributes: Object.entries(fullTraits).map(([trait_type, value]) => ({
        trait_type,
        value,
      })),
    };

    console.log(`[Reserve] Created pending vault ${vault.vaultId} for house ${houseUpper}, rarity ${selectedRarity}`);

    res.json({
      tokenId: null, // 待定，finalize 后确定
      metadata: previewMetadata,
      vault: {
        vaultId: vault.vaultId,
        vaultURI: vault.vaultURI,
        vaultHash: vault.vaultHash,
        learningRoot: vault.learningRoot,
      },
      mintParams: {
        houseId: HOUSE_KEY_TO_ID[houseUpper],
        persona: JSON.stringify({ house: traits.House, weatherId: traits.WeatherID }),
        experience: 'Genesis S0',
        vaultURI: vault.vaultURI,
        vaultHash: vault.vaultHash,
        learningRoot: vault.learningRoot,
        traitsHash,
        rarityTier: RARITY_TO_TIER[traits.RarityTier] || 0,
      },
    });
  } catch (error) {
    console.error('Genesis reserve error:', error);
    res.status(500).json({ error: 'Failed to reserve agent' });
  }
});

/**
 * POST /genesis/finalize
 * 方案B: 铸造成功后调用，绑定实际 tokenId 并生成元数据
 */
router.post('/genesis/finalize', async (req: Request, res: Response) => {
  try {
    const { vaultId, actualTokenId } = req.body;
    console.log(`[Finalize] Request: vaultId=${vaultId}, actualTokenId=${actualTokenId}`);

    if (!vaultId || actualTokenId === undefined) {
      return res.status(400).json({ error: 'vaultId and actualTokenId are required' });
    }

    const tokenId = typeof actualTokenId === 'number' ? actualTokenId : parseInt(actualTokenId, 10);
    if (isNaN(tokenId) || tokenId < 1) {
      return res.status(400).json({ error: `Invalid actualTokenId: ${actualTokenId}` });
    }

    const vaultService = getVaultService();

    // 查找 vault
    const vault = vaultService.getById(vaultId);
    if (!vault) {
      console.log(`[Finalize] Vault not found: ${vaultId}`);
      return res.status(404).json({ error: `Vault not found: ${vaultId}` });
    }
    console.log(`[Finalize] Found vault, traits:`, vault.traits);

    // 尝试验证链上所有权（最多重试3次，每次等待2秒）
    let owner: string | null = null;
    for (let i = 0; i < 3; i++) {
      owner = await getTokenOwner(tokenId);
      if (owner) break;
      console.log(`[Finalize] Token ${tokenId} not found on-chain, retry ${i + 1}/3...`);
      await new Promise(r => setTimeout(r, 2000));
    }

    // 即使链上检查失败也继续（可能是 RPC 延迟）
    if (!owner) {
      console.log(`[Finalize] Warning: Token ${tokenId} not confirmed on-chain, proceeding anyway`);
    }

    // 更新 vault 的 tokenId
    vaultService.setTokenId(vaultId, tokenId);

    // 生成并保存元数据文件
    const traits = vault.traits;
    const metadata = {
      name: `HouseForge Agent #${tokenId} — House ${traits.House}`,
      description: `A tradable Non-Fungible Agent born in HouseForge. Lineage and learning are verifiable via vaultHash/learningRoot; details live in the vault.`,
      image: `ipfs://PLACEHOLDER/${tokenId}.png`,
      attributes: Object.entries(traits).map(([trait_type, value]) => ({
        trait_type,
        value,
      })),
    };

    // 确保目录存在
    if (!fs.existsSync(METADATA_DIR)) {
      fs.mkdirSync(METADATA_DIR, { recursive: true });
    }

    // 保存元数据文件
    const metadataPath = path.join(METADATA_DIR, `${tokenId}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`[Finalize] Token #${tokenId} finalized, metadata saved to ${metadataPath}`);

    res.json({
      success: true,
      tokenId,
      owner: owner || 'pending',
      metadata,
      vault: {
        vaultId: vault.id,
        vaultHash: vault.traits ? require('../utils/hash.js').computeVaultHash(vault) : '',
        learningRoot: '',
      },
    });
  } catch (error: any) {
    console.error('Genesis finalize error:', error?.message || error);
    res.status(500).json({ error: `Failed to finalize: ${error?.message || 'Unknown error'}` });
  }
});

// =============================================================
//                    STATS ROUTES
// =============================================================

/**
 * GET /stats
 * Get collection statistics
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const genesis = loadGenesis().genesis;

    // Count metadata files
    let fileCount = 0;
    if (fs.existsSync(METADATA_DIR)) {
      fileCount = fs.readdirSync(METADATA_DIR)
        .filter(f => f.endsWith('.json') && f !== 'collection.json')
        .length;
    }

    res.json({
      totalSupply: genesis.total_supply,
      generatedMetadata: fileCount,
      houses: Object.entries(genesis.house_supply).map(([key, count]) => ({
        key,
        count,
      })),
      rarityDistribution: genesis.rarity_distribution,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /health
 * Health check
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =============================================================
//                    RENDER ROUTES
// =============================================================

// House colors for placeholder generation
const HOUSE_COLORS: Record<string, { primary: string; secondary: string }> = {
  CLEAR: { primary: '#60A5FA', secondary: '#3B82F6' },
  MONSOON: { primary: '#34D399', secondary: '#10B981' },
  THUNDER: { primary: '#A78BFA', secondary: '#8B5CF6' },
  FROST: { primary: '#93C5FD', secondary: '#60A5FA' },
  AURORA: { primary: '#F472B6', secondary: '#EC4899' },
  SAND: { primary: '#FBBF24', secondary: '#F59E0B' },
  ECLIPSE: { primary: '#6B7280', secondary: '#4B5563' },
};

/**
 * GET /placeholder/:tokenId.svg
 * Generate a placeholder SVG image for tokens without rendered images
 */
router.get('/placeholder/:tokenId.svg', (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId) || tokenId < 1) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Try to get house info from metadata
    let house = 'CLEAR';
    let rarity = 'Common';
    const filepath = path.join(METADATA_DIR, `${tokenId}.json`);
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf8');
      const metadata = JSON.parse(content);
      const houseAttr = metadata.attributes?.find((a: any) => a.trait_type === 'House');
      const rarityAttr = metadata.attributes?.find((a: any) => a.trait_type === 'RarityTier');
      if (houseAttr?.value) house = houseAttr.value;
      if (rarityAttr?.value) rarity = rarityAttr.value;
    }

    const colors = HOUSE_COLORS[house] || HOUSE_COLORS.CLEAR;

    // Rarity glow effects
    const rarityGlow: Record<string, string> = {
      Common: '',
      Uncommon: '<filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
      Rare: '<filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
      Epic: '<filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
      Legendary: '<filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
      Mythic: '<filter id="glow"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
    };

    const glowFilter = rarityGlow[rarity] || '';
    const useGlow = rarity !== 'Common' ? 'filter="url(#glow)"' : '';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#0f0f1a"/>
    </linearGradient>
    <linearGradient id="house" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors.primary}"/>
      <stop offset="100%" stop-color="${colors.secondary}"/>
    </linearGradient>
    ${glowFilter}
  </defs>

  <!-- Background -->
  <rect width="400" height="400" fill="url(#bg)"/>

  <!-- Hexagon frame -->
  <polygon points="200,40 340,110 340,250 200,320 60,250 60,110"
           fill="none" stroke="url(#house)" stroke-width="3" ${useGlow}/>

  <!-- DNA helix -->
  <g stroke="url(#house)" stroke-width="4" stroke-linecap="round" fill="none" ${useGlow}>
    <path d="M160,100 Q200,130 240,100"/>
    <path d="M160,130 Q200,160 240,130"/>
    <path d="M160,160 Q200,190 240,160"/>
    <path d="M160,190 Q200,220 240,190"/>
    <path d="M160,220 Q200,190 240,220"/>
  </g>

  <!-- Token ID -->
  <text x="200" y="280" font-family="monospace" font-size="24" fill="${colors.primary}" text-anchor="middle" font-weight="bold">
    #${tokenId}
  </text>

  <!-- House name -->
  <text x="200" y="350" font-family="sans-serif" font-size="16" fill="#666" text-anchor="middle">
    ${house}
  </text>

  <!-- KinForge branding -->
  <text x="200" y="380" font-family="sans-serif" font-size="12" fill="#444" text-anchor="middle">
    KinForge
  </text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
    res.send(svg);
  } catch (error) {
    console.error('Placeholder image error:', error);
    res.status(500).json({ error: 'Failed to generate placeholder' });
  }
});

/**
 * GET /images/:tokenId.webp or /images/:tokenId.png
 * Serve rendered token image (auto-converts WebP to PNG if needed)
 */
router.get('/images/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // Validate filename format (tokenId.webp or tokenId.png)
    const match = filename.match(/^(\d+)\.(webp|png|jpg)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid filename format' });
    }

    const tokenId = match[1];
    const requestedExt = match[2];

    const filepath = path.join(RENDER_OUTPUT_DIR, filename);

    // If requested file exists, serve it directly
    if (fs.existsSync(filepath)) {
      const contentTypes: Record<string, string> = {
        webp: 'image/webp',
        png: 'image/png',
        jpg: 'image/jpeg',
      };
      res.setHeader('Content-Type', contentTypes[requestedExt] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
      return res.sendFile(filepath);
    }

    // If PNG requested but only WebP exists, convert on-the-fly
    if (requestedExt === 'png') {
      const webpPath = path.join(RENDER_OUTPUT_DIR, `${tokenId}.webp`);
      if (fs.existsSync(webpPath)) {
        const pngBuffer = await sharp(webpPath).png().toBuffer();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.send(pngBuffer);
      }
    }

    // Try alternative extensions
    const alternatives = ['webp', 'png', 'jpg'].filter(e => e !== requestedExt);
    for (const altExt of alternatives) {
      const altPath = path.join(RENDER_OUTPUT_DIR, `${tokenId}.${altExt}`);
      if (fs.existsSync(altPath)) {
        return res.redirect(`/images/${tokenId}.${altExt}`);
      }
    }

    return res.status(404).json({ error: 'Image not found' });
  } catch (error) {
    console.error('Image serve error:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

/**
 * GET /recipes/:tokenId.json
 * Serve render recipe for a token
 */
router.get('/recipes/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // Validate filename format (tokenId.json)
    const match = filename.match(/^(\d+)\.json$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid filename format' });
    }

    const tokenId = match[1];
    const filepath = path.join(RENDER_RECIPES_DIR, `${tokenId}.json`);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
    res.json(JSON.parse(content));
  } catch (error) {
    console.error('Recipe serve error:', error);
    res.status(500).json({ error: 'Failed to serve recipe' });
  }
});

/**
 * GET /render/status
 * Get render job status
 */
router.get('/render/status', (_req: Request, res: Response) => {
  try {
    const statusFile = path.join(RENDER_RECIPES_DIR, '../jobs/status.json');

    if (!fs.existsSync(statusFile)) {
      return res.json({
        totalJobs: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        message: 'No render jobs created yet. Run pnpm render:jobs first.',
      });
    }

    const content = fs.readFileSync(statusFile, 'utf-8');
    res.json(JSON.parse(content));
  } catch (error) {
    console.error('Render status error:', error);
    res.status(500).json({ error: 'Failed to get render status' });
  }
});

/**
 * GET /render/recipes
 * List all render recipes
 */
router.get('/render/recipes', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    if (!fs.existsSync(RENDER_RECIPES_DIR)) {
      return res.json({
        recipes: [],
        total: 0,
        limit,
        offset,
      });
    }

    const files = fs.readdirSync(RENDER_RECIPES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => parseInt(f.replace('.json', ''), 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    const total = files.length;
    const paginatedIds = files.slice(offset, offset + limit);

    const recipes = paginatedIds.map(tokenId => {
      const filepath = path.join(RENDER_RECIPES_DIR, `${tokenId}.json`);
      const content = fs.readFileSync(filepath, 'utf-8');
      const recipe = JSON.parse(content);
      return {
        tokenId,
        houseKey: recipe.houseKey,
        recipeHash: recipe.recipeHash,
        outputPath: recipe.output.path,
      };
    });

    res.json({
      recipes,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('List recipes error:', error);
    res.status(500).json({ error: 'Failed to list recipes' });
  }
});

// =============================================================
//                    CHAT ROUTES
// =============================================================

/**
 * POST /chat/session
 * Create a new chat session with an agent
 * Only the token owner can create a chat session
 */
router.post('/chat/session', async (req: Request, res: Response) => {
  try {
    const { tokenId, userAddress } = req.body;

    if (!tokenId || typeof tokenId !== 'number') {
      return res.status(400).json({ error: 'tokenId is required and must be a number' });
    }
    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({ error: 'userAddress is required' });
    }

    // Verify token ownership on-chain
    const isOwner = await verifyTokenOwnership(tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({
        error: '您不是此智能体的持有者',
        message: 'Only the token owner can chat with this agent'
      });
    }

    const chatService = getChatService();
    const session = chatService.createSession(tokenId, userAddress);

    res.json(session);
  } catch (error: any) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session', details: error?.message });
  }
});

/**
 * POST /chat/message
 * Send a message and get AI response (owner only)
 */
router.post('/chat/message', async (req: Request, res: Response) => {
  try {
    const { sessionId, content, userAddress } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }

    const chatService = getChatService();
    const session = chatService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify ownership
    const walletAddress = userAddress || req.headers['x-user-address'] as string;
    if (!walletAddress) {
      return res.status(401).json({ error: '需要提供钱包地址' });
    }

    const isOwner = await verifyTokenOwnership(session.tokenId, walletAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者' });
    }

    const response = await chatService.sendMessage(sessionId, content);

    res.json(response);
  } catch (error: any) {
    console.error('Send message error:', error);

    // Handle specific errors
    if (error?.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error?.message?.includes('ended')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to send message', details: error?.message });
  }
});

/**
 * GET /chat/session/:sessionId
 * Get session details and history (owner only)
 */
router.get('/chat/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const chatService = getChatService();
    const session = chatService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Require ownership verification
    const userAddress = req.query.userAddress as string || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(401).json({ error: '需要提供钱包地址 (userAddress 参数或 x-user-address 头)' });
    }

    const isOwner = await verifyTokenOwnership(session.tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者，无法查看聊天记录' });
    }

    const history = chatService.getHistory(sessionId, limit);

    res.json({
      ...session,
      messages: history,
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to get session', details: error?.message });
  }
});

/**
 * GET /chat/sessions/:tokenId
 * Get all sessions for a token (owner only)
 */
router.get('/chat/sessions/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Require ownership verification
    const userAddress = req.query.userAddress as string || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(401).json({ error: '需要提供钱包地址 (userAddress 参数或 x-user-address 头)' });
    }

    const isOwner = await verifyTokenOwnership(tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者，无法查看会话列表' });
    }

    const limit = parseInt(req.query.limit as string, 10) || 20;

    const chatService = getChatService();
    const sessions = chatService.getSessionsByToken(tokenId, limit);

    res.json({ tokenId, sessions });
  } catch (error: any) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions', details: error?.message });
  }
});

/**
 * GET /chat/history/:tokenId
 * Get chat history with date filtering and messages (owner only)
 * 获取对话历史，支持日期过滤和消息内容
 */
router.get('/chat/history/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Require ownership verification
    const userAddress = req.query.userAddress as string || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(401).json({ error: '需要提供钱包地址 (userAddress 参数或 x-user-address 头)' });
    }

    const isOwner = await verifyTokenOwnership(tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者，无法查看对话历史' });
    }

    // Parse query params
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const includeMessages = req.query.includeMessages === 'true';

    const chatService = getChatService();
    const result = chatService.getSessionsWithFilters(tokenId, {
      startDate,
      endDate,
      limit,
      offset,
      includeMessages,
    });

    res.json({
      tokenId,
      ...result,
      hasMore: offset + result.sessions.length < result.total,
    });
  } catch (error: any) {
    console.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to get chat history', details: error?.message });
  }
});

/**
 * POST /chat/session/:sessionId/end
 * End a session and extract memories (owner only)
 */
router.post('/chat/session/:sessionId/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const chatService = getChatService();
    const session = chatService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify ownership
    const userAddress = req.body.userAddress || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(401).json({ error: '需要提供钱包地址' });
    }

    const isOwner = await verifyTokenOwnership(session.tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者' });
    }

    const summary = await chatService.endSession(sessionId);

    res.json(summary);
  } catch (error: any) {
    console.error('End session error:', error);

    if (error?.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to end session', details: error?.message });
  }
});

/**
 * GET /agent/:tokenId/mood
 * Get agent mood state (public - shows current mood)
 * 获取智能体当前心情状态（公开接口）
 */
router.get('/agent/:tokenId/mood', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const moodService = getMoodService();
    const mood = moodService.getMood(tokenId);
    const config = MOOD_CONFIG[mood.currentMood];

    res.json({
      tokenId,
      currentMood: mood.currentMood,
      moodLabel: config.label,
      moodEmoji: config.emoji,
      moodColor: config.color,
      moodIntensity: mood.moodIntensity,
      moodStability: mood.moodStability,
      positiveStreak: mood.positiveStreak,
      negativeStreak: mood.negativeStreak,
      totalInteractions: mood.totalInteractions,
      lastInteractionAt: mood.lastInteractionAt,
      recentMoodHistory: mood.moodHistory.slice(0, 5),
    });
  } catch (error: any) {
    console.error('Get agent mood error:', error);
    res.status(500).json({ error: 'Failed to get mood', details: error?.message });
  }
});

/**
 * GET /agent/:tokenId/relationship
 * Get user-agent relationship (requires wallet address)
 * 获取用户与智能体的关系等级
 */
router.get('/agent/:tokenId/relationship', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const userAddress = req.query.userAddress as string || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(400).json({ error: '需要提供钱包地址 (userAddress 参数)' });
    }

    const relationshipService = getRelationshipService();
    const relationship = relationshipService.getRelationship(tokenId, userAddress);
    const levelConfig = relationshipService.getLevelConfig(relationship.relationshipLevel);
    const expProgress = relationshipService.getExpToNextLevel(relationship.experiencePoints);

    res.json({
      tokenId,
      userAddress: relationship.userAddress,
      level: relationship.relationshipLevel,
      levelTitle: levelConfig.title,
      levelTitleEn: levelConfig.titleEn,
      levelColor: levelConfig.color,
      benefits: levelConfig.benefits,
      experiencePoints: relationship.experiencePoints,
      expProgress: {
        current: expProgress.current,
        required: expProgress.required,
        percentage: expProgress.progress,
      },
      stats: {
        totalSessions: relationship.totalSessions,
        totalMessages: relationship.totalMessages,
        positiveInteractions: relationship.positiveInteractions,
      },
      firstInteractionAt: relationship.firstInteractionAt,
      lastInteractionAt: relationship.lastInteractionAt,
      allLevels: RELATIONSHIP_LEVELS.map(l => ({
        level: l.level,
        title: l.title,
        titleEn: l.titleEn,
        minExp: l.minExp,
        color: l.color,
      })),
    });
  } catch (error: any) {
    console.error('Get relationship error:', error);
    res.status(500).json({ error: 'Failed to get relationship', details: error?.message });
  }
});

/**
 * GET /agent/:tokenId/relationships
 * Get all relationships for an agent (leaderboard)
 * 获取智能体的所有关系（排行榜）
 */
router.get('/agent/:tokenId/relationships', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const limit = parseInt(req.query.limit as string, 10) || 10;

    const relationshipService = getRelationshipService();
    const relationships = relationshipService.getAgentRelationships(tokenId, limit);

    const result = relationships.map(r => {
      const levelConfig = relationshipService.getLevelConfig(r.relationshipLevel);
      return {
        userAddress: r.userAddress,
        level: r.relationshipLevel,
        levelTitle: levelConfig.title,
        levelColor: levelConfig.color,
        experiencePoints: r.experiencePoints,
        totalSessions: r.totalSessions,
        lastInteractionAt: r.lastInteractionAt,
      };
    });

    res.json({
      tokenId,
      relationships: result,
      total: result.length,
    });
  } catch (error: any) {
    console.error('Get relationships error:', error);
    res.status(500).json({ error: 'Failed to get relationships', details: error?.message });
  }
});

/**
 * GET /agent/:tokenId/topics
 * Get conversation topic statistics (public)
 * 获取对话主题统计（公开接口）
 */
router.get('/agent/:tokenId/topics', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const topicService = getTopicService();
    const stats = topicService.getTopicStats(tokenId);

    // 添加主题配置信息
    const topicsWithConfig = stats.topTopics.map(t => ({
      ...t,
      label: TOPIC_CONFIG[t.topic]?.label || t.topic,
      emoji: TOPIC_CONFIG[t.topic]?.emoji || '💬',
      color: TOPIC_CONFIG[t.topic]?.color || '#9ca3af',
    }));

    const distributionWithConfig = Object.entries(stats.topicDistribution)
      .filter(([_, count]) => count > 0)
      .map(([topic, count]) => ({
        topic,
        count,
        label: TOPIC_CONFIG[topic as keyof typeof TOPIC_CONFIG]?.label || topic,
        emoji: TOPIC_CONFIG[topic as keyof typeof TOPIC_CONFIG]?.emoji || '💬',
        color: TOPIC_CONFIG[topic as keyof typeof TOPIC_CONFIG]?.color || '#9ca3af',
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      tokenId,
      totalTopics: stats.totalTopics,
      topTopics: topicsWithConfig,
      distribution: distributionWithConfig,
      recentTopics: stats.recentTopics.map(t => ({
        ...t,
        label: TOPIC_CONFIG[t.topic]?.label || t.topic,
        emoji: TOPIC_CONFIG[t.topic]?.emoji || '💬',
      })),
    });
  } catch (error: any) {
    console.error('Get topics error:', error);
    res.status(500).json({ error: 'Failed to get topics', details: error?.message });
  }
});

/**
 * GET /chat/stats/:tokenId
 * Get chat statistics for a token (public - no ownership required)
 * 获取智能体的对话统计数据（公开接口）
 */
router.get('/chat/stats/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const chatService = getChatService();
    const stats = chatService.getChatStats(tokenId);

    res.json(stats);
  } catch (error: any) {
    console.error('Get chat stats error:', error);
    res.status(500).json({ error: 'Failed to get chat stats', details: error?.message });
  }
});

// =============================================================
//                    MEMORY ROUTES
// =============================================================

/**
 * GET /agent/:tokenId/memories
 * Get agent memories (owner only)
 */
router.get('/agent/:tokenId/memories', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Require ownership verification
    const userAddress = req.query.userAddress as string || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(401).json({ error: '需要提供钱包地址 (userAddress 参数或 x-user-address 头)' });
    }

    const isOwner = await verifyTokenOwnership(tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者，无法查看记忆' });
    }

    const limit = parseInt(req.query.limit as string, 10) || 50;
    const type = req.query.type as string;

    const memoryService = getMemoryService();

    let memories;
    if (type && ['fact', 'preference', 'experience', 'relationship'].includes(type)) {
      memories = memoryService.getByType(tokenId, type as any, limit);
    } else {
      memories = memoryService.getByTokenId(tokenId, limit);
    }

    res.json({
      tokenId,
      count: memories.length,
      totalCount: memoryService.getCount(tokenId),
      memories,
    });
  } catch (error: any) {
    console.error('Get memories error:', error);
    res.status(500).json({ error: 'Failed to get memories', details: error?.message });
  }
});

/**
 * GET /agent/:tokenId/memories/search
 * Search agent memories (owner only)
 */
router.get('/agent/:tokenId/memories/search', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Require ownership verification
    const userAddress = req.query.userAddress as string || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(401).json({ error: '需要提供钱包地址 (userAddress 参数或 x-user-address 头)' });
    }

    const isOwner = await verifyTokenOwnership(tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者，无法搜索记忆' });
    }

    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const limit = parseInt(req.query.limit as string, 10) || 10;

    const memoryService = getMemoryService();
    const memories = memoryService.search(tokenId, query, limit);

    res.json({
      tokenId,
      query,
      count: memories.length,
      memories,
    });
  } catch (error: any) {
    console.error('Search memories error:', error);
    res.status(500).json({ error: 'Failed to search memories', details: error?.message });
  }
});

// =============================================================
//                    LEARNING ROUTES
// =============================================================

/**
 * GET /agent/:tokenId/learning
 * Get agent learning history (owner only)
 */
router.get('/agent/:tokenId/learning', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Require ownership verification
    const userAddress = req.query.userAddress as string || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(401).json({ error: '需要提供钱包地址 (userAddress 参数或 x-user-address 头)' });
    }

    const isOwner = await verifyTokenOwnership(tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者，无法查看学习历史' });
    }

    const learningService = getLearningService();
    const history = learningService.getHistory(tokenId);

    res.json(history);
  } catch (error: any) {
    console.error('Get learning history error:', error);
    res.status(500).json({ error: 'Failed to get learning history', details: error?.message });
  }
});

/**
 * GET /agent/:tokenId/learning/:version
 * Get specific learning snapshot (owner only)
 */
router.get('/agent/:tokenId/learning/:version', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    const version = parseInt(req.params.version, 10);

    if (isNaN(tokenId) || isNaN(version)) {
      return res.status(400).json({ error: 'Invalid token ID or version' });
    }

    // Require ownership verification
    const userAddress = req.query.userAddress as string || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(401).json({ error: '需要提供钱包地址 (userAddress 参数或 x-user-address 头)' });
    }

    const isOwner = await verifyTokenOwnership(tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者，无法查看学习快照' });
    }

    const learningService = getLearningService();
    const snapshot = learningService.getSnapshot(tokenId, version);

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    res.json(snapshot);
  } catch (error: any) {
    console.error('Get snapshot error:', error);
    res.status(500).json({ error: 'Failed to get snapshot', details: error?.message });
  }
});

/**
 * POST /agent/:tokenId/learning/snapshot
 * Create a new learning snapshot (owner only)
 */
router.post('/agent/:tokenId/learning/snapshot', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Require ownership verification
    const userAddress = req.body.userAddress || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(401).json({ error: '需要提供钱包地址 (userAddress 参数或 x-user-address 头)' });
    }

    const isOwner = await verifyTokenOwnership(tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者，无法创建学习快照' });
    }

    const learningService = getLearningService();
    const snapshot = learningService.createSnapshot(tokenId);

    res.json(snapshot);
  } catch (error: any) {
    console.error('Create snapshot error:', error);
    res.status(500).json({ error: 'Failed to create snapshot', details: error?.message });
  }
});

/**
 * POST /agent/:tokenId/learning/sync
 * Sync learning root to blockchain (owner only)
 */
router.post('/agent/:tokenId/learning/sync', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Require ownership verification
    const userAddress = req.body.userAddress || req.headers['x-user-address'] as string;
    if (!userAddress) {
      return res.status(401).json({ error: '需要提供钱包地址 (userAddress 参数或 x-user-address 头)' });
    }

    const isOwner = await verifyTokenOwnership(tokenId, userAddress);
    if (!isOwner) {
      return res.status(403).json({ error: '您不是此智能体的持有者，无法同步学习数据' });
    }

    const { version, privateKey } = req.body;

    const learningService = getLearningService();

    // If no version specified, get latest
    let targetVersion = version;
    if (!targetVersion) {
      const latest = learningService.getLatestSnapshot(tokenId);
      if (!latest) {
        return res.status(404).json({ error: 'No snapshots found for this agent' });
      }
      targetVersion = latest.version;
    }

    const txHash = await learningService.syncToChain(tokenId, targetVersion, privateKey);

    res.json({
      tokenId,
      version: targetVersion,
      txHash,
      synced: true,
    });
  } catch (error: any) {
    console.error('Sync to chain error:', error);

    if (error?.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error?.message?.includes('already synced')) {
      return res.status(400).json({ error: error.message });
    }
    if (error?.message?.includes('private key')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to sync to chain', details: error?.message });
  }
});

/**
 * GET /agent/:tokenId/profile
 * Get agent profile (including persona) - owner only for full profile
 */
router.get('/agent/:tokenId/profile', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const chatService = getChatService();
    const profile = await chatService.getAgentProfile(tokenId);

    // Check if owner is requesting
    const userAddress = req.query.userAddress as string || req.headers['x-user-address'] as string;

    if (userAddress) {
      const isOwner = await verifyTokenOwnership(tokenId, userAddress);
      if (isOwner) {
        // Full profile for owner
        return res.json(profile);
      }
    }

    // Public profile (limited info - no memories, no detailed persona)
    res.json({
      tokenId: profile.tokenId,
      houseName: profile.houseName,
      houseId: profile.houseId,
      generation: profile.generation,
      // Hide sensitive data for non-owners
      personaVector: {
        calm: profile.personaVector?.calm,
        curious: profile.personaVector?.curious,
        bold: profile.personaVector?.bold,
        social: profile.personaVector?.social,
        disciplined: profile.personaVector?.disciplined,
      },
      isPublicView: true,
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile', details: error?.message });
  }
});

export default router;
