# Changelog

All notable changes to KinForge will be documented in this file.

## [0.4.0] - 2025-02-05

### Added

#### AI 情绪状态系统 (Emotion State System)
- 用户消息情绪检测（8 种情绪类型：happy, sad, angry, anxious, curious, grateful, confused, neutral）
- 基于关键词模式匹配的情绪识别算法
- 情绪感知的 AI 回复风格调整
- 前端情绪状态显示（置信度 > 0.4 时显示情绪徽章）
- 数据库 `chat_messages` 表新增 `emotion` 字段

#### 对话统计展示 (Chat Statistics Display)
- 新增 `GET /chat/stats/:tokenId` API 端点
- 统计数据包括：
  - 总会话数、总消息数、平均消息/会话
  - 情绪分布图表
  - 记忆类型分布
  - 首次/最近对话时间
- 新增 `ChatStats` 前端组件
- 智能体详情页 "对话" 标签页集成统计展示

#### 性格动态进化 (Personality Dynamic Evolution)
- 会话级性格影响计算（`persona_impact` 字段）
- 情绪-性格映射规则：
  - happy/grateful → social +0.02
  - curious → curious +0.03
  - sad/anxious → calm +0.02
  - angry → bold +0.02
  - confused → curious +0.02, calm -0.01
- 每次会话性格变化上限 ±0.05（防止剧烈波动）
- 学习快照累积之前版本的性格变化
- 前端性格向量可视化增强：
  - 双向条形图显示正负值
  - 百分比变化标签
  - 情绪图标装饰

### Changed
- `LearningService.computePersonaDelta()` 使用存储的 `persona_impact` 数据
- `ChatService.sendMessage()` 返回情绪状态
- `ChatService.endSession()` 计算并存储会话性格影响
- `LearningPanel` 组件重构，改进可视化效果

### Database Schema Changes
```sql
-- chat_messages 表新增
ALTER TABLE chat_messages ADD COLUMN emotion TEXT;

-- chat_sessions 表新增
ALTER TABLE chat_sessions ADD COLUMN persona_impact TEXT;
```

---

## [0.3.0] - 2025-02-04

### Added
- AI 对话系统基础功能
- 会话管理（创建/结束）
- 记忆系统（提取/存储/检索）
- 学习快照系统
- learningRoot 链上同步
- 前端对话界面 (`AgentChat`)
- 前端学习面板 (`LearningPanel`)
- 前端记忆浏览器 (`MemoryBrowser`)

### Changed
- Agent 详情页新增对话、学习、记忆标签页

---

## [0.2.0] - 2025-02-03

### Added
- Commit-Reveal 融合系统 (`FusionCore.sol`)
- 融合前端界面
- 血脉树可视化
- 神话稀有度触发机制

### Changed
- `HouseForgeAgent.sol` 添加 `mintOffspring` 函数
- 融合费用分级计算

---

## [0.1.0] - 2025-02-01

### Added
- 初始版本发布
- ERC-721 + BAP-578 兼容合约 (`HouseForgeAgent.sol`)
- 2100 创世智能体特征生成
- 7 大天气家族系统
- 家族特征偏好机制
- 稀有度分布系统
- Vault 存储服务
- 元数据 API
- Next.js 前端（Gallery、Agent 详情）
- BSC 主网部署

---

## Format

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
