import { keccak256, concat, toBeHex, zeroPadValue, dataSlice, toBigInt } from 'ethers';

/**
 * Deterministic Random Number Generator using keccak256
 * All randomness is derived from a seed, making results fully reproducible
 */
export class DeterministicRng {
  private seed: string;
  private offset: number;

  constructor(seed: string) {
    // Ensure seed is proper hex format
    this.seed = seed.startsWith('0x') ? seed : '0x' + seed;
    this.offset = 0;
  }

  /**
   * Get a deterministic hash for the current offset
   */
  private getHash(): string {
    const offsetBytes = zeroPadValue(toBeHex(this.offset), 4);
    const hash = keccak256(concat([this.seed, offsetBytes]));
    this.offset++;
    return hash;
  }

  /**
   * Get a random float between 0 and 1
   */
  random(): number {
    const hash = this.getHash();
    // Use first 4 bytes for a uint32
    const bytes = dataSlice(hash, 0, 4);
    const value = Number(toBigInt(bytes));
    return value / 0xFFFFFFFF;
  }

  /**
   * Get a random integer between min (inclusive) and max (exclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  /**
   * Get a random integer between 0 and max (exclusive)
   */
  randomIntMax(max: number): number {
    return this.randomInt(0, max);
  }

  /**
   * Pick a random item from an array
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.randomIntMax(array.length)];
  }

  /**
   * Pick a random item using weighted selection
   * @param items Array of items with their weights
   * @returns The selected item
   */
  weightedPick<T>(items: Array<{ item: T; weight: number }>): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }

    const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
    if (totalWeight <= 0) {
      throw new Error('Total weight must be positive');
    }

    let roll = this.random() * totalWeight;

    for (const { item, weight } of items) {
      roll -= weight;
      if (roll <= 0) {
        return item;
      }
    }

    // Fallback to last item (should not happen with proper weights)
    return items[items.length - 1].item;
  }

  /**
   * Shuffle an array deterministically
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomIntMax(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Check if a condition passes based on probability
   * @param probability Value between 0 and 1
   */
  chance(probability: number): boolean {
    return this.random() < probability;
  }

  /**
   * Check modulo condition (for mythic triggers)
   * Uses next hash value and checks if moduloValue equals expected
   */
  checkModulo(modulo: number, expected: number): boolean {
    const hash = this.getHash();
    const value = Number(toBigInt(dataSlice(hash, 0, 4)));
    return (value % modulo) === expected;
  }

  /**
   * Create a new RNG with a derived seed (for sub-operations)
   */
  derive(label: string): DeterministicRng {
    const derivedSeed = keccak256(concat([this.seed, label.padEnd(32, '\0')]));
    return new DeterministicRng(derivedSeed);
  }

  /**
   * Get current offset (for debugging/verification)
   */
  getOffset(): number {
    return this.offset;
  }

  /**
   * Reset to a specific offset
   */
  setOffset(offset: number): void {
    this.offset = offset;
  }
}

/**
 * Create a genesis seed from master seed and token index
 */
export function createGenesisSeed(masterSeed: string, tokenIndex: number): string {
  const indexBytes = zeroPadValue(toBeHex(tokenIndex), 4);
  return keccak256(concat([masterSeed, indexBytes]));
}
