/**
 * Fix vault database RarityTier to match metadata files (which are synced from on-chain).
 *
 * Run: npx ts-node src/scripts/fixVaultRarity.ts
 * Or after build: node dist/scripts/fixVaultRarity.js
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || path.resolve(__dirname, '../../../data/db/vault.db');
const METADATA_DIR = path.resolve(process.cwd(), 'data/metadata');

if (!fs.existsSync(DB_PATH)) {
  console.error(`vault.db not found at: ${DB_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(METADATA_DIR)) {
  console.error(`Metadata dir not found at: ${METADATA_DIR}`);
  process.exit(1);
}

const db = new Database(DB_PATH);

// Get all vaults with token_id
const vaults = db.prepare('SELECT id, token_id, traits, summary FROM vaults WHERE token_id IS NOT NULL').all() as any[];
console.log(`Total vaults with token_id: ${vaults.length}`);

const updateStmt = db.prepare('UPDATE vaults SET traits = ?, summary = ?, updated_at = ? WHERE id = ?');

let fixed = 0;
let skipped = 0;
let noFile = 0;

const now = new Date().toISOString();

for (const vault of vaults) {
  const tokenId = vault.token_id;
  const metaPath = path.join(METADATA_DIR, `${tokenId}.json`);

  if (!fs.existsSync(metaPath)) {
    noFile++;
    continue;
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const metaRarity = meta.attributes?.find((a: any) => a.trait_type === 'RarityTier')?.value;

  if (!metaRarity) {
    skipped++;
    continue;
  }

  const traits = JSON.parse(vault.traits);
  const vaultRarity = traits.RarityTier;

  if (vaultRarity === metaRarity) {
    skipped++;
    continue;
  }

  // Update traits
  traits.RarityTier = metaRarity;
  const newTraits = JSON.stringify(traits);

  // Update summary text
  let newSummary = vault.summary;
  if (newSummary && newSummary.includes('Rarity:')) {
    newSummary = newSummary.replace(/Rarity:\s*\w+/, `Rarity: ${metaRarity}`);
  }

  updateStmt.run(newTraits, newSummary, now, vault.id);
  fixed++;

  if (fixed <= 10) {
    console.log(`  #${tokenId}: ${vaultRarity} → ${metaRarity}`);
  }
}

if (fixed > 10) {
  console.log(`  ... and ${fixed - 10} more`);
}

console.log(`\nResults:`);
console.log(`  Fixed:   ${fixed}`);
console.log(`  Skipped: ${skipped} (already correct or no rarity)`);
console.log(`  No file: ${noFile}`);

db.close();
console.log('Done.');