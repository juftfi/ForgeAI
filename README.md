# KinForge

[![Live Demo](https://img.shields.io/badge/Live-kinforge--mauve.vercel.app-blue)](https://kinforge-mauve.vercel.app)
[![BSC Mainnet](https://img.shields.io/badge/BSC-Mainnet-yellow)](https://bscscan.com/address/0xeAcf52Cb95e511EDe5107f9F33fEE0B7B77F9E2B)

A BAP-578 compliant Non-Fungible Agent (NFA) system on BNB Chain featuring 7 Weather Houses, AI-powered dialogue with personality, memory system, and commit-reveal fusion mechanics.

## Live Deployment

- **Frontend**: https://kinforge-mauve.vercel.app
- **Backend API**: https://houseforgeserver-production.up.railway.app
- **Smart Contract**: [0xeAcf52Cb95e511EDe5107f9F33fEE0B7B77F9E2B](https://bscscan.com/address/0xeAcf52Cb95e511EDe5107f9F33fEE0B7B77F9E2B)
- **Fusion Contract**: [0x8a7fdf8e6b3E7C23744de8eE893D0C1899189004](https://bscscan.com/address/0x8a7fdf8e6b3E7C23744de8eE893D0C1899189004)

## Features

### Core Features
- **7 Weather Houses**: CLEAR, MONSOON, THUNDER, FROST, AURORA, SAND, ECLIPSE
- **2,100 Genesis Agents**: Deterministic trait generation with house bias system
- **Fusion System**: Commit-reveal breeding with parent trait inheritance
- **BAP-578 Compliance**: Full interface implementation with learning updates
- **Mythic Rarity**: Special agents from specific house combinations
- **On-chain Verification**: vaultHash and learningRoot for data integrity

### AI Dialogue System (NEW)
- **Personality-driven Chat**: Each Agent has unique personality based on House traits
- **Memory System**: Agents remember conversations and accumulate knowledge
- **Learning Growth**: Personality evolves over time through interactions
- **PersonaVector**: 5-dimensional personality (calm, curious, bold, social, disciplined)
- **learningRoot Verification**: On-chain verifiable learning history

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
│   │   │   ├── vault.ts      # Vault storage
│   │   │   ├── traitEngine.ts # Trait generation
│   │   │   ├── ai.ts         # AI client (OpenAI/Anthropic)
│   │   │   ├── chat.ts       # Chat orchestration
│   │   │   ├── memory.ts     # Memory management
│   │   │   ├── learning.ts   # Learning system
│   │   │   └── prompt.ts     # Prompt engineering
│   │   ├── types/
│   │   │   └── chat.ts       # Type definitions
│   │   └── api/routes.ts
│   └── package.json
├── web/                       # Next.js frontend
│   ├── app/
│   │   ├── gallery/          # Agent gallery
│   │   ├── agent/[id]/       # Agent detail + chat
│   │   ├── fusion/           # Fusion interface
│   │   └── tree/             # Lineage tree
│   ├── components/
│   │   ├── chat/             # Chat components
│   │   ├── learning/         # Learning panel
│   │   └── memory/           # Memory browser
│   └── package.json
├── docs/
│   ├── user-guide.md         # User guide
│   ├── whitepaper.md         # Technical whitepaper
│   ├── api.md                # API documentation
│   ├── deployment.md         # Deployment guide
│   ├── bap578-compliance.md  # BAP-578 compliance
│   ├── security.md           # Security documentation
│   └── economics.md          # Economics model
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
git clone https://github.com/KinForgeLab/kinforge.git
cd kinforge
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Configuration

```env
# Server
SERVER_PORT=3001
DATABASE_PATH=./data/vault.db

# Blockchain
RPC_URL=https://bsc-dataseed.binance.org/
CHAIN_ID=56
HOUSEFORGE_AGENT_ADDRESS=0xeAcf52Cb95e511EDe5107f9F33fEE0B7B77F9E2B

# AI Configuration (Required for chat)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini

# Learning System
LEARNING_AUTO_SYNC=false
LEARNING_SYNC_THRESHOLD=10
MEMORY_MAX_COUNT=1000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=56
```

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

## AI Dialogue System

### How It Works

1. **Start Session**: Connect wallet and start a chat session with any Agent
2. **Conversation**: AI responds based on Agent's House personality and memories
3. **End Session**: Memories are extracted and stored
4. **Learning**: PersonaVector gradually evolves through interactions

### PersonaVector

Each Agent has a 5-dimensional personality vector:

| Dimension | Description | Range |
|-----------|-------------|-------|
| Calm | Emotional stability | -1.0 to 1.0 |
| Curious | Intellectual openness | -1.0 to 1.0 |
| Bold | Risk-taking tendency | -1.0 to 1.0 |
| Social | Interpersonal orientation | -1.0 to 1.0 |
| Disciplined | Self-control | -1.0 to 1.0 |

### House Personalities

| House | Base Personality |
|-------|-----------------|
| CLEAR | calm +0.4, curious +0.2 |
| MONSOON | social +0.3, curious +0.3 |
| THUNDER | bold +0.5, social +0.2 |
| FROST | calm +0.5, disciplined +0.3 |
| AURORA | curious +0.4, bold +0.2 |
| SAND | disciplined +0.4, calm +0.2 |
| ECLIPSE | calm +0.3, bold +0.3 |

### Memory Types

| Type | Description |
|------|-------------|
| Fact | Information about the user or world |
| Preference | User likes and dislikes |
| Experience | Notable interactions |
| Relationship | Connection with the user |

### learningRoot Calculation

```
memoriesHash = merkleRoot(memories.map(m => keccak256(m)))
summaryHash = keccak256(AI_generated_summary)
learningRoot = keccak256(vaultHash + memoriesHash + summaryHash)
```

## Smart Contracts

### HouseForgeAgent.sol

ERC-721 with BAP-578 extensions:
- `mintGenesisPublic/Allowlist` - Mint genesis agents
- `mintOffspring` - Mint fusion offspring (FusionCore only)
- `updateLearning` - Update learning state (learningRoot, version)
- `executeAction` - Delegate to logic contract
- `pause/unpause/terminate` - State management

### FusionCore.sol

Commit-reveal fusion system:
- `commitFusion` - Commit to fusion with hash
- `revealFusion` - Reveal and mint offspring
- `getFusionFee` - Calculate tiered fees

## API Endpoints

### Chat Endpoints

```
POST /chat/session              - Create new chat session
POST /chat/message              - Send message and get AI response
GET  /chat/session/:sessionId   - Get session details
POST /chat/session/:id/end      - End session and extract memories
```

### Memory Endpoints

```
GET  /agent/:tokenId/memories        - Get agent memories
GET  /agent/:tokenId/memories/search - Search memories
```

### Learning Endpoints

```
GET  /agent/:tokenId/learning           - Get learning history
POST /agent/:tokenId/learning/snapshot  - Create learning snapshot
POST /agent/:tokenId/learning/sync      - Sync to blockchain
```

### Vault & Metadata

```
POST /vault/create              - Create new vault
GET  /vault/:id                 - Get vault by ID
GET  /vault/token/:tokenId      - Get vault by token ID
GET  /metadata/:tokenId         - OpenSea-compatible metadata
```

### Fusion

```
POST /fusion/prepare-commit     - Prepare commit data
POST /fusion/prepare-reveal     - Generate offspring traits
```

## Fusion Mechanics

### Trait Inheritance

1. **House**: Same house = 100% inherit, Different = 70/30 weighted
2. **Rarity**: Average of parents + bonuses (cross-house +1, gen≥2 +1)
3. **Core Traits** (4): 50% inherit from parents, 50% weighted pick
4. **Other Traits**: 20% inherit, 80% weighted pick with house bias

### Mythic Triggers

| Mythic | Houses Required | Probability |
|--------|-----------------|-------------|
| EYE_OF_STORM | THUNDER + MONSOON | 1/200 |
| FROZEN_TIME | FROST + CLEAR | 1/220 |
| BLACK_SUN | ECLIPSE + AURORA | 1/333 |

## Rarity Distribution

| Tier | Probability | Rarity Multiplier |
|------|-------------|-------------------|
| Common | 62% | 1.0x |
| Uncommon | 23% | 1.5x |
| Rare | 10% | 2.0x |
| Epic | 4% | 3.0x |
| Legendary | 0.9% | 5.0x |
| Mythic | 0.1% | N/A |

## Deployment

### Frontend (Vercel)

The frontend auto-deploys from GitHub to Vercel.

```bash
# Manual deployment
cd web
vercel --prod
```

### Backend (Railway)

```bash
# Connect to Railway
railway login
railway link

# Deploy
railway up
```

Required environment variables on Railway:
- `OPENAI_API_KEY`
- `RPC_URL`
- `CHAIN_ID`
- `HOUSEFORGE_AGENT_ADDRESS`
- `DATABASE_PATH`

### Contracts (Foundry)

```bash
cd contracts
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## BAP-578 Compliance

| Feature | Status |
|---------|--------|
| State Management | ✅ Active/Paused/Terminated |
| Metadata Storage | ✅ On-chain + vaultURI |
| Vault Hash | ✅ keccak256 verification |
| Learning Root | ✅ Versioned with timestamps |
| Action Execution | ✅ Delegated with gas cap |
| Logic Upgrade | ✅ Per-agent logic address |
| Fund Management | ✅ Agent balance tracking |

## Security

- Commit-reveal prevents front-running
- Gas-capped executeAction (500k gas)
- Merkle proof allowlist verification
- Immediate treasury forwarding
- No stored funds in contracts
- API key encryption for AI services

## Testing

```bash
# Contract tests
cd contracts && forge test -vvv

# Server tests
cd server && pnpm test
```

## Documentation

- [User Guide](docs/user-guide.md) - How to use KinForge
- [Whitepaper](docs/whitepaper.md) - Technical design
- [API Reference](docs/api.md) - Full API documentation
- [Deployment Guide](docs/deployment.md) - Deployment instructions
- [BAP-578 Compliance](docs/bap578-compliance.md) - Standard compliance
- [Security](docs/security.md) - Security documentation
- [Economics](docs/economics.md) - Economic model

## Links

- Live Demo: https://kinforge-mauve.vercel.app
- GitHub: https://github.com/KinForgeLab/kinforge
- BSCScan: [Contract](https://bscscan.com/address/0xeAcf52Cb95e511EDe5107f9F33fEE0B7B77F9E2B)

## License

MIT
