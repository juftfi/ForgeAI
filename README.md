# KinForge

A BAP-578 compliant Non-Fungible Agent (NFA) system on BNB Chain featuring 7 Weather Houses, deterministic trait generation, and commit-reveal fusion mechanics.

## Features

- **7 Weather Houses**: CLEAR, MONSOON, THUNDER, FROST, AURORA, SAND, ECLIPSE
- **2,100 Genesis Agents**: Deterministic trait generation with house bias system
- **Fusion System**: Commit-reveal breeding with parent trait inheritance
- **BAP-578 Compliance**: Full interface implementation with learning updates
- **Mythic Rarity**: Special agents from specific house combinations
- **On-chain Verification**: vaultHash and learningRoot for data integrity

## Project Structure

```
KinForge/
├── config/                    # YAML configurations
│   ├── houses.yaml           # 7 houses with persona seeds
│   ├── traits.yaml           # Trait domains + weights
│   ├── genesis.yaml          # S0 supply config
│   ├── house_bias.yaml       # House trait preferences
│   ├── mythic.yaml           # Mythic conditions
│   └── economics.yaml        # Pricing and fees
├── contracts/                 # Foundry smart contracts
│   ├── src/
│   │   ├── HouseForgeAgent.sol
│   │   ├── FusionCore.sol
│   │   ├── interfaces/IBAP578Core.sol
│   │   └── logic/DemoLogic.sol
│   ├── test/
│   └── foundry.toml
├── server/                    # Node.js + TypeScript
│   ├── src/
│   │   ├── services/
│   │   │   ├── vault.ts
│   │   │   ├── traitEngine.ts
│   │   │   └── fusionOrchestrator.ts
│   │   ├── scripts/
│   │   │   ├── generateGenesis.ts
│   │   │   ├── exportVaultPack.ts
│   │   │   └── importVaultPack.ts
│   │   └── api/routes.ts
│   └── package.json
├── web/                       # Next.js frontend
│   ├── app/
│   │   ├── gallery/
│   │   ├── agent/[id]/
│   │   ├── fusion/
│   │   └── tree/
│   └── package.json
├── docs/
│   ├── bap578-compliance.md
│   ├── security.md
│   ├── economics.md
│   └── demo.md
└── assets/metadata/           # Generated metadata files
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Foundry (for contracts)

### Installation

```bash
# Clone and install
cd HouseForge
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Generate Genesis Metadata

```bash
cd server
pnpm gen:metadata
```

This creates 2,100 JSON metadata files in `assets/metadata/`.

### Run Development Server

```bash
# Start backend API
cd server
pnpm dev

# In another terminal, start frontend
cd web
pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:3000

### Deploy Contracts

```bash
cd contracts

# Build
forge build

# Test
forge test

# Deploy (update script with your parameters)
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## Configuration

### Houses (config/houses.yaml)

Each house has unique persona seeds and visual anchors:

| House | Theme | Color Palette |
|-------|-------|---------------|
| CLEAR | Minimalist clarity | White, silver, pale blue |
| MONSOON | Adaptive flow | Teal, deep blue, silver |
| THUNDER | Bold energy | Electric blue, black, gold |
| FROST | Precise calm | Ice blue, white, silver |
| AURORA | Vibrant creativity | Gradient rainbow, purple |
| SAND | Grounded wisdom | Warm tan, gold, orange |
| ECLIPSE | Mysterious depth | Deep purple, black, gold |

### Traits (config/traits.yaml)

12+ trait domains with weighted values:
- Expression, Posture, Material, Environment
- LightingMood, Weather, SeasonHint, SoundTexture
- InteractionStyle, AuraGlow, TimeOfDay, Movement

### Economics (config/economics.yaml)

| Item | Price (BNB) |
|------|-------------|
| Allowlist Mint | 0.005 |
| Public Mint | 0.01 |
| Fusion Base Fee | 0.003 |
| Rare Surcharge | +0.002 |
| Mythic Attempt | +0.003 |

## Smart Contracts

### HouseForgeAgent.sol

ERC-721 with BAP-578 extensions:
- `mintGenesisPublic/Allowlist` - Mint genesis agents
- `mintOffspring` - Mint fusion offspring (FusionCore only)
- `updateLearning` - Update learning state
- `executeAction` - Delegate to logic contract
- `pause/unpause/terminate` - State management

### FusionCore.sol

Commit-reveal fusion system:
- `commitFusion` - Commit to fusion with hash
- `revealFusion` - Reveal and mint offspring
- `getFusionFee` - Calculate tiered fees

### DemoLogic.sol

Example logic contract for executeAction:
- `incrementCounter` - Simple state modification
- `logMessage` - Store messages per agent
- `incrementMultiple` - Batch operations

## API Endpoints

### Vault Service

```
POST /vault/create     - Create new vault
GET  /vault/:id        - Get vault by ID
GET  /vault/token/:id  - Get vault by token ID
GET  /vault/hash/:hash - Get vault by hash
```

### Metadata

```
GET /metadata/:tokenId - OpenSea-compatible metadata
```

### Fusion

```
POST /fusion/prepare   - Prepare fusion (generate traits)
POST /fusion/commit    - Submit commit transaction
POST /fusion/reveal    - Execute reveal transaction
```

## Migration Tools

### Export Vault Data

```bash
# Export specific tokens
pnpm export-vault --tokenId 1,2,3 --out pack.json

# Export range
pnpm export-vault --tokenId 1-100 --out batch.json

# Export all
pnpm export-vault --all --out backup.json
```

### Import Vault Data

```bash
# Preview import
pnpm import-vault --file pack.json --dry-run

# Import skipping existing
pnpm import-vault --file pack.json --skip-existing

# Full import
pnpm import-vault --file pack.json
```

## BAP-578 Compliance

HouseForge implements the full BAP-578 interface:

| Feature | Status |
|---------|--------|
| State Management | ✅ Active/Paused/Terminated |
| Metadata Storage | ✅ On-chain + vaultURI |
| Vault Hash | ✅ keccak256 verification |
| Learning Root | ✅ Versioned with timestamps |
| Action Execution | ✅ Delegated with gas cap |
| Logic Upgrade | ✅ Per-agent logic address |
| Fund Management | ✅ Agent balance tracking |

See [docs/bap578-compliance.md](docs/bap578-compliance.md) for details.

## Testing

### Contract Tests

```bash
cd contracts
forge test -vvv
```

### Server Tests

```bash
cd server
pnpm test
```

## Rarity System

### Distribution

| Tier | Probability | Rarity Multiplier |
|------|-------------|-------------------|
| Common | 62% | 1.0x |
| Uncommon | 23% | 1.5x |
| Rare | 10% | 2.0x |
| Epic | 4% | 3.0x |
| Legendary | 0.9% | 5.0x |
| Mythic | 0.1% | N/A |

### Mythic Triggers

| Mythic | Houses Required | Probability |
|--------|-----------------|-------------|
| EYE_OF_STORM | THUNDER + MONSOON | 1/200 |
| FROZEN_TIME | FROST + CLEAR | 1/220 |
| BLACK_SUN | ECLIPSE + AURORA | 1/333 |

## Fusion Mechanics

### Trait Inheritance

1. **House**: Same house = 100% inherit, Different = 70/30 weighted
2. **Rarity**: Average of parents + bonuses (cross-house +1, gen≥2 +1)
3. **Core Traits** (4): 50% inherit from parents, 50% weighted pick
4. **Other Traits**: 20% inherit, 80% weighted pick with house bias

### Generation Calculation

```
offspring.generation = max(parentA.generation, parentB.generation) + 1
```

## Security

- Commit-reveal prevents front-running
- Gas-capped executeAction (500k gas)
- Merkle proof allowlist verification
- Immediate treasury forwarding
- No stored funds in contracts

See [docs/security.md](docs/security.md) for full security documentation.

## Environment Variables

```env
# Server
PORT=3001
DATABASE_PATH=./data/vault.db
API_BASE_URL=http://localhost:3001

# Blockchain
RPC_URL=https://bsc-dataseed.binance.org/
CHAIN_ID=56
PRIVATE_KEY=your_deployer_private_key

# Contracts (set after deployment)
AGENT_CONTRACT_ADDRESS=0x...
FUSION_CONTRACT_ADDRESS=0x...
TREASURY_ADDRESS=0x...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=56
```

## License

MIT

## Links

- Documentation: [docs/](docs/)
- BAP-578 Spec: [docs/bap578-compliance.md](docs/bap578-compliance.md)
- Economics: [docs/economics.md](docs/economics.md)
- Security: [docs/security.md](docs/security.md)
