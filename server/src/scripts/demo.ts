/**
 * HouseForge Demo Script
 * Demonstrates the full flow: generate genesis, mint, fusion
 */

import { generateGenesisMetadata, generateFusionMetadata, toOpenSeaMetadata, ParentInfo } from '../services/traitEngine.js';
import { getVaultService } from '../services/vault.js';
import { computeFusionSeed, computeTraitsHash } from '../utils/hash.js';
import { loadGenesis, loadHouses, loadMythic } from '../utils/yaml.js';

async function runDemo() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║               HouseForge Demo Script                         ║
╠══════════════════════════════════════════════════════════════╣
║  This demo shows:                                            ║
║  1. Genesis metadata generation                              ║
║  2. Vault creation                                           ║
║  3. Fusion with commit-reveal                                ║
║  4. Offspring trait inheritance                              ║
║  5. Mythic conditions check                                  ║
╚══════════════════════════════════════════════════════════════╝
`);

  const genesis = loadGenesis().genesis;
  const houses = loadHouses().houses;
  const mythics = loadMythic().mythics;
  const vaultService = getVaultService();

  // Step 1: Generate two genesis agents
  console.log('\n=== Step 1: Generate Genesis Agents ===\n');

  const agent1 = generateGenesisMetadata(1, 'THUNDER', 'Common', 1, genesis.master_seed);
  const agent2 = generateGenesisMetadata(2, 'MONSOON', 'Common', 1, genesis.master_seed);

  console.log('Agent #1 (House Thunder):');
  console.log(`  - RarityTier: ${agent1.traits.RarityTier}`);
  console.log(`  - WeatherID: ${agent1.traits.WeatherID}`);
  console.log(`  - FrameType: ${agent1.traits.FrameType}`);
  console.log(`  - CoreMaterial: ${agent1.traits.CoreMaterial}`);
  console.log(`  - LightSignature: ${agent1.traits.LightSignature}`);

  console.log('\nAgent #2 (House Monsoon):');
  console.log(`  - RarityTier: ${agent2.traits.RarityTier}`);
  console.log(`  - WeatherID: ${agent2.traits.WeatherID}`);
  console.log(`  - FrameType: ${agent2.traits.FrameType}`);
  console.log(`  - CoreMaterial: ${agent2.traits.CoreMaterial}`);
  console.log(`  - LightSignature: ${agent2.traits.LightSignature}`);

  // Step 2: Create vaults for genesis agents
  console.log('\n=== Step 2: Create Vaults ===\n');

  const vault1 = vaultService.create({
    tokenId: 1,
    traits: agent1.traits,
    personaDelta: agent1.persona,
    summary: 'Genesis Agent #1 - House Thunder',
  });

  const vault2 = vaultService.create({
    tokenId: 2,
    traits: agent2.traits,
    personaDelta: agent2.persona,
    summary: 'Genesis Agent #2 - House Monsoon',
  });

  console.log('Vault #1:');
  console.log(`  - URI: ${vault1.vaultURI}`);
  console.log(`  - Hash: ${vault1.vaultHash.slice(0, 20)}...`);
  console.log(`  - LearningRoot: ${vault1.learningRoot.slice(0, 20)}...`);

  console.log('\nVault #2:');
  console.log(`  - URI: ${vault2.vaultURI}`);
  console.log(`  - Hash: ${vault2.vaultHash.slice(0, 20)}...`);
  console.log(`  - LearningRoot: ${vault2.learningRoot.slice(0, 20)}...`);

  // Step 3: Simulate fusion
  console.log('\n=== Step 3: Simulate Fusion ===\n');

  const salt = '0x' + 'abcd'.repeat(16);
  const commitBlockHash = '0x' + '1234'.repeat(16);

  // Create parent info
  const parent1: ParentInfo = {
    tokenId: 1,
    house: agent1.traits.House,
    rarity: agent1.traits.RarityTier,
    generation: 0,
    traits: agent1.traits,
    learningRoot: vault1.learningRoot,
  };

  const parent2: ParentInfo = {
    tokenId: 2,
    house: agent2.traits.House,
    rarity: agent2.traits.RarityTier,
    generation: 0,
    traits: agent2.traits,
    learningRoot: vault2.learningRoot,
  };

  // Compute fusion seed
  const fusionSeed = computeFusionSeed(
    1, 2,
    vault1.learningRoot,
    vault2.learningRoot,
    salt,
    commitBlockHash
  );

  console.log('Fusion Parameters:');
  console.log(`  - Parent A: #1 (${parent1.house})`);
  console.log(`  - Parent B: #2 (${parent2.house})`);
  console.log(`  - Salt: ${salt.slice(0, 20)}...`);
  console.log(`  - Seed: ${fusionSeed.slice(0, 20)}...`);

  // Generate offspring
  const offspring = generateFusionMetadata(3, parent1, parent2, fusionSeed);

  console.log('\n=== Step 4: Offspring Result ===\n');

  console.log('Offspring #3:');
  console.log(`  - House: ${offspring.traits.House}`);
  console.log(`  - RarityTier: ${offspring.traits.RarityTier}`);
  console.log(`  - Generation: ${offspring.generation}`);
  console.log(`  - Is Mythic: ${offspring.isMythic}`);
  if (offspring.mythicKey) {
    console.log(`  - Mythic Type: ${offspring.mythicKey}`);
  }
  console.log(`  - FrameType: ${offspring.traits.FrameType}`);
  console.log(`  - CoreMaterial: ${offspring.traits.CoreMaterial}`);
  console.log(`  - LightSignature: ${offspring.traits.LightSignature}`);

  // Trait inheritance analysis
  console.log('\nTrait Inheritance:');
  const coreTraits = ['FrameType', 'CoreMaterial', 'LightSignature', 'InstrumentMark'];
  for (const trait of coreTraits) {
    const offspringVal = (offspring.traits as any)[trait];
    const parent1Val = (parent1.traits as any)[trait];
    const parent2Val = (parent2.traits as any)[trait];

    const inherited = offspringVal === parent1Val ? 'Parent A' :
                      offspringVal === parent2Val ? 'Parent B' : 'Mutated';
    console.log(`  - ${trait}: ${offspringVal} (${inherited})`);
  }

  // Step 5: Show mythic conditions
  console.log('\n=== Step 5: Mythic Conditions ===\n');

  for (const mythic of mythics) {
    console.log(`${mythic.name} (${mythic.key}):`);
    console.log(`  Required parent houses: ${mythic.conditions
      .filter(c => c.type === 'parents_houses')
      .flatMap(c => c.any_of || [])
      .map(pair => pair.join(' + '))
      .join(' or ')
    }`);
    console.log(`  Trigger chance: 1/${mythic.trigger.modulo}`);
  }

  // Create vault for offspring
  const vault3 = vaultService.create({
    tokenId: 3,
    parentAId: 1,
    parentBId: 2,
    parentALearningRoot: vault1.learningRoot,
    parentBLearningRoot: vault2.learningRoot,
    seed: fusionSeed,
    traits: offspring.traits,
    personaDelta: offspring.persona,
  });

  console.log('\n=== Step 6: Offspring Vault ===\n');
  console.log(`  - URI: ${vault3.vaultURI}`);
  console.log(`  - Hash: ${vault3.vaultHash.slice(0, 20)}...`);
  console.log(`  - LearningRoot: ${vault3.learningRoot.slice(0, 20)}...`);

  // Show OpenSea metadata format
  console.log('\n=== OpenSea Metadata Format ===\n');
  const openSeaMeta = toOpenSeaMetadata(offspring);
  console.log(JSON.stringify(openSeaMeta, null, 2));

  // Close vault service
  vaultService.close();

  console.log('\n=== Demo Complete ===\n');
  console.log('The demo showed:');
  console.log('  1. Genesis trait generation is deterministic');
  console.log('  2. Vaults store traits and compute hashes');
  console.log('  3. Fusion seed is derived from parents + block hash');
  console.log('  4. Offspring inherits traits with mutations');
  console.log('  5. Mythic conditions are transparent and verifiable');
}

runDemo().catch(console.error);
