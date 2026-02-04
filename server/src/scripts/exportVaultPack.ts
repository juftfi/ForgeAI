#!/usr/bin/env tsx
/**
 * Export Vault Pack - Migration tool for BAP-578 compliant vault data export
 *
 * Usage:
 *   npx tsx src/scripts/exportVaultPack.ts --tokenId 1,2,3 --out pack.json
 *   npx tsx src/scripts/exportVaultPack.ts --tokenId 1-10 --out pack.json
 *   npx tsx src/scripts/exportVaultPack.ts --all --out full-backup.json
 */

import fs from 'fs';
import path from 'path';
import { getVaultService, VaultData } from '../services/vault.js';

interface ExportPack {
  version: string;
  exportedAt: string;
  source: string;
  tokenCount: number;
  vaults: VaultData[];
  metadata: {
    totalTraits: number;
    houses: Record<string, number>;
    rarities: Record<string, number>;
  };
}

function parseArgs(): { tokenIds: number[] | 'all'; outFile: string } {
  const args = process.argv.slice(2);
  let tokenIds: number[] | 'all' = [];
  let outFile = 'vault-pack.json';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--tokenId' || arg === '-t') {
      const value = args[++i];
      if (!value) {
        console.error('Error: --tokenId requires a value');
        process.exit(1);
      }

      // Parse comma-separated or range
      if (value.includes('-') && !value.includes(',')) {
        // Range format: 1-10
        const [start, end] = value.split('-').map(Number);
        tokenIds = [];
        for (let j = start; j <= end; j++) {
          tokenIds.push(j);
        }
      } else {
        // Comma-separated: 1,2,3
        tokenIds = value.split(',').map((s) => parseInt(s.trim(), 10));
      }
    } else if (arg === '--all' || arg === '-a') {
      tokenIds = 'all';
    } else if (arg === '--out' || arg === '-o') {
      outFile = args[++i];
      if (!outFile) {
        console.error('Error: --out requires a file path');
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (tokenIds !== 'all' && tokenIds.length === 0) {
    console.error('Error: Please specify token IDs with --tokenId or use --all');
    printHelp();
    process.exit(1);
  }

  return { tokenIds, outFile };
}

function printHelp(): void {
  console.log(`
Export Vault Pack - BAP-578 Migration Tool

Usage:
  npx tsx src/scripts/exportVaultPack.ts [options]

Options:
  --tokenId, -t <ids>   Token IDs to export (comma-separated or range)
                        Examples: "1,2,3" or "1-10"
  --all, -a             Export all vaults
  --out, -o <file>      Output file path (default: vault-pack.json)
  --help, -h            Show this help message

Examples:
  npx tsx src/scripts/exportVaultPack.ts --tokenId 1,2,3 --out pack.json
  npx tsx src/scripts/exportVaultPack.ts --tokenId 1-100 --out batch.json
  npx tsx src/scripts/exportVaultPack.ts --all --out full-backup.json
`);
}

async function main(): Promise<void> {
  const { tokenIds, outFile } = parseArgs();

  console.log('🔧 HouseForge Vault Export Tool');
  console.log('================================\n');

  const vaultService = getVaultService();
  const vaults: VaultData[] = [];
  const notFound: number[] = [];

  if (tokenIds === 'all') {
    console.log('📦 Exporting all vaults...');
    // For 'all' mode, we need to query all vaults
    // Since VaultService doesn't have a getAll method, we'll add logic here
    const db = (vaultService as any).db;
    const stmt = db.prepare('SELECT * FROM vaults WHERE token_id IS NOT NULL ORDER BY token_id');
    const rows = stmt.all();

    for (const row of rows) {
      vaults.push({
        id: row.id,
        tokenId: row.token_id,
        parentAId: row.parent_a_id,
        parentBId: row.parent_b_id,
        parentALearningRoot: row.parent_a_learning_root,
        parentBLearningRoot: row.parent_b_learning_root,
        fusionVersion: row.fusion_version,
        seed: row.seed,
        traits: JSON.parse(row.traits),
        personaDelta: JSON.parse(row.persona_delta),
        summary: row.summary,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
  } else {
    console.log(`📦 Exporting ${tokenIds.length} token(s): ${tokenIds.join(', ')}`);

    for (const tokenId of tokenIds) {
      const vault = vaultService.getByTokenId(tokenId);
      if (vault) {
        vaults.push(vault);
        console.log(`  ✅ Token #${tokenId} - ${vault.traits.House || 'Unknown House'}`);
      } else {
        notFound.push(tokenId);
        console.log(`  ⚠️  Token #${tokenId} - Not found`);
      }
    }
  }

  if (vaults.length === 0) {
    console.error('\n❌ No vaults found to export');
    process.exit(1);
  }

  // Calculate metadata
  const houses: Record<string, number> = {};
  const rarities: Record<string, number> = {};
  let totalTraits = 0;

  for (const vault of vaults) {
    const house = vault.traits.House || 'Unknown';
    houses[house] = (houses[house] || 0) + 1;

    const rarity = vault.traits.RarityTier || 'Unknown';
    rarities[rarity] = (rarities[rarity] || 0) + 1;

    totalTraits += Object.keys(vault.traits).length;
  }

  // Build export pack
  const pack: ExportPack = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    source: 'HouseForge',
    tokenCount: vaults.length,
    vaults,
    metadata: {
      totalTraits,
      houses,
      rarities,
    },
  };

  // Write to file
  const outPath = path.resolve(process.cwd(), outFile);
  fs.writeFileSync(outPath, JSON.stringify(pack, null, 2), 'utf-8');

  console.log('\n================================');
  console.log(`✅ Export complete!`);
  console.log(`   File: ${outPath}`);
  console.log(`   Vaults: ${vaults.length}`);
  console.log(`   Houses: ${Object.entries(houses).map(([h, c]) => `${h}(${c})`).join(', ')}`);
  console.log(`   Rarities: ${Object.entries(rarities).map(([r, c]) => `${r}(${c})`).join(', ')}`);

  if (notFound.length > 0) {
    console.log(`\n⚠️  Not found: ${notFound.join(', ')}`);
  }

  vaultService.close();
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
