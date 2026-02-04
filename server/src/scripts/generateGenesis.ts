/**
 * Genesis Metadata Generator
 * Generates 2100 metadata JSON files for the Genesis collection
 */

import fs from 'fs';
import path from 'path';
import { loadGenesis, loadHouses } from '../utils/yaml.js';
import { generateGenesisMetadata, toOpenSeaMetadata } from '../services/traitEngine.js';
import { DeterministicRng } from '../utils/rng.js';

const OUTPUT_DIR = path.resolve(__dirname, '../../../assets/metadata');

interface HouseAllocation {
  houseKey: string;
  count: number;
  rarityDistribution: { rarity: string; count: number }[];
}

/**
 * Distribute rarities within a house based on total count
 */
function distributeRarities(
  totalCount: number,
  rarityDistribution: Record<string, number>
): { rarity: string; count: number }[] {
  const result: { rarity: string; count: number }[] = [];
  let remaining = totalCount;

  const rarities = ['Mythic', 'Epic', 'Rare', 'Uncommon', 'Common'];

  for (const rarity of rarities) {
    const percentage = rarityDistribution[rarity] || 0;
    const count = rarity === 'Common'
      ? remaining // Give all remaining to Common
      : Math.floor(totalCount * percentage);

    if (count > 0) {
      result.push({ rarity, count });
      remaining -= count;
    }
  }

  return result;
}

/**
 * Generate allocation plan for all houses
 */
function generateAllocationPlan(): HouseAllocation[] {
  const genesis = loadGenesis().genesis;
  const allocations: HouseAllocation[] = [];

  for (const [houseKey, count] of Object.entries(genesis.house_supply)) {
    allocations.push({
      houseKey,
      count,
      rarityDistribution: distributeRarities(count, genesis.rarity_distribution),
    });
  }

  return allocations;
}

/**
 * Generate all metadata files
 */
async function generateAllMetadata(): Promise<void> {
  console.log('=== HouseForge Genesis Metadata Generator ===\n');

  const genesis = loadGenesis().genesis;
  const houses = loadHouses().houses;
  const masterSeed = genesis.master_seed;

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate allocation plan
  const allocations = generateAllocationPlan();

  console.log('Allocation Plan:');
  console.log('----------------');
  for (const alloc of allocations) {
    const house = houses.find(h => h.key === alloc.houseKey);
    console.log(`${house?.name} (${alloc.houseKey}): ${alloc.count} tokens`);
    for (const rd of alloc.rarityDistribution) {
      console.log(`  - ${rd.rarity}: ${rd.count}`);
    }
  }
  console.log('');

  // Build token list with shuffled order
  interface TokenSpec {
    houseKey: string;
    rarity: string;
    serial: number;
  }

  const tokenSpecs: TokenSpec[] = [];
  const houseSerials: Record<string, number> = {};

  for (const alloc of allocations) {
    houseSerials[alloc.houseKey] = 1;

    for (const rd of alloc.rarityDistribution) {
      for (let i = 0; i < rd.count; i++) {
        tokenSpecs.push({
          houseKey: alloc.houseKey,
          rarity: rd.rarity,
          serial: houseSerials[alloc.houseKey]++,
        });
      }
    }
  }

  // Shuffle tokens deterministically
  const shuffleRng = new DeterministicRng(masterSeed);
  const shuffledSpecs = shuffleRng.shuffle(tokenSpecs);

  console.log(`Generating ${shuffledSpecs.length} metadata files...\n`);

  // Track statistics
  const stats = {
    total: 0,
    byHouse: {} as Record<string, number>,
    byRarity: {} as Record<string, number>,
  };

  // Generate metadata for each token
  for (let i = 0; i < shuffledSpecs.length; i++) {
    const tokenId = i + 1; // Token IDs start at 1
    const spec = shuffledSpecs[i];

    // Find the correct serial for this token within its house
    const metadata = generateGenesisMetadata(
      tokenId,
      spec.houseKey,
      spec.rarity,
      spec.serial,
      masterSeed
    );

    // Convert to OpenSea format
    const openSeaMetadata = toOpenSeaMetadata(metadata);

    // Write to file
    const filename = path.join(OUTPUT_DIR, `${tokenId}.json`);
    fs.writeFileSync(filename, JSON.stringify(openSeaMetadata, null, 2));

    // Update stats
    stats.total++;
    stats.byHouse[spec.houseKey] = (stats.byHouse[spec.houseKey] || 0) + 1;
    stats.byRarity[spec.rarity] = (stats.byRarity[spec.rarity] || 0) + 1;

    // Progress indicator
    if ((i + 1) % 100 === 0 || i === shuffledSpecs.length - 1) {
      process.stdout.write(`\rGenerated: ${i + 1}/${shuffledSpecs.length}`);
    }
  }

  console.log('\n\n=== Generation Complete ===\n');
  console.log(`Total tokens: ${stats.total}`);
  console.log('\nBy House:');
  for (const [house, count] of Object.entries(stats.byHouse).sort()) {
    console.log(`  ${house}: ${count}`);
  }
  console.log('\nBy Rarity:');
  for (const rarity of ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic']) {
    console.log(`  ${rarity}: ${stats.byRarity[rarity] || 0}`);
  }

  // Generate collection metadata
  const collectionMetadata = {
    name: 'HouseForge Genesis',
    description: 'The Genesis collection of HouseForge Non-Fungible Agents. 2100 unique agents across 7 Weather Houses.',
    image: 'ipfs://PLACEHOLDER/collection.png',
    external_link: 'https://houseforge.io',
    seller_fee_basis_points: 500, // 5% royalty
    fee_recipient: '0x0000000000000000000000000000000000000000',
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'collection.json'),
    JSON.stringify(collectionMetadata, null, 2)
  );

  console.log('\nCollection metadata written to collection.json');
  console.log(`\nAll metadata files written to: ${OUTPUT_DIR}`);
}

// Run if called directly
generateAllMetadata().catch(console.error);
