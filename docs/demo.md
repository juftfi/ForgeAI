# ForgeAI 演示指南

本指南将引导您从头运行完整的 ForgeAI 演示。

## 前置要求

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Foundry（用于智能合约）

## 快速开始

### 1. 安装依赖

```bash
cd ForgeAI
pnpm install
```

### 2. 生成创世元数据

生成所有 2100 个创世 Token 的元数据文件：

```bash
pnpm gen:metadata
```

这会在 `assets/metadata/` 目录下创建 JSON 文件，特征基于主种子确定性生成。

### 3. 运行演示脚本

```bash
pnpm demo
```

演示内容包括：
- 创世特征生成
- 带哈希的 Vault 创建
- 融合种子计算
- 后代特征继承
- 神话条件触发

### 4. 启动开发服务器

```bash
pnpm dev
```

这会启动：
- 后端 API：http://localhost:3001
- 前端界面：http://localhost:3000

### 5. 探索界面

- **图鉴** (`/gallery`)：浏览所有生成的智能体
- **智能体详情** (`/agent/[id]`)：查看特征和血统
- **融合实验室** (`/fusion`)：模拟融合流程
- **血脉树** (`/tree`)：可视化祖先关系

## 智能合约

### 部署到本地网络

```bash
cd contracts

# 启动本地节点（在另一个终端）
anvil

# 部署合约
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

### 部署到 BSC 测试网

```bash
# 设置环境变量
export DEPLOYER_PRIVATE_KEY=your_key
export BSC_TESTNET_RPC_URL=https://bsc-testnet.public.blastapi.io

# 部署
forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC_URL --broadcast --verify
```

### 运行合约测试

```bash
forge test
```

## API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/stats` | 收藏统计 |
| GET | `/metadata/:id` | Token 元数据（OpenSea 格式）|
| POST | `/vault/create` | 创建新 Vault |
| GET | `/vault/:id` | 通过 ID 获取 Vault |
| GET | `/vault/token/:tokenId` | 通过 Token ID 获取 Vault |
| POST | `/fusion/prepare-commit` | 准备融合提交 |
| POST | `/fusion/prepare-reveal` | 生成后代特征 |

## 融合流程

### 1. Commit 阶段

```javascript
// 用户在链下计算 commit 哈希
const commitHash = keccak256(abi.encode(
  parentA,
  parentB,
  salt,        // 秘密值，保存用于 reveal
  blockNumber,
  userAddress,
  mode         // 0 = 销毁铸造, 1 = 封印
));

// 提交到合约
fusionCore.commitFusion(parentA, parentB, commitHash, mode);
```

### 2. Reveal 阶段（1+ 区块后）

```javascript
// 获取 commit 区块哈希
const blockHash = fusionCore.getCommitBlockHash(user, parentA, parentB);

// 从 API 请求后代特征
const response = await fetch('/fusion/prepare-reveal', {
  method: 'POST',
  body: JSON.stringify({
    parentAId, parentBId, salt, commitBlockHash: blockHash
  })
});

const { vault, offspringHouseId } = await response.json();

// 提交 reveal 到合约
fusionCore.revealFusion(
  parentA, parentB, salt,
  vault.vaultURI, vault.vaultHash, vault.learningRoot,
  offspringPersona, offspringExperience, offspringHouseId
);
```

## 特征生成规则

### 创世

- 特征基于 `config/traits.yaml` 的权重
- 家族偏好对偏好特征应用 2 倍乘数
- 稀有度乘数调整稀有/史诗特征权重

### 融合

- **家族**：相同父母 = 100% 继承；不同 = 70/30 分配
- **稀有度**：父母平均值 + 加成（跨家族 +1，高世代 +1）
- **核心特征**：50% 继承，50% 权重随机
- **其他特征**：20% 继承，80% 权重随机

### 神话

神话需要满足所有条件：
1. 特定的父母家族组合
2. 父母具有必需特征
3. 最低世代要求
4. 种子取模检查（概率性）

示例："风暴之眼"需要：
- 父母：THUNDER+THUNDER 或 THUNDER+MONSOON
- 父母具有 Plasma_Ion CoreMaterial
- 父母具有 LightningFork 或 IonBloom
- 后代为 Gen 2+
- seed % 200 === 0（1/200 概率）

## 验证

所有特征都是确定性的且可验证：

```javascript
// 重新计算融合种子
const seed = keccak256(abi.encode(
  parentA, parentB,
  parentALearningRoot, parentBLearningRoot,
  salt, commitBlockHash
));

// 重新生成特征
const traits = traitEngine.generateFusionTraits(parentA, parentB, seed);

// 验证哈希与链上匹配
assert(keccak256(stableStringify(traits)) === onChainTraitsHash);
```

## 项目结构

```
ForgeAI/
├── config/           # YAML 配置文件
├── contracts/        # Foundry 智能合约
│   ├── src/          # 合约源码
│   ├── test/         # 合约测试
│   └── script/       # 部署脚本
├── server/           # Node.js 后端
│   └── src/
│       ├── services/ # Vault、TraitEngine、Orchestrator
│       ├── utils/    # RNG、Hash、YAML 加载器
│       └── api/      # Express 路由
├── web/              # Next.js 前端
│   └── app/          # App Router 页面
├── assets/
│   └── metadata/     # 生成的 JSON 文件
└── docs/             # 文档
```

## 故障排除

### 元数据未加载

- 确保已运行 `pnpm gen:metadata`
- 检查 `assets/metadata/` 是否包含 JSON 文件

### Vault 错误

- 检查 SQLite 数据库是否存在于 `server/data/vault.db`
- 删除数据库以重置

### 合约部署失败

- 验证 Foundry 已安装：`forge --version`
- 检查 RPC 端点是否可访问
- 确保部署者有足够的 gas

## 许可证

MIT
