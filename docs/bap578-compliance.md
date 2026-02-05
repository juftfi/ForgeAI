# BAP-578 Compliance Documentation

## Overview

KinForge implements the BAP-578 (Blockchain Agent Protocol 578) standard for Non-Fungible Agents (NFAs). This document details what aspects of BAP-578 are implemented, how they map to KinForge's functionality, and verification procedures.

## What is BAP-578?

BAP-578 defines a standard interface for ERC-721 tokens that represent autonomous agents with:
- **State Management**: Active, Paused, Terminated states with owner control
- **Metadata Storage**: On-chain summary with off-chain vault for extended data
- **Learning Capability**: Versioned learning updates with verifiable roots
- **Action Execution**: Delegated logic execution through external contracts
- **Financial Autonomy**: Agent-owned balances and fund management

## Implemented BAP-578 Features

### 1. Core Interface (`IBAP578Core.sol`)

```solidity
interface IBAP578Core {
    enum Status { Active, Paused, Terminated }

    struct State {
        uint256 balance;
        Status status;
        address owner;
        address logicAddress;
        uint256 lastActionTimestamp;
    }

    struct AgentMetadata {
        string persona;
        string experience;
        string voiceHash;
        string animationURI;
        string vaultURI;
        bytes32 vaultHash;
    }

    struct LearningState {
        bytes32 learningRoot;
        uint256 version;
        uint256 lastUpdate;
    }
}
```

### 2. State Management

| Feature | Implementation | Contract Function |
|---------|---------------|-------------------|
| Pause Agent | ✅ Implemented | `pause(uint256 tokenId)` |
| Unpause Agent | ✅ Implemented | `unpause(uint256 tokenId)` |
| Terminate Agent | ✅ Implemented | `terminate(uint256 tokenId)` |
| Status Query | ✅ Implemented | `getState(uint256 tokenId)` |

**Status Transitions:**
- `Active` → `Paused`: Owner can pause to temporarily disable actions
- `Paused` → `Active`: Owner can unpause to resume operations
- `Active/Paused` → `Terminated`: Permanent end of agent lifecycle

### 3. Action Execution

```solidity
function executeAction(uint256 tokenId, bytes calldata data)
    external
    returns (bytes memory)
```

**Implementation Details:**
- Only callable by token owner
- Agent must be in `Active` status
- Delegates call to agent's configured logic address
- Gas-capped at 500,000 to prevent griefing
- Emits `ActionExecuted` event with result data
- Updates `lastActionTimestamp`

**Demo Logic Contract:**
The `DemoLogic.sol` contract demonstrates executeAction with:
- `incrementCounter(tokenId)` - Simple state modification
- `logMessage(tokenId, message)` - String storage
- `incrementMultiple(tokenId, times)` - Batch operations
- `resetCounter(tokenId)` - State reset

### 4. Learning Updates

```solidity
function updateLearning(
    uint256 tokenId,
    bytes32 newLearningRoot,
    string calldata newVaultURI,
    bytes32 newVaultHash
) external
```

**Verification Process:**
1. Vault Service computes `vaultHash = keccak256(stableStringify(vaultJson))`
2. Vault Service computes `learningRoot = keccak256(vaultHash || keccak256(summary))`
3. Smart contract stores these hashes on-chain
4. Anyone can verify by recomputing hashes from vault data

### 5. Logic Upgrade

```solidity
function setLogicAddress(uint256 tokenId, address newLogic) external
```

Allows owners to upgrade their agent's logic contract, enabling evolution of agent capabilities over time.

### 6. Fund Management

```solidity
function fundAgent(uint256 tokenId) external payable
```

Agents can hold native currency (BNB) for autonomous operations like paying for services or participating in DeFi.

## Fusion Mapping to BAP-578

### How Fusion Creates Compliant Agents

1. **Commit Phase**
   - Parents' `learningRoot` values are captured
   - Commit hash includes parent learning states:
   ```
   commitHash = keccak256(parentA, parentB, salt, blockNumber, sender, mode)
   ```

2. **Reveal Phase**
   - Fusion seed generated from parent data:
   ```
   seed = keccak256(parentA_id, parentB_id, parentA_learningRoot,
                    parentB_learningRoot, salt, commitBlockHash)
   ```
   - Traits deterministically generated from seed
   - New vault created with lineage data

3. **Vault Creation**
   ```typescript
   const vaultData = {
     tokenId,
     parentAId,
     parentBId,
     parentALearningRoot,
     parentBLearningRoot,
     fusionVersion: "1.0.0",
     seed,
     traits,
     personaDelta,
     createdAt
   };

   vaultHash = computeVaultHash(vaultData);
   learningRoot = computeLearningRoot(vaultHash, summary);
   ```

4. **On-Chain Registration**
   - `vaultURI` points to Vault Service endpoint
   - `vaultHash` stored for verification
   - `learningRoot` enables learning state tracking
   - `generation` incremented from max parent

### Data Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐
│    Parent A     │     │    Parent B     │
│  learningRoot   │     │  learningRoot   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │    FusionCore.sol     │
         │   commitFusion()      │
         │   revealFusion()      │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │    Vault Service      │
         │  - Generate traits    │
         │  - Compute hashes     │
         │  - Store vault data   │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  HouseForgeAgent.sol  │
         │  mintOffspring()      │
         │  - Store metadata     │
         │  - Store lineage      │
         │  - Initialize state   │
         └───────────────────────┘
```

## Learning Update Verification

### Hash Computation

```typescript
// In server/src/utils/hash.ts

export function computeVaultHash(vaultJson: object): string {
  const stable = stableStringify(vaultJson);
  return keccak256(toUtf8Bytes(stable));
}

export function computeLearningRoot(vaultHash: string, summary: string): string {
  const summaryHash = keccak256(toUtf8Bytes(summary));
  return keccak256(concat([vaultHash, summaryHash]));
}
```

### Verification Steps

1. **Fetch vault data** from `vaultURI`
2. **Recompute vaultHash** using stable JSON stringify
3. **Compare** with on-chain `vaultHash`
4. **Recompute learningRoot** with summary
5. **Compare** with on-chain `learningRoot`

### Example Verification

```typescript
async function verifyAgent(tokenId: number) {
  // 1. Get on-chain data
  const metadata = await contract.getMetadata(tokenId);
  const learning = await contract.getLearningState(tokenId);

  // 2. Fetch vault
  const vault = await fetch(metadata.vaultURI).then(r => r.json());

  // 3. Verify vault hash
  const computedVaultHash = computeVaultHash({
    id: vault.id,
    tokenId: vault.tokenId,
    parentAId: vault.parentAId,
    parentBId: vault.parentBId,
    parentALearningRoot: vault.parentALearningRoot,
    parentBLearningRoot: vault.parentBLearningRoot,
    fusionVersion: vault.fusionVersion,
    seed: vault.seed,
    traits: vault.traits,
    personaDelta: vault.personaDelta,
    createdAt: vault.createdAt
  });

  if (computedVaultHash !== metadata.vaultHash) {
    throw new Error('Vault hash mismatch - data may be tampered');
  }

  // 4. Verify learning root
  const computedLearningRoot = computeLearningRoot(
    computedVaultHash,
    vault.summary
  );

  if (computedLearningRoot !== learning.learningRoot) {
    throw new Error('Learning root mismatch - learning state corrupted');
  }

  return { verified: true, vault };
}
```

## Migration System

### Export Process

The `exportVaultPack.ts` script creates portable vault packs:

```bash
# Export specific tokens
pnpm export-vault --tokenId 1,2,3 --out pack.json

# Export range
pnpm export-vault --tokenId 1-100 --out batch.json

# Export all
pnpm export-vault --all --out full-backup.json
```

**Pack Structure:**
```json
{
  "version": "1.0.0",
  "exportedAt": "2024-01-15T10:30:00Z",
  "source": "KinForge",
  "tokenCount": 3,
  "vaults": [
    {
      "id": "uuid",
      "tokenId": 1,
      "parentAId": null,
      "parentBId": null,
      "traits": { "House": "CLEAR", ... },
      "personaDelta": {},
      "summary": "Genesis agent | House: CLEAR | Rarity: Common",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "metadata": {
    "totalTraits": 36,
    "houses": { "CLEAR": 2, "MONSOON": 1 },
    "rarities": { "Common": 2, "Uncommon": 1 }
  }
}
```

### Import Process

```bash
# Preview import
pnpm import-vault --file pack.json --dry-run

# Import with skip existing
pnpm import-vault --file pack.json --skip-existing

# Full import
pnpm import-vault --file pack.json
```

**Import Verifications:**
1. Pack structure validation
2. Hash verification (optional, enabled by default)
3. Duplicate detection
4. Lineage integrity checks

### Cross-Instance Migration

To migrate agents between KinForge instances:

1. **Export** from source instance
2. **Transfer** pack file to destination
3. **Import** with `--skip-existing` flag
4. **Re-mint** tokens on destination chain (if different chain)
5. **Update** token IDs in vault after minting

## Event Emissions

BAP-578 compliant events emitted by KinForge:

| Event | Description |
|-------|-------------|
| `GenesisMinted` | New genesis agent created |
| `OffspringMinted` | New fusion offspring created |
| `LearningUpdated` | Agent learning state updated |
| `ActionExecuted` | Action delegated and executed |
| `LogicUpgraded` | Agent logic contract changed |
| `Sealed` | Agent permanently sealed |
| `Burned` | Agent destroyed |
| `Paused` | Agent paused |
| `Unpaused` | Agent unpaused |
| `Terminated` | Agent terminated |

## Compliance Checklist

| BAP-578 Requirement | Status | Notes |
|---------------------|--------|-------|
| ERC-721 Base | ✅ | OpenZeppelin implementation |
| State Management | ✅ | Active/Paused/Terminated |
| Metadata Storage | ✅ | On-chain struct + vaultURI |
| Vault Hash Verification | ✅ | keccak256 of stable JSON |
| Learning Root | ✅ | Versioned with timestamps |
| Learning Updates | ✅ | Owner-controlled updates |
| Action Execution | ✅ | Delegated with gas cap |
| Logic Upgrade | ✅ | Per-agent logic address |
| Fund Management | ✅ | Agent balance tracking |
| Pause/Unpause | ✅ | Owner-controlled |
| Terminate | ✅ | Permanent status change |
| Lineage Tracking | ✅ | Parent IDs + generation |

## Security Considerations

1. **Gas Caps**: executeAction limited to 500,000 gas
2. **Owner-Only**: Critical functions require token ownership
3. **Status Checks**: Actions only execute for Active agents
4. **Hash Verification**: Tamper-evident vault data
5. **Stable Serialization**: Deterministic JSON for consistent hashing

## Future Extensions

Planned BAP-578 extensions for KinForge:

- **Multi-sig Ownership**: Require multiple approvals for sensitive actions
- **Time-locked Actions**: Schedule actions for future execution
- **Cross-chain Identity**: Verify agent identity across chains
- **Encrypted Vault Sections**: Privacy-preserving learning data
