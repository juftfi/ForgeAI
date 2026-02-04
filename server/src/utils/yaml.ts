import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

// Type definitions for configuration files

export interface PersonaSeed {
  calm: number;
  curious: number;
  bold: number;
  social: number;
  disciplined: number;
}

export interface VisualAnchors {
  palette_temperature: string[];
  default_light_signature: string[];
  default_instrument_mark: string[];
  style_notes: string;
}

export interface House {
  id: number;
  key: string;
  name: string;
  theme: string;
  persona_seed: PersonaSeed;
  visual_anchors: VisualAnchors;
}

export interface HousesConfig {
  version: number;
  houses: House[];
}

export interface TraitValue {
  key: string;
  w: number;
}

export interface TraitDomain {
  values: string[] | TraitValue[];
}

export interface RarityMultiplier {
  rareTraitBoost: number;
  epicTraitBoost: number;
}

export interface TraitsConfig {
  version: number;
  domains: Record<string, TraitDomain>;
  rarity_multipliers: Record<string, RarityMultiplier>;
  rare_traits: Record<string, string[]>;
  epic_traits: Record<string, string[]>;
  core_traits: string[];
}

export interface GenesisConfig {
  version: number;
  genesis: {
    season: string;
    total_supply: number;
    house_supply: Record<string, number>;
    rarity_distribution: Record<string, number>;
    weather_id_format: string;
    serial_padding: number;
    master_seed: string;
  };
}

export interface HouseBiasConfig {
  version: number;
  bias: Record<string, {
    prefer: Record<string, string[]>;
  }>;
  bias_multiplier: number;
}

export interface MythicCondition {
  type: string;
  any_of?: string[][];
  must_include?: Record<string, string[]>;
  value?: number;
}

export interface MythicTrigger {
  type: string;
  modulo: number;
  equals: number;
}

export interface Mythic {
  key: string;
  name: string;
  description: string;
  conditions: MythicCondition[];
  trigger: MythicTrigger;
  override_traits: Record<string, string>;
}

export interface MythicConfig {
  version: number;
  mythics: Mythic[];
}

// Config loader - try multiple possible paths
function getConfigDir(): string {
  const possiblePaths = [
    path.resolve(__dirname, '../../../config'),  // From dist/utils/ -> config/
    path.resolve(__dirname, '../../config'),     // Alternative
    path.resolve(process.cwd(), '../config'),    // From server/ -> config/
    path.resolve(process.cwd(), 'config'),       // From root/ -> config/
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'traits.yaml'))) {
      console.log(`Config directory found at: ${p}`);
      return p;
    }
  }

  console.error('Config directory not found. Tried:', possiblePaths);
  throw new Error('Config directory not found');
}

let CONFIG_DIR: string | null = null;

function loadYaml<T>(filename: string): T {
  if (!CONFIG_DIR) {
    CONFIG_DIR = getConfigDir();
  }
  const filepath = path.join(CONFIG_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf8');
  return yaml.load(content) as T;
}

let housesCache: HousesConfig | null = null;
let traitsCache: TraitsConfig | null = null;
let genesisCache: GenesisConfig | null = null;
let houseBiasCache: HouseBiasConfig | null = null;
let mythicCache: MythicConfig | null = null;

export function loadHouses(): HousesConfig {
  if (!housesCache) {
    housesCache = loadYaml<HousesConfig>('houses.yaml');
  }
  return housesCache;
}

export function loadTraits(): TraitsConfig {
  if (!traitsCache) {
    traitsCache = loadYaml<TraitsConfig>('traits.yaml');
  }
  return traitsCache;
}

export function loadGenesis(): GenesisConfig {
  if (!genesisCache) {
    genesisCache = loadYaml<GenesisConfig>('genesis.yaml');
  }
  return genesisCache;
}

export function loadHouseBias(): HouseBiasConfig {
  if (!houseBiasCache) {
    houseBiasCache = loadYaml<HouseBiasConfig>('house_bias.yaml');
  }
  return houseBiasCache;
}

export function loadMythic(): MythicConfig {
  if (!mythicCache) {
    mythicCache = loadYaml<MythicConfig>('mythic.yaml');
  }
  return mythicCache;
}

// Utility functions
export function getHouseById(id: number): House | undefined {
  return loadHouses().houses.find(h => h.id === id);
}

export function getHouseByKey(key: string): House | undefined {
  return loadHouses().houses.find(h => h.key === key);
}

export function getAllHouseKeys(): string[] {
  return loadHouses().houses.map(h => h.key);
}

// Clear cache (for testing)
export function clearConfigCache(): void {
  housesCache = null;
  traitsCache = null;
  genesisCache = null;
  houseBiasCache = null;
  mythicCache = null;
}
