# ForgeAI 部署指南

本文档详细说明如何部署 ForgeAI 的各个组件。

## 目录

1. [环境准备](#环境准备)
2. [智能合约部署](#智能合约部署)
3. [后端部署 (Railway)](#后端部署-railway)
4. [前端部署 (Vercel)](#前端部署-vercel)
5. [环境变量配置](#环境变量配置)
6. [数据库初始化](#数据库初始化)
7. [生产环境检查清单](#生产环境检查清单)
8. [故障排除](#故障排除)

---

## 环境准备

### 必需工具

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+ | 运行时 |
| pnpm | 8+ | 包管理 |
| Foundry | 最新 | 合约开发 |
| Git | 最新 | 版本控制 |

### 安装 Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 安装 pnpm

```bash
npm install -g pnpm
```

### 克隆仓库

```bash
git clone https://github.com/ForgeAILab/kinforge.git
cd kinforge
pnpm install
```

---

## 智能合约部署

### 1. 配置环境变量

```bash
cd contracts
cp .env.example .env
```

编辑 `.env`:

```env
# 部署私钥 (确保有足够 BNB)
PRIVATE_KEY=0x...

# BSC RPC
RPC_URL=https://bsc-dataseed.binance.org

# Etherscan API Key (用于验证)
BSCSCAN_API_KEY=...

# 国库地址
TREASURY_ADDRESS=0x...
```

### 2. 编译合约

```bash
forge build
```

### 3. 运行测试

```bash
forge test -vvv
```

### 4. 部署到 BSC 主网

```bash
# 部署 ForgeAIAgent
forge script script/DeployAgent.s.sol:DeployAgent \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify

# 部署 FusionCore
forge script script/DeployFusion.s.sol:DeployFusion \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

### 5. 记录合约地址

部署完成后，记录以下地址:
- HouseForgeAgent: `0x...`
- FusionCore: `0x...`

### 6. 配置合约权限

```bash
# 设置 FusionCore 为铸造者
cast send $AGENT_ADDRESS "setMinter(address,bool)" $FUSION_ADDRESS true \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

---

## 后端部署 (Railway)

### 1. 准备代码

确保 `server/` 目录结构正确:

```
server/
├── src/
│   ├── services/
│   ├── api/
│   └── index.ts
├── data/
│   └── metadata/    # Genesis 元数据
├── package.json
└── tsconfig.json
```

### 2. 配置 Railway

1. 访问 https://railway.app
2. 创建新项目
3. 连接 GitHub 仓库
4. 选择 `server/` 目录

### 3. 配置持久化存储 (Volume)

> **重要**: 不配置 Volume 会导致每次部署丢失对话记忆、关系等级等数据。

1. 在项目主页按 `Ctrl+K` 打开 Command Palette
2. 输入 "Volume"，选择创建 Volume
3. 连接到 `@houseforge/server` 服务
4. **Mount Path**: `/app/data/db`
5. 确认创建

这样数据库文件 (`vault.db`) 存储在持久化卷中，而 metadata 和渲染图片从 Git 获取，互不影响：

| 数据 | 存储位置 | 持久化方式 |
|------|----------|-----------|
| vault.db（对话/记忆/关系） | Volume `/app/data/db` | 跨部署持久 |
| metadata JSON | Git → `/app/data/metadata` | 每次部署自动带入 |
| 渲染图片 | Git → `/app/data/render/output` | 每次部署自动带入 |

### 4. 配置环境变量

在 Railway Dashboard → Variables 中添加:

```env
# 必需
OPENAI_API_KEY=sk-proj-...
RPC_URL=https://bsc-dataseed.binance.org
CHAIN_ID=56
HOUSEFORGE_AGENT_ADDRESS=0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f
FUSION_CORE_ADDRESS=0xa62E109Db724308FEB530A0b00431cf47BBC1f6E
DATABASE_PATH=/app/data/db/vault.db
SERVER_PORT=3001

# 可选
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
LEARNING_AUTO_SYNC=false
LEARNING_SYNC_THRESHOLD=10
MEMORY_MAX_COUNT=1000
```

### 5. 配置构建命令

在 Railway Settings 中:

- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm start`
- **Root Directory**: `server`

### 6. 部署

```bash
# 推送到 GitHub 自动部署
git push origin main

# 或手动部署
cd server
railway up
```

### 7. 验证部署

```bash
curl https://your-app.railway.app/health
# 应返回: {"status":"ok","timestamp":"..."}
```

---

## 前端部署 (Vercel)

### 1. 准备代码

确保 `web/` 目录配置正确:

```
web/
├── app/
├── components/
├── config/
├── hooks/
├── vercel.json
└── package.json
```

### 2. 配置 vercel.json

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "regions": ["sin1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

### 3. 配置 Vercel

1. 访问 https://vercel.com
2. 导入 GitHub 仓库
3. 设置 Root Directory 为 `web`

### 4. 配置环境变量

在 Vercel Dashboard → Settings → Environment Variables:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_AGENT_CONTRACT=0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f
NEXT_PUBLIC_FUSION_CONTRACT=0xa62E109Db724308FEB530A0b00431cf47BBC1f6E
NEXT_PUBLIC_RPC_URL=https://bsc-dataseed.binance.org
```

### 5. 部署

```bash
# 自动部署 (推送到 GitHub)
git push origin main

# 手动部署
cd web
vercel --prod
```

### 6. 配置域名

1. 在 Vercel Dashboard → Settings → Domains
2. 添加自定义域名
3. 配置 DNS 记录

---

## 环境变量配置

### 完整环境变量参考

#### 后端 (.env)

```env
# ========== 网络配置 ==========
RPC_URL=https://bsc-dataseed1.binance.org
CHAIN_ID=56

# ========== 合约地址 (V3) ==========
HOUSEFORGE_AGENT_ADDRESS=0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f
FUSION_CORE_ADDRESS=0xa62E109Db724308FEB530A0b00431cf47BBC1f6E

# ========== 服务器配置 ==========
SERVER_PORT=3001
SERVER_HOST=0.0.0.0
DATABASE_PATH=/app/data/db/vault.db

# ========== AI 配置 ==========
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxx
OPENAI_MODEL=gpt-4o-mini
# 或使用 Anthropic
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-xxx
# ANTHROPIC_MODEL=claude-3-haiku-20240307

# ========== 学习系统 ==========
LEARNING_AUTO_SYNC=false
LEARNING_SYNC_THRESHOLD=10
MEMORY_MAX_COUNT=1000

# ========== 链上同步 (可选) ==========
SERVER_PRIVATE_KEY=0x...
```

#### 前端 (.env.production)

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_AGENT_CONTRACT=0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f
NEXT_PUBLIC_FUSION_CONTRACT=0xa62E109Db724308FEB530A0b00431cf47BBC1f6E
NEXT_PUBLIC_RPC_URL=https://bsc-dataseed.binance.org
NEXT_PUBLIC_ANALYTICS_ENABLED=true
```

---

## 数据库初始化

### 1. 生成 Genesis 元数据

```bash
cd server
pnpm gen:metadata
```

这会在 `data/metadata/` 生成 2100 个 JSON 文件。

### 2. 初始化数据库

数据库会在首次启动时自动创建，包含以下表:

- `vaults` - Vault 数据
- `chat_sessions` - 对话会话
- `chat_messages` - 对话消息
- `agent_memories` - Agent 记忆
- `learning_snapshots` - 学习快照

### 3. 数据迁移

如果需要从旧数据库迁移:

```bash
# 导出
pnpm export-vault --all --out backup.json

# 导入到新数据库
pnpm import-vault --file backup.json
```

---

## 生产环境检查清单

### 部署前检查

- [ ] 所有环境变量已配置
- [ ] 合约已部署并验证
- [ ] FusionCore 已获得铸造权限
- [ ] Genesis 元数据已生成
- [ ] 数据库已初始化

### 部署后检查

- [ ] 后端 `/health` 端点返回 200
- [ ] 前端可以正常加载
- [ ] 钱包连接正常
- [ ] 对话功能正常 (需要 OPENAI_API_KEY)
- [ ] 融合功能正常
- [ ] 图片加载正常

### 安全检查

- [ ] 私钥未提交到 Git
- [ ] API Key 仅在服务端使用
- [ ] CORS 已正确配置
- [ ] HTTPS 已启用
- [ ] 速率限制已配置

---

## 故障排除

### 常见问题

#### 1. "Failed to create session" 错误

**原因**: OPENAI_API_KEY 未配置或无效

**解决**:
1. 检查 Railway 环境变量
2. 确保 OPENAI_API_KEY 正确
3. 重新部署后端

#### 2. 404 错误 - /vault/token/:id

**原因**: Token 没有 Vault 数据

**解决**:
- 这对于直接链上铸造的 Token 是正常的
- 通过 `/genesis/reserve` API 创建 Vault

#### 3. 合约交互失败

**原因**:
- 钱包网络不是 BSC
- 余额不足
- 合约地址错误

**解决**:
1. 切换到 BSC Mainnet
2. 确保有足够 BNB
3. 检查合约地址配置

#### 4. Railway 构建失败

**原因**: TypeScript 编译错误

**解决**:
```bash
cd server
pnpm build
# 修复报告的错误
git push
```

#### 5. Vercel 部署失败

**原因**: 环境变量缺失或构建错误

**解决**:
1. 检查 Vercel 环境变量
2. 本地运行 `pnpm build` 测试
3. 查看 Vercel 构建日志

### 日志查看

#### Railway 日志

```bash
railway logs
```

或在 Railway Dashboard → Logs

#### Vercel 日志

在 Vercel Dashboard → Deployments → 选择部署 → Logs

### 紧急回滚

#### 后端回滚

在 Railway Dashboard:
1. 进入 Deployments
2. 选择之前的部署
3. 点击 "Redeploy"

#### 前端回滚

在 Vercel Dashboard:
1. 进入 Deployments
2. 选择之前的部署
3. 点击 "Promote to Production"

---

## 监控和维护

### 健康检查

设置定期健康检查:

```bash
# 使用 cron 或监控服务
curl -f https://your-backend.railway.app/health || alert
```

### 数据库备份

```bash
# 定期备份
cp data/vault.db backups/vault-$(date +%Y%m%d).db
```

### 日志监控

建议设置:
- Railway 日志告警
- Vercel Analytics
- 错误追踪 (如 Sentry)

---

*最后更新: 2026-02-06*
