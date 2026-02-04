import { Router, Request, Response } from 'express';
import { getVaultService } from '../services/vault.js';
import { generateGenesisMetadata, toOpenSeaMetadata } from '../services/traitEngine.js';
import { loadGenesis } from '../utils/yaml.js';
import path from 'path';
import fs from 'fs';

const router = Router();

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

    // Helper to get working image URL
    const getImageUrl = (tid: number): string => {
      // Check for rendered images first
      const webpPath = path.join(RENDER_OUTPUT_DIR, `${tid}.webp`);
      const pngPath = path.join(RENDER_OUTPUT_DIR, `${tid}.png`);
      if (fs.existsSync(webpPath)) {
        return `/images/${tid}.webp`;
      }
      if (fs.existsSync(pngPath)) {
        return `/images/${tid}.png`;
      }
      // Fall back to placeholder SVG
      return `/placeholder/${tid}.svg`;
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

    res.json({
      offspring: toOpenSeaMetadata(offspringMetadata),
      vault,
      offspringHouseId: HOUSE_KEY_TO_ID[offspringMetadata.traits.House],
      traitsHash: computeTraitsHash(offspringMetadata.traits),
      isMythic: offspringMetadata.isMythic,
      mythicKey: offspringMetadata.mythicKey,
    });
  } catch (error) {
    console.error('Prepare reveal error:', error);
    res.status(500).json({ error: 'Failed to prepare reveal' });
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
 * Reserve a specific genesis agent for minting (returns vault data)
 */
router.post('/genesis/reserve', (req: Request, res: Response) => {
  try {
    const { tokenId } = req.body;

    if (!tokenId || typeof tokenId !== 'number') {
      return res.status(400).json({ error: 'tokenId is required and must be a number' });
    }

    // Load metadata
    const filepath = path.join(METADATA_DIR, `${tokenId}.json`);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const metadata = JSON.parse(content);

    // Extract traits from attributes
    const traits: Record<string, string> = {};
    for (const attr of metadata.attributes || []) {
      traits[attr.trait_type] = attr.value;
    }

    // Create vault entry
    const vaultService = getVaultService();
    const vault = vaultService.create({
      tokenId,
      traits,
      summary: `Genesis agent #${tokenId} | House: ${traits.House} | Rarity: ${traits.RarityTier}`,
    });

    // Map house to ID
    const HOUSE_KEY_TO_ID: Record<string, number> = {
      CLEAR: 1, MONSOON: 2, THUNDER: 3, FROST: 4, AURORA: 5, SAND: 6, ECLIPSE: 7
    };

    // Map rarity to tier number
    const RARITY_TO_TIER: Record<string, number> = {
      Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Mythic: 4
    };

    // Compute traits hash
    const { computeTraitsHash } = require('../utils/hash.js');
    const traitsHash = computeTraitsHash(traits);

    res.json({
      tokenId,
      metadata,
      vault: {
        vaultId: vault.vaultId,
        vaultURI: vault.vaultURI,
        vaultHash: vault.vaultHash,
        learningRoot: vault.learningRoot,
      },
      mintParams: {
        houseId: HOUSE_KEY_TO_ID[traits.House] || 1,
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
 * GET /images/:tokenId.webp
 * Serve rendered token image
 */
router.get('/images/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // Validate filename format (tokenId.webp or tokenId.png)
    const match = filename.match(/^(\d+)\.(webp|png|jpg)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid filename format' });
    }

    const tokenId = match[1];
    const ext = match[2];

    const filepath = path.join(RENDER_OUTPUT_DIR, filename);

    if (!fs.existsSync(filepath)) {
      // Try alternative extensions
      const alternatives = ['webp', 'png', 'jpg'].filter(e => e !== ext);
      for (const altExt of alternatives) {
        const altPath = path.join(RENDER_OUTPUT_DIR, `${tokenId}.${altExt}`);
        if (fs.existsSync(altPath)) {
          return res.redirect(`/images/${tokenId}.${altExt}`);
        }
      }
      return res.status(404).json({ error: 'Image not found' });
    }

    // Set content type
    const contentTypes: Record<string, string> = {
      webp: 'image/webp',
      png: 'image/png',
      jpg: 'image/jpeg',
    };

    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    res.sendFile(filepath);
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

export default router;
