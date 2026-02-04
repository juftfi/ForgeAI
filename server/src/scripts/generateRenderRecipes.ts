#!/usr/bin/env tsx
/**
 * Generate Render Recipes
 *
 * Creates renderRecipe.json for each token in assets/metadata.
 * Recipes contain all information needed to deterministically render a token.
 *
 * Usage:
 *   pnpm render:recipes
 *   pnpm render:recipes -- --start 1 --count 100
 */

import fs from 'fs';
import path from 'path';
import { keccak256, toUtf8Bytes } from 'ethers';
import stableStringify from 'json-stable-stringify';

// Types
interface TokenMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

interface RenderRecipe {
  version: number;
  tokenId: number;
  houseKey: string;
  houseId: number;
  seed: string;
  traits: Record<string, string>;
  templateBlend: string;
  geometryPreset: string;
  cameraPreset: string;
  lightSignature: string;
  output: {
    width: number;
    height: number;
    format: string;
    quality: number;
    path: string;
  };
  renderSettings: {
    engine: string;
    samples: number;
    denoise: boolean;
    adaptiveSampling: boolean;
    maxBounces: number;
    transparentBackground: boolean;
  };
  recipeHash?: string;
}

// House ID mapping
const HOUSE_BY_NAME: Record<string, number> = {
  CLEAR: 1,
  MONSOON: 2,
  THUNDER: 3,
  FROST: 4,
  AURORA: 5,
  SAND: 6,
  ECLIPSE: 7,
};

// Default light signatures per house
const HOUSE_DEFAULT_LIGHTS: Record<string, string> = {
  CLEAR: 'Sunbeam',
  MONSOON: 'NeonRain',
  THUNDER: 'LightningFork',
  FROST: 'PolarGlow',
  AURORA: 'AuroraRibbon',
  SAND: 'GoldenHaze',
  ECLIPSE: 'EclipseHalo',
};

function parseArgs(): { start: number; count: number; outputDir: string; metadataDir: string } {
  const args = process.argv.slice(2);
  let start = 1;
  let count = -1; // -1 means all
  let outputDir = path.resolve(__dirname, '../../../render/recipes');
  let metadataDir = path.resolve(__dirname, '../../../assets/metadata');

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--start' || arg === '-s') {
      start = parseInt(args[++i], 10);
    } else if (arg === '--count' || arg === '-c') {
      count = parseInt(args[++i], 10);
    } else if (arg === '--output' || arg === '-o') {
      outputDir = args[++i];
    } else if (arg === '--metadata' || arg === '-m') {
      metadataDir = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Generate Render Recipes

Usage:
  pnpm render:recipes [options]

Options:
  --start, -s <n>      Start from token ID (default: 1)
  --count, -c <n>      Number of recipes to generate (default: all)
  --output, -o <dir>   Output directory (default: render/recipes)
  --metadata, -m <dir> Metadata directory (default: assets/metadata)
  --help, -h           Show this help
      `);
      process.exit(0);
    }
  }

  return { start, count, outputDir, metadataDir };
}

function loadMetadata(metadataDir: string, tokenId: number): TokenMetadata | null {
  const filePath = path.join(metadataDir, `${tokenId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function extractTraits(metadata: TokenMetadata): Record<string, string> {
  const traits: Record<string, string> = {};
  for (const attr of metadata.attributes) {
    traits[attr.trait_type] = attr.value;
  }
  return traits;
}

function generateSeed(tokenId: number, traits: Record<string, string>): string {
  // Generate deterministic seed from tokenId and traits
  const seedInput = stableStringify({ tokenId, traits });
  return keccak256(toUtf8Bytes(seedInput || ''));
}

function getHouseFromTraits(traits: Record<string, string>): { key: string; id: number } {
  const houseName = traits.House || 'CLEAR';
  const houseKey = houseName.toUpperCase();
  const houseId = HOUSE_BY_NAME[houseKey] || 1;
  return { key: houseKey, id: houseId };
}

function createRecipe(tokenId: number, metadata: TokenMetadata): RenderRecipe {
  const traits = extractTraits(metadata);
  const house = getHouseFromTraits(traits);
  const seed = generateSeed(tokenId, traits);

  // Get light signature from traits or use house default
  const lightSignature = traits.LightSignature || HOUSE_DEFAULT_LIGHTS[house.key] || 'Sunbeam';

  // Get geometry preset
  const geometryPreset = traits.DioramaGeometry || 'Sphere';

  const recipe: RenderRecipe = {
    version: 1,
    tokenId,
    houseKey: house.key,
    houseId: house.id,
    seed,
    traits,
    templateBlend: `render/scenes/house_${house.key.toLowerCase()}.blend`,
    geometryPreset,
    cameraPreset: 'main',
    lightSignature,
    output: {
      width: 1024,
      height: 1024,
      format: 'WEBP',
      quality: 90,
      path: `render/output/${tokenId}.webp`,
    },
    renderSettings: {
      engine: 'CYCLES',
      samples: 96,
      denoise: true,
      adaptiveSampling: true,
      maxBounces: 6,
      transparentBackground: false,
    },
  };

  // Compute recipe hash (for verification)
  const recipeForHash = { ...recipe };
  delete recipeForHash.recipeHash;
  recipe.recipeHash = keccak256(toUtf8Bytes(stableStringify(recipeForHash) || ''));

  return recipe;
}

function saveRecipe(recipe: RenderRecipe, outputDir: string): void {
  const filePath = path.join(outputDir, `${recipe.tokenId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(recipe, null, 2), 'utf-8');
}

async function main(): Promise<void> {
  const { start, count, outputDir, metadataDir } = parseArgs();

  console.log('🎨 HouseForge Render Recipe Generator');
  console.log('=====================================\n');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Find all metadata files
  let metadataFiles: string[] = [];
  if (fs.existsSync(metadataDir)) {
    metadataFiles = fs.readdirSync(metadataDir)
      .filter(f => f.endsWith('.json'))
      .map(f => parseInt(f.replace('.json', ''), 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b)
      .map(n => `${n}.json`);
  }

  if (metadataFiles.length === 0) {
    console.error('❌ No metadata files found in:', metadataDir);
    console.log('   Run `pnpm gen:metadata` first to generate token metadata.');
    process.exit(1);
  }

  console.log(`📁 Found ${metadataFiles.length} metadata files`);
  console.log(`📂 Output: ${outputDir}\n`);

  // Filter by range
  let tokenIds = metadataFiles.map(f => parseInt(f.replace('.json', ''), 10));
  tokenIds = tokenIds.filter(id => id >= start);

  if (count > 0) {
    tokenIds = tokenIds.slice(0, count);
  }

  console.log(`🔄 Generating recipes for tokens ${tokenIds[0]} to ${tokenIds[tokenIds.length - 1]}\n`);

  let generated = 0;
  let skipped = 0;
  const houseCounts: Record<string, number> = {};

  for (const tokenId of tokenIds) {
    const metadata = loadMetadata(metadataDir, tokenId);
    if (!metadata) {
      console.log(`  ⚠️ Token #${tokenId} - Metadata not found, skipping`);
      skipped++;
      continue;
    }

    const recipe = createRecipe(tokenId, metadata);
    saveRecipe(recipe, outputDir);

    // Track house distribution
    houseCounts[recipe.houseKey] = (houseCounts[recipe.houseKey] || 0) + 1;

    if (generated % 100 === 0 && generated > 0) {
      console.log(`  ✅ Generated ${generated} recipes...`);
    }
    generated++;
  }

  console.log('\n=====================================');
  console.log(`✅ Recipe generation complete!`);
  console.log(`   Generated: ${generated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log('\n📊 House Distribution:');
  for (const [house, count] of Object.entries(houseCounts).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`   ${house}: ${count}`);
  }
}

main().catch((err) => {
  console.error('Recipe generation failed:', err);
  process.exit(1);
});
