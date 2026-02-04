#!/usr/bin/env tsx
/**
 * Update Metadata with Render Information
 *
 * After rendering, this script updates metadata files with:
 * - Correct image URIs pointing to rendered images
 * - renderRecipeURI and renderRecipeHash for verifiability
 * - imageHash for integrity verification
 *
 * Usage:
 *   pnpm render:update-metadata
 *   pnpm render:update-metadata -- --base-url http://localhost:3001
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { keccak256, toUtf8Bytes } from 'ethers';
import stableStringify from 'json-stable-stringify';

interface TokenMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  properties?: Record<string, any>;
}

interface RenderRecipe {
  tokenId: number;
  recipeHash: string;
  output: {
    path: string;
    format: string;
  };
}

function parseArgs(): {
  metadataDir: string;
  renderDir: string;
  recipesDir: string;
  baseUrl: string;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  let metadataDir = path.resolve(__dirname, '../../../assets/metadata');
  let renderDir = path.resolve(__dirname, '../../../render/output');
  let recipesDir = path.resolve(__dirname, '../../../render/recipes');
  let baseUrl = 'http://localhost:3001';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--metadata' || arg === '-m') {
      metadataDir = args[++i];
    } else if (arg === '--render' || arg === '-r') {
      renderDir = args[++i];
    } else if (arg === '--recipes') {
      recipesDir = args[++i];
    } else if (arg === '--base-url' || arg === '-u') {
      baseUrl = args[++i];
    } else if (arg === '--dry-run' || arg === '-d') {
      dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Update Metadata with Render Information

Usage:
  pnpm render:update-metadata [options]

Options:
  --metadata, -m <dir>   Metadata directory (default: assets/metadata)
  --render, -r <dir>     Render output directory (default: render/output)
  --recipes <dir>        Recipes directory (default: render/recipes)
  --base-url, -u <url>   Base URL for image URIs (default: http://localhost:3001)
  --dry-run, -d          Show changes without writing files
  --help, -h             Show this help

Example:
  pnpm render:update-metadata -- --base-url https://api.houseforge.io
      `);
      process.exit(0);
    }
  }

  return { metadataDir, renderDir, recipesDir, baseUrl, dryRun };
}

function computeImageHash(imagePath: string): string {
  const imageBuffer = fs.readFileSync(imagePath);
  return crypto.createHash('sha256').update(imageBuffer).digest('hex');
}

function computeRecipeHash(recipe: RenderRecipe): string {
  return recipe.recipeHash;
}

function findRenderedImage(tokenId: number, renderDir: string): string | null {
  const extensions = ['webp', 'png', 'jpg'];
  for (const ext of extensions) {
    const imagePath = path.join(renderDir, `${tokenId}.${ext}`);
    if (fs.existsSync(imagePath)) {
      return imagePath;
    }
  }
  return null;
}

function loadRecipe(tokenId: number, recipesDir: string): RenderRecipe | null {
  const recipePath = path.join(recipesDir, `${tokenId}.json`);
  if (!fs.existsSync(recipePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(recipePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const { metadataDir, renderDir, recipesDir, baseUrl, dryRun } = parseArgs();

  console.log('🔄 HouseForge Metadata Image Updater');
  console.log('=====================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN - No files will be modified\n');
  }

  // Find all metadata files
  if (!fs.existsSync(metadataDir)) {
    console.error('❌ Metadata directory not found:', metadataDir);
    process.exit(1);
  }

  const metadataFiles = fs.readdirSync(metadataDir)
    .filter(f => f.endsWith('.json') && f !== 'collection.json')
    .map(f => parseInt(f.replace('.json', ''), 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);

  if (metadataFiles.length === 0) {
    console.error('❌ No metadata files found');
    process.exit(1);
  }

  console.log(`📁 Found ${metadataFiles.length} metadata files`);
  console.log(`📂 Render output: ${renderDir}`);
  console.log(`🌐 Base URL: ${baseUrl}\n`);

  let updated = 0;
  let skipped = 0;
  let noImage = 0;

  for (const tokenId of metadataFiles) {
    const metadataPath = path.join(metadataDir, `${tokenId}.json`);

    // Check for rendered image
    const imagePath = findRenderedImage(tokenId, renderDir);
    if (!imagePath) {
      noImage++;
      continue;
    }

    // Load recipe
    const recipe = loadRecipe(tokenId, recipesDir);

    // Load current metadata
    const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
    const metadata: TokenMetadata = JSON.parse(metadataContent);

    // Compute hashes
    const imageHash = computeImageHash(imagePath);
    const imageExt = path.extname(imagePath).slice(1);
    const imageUri = `${baseUrl}/images/${tokenId}.${imageExt}`;

    // Update metadata
    const updatedMetadata: TokenMetadata = {
      ...metadata,
      image: imageUri,
      properties: {
        ...(metadata.properties || {}),
        imageHash: `sha256:${imageHash}`,
        ...(recipe ? {
          renderRecipeURI: `${baseUrl}/recipes/${tokenId}.json`,
          renderRecipeHash: recipe.recipeHash,
        } : {}),
      },
    };

    // Check if changed
    const originalJson = JSON.stringify(metadata, null, 2);
    const updatedJson = JSON.stringify(updatedMetadata, null, 2);

    if (originalJson === updatedJson) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  📝 Token #${tokenId}:`);
      console.log(`     image: ${imageUri}`);
      console.log(`     imageHash: sha256:${imageHash.substring(0, 16)}...`);
      if (recipe) {
        console.log(`     recipeHash: ${recipe.recipeHash.substring(0, 16)}...`);
      }
    } else {
      fs.writeFileSync(metadataPath, updatedJson, 'utf-8');
    }

    updated++;

    if (updated % 100 === 0) {
      console.log(`  ✅ Updated ${updated} metadata files...`);
    }
  }

  console.log('\n=====================================');
  console.log(`✅ Metadata update complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (unchanged): ${skipped}`);
  console.log(`   No image: ${noImage}`);

  if (dryRun && updated > 0) {
    console.log('\n🔍 Run without --dry-run to apply changes.');
  }
}

main().catch((err) => {
  console.error('Metadata update failed:', err);
  process.exit(1);
});
