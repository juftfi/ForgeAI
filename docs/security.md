# ForgeAI 安全文档

## 概述

本文档详细说明 ForgeAI NFT 合约和服务的安全架构、威胁模型及缓解策略。

## 智能合约安全

### 访问控制

| 函数 | 访问级别 | 保护机制 |
|------|---------|---------|
| `mintGenesisPublic` | 公开 | 支付验证、钱包限额、阶段检查 |
| `mintGenesisAllowlist` | 白名单 | Merkle 证明验证 |
| `mintOffspring` | 仅 FusionCore | `onlyFusionCore` 修饰符 |
| `updateLearning` | Token 持有者 | `onlyTokenOwner` 修饰符 |
| `executeAction` | Token 持有者 | `onlyTokenOwner` + 活跃状态 |
| `pause/unpause/terminate` | Token 持有者 | `onlyTokenOwner` 修饰符 |
| `setLogicAddress` | Token 持有者 | `onlyTokenOwner` 修饰符 |
| `setAllowlistRoot` | 合约所有者 | `onlyOwner` 修饰符 |
| `setPhases` | 合约所有者 | `onlyOwner` 修饰符 |
| `withdrawStuckTokens` | 合约所有者 | `onlyOwner` 修饰符 |

### 重入攻击防护

所有状态变更函数都遵循 检查-生效-交互 模式：

```solidity
function mintGenesisPublic(uint256 count, ...) external payable nonReentrant {
    // 1. 检查
    require(msg.value >= price * count, "Insufficient payment");
    require(_mintCounts[msg.sender] + count <= perWalletLimit, "Wallet limit");

    // 2. 生效
    _mintCounts[msg.sender] += count;

    // 3. 交互
    (bool sent, ) = treasury.call{value: msg.value}("");
    require(sent, "Treasury transfer failed");
    _mint(msg.sender, tokenId);
}
```

### 整数溢出防护

- Solidity 0.8.24 内置溢出检查
- 所有算术运算在溢出时回滚
- 敏感计算不使用 unchecked 代码块

### Gas 限制

- `executeAction` 限制为 500,000 gas 以防止 griefing 攻击
- 批量操作（如 `incrementMultiple`）限制为 100 次迭代

### Commit-Reveal 机制

融合系统使用 commit-reveal 防止抢跑交易：

```solidity
// Commit 阶段（区块 N）
commitHash = keccak256(parentA, parentB, salt, block.number, msg.sender, mode)

// Reveal 阶段（区块 N+1 到 N+256）
// - 必须等待至少 1 个区块
// - commitBlockHash 仅在 256 个区块内可用
// - 基于区块哈希的确定性种子防止操纵
```

**安全特性：**
1. **不可预测**：提交时区块哈希未知
2. **可验证**：任何人都可验证 reveal 与 commit 匹配
3. **时间限制**：256 区块窗口防止无限期延迟
4. **抗抢跑**：攻击者无法预测结果

### Merkle 白名单

白名单验证使用 OpenZeppelin 的 MerkleProof：

```solidity
bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
require(MerkleProof.verify(proof, allowlistRoot, leaf), "Invalid proof");
```

**安全特性：**
- 双重哈希防止第二原像攻击
- 使用经过审计的标准库实现
- 仅合约所有者可设置根哈希

## 费用安全

### 资金库转发

所有费用直接转发至资金库，不在合约中存储：

```solidity
// 在 HouseForgeAgent 中
(bool sent, ) = treasury.call{value: msg.value}("");
require(sent, "Treasury transfer failed");

// 在 FusionCore 中
uint256 excess = msg.value - totalFee;
if (excess > 0) {
    (bool refunded, ) = payable(msg.sender).call{value: excess}("");
    require(refunded, "Refund failed");
}
(bool sent, ) = treasury.call{value: totalFee}("");
require(sent, "Treasury transfer failed");
```

### 费用计算

融合费用基于链上可验证数据分层计算：

```solidity
function getFusionFee(uint256 parentA, uint256 parentB) public view returns (
    uint256 totalFee,
    uint256 baseAmount,
    uint256 rareAmount,
    uint256 mythicAmount
) {
    baseAmount = baseFee;

    // 稀有附加费（任一父代为 Rare 或以上）
    uint8 rarityA = agentContract.getRarityTier(parentA);
    uint8 rarityB = agentContract.getRarityTier(parentB);
    if (rarityA >= 3 || rarityB >= 3) {
        rareAmount = rareSurcharge;
    }

    // 神话尝试附加费（基于家族组合）
    uint8 houseA = agentContract.getHouseId(parentA);
    uint8 houseB = agentContract.getHouseId(parentB);
    if (mythicEligibleHouses[houseA][houseB]) {
        mythicAmount = mythicAttemptSurcharge;
    }

    totalFee = baseAmount + rareAmount + mythicAmount;
}
```

## Vault 服务安全

### 哈希完整性

Vault 数据完整性通过加密验证：

```typescript
// 确定性序列化
const stable = stableStringify(vaultJson);

// 哈希计算
const vaultHash = keccak256(toUtf8Bytes(stable));
const learningRoot = keccak256(concat([vaultHash, keccak256(summary)]));
```

**特性：**
- `stableStringify` 确保键排序一致
- 任何篡改都会改变哈希
- 链上哈希可验证链下数据

### 数据库安全

SQLite Vault 存储：
- 参数化查询防止 SQL 注入
- 数据库文件权限限制访问
- 部署文档中推荐定期备份

### API 安全

推荐的生产环境配置：
- 所有端点启用速率限制
- CORS 限制为已知来源
- 强制 HTTPS
- 请求大小限制
- 所有参数输入验证

## 威胁模型

### 威胁：融合抢跑

**攻击向量：** 攻击者观察待处理的融合交易，提交自己的交易以窃取有利结果。

**缓解措施：** Commit-reveal 机制。攻击者无法在提交时预测区块哈希，使结果不可预测。

### 威胁：Merkle 证明伪造

**攻击向量：** 攻击者生成假的 Merkle 证明以绕过白名单。

**缓解措施：** Merkle 树的加密安全性。伪造证明需要找到原像，这在计算上不可行。

### 威胁：Vault 数据篡改

**攻击向量：** 恶意行为者修改链下 Vault 数据。

**缓解措施：** 链上 vaultHash 允许任何人验证数据完整性。篡改可被检测。

### 威胁：重入攻击

**攻击向量：** 恶意合约在外部调用期间重入以操纵状态。

**缓解措施：** 检查-生效-交互模式。状态变更在外部调用前完成。

### 威胁：通过 executeAction 的 Gas Griefing

**攻击向量：** 攻击者配置消耗过多 gas 的逻辑合约。

**缓解措施：** 委托调用限制为 500,000 gas。攻击者自己的 gas 被消耗。

### 威胁：预言机操纵

**攻击向量：** 不适用 - ForgeAI 不使用外部预言机进行定价或随机数生成。

**缓解措施：** 区块哈希为特征生成提供足够的随机性。不使用价格预言机。

### 威胁：闪电贷攻击

**攻击向量：** 不适用 - 无抵押或借贷机制。

**缓解措施：** 无需。

## 审计建议

主网部署前：

1. **专业审计**：聘请知名审计公司（如 OpenZeppelin、Trail of Bits）
2. **漏洞赏金**：建立有竞争力的奖励计划
3. **形式化验证**：考虑对关键函数进行验证
4. **测试网阶段**：在 BSC 测试网进行充分测试
5. **渐进式推出**：从有限供应开始，验证后再扩展

## 应急程序

### 合约暂停

如发现严重漏洞：

1. 合约所有者可通过阶段配置暂停铸造
2. 可通过部署新实例断开 FusionCore
3. 个别 Agent 可由持有者暂停

### 升级路径

ForgeAI 使用不可升级合约以保证不可变性。如需升级：

1. 部署新合约版本
2. 快照现有状态
3. 启用迁移到新合约
4. 弃用旧合约

### 滞留资金恢复

仅用于真正滞留的代币（误发送）：

```solidity
function withdrawStuckTokens(address token, uint256 amount) external onlyOwner {
    // 不能提取原生 BNB 以防止资金库被盗
    require(token != address(0), "Use treasury for BNB");
    IERC20(token).transfer(treasury, amount);
}
```

## 安全检查清单

### 部署前

- [ ] 所有测试通过
- [ ] 无编译器警告
- [ ] 静态分析通过（Slither）
- [ ] Gas 优化审查
- [ ] 访问控制审计
- [ ] 重入审查
- [ ] 整数溢出审查

### 部署时

- [ ] 在 BSCScan 上验证合约源码
- [ ] 确认资金库地址
- [ ] 设置正确的阶段时间戳
- [ ] 验证 Merkle 根
- [ ] 用小额在主网测试铸造流程

### 部署后

- [ ] 监控合约事件
- [ ] 设置异常活动告警
- [ ] 记录管理员程序
- [ ] 建立事件响应计划
