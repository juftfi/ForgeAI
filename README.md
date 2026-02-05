# KinForge

[![在线演示](https://img.shields.io/badge/在线-kinforge.xyz-blue)](https://www.kinforge.xyz/)
[![BSC 主网](https://img.shields.io/badge/BSC-主网-yellow)](https://bscscan.com/address/0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f)

基于 BNB Chain 的 BAP-578 兼容非同质化智能体 (NFA) 系统，包含 7 大天气家族、AI 驱动的个性化对话、记忆系统和 commit-reveal 融合机制。

## 在线部署

- **官网**: https://www.kinforge.xyz/
- **智能合约**: [0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f](https://bscscan.com/address/0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f) (V3)
- **融合合约**: [0xa62E109Db724308FEB530A0b00431cf47BBC1f6E](https://bscscan.com/address/0xa62E109Db724308FEB530A0b00431cf47BBC1f6E) (V3)

## 功能特性

### 核心功能
- **7 大天气家族**: CLEAR、MONSOON、THUNDER、FROST、AURORA、SAND、ECLIPSE
- **2,100 个创世智能体**: 确定性特征生成，带家族偏好系统
- **融合系统**: Commit-reveal 繁殖机制，支持亲本特征继承
- **BAP-578 合规**: 完整实现标准接口，支持学习更新
- **神话稀有度**: 特定家族组合触发神话级智能体
- **链上验证**: 通过 vaultHash 和 learningRoot 保证数据完整性

### AI 对话系统
- **个性化对话**: 每个智能体基于家族特征拥有独特性格
- **记忆系统**: 智能体记住对话内容，积累知识
- **学习成长**: 性格随互动逐渐演化
- **性格向量**: 5 维性格（冷静、好奇、大胆、社交、自律）
- **learningRoot 验证**: 链上可验证的学习历史

### AI 增强功能 (v0.4.0 新增)
- **情绪感知**: 检测用户情绪（8 种状态），调整回复风格
- **对话统计**: 会话数、消息数、情绪分布可视化
- **性格动态进化**: 性格随情绪互动逐渐变化，每个智能体独一无二

## 项目结构

```
KinForge/
├── config/                    # YAML 配置文件
│   ├── houses.yaml           # 7 大家族及性格种子
│   ├── traits.yaml           # 特征域及权重
│   ├── genesis.yaml          # S0 供应配置
│   ├── house_bias.yaml       # 家族特征偏好
│   ├── mythic.yaml           # 神话触发条件
│   └── economics.yaml        # 定价和费用
├── contracts/                 # Foundry 智能合约
│   ├── src/
│   │   ├── HouseForgeAgent.sol
│   │   ├── FusionCore.sol
│   │   ├── interfaces/IBAP578Core.sol
│   │   └── logic/DemoLogic.sol
│   ├── test/
│   └── foundry.toml
├── server/                    # Node.js + TypeScript 后端
│   ├── src/
│   │   ├── services/
│   │   │   ├── vault.ts      # 保险库存储
│   │   │   ├── traitEngine.ts # 特征生成
│   │   │   ├── ai.ts         # AI 客户端 (OpenAI/Anthropic)
│   │   │   ├── chat.ts       # 对话编排
│   │   │   ├── memory.ts     # 记忆管理
│   │   │   ├── learning.ts   # 学习系统
│   │   │   └── prompt.ts     # 提示词工程
│   │   ├── types/
│   │   │   └── chat.ts       # 类型定义
│   │   └── api/routes.ts
│   └── package.json
├── web/                       # Next.js 前端
│   ├── app/
│   │   ├── gallery/          # 智能体图鉴
│   │   ├── agent/[id]/       # 智能体详情 + 对话
│   │   ├── fusion/           # 融合界面
│   │   └── tree/             # 血脉树
│   ├── components/
│   │   ├── chat/             # 对话组件
│   │   ├── learning/         # 学习面板
│   │   └── memory/           # 记忆浏览器
│   └── package.json
├── docs/
│   ├── user-guide.md         # 用户指南
│   ├── whitepaper.md         # 技术白皮书
│   ├── api.md                # API 文档
│   ├── deployment.md         # 部署指南
│   ├── bap578-compliance.md  # BAP-578 合规说明
│   ├── security.md           # 安全文档
│   └── economics.md          # 经济模型
└── assets/metadata/           # 生成的元数据文件
```

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- Foundry（合约开发）

### 安装

```bash
# 克隆并安装
git clone https://github.com/KinForgeLab/kinforge.git
cd kinforge
pnpm install

# 复制环境变量
cp .env.example .env
# 编辑 .env 配置
```

### 环境变量配置

```env
# 服务器
SERVER_PORT=3001
DATABASE_PATH=./data/vault.db

# 区块链
RPC_URL=https://bsc-dataseed.binance.org/
CHAIN_ID=56
HOUSEFORGE_AGENT_ADDRESS=0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f
FUSION_CORE_ADDRESS=0xa62E109Db724308FEB530A0b00431cf47BBC1f6E

# AI 配置（对话必需）
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini

# 学习系统
LEARNING_AUTO_SYNC=false
LEARNING_SYNC_THRESHOLD=10
MEMORY_MAX_COUNT=1000

# 前端
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=56
```

### 运行开发服务器

```bash
# 启动后端 API
cd server
pnpm dev

# 在另一个终端启动前端
cd web
pnpm dev
```

- API: http://localhost:3001
- 前端: http://localhost:3000

## AI 对话系统

### 工作原理

1. **开始会话**: 连接钱包，与任意智能体开始对话
2. **对话交互**: AI 根据智能体的家族性格和记忆进行回复
3. **结束会话**: 系统从对话中提取记忆并保存
4. **学习成长**: 性格向量随互动逐渐演化

### 性格向量 (PersonaVector)

每个智能体有 5 维性格向量：

| 维度 | 描述 | 范围 |
|------|------|------|
| 冷静 | 情绪稳定程度 | -1.0 到 1.0 |
| 好奇 | 求知欲和开放性 | -1.0 到 1.0 |
| 大胆 | 冒险倾向 | -1.0 到 1.0 |
| 社交 | 人际交往倾向 | -1.0 到 1.0 |
| 自律 | 自我控制能力 | -1.0 到 1.0 |

### 家族基础性格

| 家族 | 基础性格 |
|------|---------|
| CLEAR | 冷静 +0.4, 好奇 +0.2 |
| MONSOON | 社交 +0.3, 好奇 +0.3 |
| THUNDER | 大胆 +0.5, 社交 +0.2 |
| FROST | 冷静 +0.5, 自律 +0.3 |
| AURORA | 好奇 +0.4, 大胆 +0.2 |
| SAND | 自律 +0.4, 冷静 +0.2 |
| ECLIPSE | 冷静 +0.3, 大胆 +0.3 |

### 记忆类型

| 类型 | 描述 |
|------|------|
| 事实 | 关于用户或世界的信息 |
| 偏好 | 用户的喜好和厌恶 |
| 经历 | 重要的互动事件 |
| 关系 | 与用户的关系描述 |

### learningRoot 计算

```
memoriesHash = merkleRoot(memories.map(m => keccak256(m)))
summaryHash = keccak256(AI生成的摘要)
learningRoot = keccak256(vaultHash + memoriesHash + summaryHash)
```

## 智能合约

### HouseForgeAgent.sol

带 BAP-578 扩展的 ERC-721：
- `mintGenesisPublic/Allowlist` - 铸造创世智能体
- `mintOffspring` - 铸造融合后代（仅 FusionCore 可调用）
- `updateLearning` - 更新学习状态（learningRoot, version）
- `executeAction` - 委托给逻辑合约执行
- `pause/unpause/terminate` - 状态管理

### FusionCore.sol

Commit-reveal 融合系统：
- `commitFusion` - 提交融合承诺哈希
- `revealFusion` - 揭示并铸造后代
- `getFusionFee` - 计算分级费用

## API 接口

### 对话接口

```
POST /chat/session              - 创建对话会话
POST /chat/message              - 发送消息获取 AI 回复
GET  /chat/session/:sessionId   - 获取会话详情
POST /chat/session/:id/end      - 结束会话并提取记忆
GET  /chat/stats/:tokenId       - 获取对话统计（情绪分布、消息数等）
```

### 记忆接口

```
GET  /agent/:tokenId/memories        - 获取智能体记忆
GET  /agent/:tokenId/memories/search - 搜索记忆
```

### 学习接口

```
GET  /agent/:tokenId/learning           - 获取学习历史
POST /agent/:tokenId/learning/snapshot  - 创建学习快照
POST /agent/:tokenId/learning/sync      - 同步到区块链
```

### 保险库和元数据

```
POST /vault/create              - 创建保险库
GET  /vault/:id                 - 获取保险库详情
GET  /vault/token/:tokenId      - 通过 Token ID 获取
GET  /metadata/:tokenId         - OpenSea 兼容元数据
```

### 融合

```
POST /fusion/prepare-commit     - 准备提交数据
POST /fusion/prepare-reveal     - 生成后代特征
```

## 融合机制

### 特征继承

1. **家族**: 同家族 = 100% 继承，不同家族 = 70/30 加权
2. **稀有度**: 双亲平均值 + 奖励（跨家族 +1，高世代 +1）
3. **核心特征** (4个): 50% 继承，50% 加权随机
4. **其他特征**: 20% 继承，80% 带家族偏好的加权随机

### 神话触发

| 神话 | 需要家族 | 概率 |
|------|---------|------|
| 风暴之眼 | THUNDER + MONSOON | 1/200 |
| 冻结时间 | FROST + CLEAR | 1/220 |
| 黑日 | ECLIPSE + AURORA | 1/333 |

## 稀有度分布

| 等级 | 概率 | 稀有度倍率 |
|------|------|-----------|
| 普通 | 62% | 1.0x |
| 罕见 | 23% | 1.5x |
| 稀有 | 10% | 2.0x |
| 史诗 | 4% | 3.0x |
| 传说 | 0.9% | 5.0x |
| 神话 | 0.1% | 特殊 |

## 部署

### 前端 (Vercel)

前端通过 GitHub 自动部署到 Vercel。

```bash
# 手动部署
cd web
vercel --prod
```

### 后端 (Railway)

```bash
# 连接 Railway
railway login
railway link

# 部署
railway up
```

Railway 必需环境变量：
- `OPENAI_API_KEY`
- `RPC_URL`
- `CHAIN_ID`
- `HOUSEFORGE_AGENT_ADDRESS`
- `DATABASE_PATH`

### 合约 (Foundry)

```bash
cd contracts
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## BAP-578 合规

| 功能 | 状态 |
|------|------|
| 状态管理 | ✅ Active/Paused/Terminated |
| 元数据存储 | ✅ 链上 + vaultURI |
| 保险库哈希 | ✅ keccak256 验证 |
| 学习根 | ✅ 版本化 + 时间戳 |
| 操作执行 | ✅ 委托 + Gas 上限 |
| 逻辑升级 | ✅ 每个智能体独立逻辑地址 |
| 资金管理 | ✅ 智能体余额追踪 |

## 安全性

- Commit-reveal 防止抢跑
- executeAction Gas 上限 (500k)
- Merkle 证明白名单验证
- 即时转发到国库
- 合约不存储资金
- AI 服务 API Key 加密

## 测试

```bash
# 合约测试
cd contracts && forge test -vvv

# 服务器测试
cd server && pnpm test
```

## 文档

- [更新日志](CHANGELOG.md) - 版本更新记录
- [用户指南](docs/user-guide.md) - 如何使用 KinForge
- [技术白皮书](docs/whitepaper.md) - 技术设计详情
- [API 参考](docs/api.md) - 完整 API 文档
- [部署指南](docs/deployment.md) - 部署说明
- [BAP-578 合规](docs/bap578-compliance.md) - 标准合规说明
- [安全文档](docs/security.md) - 安全说明
- [经济模型](docs/economics.md) - 经济设计
- [开发历程](docs/development-story.md) - 项目开发故事

## 链接

- 官网: https://www.kinforge.xyz/
- GitHub: https://github.com/KinForgeLab/kinforge
- BSCScan: [HouseForgeAgent](https://bscscan.com/address/0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f) | [FusionCore](https://bscscan.com/address/0xa62E109Db724308FEB530A0b00431cf47BBC1f6E)

## 许可证

MIT
