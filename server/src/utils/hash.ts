import { keccak256, toUtf8Bytes, concat, zeroPadValue, toBeHex } from 'ethers';
import stableStringify from 'json-stable-stringify';

/**
 * Compute keccak256 hash of a string
 */
export function hashString(input: string): string {
  return keccak256(toUtf8Bytes(input));
}

/**
 * Compute keccak256 hash of an object using stable JSON stringify
 */
export function hashObject(obj: unknown): string {
  const json = stableStringify(obj) ?? '';
  return keccak256(toUtf8Bytes(json));
}

/**
 * Compute keccak256 hash of multiple hex strings concatenated
 */
export function hashConcat(...hexStrings: string[]): string {
  const bytes = hexStrings.map(h => {
    // Ensure proper hex format
    if (!h.startsWith('0x')) {
      h = '0x' + h;
    }
    return h;
  });
  return keccak256(concat(bytes));
}

/**
 * Convert a number to a 32-byte hex string (for hashing)
 */
export function numberToBytes32(n: number | bigint): string {
  return zeroPadValue(toBeHex(n), 32);
}

/**
 * Compute vault hash from vault JSON object
 */
export function computeVaultHash(vaultData: unknown): string {
  return hashObject(vaultData);
}

/**
 * Compute learning root from vault hash and summary
 */
export function computeLearningRoot(vaultHash: string, summary: string): string {
  const summaryHash = hashString(summary);
  return hashConcat(vaultHash, summaryHash);
}

/**
 * Compute traits hash for on-chain verification
 */
export function computeTraitsHash(traits: Record<string, string>): string {
  return hashObject(traits);
}

/**
 * Compute fusion seed from parent data
 */
export function computeFusionSeed(
  parentAId: number | bigint,
  parentBId: number | bigint,
  parentALearningRoot: string,
  parentBLearningRoot: string,
  salt: string,
  commitBlockHash: string
): string {
  return keccak256(concat([
    numberToBytes32(parentAId),
    numberToBytes32(parentBId),
    parentALearningRoot,
    parentBLearningRoot,
    salt.startsWith('0x') ? salt : '0x' + salt,
    commitBlockHash
  ]));
}
