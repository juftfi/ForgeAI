import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateGenesisTraits,
  generateGenesisMetadata,
  generateFusionTraits,
  generateFusionMetadata,
  toOpenSeaMetadata,
  ParentInfo,
  GeneratedTraits,
} from '../services/traitEngine';
import { DeterministicRng } from '../utils/rng';
import { computeTraitsHash, computeFusionSeed } from '../utils/hash';

describe('Trait Engine', () => {
  describe('Genesis Generation', () => {
    it('generates deterministic traits with same seed', () => {
      const seed = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const traits1 = generateGenesisTraits(1, 'CLEAR', 'Common', 1, seed);
      const traits2 = generateGenesisTraits(1, 'CLEAR', 'Common', 1, seed);

      expect(traits1).toEqual(traits2);
    });

    it('generates different traits with different seeds', () => {
      const seed1 = '0x1111111111111111111111111111111111111111111111111111111111111111';
      const seed2 = '0x2222222222222222222222222222222222222222222222222222222222222222';

      const traits1 = generateGenesisTraits(1, 'CLEAR', 'Common', 1, seed1);
      const traits2 = generateGenesisTraits(1, 'CLEAR', 'Common', 1, seed2);

      // At least some traits should differ
      expect(traits1).not.toEqual(traits2);
    });

    it('applies house bias correctly', () => {
      const seed = '0x3333333333333333333333333333333333333333333333333333333333333333';

      // Generate many tokens and check distribution
      const clearTraits: GeneratedTraits[] = [];
      const thunderTraits: GeneratedTraits[] = [];

      for (let i = 0; i < 100; i++) {
        const seedN = `0x${i.toString(16).padStart(64, '0')}`;
        clearTraits.push(generateGenesisTraits(i, 'CLEAR', 'Common', i, seedN));
        thunderTraits.push(generateGenesisTraits(i, 'THUNDER', 'Common', i, seedN));
      }

      // CLEAR should have more Sunbeam/PrismaticRay light signatures
      const clearSunbeam = clearTraits.filter(t =>
        t.LightSignature === 'Sunbeam' || t.LightSignature === 'PrismaticRay'
      ).length;

      // THUNDER should have more LightningFork/IonBloom
      const thunderLightning = thunderTraits.filter(t =>
        t.LightSignature === 'LightningFork' || t.LightSignature === 'IonBloom'
      ).length;

      expect(clearSunbeam).toBeGreaterThan(20); // Should be biased
      expect(thunderLightning).toBeGreaterThan(20);
    });

    it('generates correct WeatherID format', () => {
      const traits = generateGenesisTraits(1, 'AURORA', 'Rare', 42, '0x' + '0'.repeat(64));

      expect(traits.WeatherID).toMatch(/^S0-AURORA-\d{4}$/);
      expect(traits.WeatherID).toBe('S0-AURORA-0042');
    });

    it('generates metadata with all required fields', () => {
      const metadata = generateGenesisMetadata(1, 'FROST', 'Epic', 1, '0x' + '0'.repeat(64));

      expect(metadata.tokenId).toBe(1);
      expect(metadata.name).toContain('House Frost');
      expect(metadata.description).toContain('vault');
      expect(metadata.image).toMatch(/^ipfs:\/\/PLACEHOLDER\/\d+\.png$/);
      expect(metadata.traits.House).toBe('FROST');
      expect(metadata.traits.RarityTier).toBe('Epic');
      expect(metadata.generation).toBe(0);
      expect(metadata.isMythic).toBe(false);
      expect(metadata.persona).toBeDefined();
      expect(metadata.traitsHash).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });

  describe('Fusion Generation', () => {
    const createParent = (id: number, house: string, rarity: string, gen: number): ParentInfo => ({
      tokenId: id,
      house,
      rarity,
      generation: gen,
      traits: {
        Season: 'S0',
        House: house,
        RarityTier: rarity,
        WeatherID: `S0-${house}-0001`,
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

    it('same house parents produce same house offspring', () => {
      const parentA = createParent(1, 'FROST', 'Common', 0);
      const parentB = createParent(2, 'FROST', 'Uncommon', 0);
      const seed = '0x' + '4'.repeat(64);

      const result = generateFusionTraits(parentA, parentB, seed);

      expect(result.traits.House).toBe('FROST');
    });

    it('different house parents follow 70/30 rule', () => {
      const parentA = createParent(1, 'AURORA', 'Common', 0);
      const parentB = createParent(2, 'ECLIPSE', 'Common', 0);

      // Generate many offspring
      let auroraCount = 0;
      let eclipseCount = 0;

      for (let i = 0; i < 1000; i++) {
        const seed = `0x${i.toString(16).padStart(64, '0')}`;
        const result = generateFusionTraits(parentA, parentB, seed);

        if (result.traits.House === 'AURORA') auroraCount++;
        if (result.traits.House === 'ECLIPSE') eclipseCount++;
      }

      // Should be roughly 70/30
      expect(auroraCount).toBeGreaterThan(600);
      expect(auroraCount).toBeLessThan(800);
      expect(eclipseCount).toBeGreaterThan(200);
      expect(eclipseCount).toBeLessThan(400);
    });

    it('cross-house fusion increases rarity', () => {
      const parentA = createParent(1, 'CLEAR', 'Common', 0);
      const parentB = createParent(2, 'MONSOON', 'Common', 0);
      const seed = '0x' + '5'.repeat(64);

      const result = generateFusionTraits(parentA, parentB, seed);

      // Common + Common with cross-house bonus should be Uncommon
      expect(result.traits.RarityTier).toBe('Uncommon');
    });

    it('high generation parents increase rarity', () => {
      const parentA = createParent(1, 'FROST', 'Common', 2);
      const parentB = createParent(2, 'FROST', 'Common', 0);
      const seed = '0x' + '6'.repeat(64);

      const result = generateFusionTraits(parentA, parentB, seed);

      // Common + Common with gen bonus should be Uncommon
      expect(result.traits.RarityTier).toBe('Uncommon');
    });

    it('fusion metadata includes parent info', () => {
      const parentA = createParent(1, 'SAND', 'Rare', 1);
      const parentB = createParent(2, 'ECLIPSE', 'Uncommon', 0);
      const seed = '0x' + '7'.repeat(64);

      const metadata = generateFusionMetadata(100, parentA, parentB, seed);

      expect(metadata.parentA).toBe(1);
      expect(metadata.parentB).toBe(2);
      expect(metadata.generation).toBe(2); // max(1, 0) + 1
    });
  });

  describe('Hash Consistency', () => {
    it('computes consistent traits hash', () => {
      const traits: GeneratedTraits = {
        Season: 'S0',
        House: 'CLEAR',
        RarityTier: 'Common',
        WeatherID: 'S0-CLEAR-0001',
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
      };

      const hash1 = computeTraitsHash(traits);
      const hash2 = computeTraitsHash(traits);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('computes different hash for different traits', () => {
      const traits1: GeneratedTraits = {
        Season: 'S0', House: 'CLEAR', RarityTier: 'Common',
        WeatherID: 'S0-CLEAR-0001', FrameType: 'TitaniumBlack_Brushed',
        CoreMaterial: 'VolumetricCloud', LightSignature: 'Sunbeam',
        InstrumentMark: 'FineScale', Atmosphere: 'Clean',
        DioramaGeometry: 'Capsule', PaletteTemperature: 'Neutral',
        SurfaceAging: 'Pristine', MicroEngraving: 'SerialOnly', LensBloom: 'Soft',
      };

      const traits2 = { ...traits1, FrameType: 'BlackChrome_Mirror' };

      const hash1 = computeTraitsHash(traits1);
      const hash2 = computeTraitsHash(traits2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('OpenSea Metadata Format', () => {
    it('converts to valid OpenSea format', () => {
      const metadata = generateGenesisMetadata(1, 'THUNDER', 'Rare', 1, '0x' + '0'.repeat(64));
      const openSea = toOpenSeaMetadata(metadata);

      expect(openSea).toHaveProperty('name');
      expect(openSea).toHaveProperty('description');
      expect(openSea).toHaveProperty('image');
      expect(openSea).toHaveProperty('attributes');
      expect(Array.isArray((openSea as any).attributes)).toBe(true);

      const attrs = (openSea as any).attributes;
      const houseAttr = attrs.find((a: any) => a.trait_type === 'House');
      expect(houseAttr?.value).toBe('THUNDER');
    });
  });
});

describe('Deterministic RNG', () => {
  it('produces same sequence with same seed', () => {
    const rng1 = new DeterministicRng('0x1234');
    const rng2 = new DeterministicRng('0x1234');

    for (let i = 0; i < 10; i++) {
      expect(rng1.random()).toBe(rng2.random());
    }
  });

  it('produces different sequence with different seed', () => {
    const rng1 = new DeterministicRng('0x1234');
    const rng2 = new DeterministicRng('0x5678');

    let sameCount = 0;
    for (let i = 0; i < 100; i++) {
      if (rng1.random() === rng2.random()) sameCount++;
    }

    expect(sameCount).toBeLessThan(5); // Very unlikely to have many matches
  });

  it('weighted pick respects weights', () => {
    const rng = new DeterministicRng('0x' + '1234567890abcdef'.repeat(4));
    const items = [
      { item: 'A', weight: 90 },
      { item: 'B', weight: 10 },
    ];

    let aCount = 0;
    for (let i = 0; i < 1000; i++) {
      rng.setOffset(i);
      if (rng.weightedPick(items) === 'A') aCount++;
    }

    expect(aCount).toBeGreaterThan(800);
    expect(aCount).toBeLessThan(950);
  });
});
