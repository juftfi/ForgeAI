# HouseForge Demo Guide

This guide walks you through running the complete HouseForge demo from scratch.

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Foundry (for smart contracts)

## Quick Start

### 1. Install Dependencies

```bash
cd HouseForge
pnpm install
```

### 2. Generate Genesis Metadata

Generate all 2100 genesis token metadata files:

```bash
pnpm gen:metadata
```

This creates JSON files in `assets/metadata/` with deterministic traits based on the master seed.

### 3. Run the Demo Script

```bash
pnpm demo
```

This demonstrates:
- Genesis trait generation
- Vault creation with hashes
- Fusion seed computation
- Offspring trait inheritance
- Mythic conditions

### 4. Start the Development Server

```bash
pnpm dev
```

This starts:
- Backend API at http://localhost:3001
- Frontend at http://localhost:3000

### 5. Explore the UI

- **Gallery** (`/gallery`): Browse all generated agents
- **Agent Detail** (`/agent/[id]`): View traits and lineage
- **Fusion Lab** (`/fusion`): Simulate fusion process
- **Lineage Tree** (`/tree`): Visualize ancestry

## Smart Contracts

### Deploy to Local Network

```bash
cd contracts

# Start local node (in another terminal)
anvil

# Deploy contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Deploy to BSC Testnet

```bash
# Set environment variables
export DEPLOYER_PRIVATE_KEY=your_key
export BSC_TESTNET_RPC_URL=https://bsc-testnet.public.blastapi.io

# Deploy
forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC_URL --broadcast --verify
```

### Run Contract Tests

```bash
forge test
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/stats` | Collection statistics |
| GET | `/metadata/:id` | Token metadata (OpenSea format) |
| POST | `/vault/create` | Create new vault |
| GET | `/vault/:id` | Get vault by ID |
| GET | `/vault/token/:tokenId` | Get vault by token ID |
| POST | `/fusion/prepare-commit` | Prepare fusion commit |
| POST | `/fusion/prepare-reveal` | Generate offspring traits |

## Fusion Flow

### 1. Commit Phase

```javascript
// User computes commit hash off-chain
const commitHash = keccak256(abi.encode(
  parentA,
  parentB,
  salt,        // Secret, saved for reveal
  blockNumber,
  userAddress,
  mode         // 0 = BURN_TO_MINT, 1 = SEAL
));

// Submit to contract
fusionCore.commitFusion(parentA, parentB, commitHash, mode);
```

### 2. Reveal Phase (after 1+ blocks)

```javascript
// Get commit block hash
const blockHash = fusionCore.getCommitBlockHash(user, parentA, parentB);

// Request offspring traits from API
const response = await fetch('/fusion/prepare-reveal', {
  method: 'POST',
  body: JSON.stringify({
    parentAId, parentBId, salt, commitBlockHash: blockHash
  })
});

const { vault, offspringHouseId } = await response.json();

// Submit reveal to contract
fusionCore.revealFusion(
  parentA, parentB, salt,
  vault.vaultURI, vault.vaultHash, vault.learningRoot,
  offspringPersona, offspringExperience, offspringHouseId
);
```

## Trait Generation Rules

### Genesis
- Traits are weighted based on `config/traits.yaml`
- House bias applies 2x multiplier to preferred traits
- Rarity multipliers adjust rare/epic trait weights

### Fusion
- **House**: Same parents = 100% same house; different = 70/30 split
- **Rarity**: Average of parents + bonuses (cross-house +1, high gen +1)
- **Core Traits**: 50% inheritance, 50% weighted pick
- **Other Traits**: 20% inheritance, 80% weighted pick

### Mythic
Mythics require ALL conditions:
1. Specific parent house combinations
2. Required traits on parents
3. Minimum generation
4. Seed modulo check (probabilistic)

Example: "Eye of the Storm" requires:
- Parents: THUNDER+THUNDER or THUNDER+MONSOON
- Parent has Plasma_Ion CoreMaterial
- Parent has LightningFork or IonBloom
- Offspring is Gen 2+
- seed % 200 === 0 (1/200 chance)

## Verification

All traits are deterministic and verifiable:

```javascript
// Recompute fusion seed
const seed = keccak256(abi.encode(
  parentA, parentB,
  parentALearningRoot, parentBLearningRoot,
  salt, commitBlockHash
));

// Regenerate traits
const traits = traitEngine.generateFusionTraits(parentA, parentB, seed);

// Verify hash matches on-chain
assert(keccak256(stableStringify(traits)) === onChainTraitsHash);
```

## Project Structure

```
HouseForge/
├── config/           # YAML configurations
├── contracts/        # Foundry smart contracts
│   ├── src/          # Contract source
│   ├── test/         # Contract tests
│   └── script/       # Deployment scripts
├── server/           # Node.js backend
│   └── src/
│       ├── services/ # Vault, TraitEngine, Orchestrator
│       ├── utils/    # RNG, Hash, YAML loader
│       └── api/      # Express routes
├── web/              # Next.js frontend
│   └── app/          # App router pages
├── assets/
│   └── metadata/     # Generated JSON files
└── docs/             # Documentation
```

## Troubleshooting

### Metadata not loading
- Ensure you ran `pnpm gen:metadata` first
- Check that `assets/metadata/` contains JSON files

### Vault errors
- Check that SQLite database exists at `server/data/vault.db`
- Delete the database to reset

### Contract deployment fails
- Verify Foundry is installed: `forge --version`
- Check RPC endpoint is accessible
- Ensure deployer has sufficient gas

## License

MIT
