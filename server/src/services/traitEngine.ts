import { DeterministicRng, createGenesisSeed } from '../utils/rng.js';
import { computeTraitsHash } from '../utils/hash.js';
import {
  loadTraits,
  loadHouseBias,
  loadHouses,
  loadGenesis,
  loadMythic,
  getHouseByKey,
  House,
  TraitValue,
  Mythic,
} from '../utils/yaml.js';

// Types
export interface GeneratedTraits {
  Season: string;
  House: string;
  RarityTier: string;
  WeatherID: string;
  FrameType: string;
  CoreMaterial: string;
  LightSignature: string;
  InstrumentMark: string;
  Atmosphere: string;
  DioramaGeometry: string;
  PaletteTemperature: string;
  SurfaceAging: string;
  MicroEngraving: string;
  LensBloom: string;
  [key: string]: string; // Index signature for Record compatibility
}

export interface AgentMetadata {
  tokenId: number;
  name: string;
  description: string;
  image: string;
  traits: GeneratedTraits;
  traitsHash: string;
  persona: PersonaVector;
  generation: number;
  parentA?: number;
  parentB?: number;
  isMythic: boolean;
  mythicKey?: string;
}

export interface PersonaVector {
  calm: number;
  curious: number;
  bold: number;
  social: number;
  disciplined: number;
  [key: string]: number; // Index signature for Record compatibility
}

export interface WeightedTrait {
  key: string;
  weight: number;
}

// Rarity scores for calculations
const RARITY_SCORES: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Mythic: 5,
};

const RARITY_FROM_SCORE: Record<number, string> = {
  1: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Epic',
  5: 'Mythic',
};

/**
 * Get weighted traits for a domain, applying house bias and rarity multipliers
 */
function getWeightedTraits(
  domain: string,
  houseKey: string,
  rarityTier: string
): WeightedTrait[] {
  const traitsConfig = loadTraits();
  const houseBiasConfig = loadHouseBias();

  const domainConfig = traitsConfig.domains[domain];
  if (!domainConfig) {
    throw new Error(`Unknown trait domain: ${domain}`);
  }

  // Handle simple string arrays (Season, RarityTier)
  if (typeof domainConfig.values[0] === 'string') {
    return (domainConfig.values as string[]).map(v => ({ key: v, weight: 1 }));
  }

  // Get base weights
  let weights: WeightedTrait[] = (domainConfig.values as TraitValue[]).map(v => ({
    key: v.key,
    weight: v.w,
  }));

  // Apply house bias (2x multiplier for preferred traits)
  const houseBias = houseBiasConfig.bias[houseKey]?.prefer?.[domain];
  if (houseBias) {
    weights = weights.map(w => ({
      key: w.key,
      weight: houseBias.includes(w.key)
        ? w.weight * houseBiasConfig.bias_multiplier
        : w.weight,
    }));
  }

  // Apply rarity multipliers
  const rarityMult = traitsConfig.rarity_multipliers[rarityTier];
  if (rarityMult) {
    const rareTraits = traitsConfig.rare_traits[domain] || [];
    const epicTraits = traitsConfig.epic_traits[domain] || [];

    weights = weights.map(w => {
      let mult = 1;
      if (epicTraits.includes(w.key)) {
        mult = rarityMult.epicTraitBoost;
      } else if (rareTraits.includes(w.key)) {
        mult = rarityMult.rareTraitBoost;
      }
      return { key: w.key, weight: w.weight * mult };
    });
  }

  return weights;
}

/**
 * Pick a trait from weighted options using RNG
 */
function pickTrait(rng: DeterministicRng, weights: WeightedTrait[]): string {
  return rng.weightedPick(weights.map(w => ({ item: w.key, weight: w.weight })));
}

/**
 * Generate Weather ID for an agent
 */
function generateWeatherID(
  season: string,
  houseKey: string,
  serial: number,
  padding: number = 4
): string {
  const paddedSerial = serial.toString().padStart(padding, '0');
  return `${season}-${houseKey}-${paddedSerial}`;
}

/**
 * Compute persona vector from house base + trait modifiers
 */
function computePersona(house: House, traits: GeneratedTraits): PersonaVector {
  const base = { ...house.persona_seed };

  // Trait-based modifiers (small adjustments)
  const modifiers: Partial<PersonaVector> = {};

  // Atmosphere affects calm
  if (traits.Atmosphere === 'Charged') modifiers.calm = -0.1;
  if (traits.Atmosphere === 'Icy') modifiers.calm = 0.05;
  if (traits.Atmosphere === 'Void') modifiers.bold = 0.1;

  // LensBloom affects curiosity
  if (traits.LensBloom === 'HaloHeavy') modifiers.curious = 0.1;
  if (traits.LensBloom === 'Cinematic') modifiers.social = 0.05;

  // SurfaceAging affects discipline
  if (traits.SurfaceAging === 'Pristine') modifiers.disciplined = 0.05;
  if (traits.SurfaceAging === 'EdgeWear') modifiers.disciplined = -0.05;

  // Apply modifiers and clamp
  return {
    calm: Math.max(0, Math.min(1, base.calm + (modifiers.calm || 0))),
    curious: Math.max(0, Math.min(1, base.curious + (modifiers.curious || 0))),
    bold: Math.max(0, Math.min(1, base.bold + (modifiers.bold || 0))),
    social: Math.max(0, Math.min(1, base.social + (modifiers.social || 0))),
    disciplined: Math.max(0, Math.min(1, base.disciplined + (modifiers.disciplined || 0))),
  };
}

/**
 * Generate traits for a Genesis agent
 */
export function generateGenesisTraits(
  tokenId: number,
  houseKey: string,
  rarityTier: string,
  serial: number,
  seed: string
): GeneratedTraits {
  const rng = new DeterministicRng(seed);
  const genesis = loadGenesis().genesis;

  const traits: GeneratedTraits = {
    Season: genesis.season,
    House: houseKey,
    RarityTier: rarityTier,
    WeatherID: generateWeatherID(genesis.season, houseKey, serial, genesis.serial_padding),
    FrameType: pickTrait(rng, getWeightedTraits('FrameType', houseKey, rarityTier)),
    CoreMaterial: pickTrait(rng, getWeightedTraits('CoreMaterial', houseKey, rarityTier)),
    LightSignature: pickTrait(rng, getWeightedTraits('LightSignature', houseKey, rarityTier)),
    InstrumentMark: pickTrait(rng, getWeightedTraits('InstrumentMark', houseKey, rarityTier)),
    Atmosphere: pickTrait(rng, getWeightedTraits('Atmosphere', houseKey, rarityTier)),
    DioramaGeometry: pickTrait(rng, getWeightedTraits('DioramaGeometry', houseKey, rarityTier)),
    PaletteTemperature: pickTrait(rng, getWeightedTraits('PaletteTemperature', houseKey, rarityTier)),
    SurfaceAging: pickTrait(rng, getWeightedTraits('SurfaceAging', houseKey, rarityTier)),
    MicroEngraving: pickTrait(rng, getWeightedTraits('MicroEngraving', houseKey, rarityTier)),
    LensBloom: pickTrait(rng, getWeightedTraits('LensBloom', houseKey, rarityTier)),
  };

  return traits;
}

/**
 * Generate full metadata for a Genesis agent
 */
export function generateGenesisMetadata(
  tokenId: number,
  houseKey: string,
  rarityTier: string,
  serial: number,
  masterSeed: string
): AgentMetadata {
  const seed = createGenesisSeed(masterSeed, tokenId);
  const traits = generateGenesisTraits(tokenId, houseKey, rarityTier, serial, seed);

  const house = getHouseByKey(houseKey);
  if (!house) {
    throw new Error(`Unknown house: ${houseKey}`);
  }

  const persona = computePersona(house, traits);
  const traitsHash = computeTraitsHash(traits);

  return {
    tokenId,
    name: `HouseForge Agent #${tokenId} — ${house.name}`,
    description: `A tradable Non-Fungible Agent born in HouseForge. Lineage and learning are verifiable via vaultHash/learningRoot; details live in the vault.`,
    image: `ipfs://PLACEHOLDER/${tokenId}.png`,
    traits,
    traitsHash,
    persona,
    generation: 0,
    isMythic: false,
  };
}

/**
 * Determine offspring house based on parents
 */
function determineOffspringHouse(
  parentAHouse: string,
  parentBHouse: string,
  rng: DeterministicRng
): string {
  if (parentAHouse === parentBHouse) {
    return parentAHouse;
  }
  // 70% parentA, 30% parentB
  return rng.chance(0.7) ? parentAHouse : parentBHouse;
}

/**
 * Calculate offspring rarity based on parents
 */
function calculateOffspringRarity(
  parentARarity: string,
  parentBRarity: string,
  parentAGeneration: number,
  parentBGeneration: number,
  parentAHouse: string,
  parentBHouse: string
): string {
  const scoreA = RARITY_SCORES[parentARarity] || 1;
  const scoreB = RARITY_SCORES[parentBRarity] || 1;

  let score = Math.floor((scoreA + scoreB) / 2);

  // Bonus for cross-house fusion
  if (parentAHouse !== parentBHouse) {
    score += 1;
  }

  // Bonus for high generation parents
  if (parentAGeneration >= 2 || parentBGeneration >= 2) {
    score += 1;
  }

  // Cap at Mythic (5) - but Mythic requires special conditions
  score = Math.min(score, 4); // Cap at Epic, Mythic needs special trigger

  return RARITY_FROM_SCORE[score] || 'Common';
}

/**
 * Check if mythic conditions are met
 */
function checkMythicConditions(
  mythic: Mythic,
  parentAHouse: string,
  parentBHouse: string,
  parentATraits: GeneratedTraits,
  parentBTraits: GeneratedTraits,
  offspringGeneration: number
): boolean {
  for (const condition of mythic.conditions) {
    switch (condition.type) {
      case 'parents_houses': {
        const housePairs = condition.any_of || [];
        const matches = housePairs.some(pair => {
          const [h1, h2] = pair;
          return (parentAHouse === h1 && parentBHouse === h2) ||
                 (parentAHouse === h2 && parentBHouse === h1);
        });
        if (!matches) return false;
        break;
      }
      case 'required_traits': {
        const mustInclude = condition.must_include || {};
        for (const [trait, values] of Object.entries(mustInclude)) {
          const parentAValue = (parentATraits as Record<string, string>)[trait];
          const parentBValue = (parentBTraits as Record<string, string>)[trait];
          const hasMatch = values.includes(parentAValue) || values.includes(parentBValue);
          if (!hasMatch) return false;
        }
        break;
      }
      case 'min_generation': {
        if (offspringGeneration < (condition.value || 0)) return false;
        break;
      }
    }
  }
  return true;
}

/**
 * Check if mythic triggers (after conditions are met)
 */
function checkMythicTrigger(mythic: Mythic, rng: DeterministicRng): boolean {
  const trigger = mythic.trigger;
  if (trigger.type === 'seed_threshold') {
    return rng.checkModulo(trigger.modulo, trigger.equals);
  }
  return false;
}

/**
 * Check all mythics and return triggered one (if any)
 */
function checkForMythic(
  parentAHouse: string,
  parentBHouse: string,
  parentATraits: GeneratedTraits,
  parentBTraits: GeneratedTraits,
  offspringGeneration: number,
  rng: DeterministicRng
): Mythic | null {
  const mythicConfig = loadMythic();

  for (const mythic of mythicConfig.mythics) {
    const conditionsMet = checkMythicConditions(
      mythic,
      parentAHouse,
      parentBHouse,
      parentATraits,
      parentBTraits,
      offspringGeneration
    );

    if (conditionsMet && checkMythicTrigger(mythic, rng)) {
      return mythic;
    }
  }

  return null;
}

/**
 * Generate a trait, possibly inheriting from parents
 */
function generateTraitWithInheritance(
  traitName: string,
  parentAValue: string,
  parentBValue: string,
  houseKey: string,
  rarityTier: string,
  inheritanceProbability: number,
  rng: DeterministicRng
): string {
  // Check if we inherit
  if (rng.chance(inheritanceProbability)) {
    // 50/50 which parent to inherit from
    return rng.chance(0.5) ? parentAValue : parentBValue;
  }

  // Generate new trait
  return pickTrait(rng, getWeightedTraits(traitName, houseKey, rarityTier));
}

export interface ParentInfo {
  tokenId: number;
  house: string;
  rarity: string;
  generation: number;
  traits: GeneratedTraits;
  learningRoot: string;
}

/**
 * Generate traits for an offspring through fusion
 */
export function generateFusionTraits(
  parentA: ParentInfo,
  parentB: ParentInfo,
  seed: string
): { traits: GeneratedTraits; isMythic: boolean; mythicKey?: string } {
  const rng = new DeterministicRng(seed);
  const traitsConfig = loadTraits();
  const coreTraits = traitsConfig.core_traits;

  // Determine house (70/30 rule)
  const houseKey = determineOffspringHouse(parentA.house, parentB.house, rng);

  // Calculate generation
  const generation = Math.max(parentA.generation, parentB.generation) + 1;

  // Calculate base rarity
  let rarityTier = calculateOffspringRarity(
    parentA.rarity,
    parentB.rarity,
    parentA.generation,
    parentB.generation,
    parentA.house,
    parentB.house
  );

  // Check for mythic
  const mythic = checkForMythic(
    parentA.house,
    parentB.house,
    parentA.traits,
    parentB.traits,
    generation,
    rng
  );

  const isMythic = mythic !== null;
  if (isMythic) {
    rarityTier = 'Mythic';
  }

  // Generate serial (would come from contract in real implementation)
  const serial = Math.floor(rng.random() * 9999) + 1;
  const genesis = loadGenesis().genesis;

  // Generate traits
  const traits: GeneratedTraits = {
    Season: genesis.season,
    House: houseKey,
    RarityTier: rarityTier,
    WeatherID: generateWeatherID(genesis.season, houseKey, serial, genesis.serial_padding),
    FrameType: '',
    CoreMaterial: '',
    LightSignature: '',
    InstrumentMark: '',
    Atmosphere: '',
    DioramaGeometry: '',
    PaletteTemperature: '',
    SurfaceAging: '',
    MicroEngraving: '',
    LensBloom: '',
  };

  // Generate each trait with inheritance rules
  // Core traits: 50% inheritance
  // Other traits: 20% inheritance
  const traitNames = [
    'FrameType', 'CoreMaterial', 'LightSignature', 'InstrumentMark',
    'Atmosphere', 'DioramaGeometry', 'PaletteTemperature',
    'SurfaceAging', 'MicroEngraving', 'LensBloom'
  ];

  for (const traitName of traitNames) {
    const isCoreF = coreTraits.includes(traitName);
    const inheritProb = isCoreF ? 0.5 : 0.2;

    const parentAValue = (parentA.traits as Record<string, string>)[traitName];
    const parentBValue = (parentB.traits as Record<string, string>)[traitName];

    (traits as Record<string, string>)[traitName] = generateTraitWithInheritance(
      traitName,
      parentAValue,
      parentBValue,
      houseKey,
      rarityTier,
      inheritProb,
      rng
    );
  }

  // Apply mythic overrides if triggered
  if (mythic) {
    for (const [trait, value] of Object.entries(mythic.override_traits)) {
      (traits as Record<string, string>)[trait] = value;
    }
  }

  return {
    traits,
    isMythic,
    mythicKey: mythic?.key,
  };
}

/**
 * Generate full metadata for a fusion offspring
 */
export function generateFusionMetadata(
  tokenId: number,
  parentA: ParentInfo,
  parentB: ParentInfo,
  seed: string
): AgentMetadata {
  const { traits, isMythic, mythicKey } = generateFusionTraits(parentA, parentB, seed);

  const house = getHouseByKey(traits.House);
  if (!house) {
    throw new Error(`Unknown house: ${traits.House}`);
  }

  const persona = computePersona(house, traits);
  const traitsHash = computeTraitsHash(traits);
  const generation = Math.max(parentA.generation, parentB.generation) + 1;

  let description = `A tradable Non-Fungible Agent born in HouseForge through fusion.`;
  if (isMythic) {
    const mythicConfig = loadMythic();
    const mythicInfo = mythicConfig.mythics.find(m => m.key === mythicKey);
    if (mythicInfo) {
      description = mythicInfo.description;
    }
  }

  return {
    tokenId,
    name: isMythic
      ? `HouseForge ${mythicKey?.replace(/_/g, ' ')} #${tokenId}`
      : `HouseForge Agent #${tokenId} — ${house.name}`,
    description,
    image: `ipfs://PLACEHOLDER/${tokenId}.png`,
    traits,
    traitsHash,
    persona,
    generation,
    parentA: parentA.tokenId,
    parentB: parentB.tokenId,
    isMythic,
    mythicKey,
  };
}

/**
 * Convert metadata to OpenSea-compatible format
 */
export function toOpenSeaMetadata(metadata: AgentMetadata): object {
  const attributes = Object.entries(metadata.traits).map(([trait_type, value]) => ({
    trait_type,
    value,
  }));

  // Add generation as numeric attribute
  attributes.push({
    trait_type: 'Generation',
    value: metadata.generation.toString(),
  });

  // Add mythic status
  if (metadata.isMythic) {
    attributes.push({
      trait_type: 'Mythic',
      value: metadata.mythicKey || 'Unknown',
    });
  }

  return {
    name: metadata.name,
    description: metadata.description,
    image: metadata.image,
    attributes,
  };
}
