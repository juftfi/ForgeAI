# KinForge 经济模型文档

## 概述

KinForge 实现了低门槛、高参与度的经济模型，专为 BSC 上的大规模采用而设计。所有价格以 BNB 计价。

## 配置

经济参数定义在 `config/economics.yaml` 中：

```yaml
version: 3
economics:
  # 所有者钱包（硬编码在合约中）
  owner_wallet: "0x1e87e1d1f317e8c647380ce1e1233e1edd265607"
  treasury_address: "0x1e87e1d1f317e8c647380ce1e1233e1edd265607"

  genesis:
    allowlist_price_bnb: 0.01
    public_price_bnb: 0.01
    per_wallet_limit: 4
    special_wallet: "0x1e87e1d1f317e8c647380ce1e1233e1edd265607"
    special_wallet_limit: 16  # 所有者钱包可铸造 16 个

  fusion_fees_bnb:
    # 基于后代世代的阶梯式基础费用（指数增长）
    base_by_generation:
      gen_1: 0.01    # 父母为 Gen 0
      gen_2: 0.04
      gen_3: 0.08
      gen_4_plus: 0.16
    rare_surcharge: 0.002
    mythic_attempt_surcharge: 0.003

  vault:
    free_snapshots_per_agent: 10
    pro_snapshots_per_agent: 200
    pro_pass_price_bnb: 0.02

  allowlist:
    enabled: true
    merkle_root: "0x0000..."
    max_per_wallet: 2

  phases:
    allowlist_start: 0
    public_start: 0
    mint_end: 0
```

## 创世铸造

### 定价结构

| 阶段 | 价格 (BNB) | 美元等值* | 钱包限额 |
|------|------------|----------|---------|
| 白名单 | 0.01 | ~$6 | 2 |
| 公开 | 0.01 | ~$6 | 4（普通）/ 16（特权钱包）|

*美元估算按 BNB = $600 计算

### 特权钱包

合约所有者可指定一个"特权钱包"，具有更高的铸造限额（默认：16 个代币）。用途包括：
- 项目团队预留
- 营销/赠送分配
- 战略合作

配置方法：`setSpecialWallet(address wallet, uint256 limit)`

### 供应分布

创世总供应：**2,100 个智能体**

| 家族 | 供应量 | 百分比 |
|------|--------|-------|
| CLEAR | 350 | 16.67% |
| MONSOON | 300 | 14.29% |
| THUNDER | 300 | 14.29% |
| FROST | 300 | 14.29% |
| AURORA | 300 | 14.29% |
| SAND | 300 | 14.29% |
| ECLIPSE | 250 | 11.90% |

### 稀有度分布

| 稀有度 | 百分比 | 预期数量 |
|--------|--------|---------|
| Common | 62% | 1,302 |
| Uncommon | 23% | 483 |
| Rare | 10% | 210 |
| Epic | 4% | 84 |
| Legendary | 0.9% | ~19 |
| Mythic | 0.1% | ~2 |

### 收入预测

假设全部售出：

| 场景 | 白名单 (420) | 公开 (1680) | 总收入 |
|------|-------------|-------------|--------|
| 最小（全白名单）| 420 × 0.01 = 4.2 | 0 | 4.2 BNB |
| 最大（全公开）| 0 | 2100 × 0.01 = 21 | 21 BNB |
| 实际（20/80）| 420 × 0.01 = 4.2 | 1680 × 0.01 = 16.8 | 21 BNB |

## 融合经济

### 费用结构

融合费用采用基于后代世代的**阶梯式模型**，并针对稀有度和神话资格收取附加费：

#### 基于后代世代的基础费用

| 后代世代 | 基础费用 (BNB) | 美元等值* | 理由 |
|----------|---------------|----------|------|
| Gen 1（父母为 Gen 0）| 0.01 | ~$6 | 入门级繁殖 |
| Gen 2 | 0.04 | ~$24 | 适度增长 |
| Gen 3 | 0.08 | ~$48 | 更高价值后代 |
| Gen 4+ | 0.16 | ~$96 | 深度血统溢价 |

*美元估算按 BNB = $600 计算

#### 附加费

| 组成部分 | 费用 (BNB) | 触发条件 |
|----------|-----------|---------|
| 稀有附加费 | +0.002 | 任一父代为 Rare 或更高 |
| 神话尝试费 | +0.003 | 家族组合符合神话条件 |

### 费用计算示例

**基础 Gen 1 融合（Gen 0 Common × Gen 0 Common → Gen 1）**
```
基础费用（Gen 1）：0.01 BNB
总计：0.01 BNB (~$6)
```

**带 Rare 父代的 Gen 2 融合（Gen 1 Rare × Gen 0 Common → Gen 2）**
```
基础费用（Gen 2）：0.04 BNB
稀有附加费：0.002 BNB
总计：0.042 BNB (~$25)
```

**Gen 3 神话尝试（Gen 2 Thunder × Gen 2 Monsoon，均为 Rare → Gen 3）**
```
基础费用（Gen 3）：0.08 BNB
稀有附加费：0.002 BNB
神话尝试费：0.003 BNB
总计：0.085 BNB (~$51)
```

**深度血统 Gen 5（Gen 4 × Gen 3 → Gen 5）**
```
基础费用（Gen 4+）：0.16 BNB
总计：0.16 BNB (~$96)
```

### 神话符合条件的组合

| 神话 | 家族 A | 家族 B | 基础概率 |
|------|--------|--------|---------|
| EYE_OF_STORM | THUNDER | MONSOON | 1/200 |
| FROZEN_TIME | FROST | CLEAR | 1/220 |
| BLACK_SUN | ECLIPSE | AURORA | 1/333 |

### 融合收入模型

假设每月 1000 次融合，按世代分布：

| 世代 | 百分比 | 数量 | 基础费用 | 平均总计* | 收入 |
|------|--------|------|----------|----------|------|
| Gen 1 | 40% | 400 | 0.01 | 0.012 | 4.8 BNB |
| Gen 2 | 30% | 300 | 0.04 | 0.044 | 13.2 BNB |
| Gen 3 | 20% | 200 | 0.08 | 0.085 | 17.0 BNB |
| Gen 4+ | 10% | 100 | 0.16 | 0.165 | 16.5 BNB |
| **月度总计** | | | | | **51.5 BNB** |

*平均总计包含根据后代稀有度概率估算的稀有/神话附加费

## Vault 服务（可选高级版）

### 免费版

每个智能体包含：
- 10 次学习快照
- 基础 Vault 存储
- 哈希验证

### Pro 通行证

面向需要丰富学习历史的高级用户：

| 功能 | 免费版 | Pro 版 |
|------|--------|--------|
| 快照次数 | 10 | 200 |
| 价格 | 0 BNB | 0.02 BNB |
| 有效期 | 永久 | 每智能体永久 |

## 资金库管理

### 资金流向

```
┌─────────────────┐
│    用户钱包     │
└────────┬────────┘
         │ 铸造/融合支付
         ▼
┌─────────────────┐
│   智能合约      │
│  （不存储资金）  │
└────────┬────────┘
         │ 即时转发
         ▼
┌─────────────────┐
│     资金库      │
│ （建议多签钱包） │
└─────────────────┘
```

### 资金库建议

1. **多签钱包**：使用 Gnosis Safe，2-of-3 或 3-of-5 签名者
2. **职责分离**：运营钱包 vs. 长期持有
3. **透明报告**：定期公布资金库余额
4. **储备分配**：
   - 40% 开发与运营
   - 30% 营销与增长
   - 20% 社区奖励
   - 10% 应急储备

## 价格稳定性考虑

### BNB 波动缓冲

- 价格设置保守偏低
- 即使 BNB 价格下跌 50%，收入目标仍可实现
- 不使用 USD 锚定机制以避免复杂性

### 市场对比

| 项目 | 铸造价格 | 链 |
|------|----------|-----|
| KinForge | 0.01 BNB (~$6) | BSC |
| 典型 PFP | 0.05-0.1 ETH ($100-200) | Ethereum |
| Ordinals | 可变 sats | Bitcoin |

KinForge 定位于**可及的游戏收藏品**细分市场，而非奢侈数字艺术。

## 经济可持续性

### 盈亏平衡分析

固定成本（估算月度）：
- 服务器托管：$50
- RPC 端点：$100
- 域名/SSL：$10
- **总计：~$160/月 ≈ 0.27 BNB**

盈亏平衡需要：
- 90 次基础融合/月，或
- 9 次公开铸造，或
- 14 个 Pro 通行证

### 增长激励

1. **推荐白名单**：活跃社区成员获得白名单名额
2. **融合奖励**：季节性活动降低费用
3. **稀有繁殖计划**：社区协调的神话尝试
4. **血统奖励**：长血统链获得认可

## 费用调整治理

### 初始阶段（第 1-3 月）

- 费用按规定固定
- 收集使用模式数据
- 收集社区反馈

### 调整标准

以下情况可提议费用变更：
- 融合量连续 3 个月低于 100/月
- BNB 价格持续变化超过 100%
- 社区投票要求变更

### 变更流程

1. 提议新费用结构
2. 7 天社区讨论
3. 快照投票（如实施代币治理）
4. 合约所有者执行变更
5. 激活前 48 小时通知

## 附录：费用计算代码

```solidity
// 所有者钱包（硬编码）
address public constant OWNER_WALLET = 0x1e87e1d1f317e8c647380ce1e1233e1edd265607;

// 基础费用数组：[Gen1, Gen2, Gen3, Gen4+]
uint256[4] public baseFeeByTier; // [0.01, 0.04, 0.08, 0.16 ether]

function getFusionFee(uint256 parentA, uint256 parentB) public view returns (
    uint256 totalFee,
    uint256 baseAmount,
    uint256 rareAmount,
    uint256 mythicAmount
) {
    // 计算后代世代以确定费用层级
    uint256 genA = agentContract.getGeneration(parentA);
    uint256 genB = agentContract.getGeneration(parentB);
    uint256 offspringGen = (genA > genB ? genA : genB) + 1;

    // 将世代映射到层级 (0-3)：Gen1→0, Gen2→1, Gen3→2, Gen4+→3
    uint256 tier = offspringGen >= 4 ? 3 : offspringGen - 1;
    baseAmount = baseFeeByTier[tier];

    // 稀有附加费：任一父代为 Rare（层级 2）或更高
    uint8 rarityA = agentContract.getRarityTier(parentA);
    uint8 rarityB = agentContract.getRarityTier(parentB);
    if (rarityA >= 2 || rarityB >= 2) {
        rareAmount = rareSurcharge; // 0.002 BNB
    }

    // 神话尝试附加费：基于家族组合 + 世代
    if (_isMythicAttemptEligible(parentA, parentB)) {
        mythicAmount = mythicAttemptSurcharge; // 0.003 BNB
    }

    totalFee = baseAmount + rareAmount + mythicAmount;
}
```

### 费用管理的管理员函数

```solidity
// 一次性设置所有费用
function setFees(
    uint256[4] calldata _baseFeeByTier,  // [Gen1, Gen2, Gen3, Gen4+]
    uint256 _rareSurcharge,
    uint256 _mythicAttemptSurcharge
) external onlyAdmin;

// 设置单个层级费用
function setBaseFeeForTier(uint8 tier, uint256 fee) external onlyAdmin;

// 设置资金库地址
function setTreasury(address _treasury) external onlyAdmin;
```

## 总结

KinForge 的经济模型优先考虑：
- **可及性**：低入门价格（0.01 BNB）
- **可持续性**：循环融合费用为持续开发提供资金
- **透明性**：所有费用链上计算，即时转发
- **公平性**：基于获得价值的阶梯费用（稀有父代、神话机会）
