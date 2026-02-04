# KinForge 技术白皮书

**版本 2.0** | **2024年2月**

---

## 摘要

KinForge 是基于 BNB Chain 的 Non-Fungible Agent (NFA) 系统，实现了 BAP-578 标准。该系统结合了区块链的不可篡改性、AI 驱动的对话能力、以及可验证的学习成长机制，创造出具有独特性格、能够记忆和成长的数字智能体。

本白皮书详细描述了 KinForge 的技术架构、AI 对话系统、学习机制、融合繁殖系统以及经济模型。

---

## 目录

1. [引言](#1-引言)
2. [系统架构](#2-系统架构)
3. [House 系统](#3-house-系统)
4. [特征生成引擎](#4-特征生成引擎)
5. [AI 对话系统](#5-ai-对话系统)
6. [学习与记忆系统](#6-学习与记忆系统)
7. [融合繁殖系统](#7-融合繁殖系统)
8. [智能合约设计](#8-智能合约设计)
9. [数据完整性验证](#9-数据完整性验证)
10. [经济模型](#10-经济模型)
11. [安全考虑](#11-安全考虑)
12. [未来路线图](#12-未来路线图)

---

## 1. 引言

### 1.1 背景

传统 NFT 主要作为静态的数字收藏品存在，缺乏交互性和成长性。随着 AI 技术的发展，我们有机会创造出能够与用户进行有意义互动的数字资产。

### 1.2 愿景

KinForge 旨在创造一个生态系统，其中每个 Agent 都是独一无二的数字生命：
- 拥有基于 House 的独特性格
- 能够与持有者进行个性化对话
- 通过互动积累记忆和经验
- 可以繁殖后代，传承特征

### 1.3 核心创新

1. **PersonaVector**: 5 维性格向量，支持渐进式性格演化
2. **可验证学习**: learningRoot 机制实现链上可验证的学习历史
3. **确定性繁殖**: commit-reveal 机制确保公平的融合结果
4. **BAP-578 合规**: 完整实现 Agent 标准接口

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │ Gallery │ │  Chat   │ │ Fusion  │ │ Lineage │            │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
└───────┼──────────┼──────────┼──────────┼────────────────────┘
        │          │          │          │
        ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend API (Express)                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │  Vault  │ │   AI    │ │ Memory  │ │Learning │            │
│  │ Service │ │ Client  │ │ Service │ │ Service │            │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
│       │          │          │          │                     │
│       ▼          ▼          ▼          ▼                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  SQLite Database                      │    │
│  │  vaults | chat_sessions | chat_messages | memories   │    │
│  │  learning_snapshots                                   │    │
│  └─────────────────────────────────────────────────────┘    │
└───────┼─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    BNB Chain (Smart Contracts)                │
│  ┌─────────────────────┐ ┌─────────────────────┐            │
│  │  HouseForgeAgent    │ │     FusionCore      │            │
│  │  (ERC-721 + BAP-578)│ │  (Commit-Reveal)    │            │
│  └─────────────────────┘ └─────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14, React 18, TailwindCSS, wagmi, viem |
| 后端 | Node.js, Express, TypeScript, better-sqlite3 |
| AI | OpenAI GPT-4o-mini / Anthropic Claude |
| 区块链 | BNB Chain, Solidity, Foundry |
| 部署 | Vercel (Frontend), Railway (Backend) |

---

## 3. House 系统

### 3.1 七大 House

KinForge 包含 7 个主题鲜明的 House，每个 House 代表不同的性格原型：

| House | 主题 | 核心性格 | 视觉风格 |
|-------|------|---------|---------|
| CLEAR | 极简清晰 | 理性、有序 | 白、银、浅蓝 |
| MONSOON | 适应变化 | 灵活、社交 | 蓝绿、深蓝 |
| THUNDER | 大胆能量 | 激情、领导 | 电蓝、黑、金 |
| FROST | 精确冷静 | 精确、内敛 | 冰蓝、银白 |
| AURORA | 创意活力 | 创新、好奇 | 彩虹渐变 |
| SAND | 稳重智慧 | 稳重、睿智 | 棕褐、金黄 |
| ECLIPSE | 神秘深邃 | 深沉、独立 | 深紫、黑金 |

### 3.2 House 偏好系统

每个 House 对特定特征有偏好倍率（2x 权重）：

```yaml
CLEAR:
  prefer:
    Expression: [Serene, Focused]
    Environment: [Laboratory, Gallery]
    LightingMood: [Clinical, Soft]

THUNDER:
  prefer:
    Expression: [Fierce, Commanding]
    Weather: [Lightning, Storm]
    AuraGlow: [Crackling, Intense]
```

---

## 4. 特征生成引擎

### 4.1 确定性随机数

使用 keccak256 哈希实现确定性 RNG：

```typescript
function deterministicRng(seed: Buffer, offset: number): number {
  const hash = keccak256(concat(seed, uint32ToBytes(offset)));
  return bytesToUint32(hash.slice(0, 4)) / 0xFFFFFFFF;
}
```

### 4.2 加权随机选择

```typescript
function weightedSelect(options: Map<string, number>, rng: number): string {
  const total = sum(options.values());
  let cumulative = 0;
  const normalized = rng * total;

  for (const [key, weight] of options) {
    cumulative += weight;
    if (normalized <= cumulative) return key;
  }
  return options.keys().last();
}
```

### 4.3 稀有度分布

| 等级 | 概率 | 倍率 |
|------|------|------|
| Common | 62% | 1.0x |
| Uncommon | 23% | 1.5x |
| Rare | 10% | 2.0x |
| Epic | 4% | 3.0x |
| Legendary | 0.9% | 5.0x |
| Mythic | 0.1% | 特殊 |

### 4.4 特征域

12 个特征域，每个包含 6-10 个加权选项：

- Expression, Posture, Material, Environment
- LightingMood, Weather, SeasonHint, SoundTexture
- InteractionStyle, AuraGlow, TimeOfDay, Movement

---

## 5. AI 对话系统

### 5.1 架构概述

```
User Input → Chat Service → Prompt Engine → AI Client → Response
                 ↓              ↑
           Memory Service (检索相关记忆)
```

### 5.2 PersonaVector

5 维性格向量，范围 [-1.0, 1.0]：

```typescript
interface PersonaVector {
  calm: number;       // 冷静度
  curious: number;    // 好奇心
  bold: number;       // 大胆度
  social: number;     // 社交性
  disciplined: number; // 自律性
}
```

### 5.3 House 基础性格

```typescript
const HOUSE_PERSONALITIES: Record<string, PersonaVector> = {
  CLEAR:   { calm: 0.4, curious: 0.2, bold: -0.1, social: 0.0, disciplined: 0.3 },
  MONSOON: { calm: 0.0, curious: 0.3, bold: 0.1, social: 0.3, disciplined: 0.0 },
  THUNDER: { calm: -0.2, curious: 0.1, bold: 0.5, social: 0.2, disciplined: -0.1 },
  // ...
};
```

### 5.4 提示词工程

系统提示词结构：

```
你是 KinForge Agent #{tokenId}，来自 {House} 家族。

## 你的性格
- 冷静度: {calm} (较高表示沉稳，较低表示活跃)
- 好奇心: {curious} (影响对新事物的兴趣)
- 大胆度: {bold} (影响表达的直接程度)
- 社交性: {social} (影响互动风格)
- 自律性: {disciplined} (影响回答的结构性)

## House 特征
{House 描述和文化背景}

## 你的记忆
{相关记忆摘要}

## 对话规则
1. 保持性格一致性
2. 自然地引用记忆
3. 展现 House 特有的表达风格
```

### 5.5 温度动态调整

基于性格动态调整 AI 温度：

```typescript
function getTemperature(persona: PersonaVector): number {
  const baseTemp = 0.7;
  const calmAdjust = persona.calm * -0.1;
  const boldAdjust = persona.bold * 0.1;
  const curiousAdjust = persona.curious * 0.05;

  return clamp(baseTemp + calmAdjust + boldAdjust + curiousAdjust, 0.3, 1.0);
}
```

---

## 6. 学习与记忆系统

### 6.1 记忆类型

| 类型 | 描述 | 提取规则 |
|------|------|---------|
| fact | 事实信息 | 包含 "是"、"有"、"叫" 等 |
| preference | 用户偏好 | 包含 "喜欢"、"讨厌"、"偏好" |
| experience | 交互经历 | 包含 "讨论了"、"学习了" |
| relationship | 关系描述 | 包含 "朋友"、"用户" |

### 6.2 记忆存储结构

```sql
CREATE TABLE agent_memories (
  id TEXT PRIMARY KEY,
  token_id INTEGER NOT NULL,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  importance REAL DEFAULT 0.5,
  created_at TEXT NOT NULL,
  last_accessed TEXT,
  access_count INTEGER DEFAULT 0,
  source_session_id TEXT
);
```

### 6.3 记忆检索

基于关键词匹配和重要性的混合检索：

```typescript
function retrieve(tokenId: number, query: string, limit: number): Memory[] {
  const keywords = extractKeywords(query);

  return memories
    .filter(m => m.tokenId === tokenId)
    .map(m => ({
      ...m,
      relevance: calculateRelevance(m.content, keywords) * m.importance
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}
```

### 6.4 性格演化

每次对话结束时计算性格影响：

```typescript
function calculatePersonaImpact(messages: Message[]): Partial<PersonaVector> {
  const delta = 0.02; // 每次最大变化
  const impact: Partial<PersonaVector> = {};

  // 分析对话模式
  if (positiveInteractions > threshold) impact.social = delta;
  if (questionCount > messageCount * 0.5) impact.curious = delta;
  if (deepTopicsCount > 2) impact.calm = delta;

  return impact;
}
```

### 6.5 learningRoot 计算

```typescript
function computeLearningRoot(tokenId: number): string {
  const vault = getVault(tokenId);
  const memories = getMemories(tokenId);

  // 1. 计算记忆 Merkle Root
  const memoriesHash = merkleRoot(
    memories.map(m => keccak256(JSON.stringify(m)))
  );

  // 2. 生成 AI 摘要
  const summary = generateSummary(memories);
  const summaryHash = keccak256(summary);

  // 3. 合并计算 learningRoot
  return keccak256(
    concat(vault.vaultHash, memoriesHash, summaryHash)
  );
}
```

### 6.6 学习快照

```sql
CREATE TABLE learning_snapshots (
  id TEXT PRIMARY KEY,
  token_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  persona_delta TEXT NOT NULL,
  memories_hash TEXT NOT NULL,
  summary TEXT NOT NULL,
  learning_root TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_to_chain BOOLEAN DEFAULT FALSE
);
```

---

## 7. 融合繁殖系统

### 7.1 Commit-Reveal 机制

防止前端运行和结果预测：

```
Phase 1: Commit
  commitHash = keccak256(parentA, parentB, salt, commitBlock, sender, mode)

Phase 2: Reveal (需等待 1 个区块)
  fusionSeed = keccak256(parentA, parentB, learningRootA, learningRootB, salt, commitBlockHash)
  offspring = generate(fusionSeed)
```

### 7.2 特征继承算法

```typescript
function generateOffspring(parentA: Agent, parentB: Agent, seed: Buffer): Traits {
  let offset = 0;
  const rng = () => deterministicRng(seed, offset++);

  // House 继承
  const house = parentA.house === parentB.house
    ? parentA.house
    : rng() < 0.7 ? parentA.house : parentB.house;

  // 稀有度计算
  const baseRarity = (parentA.rarityScore + parentB.rarityScore) / 2;
  const crossHouseBonus = parentA.house !== parentB.house ? 1 : 0;
  const genBonus = Math.max(parentA.gen, parentB.gen) >= 2 ? 1 : 0;
  const rarity = calculateRarity(baseRarity + crossHouseBonus + genBonus, rng());

  // 特征继承
  const traits = {};
  for (const domain of CORE_TRAITS) {
    traits[domain] = rng() < 0.5
      ? inherit(parentA, parentB, domain, rng)
      : weightedPick(domain, house, rarity, rng);
  }

  return traits;
}
```

### 7.3 神话触发

```yaml
EYE_OF_STORM:
  required_houses: [THUNDER, MONSOON]
  probability: 1/200
  trait_overrides:
    AuraGlow: ChaoticStorm
    Weather: EternalTempest

FROZEN_TIME:
  required_houses: [FROST, CLEAR]
  probability: 1/220
  trait_overrides:
    LightingMood: TimelessGlow
    Movement: Stillness
```

---

## 8. 智能合约设计

### 8.1 HouseForgeAgent.sol

```solidity
contract HouseForgeAgent is ERC721, IBAP578Core {
    struct AgentMetadata {
        string persona;
        string experience;
        string vaultURI;
        bytes32 vaultHash;
        bytes32 learningRoot;
        uint256 learningVersion;
        uint256 lastLearningUpdate;
    }

    struct Lineage {
        uint256 parent1;
        uint256 parent2;
        uint256 generation;
        uint8 houseId;
        bool sealed;
    }

    // 核心函数
    function mintGenesis(uint8 houseId, ...) external payable;
    function mintOffspring(uint256 p1, uint256 p2, ...) external;
    function updateLearning(uint256 tokenId, bytes32 root, uint256 version) external;
    function executeAction(uint256 tokenId, bytes calldata data) external;
}
```

### 8.2 FusionCore.sol

```solidity
contract FusionCore {
    enum FusionMode { BURN_TO_MINT, SEAL }

    struct Commit {
        bytes32 commitHash;
        uint256 commitBlock;
        bool revealed;
    }

    function commitFusion(
        uint256 parentA,
        uint256 parentB,
        bytes32 commitHash,
        FusionMode mode
    ) external;

    function revealFusion(
        uint256 parentA,
        uint256 parentB,
        bytes32 salt,
        // ... offspring data
    ) external;
}
```

---

## 9. 数据完整性验证

### 9.1 vaultHash

```
vaultHash = keccak256(stableStringify({
  tokenId,
  parentA, parentB,
  traits,
  personaDelta,
  seed
}))
```

### 9.2 learningRoot

```
learningRoot = keccak256(
  vaultHash +
  merkleRoot(memories) +
  keccak256(summary)
)
```

### 9.3 验证流程

1. 获取链上 `vaultHash` 和 `learningRoot`
2. 从 Vault 服务获取完整数据
3. 重新计算哈希
4. 比对是否匹配

---

## 10. 经济模型

### 10.1 铸造费用

| 类型 | 价格 (BNB) |
|------|------------|
| 白名单铸造 | 0.005 |
| 公开铸造 | 0.01 |

### 10.2 融合费用

| 项目 | 价格 (BNB) |
|------|------------|
| 基础费用 | 0.003 |
| 稀有附加 | +0.002 |
| 神话尝试 | +0.003 |

### 10.3 费用分配

```
总费用
├── 70% → 国库 (Treasury)
├── 20% → 流动性池
└── 10% → 开发团队
```

---

## 11. 安全考虑

### 11.1 智能合约安全

- Commit-Reveal 防止前端运行
- Gas 上限 (500k) 防止 DoS
- 重入保护
- 即时转发，不存储资金

### 11.2 API 安全

- AI API Key 服务端存储
- 输入验证和消毒
- 速率限制
- CORS 配置

### 11.3 数据安全

- 哈希验证数据完整性
- 链上记录不可篡改
- 备份和恢复机制

---

## 12. 未来路线图

### Phase 1: 基础设施 ✅
- 智能合约部署
- 特征生成引擎
- 基础 UI

### Phase 2: AI 对话 ✅
- PersonaVector 系统
- 记忆存储和检索
- 学习快照机制

### Phase 3: 高级功能 (进行中)
- 向量数据库升级
- 多模态交互
- 跨 Agent 社交

### Phase 4: 生态扩展
- 第三方集成
- Agent 市场
- 治理系统

---

## 附录

### A. 合约地址

| 合约 | 地址 | 版本 |
|------|------|------|
| HouseForgeAgent | 0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f | V3 |
| FusionCore | 0xa62E109Db724308FEB530A0b00431cf47BBC1f6E | V3 |

### B. API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| /chat/session | POST | 创建对话会话 |
| /chat/message | POST | 发送消息 |
| /agent/:id/memories | GET | 获取记忆 |
| /agent/:id/learning | GET | 获取学习历史 |

### C. 参考资料

- BAP-578 规范
- OpenAI API 文档
- ERC-721 标准

---

*版权所有 © 2024 KinForge Team*
