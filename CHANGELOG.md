# Changelog

All notable changes to ForgeAI will be documented in this file.

## [0.6.0] - 2026-02-06

### Added

#### 数据持久化存储 (Persistent Data Storage)
- Railway Volume 持久化配置，服务更新不再丢失数据
- 数据库路径分离：`vault.db` 独立存储于持久化卷
- 支持 `DATABASE_PATH` 环境变量自定义数据库路径
- 对话记忆、心情状态、关系等级、学习快照跨部署持久保存

#### 铸造流程优化 (Minting Flow Optimization)
- 简化铸造为三步流程：选择家族 → 预览智能体 → 一键铸造
- 链上状态校验：自动跳过已铸造 Token，避免交易失败
- 交易回执实时解析：铸造成功即刻确认 Token ID 归属
- 新增 `/genesis/finalize` 端点，铸造后绑定实际 Token ID

#### 图片显示优化 (Image Display)
- 优先展示高清渲染图（WebP），fallback 到 SVG 占位符
- 新增 `/placeholder/house/:house.svg` 端点用于家族预览
- 支持稀有度光效的 SVG 占位符生成

### Changed
- `VaultService` 默认数据库路径从 `data/vault.db` 改为 `data/db/vault.db`
- Reserve API 增加链上铸造状态检查
- Mint 页面适配动态 Token ID 分配流程

### Infrastructure
- Railway 部署新增 Volume 挂载点 `/app/data/db`
- 静态文件（metadata、渲染图片）与动态数据（数据库）分离存储

---

## [0.5.0] - 2025-02-05

### Added

#### 对话历史回顾 (Chat History Review)
- 新增 `GET /chat/history/:tokenId` API 端点
- 支持日期范围过滤（startDate, endDate）
- 支持分页查询（limit, offset）
- 可选加载会话消息内容（includeMessages）
- 新增 `ChatHistory` 前端组件
- 展开/折叠查看历史对话详情
- 智能体详情页新增"历史"标签页

#### 智能体心情系统 (Agent Mood System)
- 智能体拥有独立心情状态，影响 AI 回复风格
- 8 种心情类型：joyful（愉悦）、content（满足）、neutral（平静）、melancholy（忧郁）、irritated（烦躁）、curious（好奇）、energetic（充沛）、tired（疲惫）
- 心情基于互动内容动态变化
- 新增 `GET /agent/:tokenId/mood` API 端点（公开）
- 新增 `MoodService` 服务
- 新增 `AgentMood` 前端组件
- 心情面板显示：当前心情、强度、稳定性、历史记录

#### 关系等级系统 (Relationship Level System)
- 用户与智能体之间的亲密度等级
- 7 个关系等级：初识 → 相识 → 朋友 → 挚友 → 知己 → 羁绊 → 灵魂伴侣
- 经验值累积机制：
  - 发送消息 +2 EXP
  - 完成会话 +10 EXP
  - 正面情绪 +5 EXP
  - 长对话奖励 +15 EXP
  - 连续互动 +8 EXP
- 不同等级解锁不同权益
- 新增 `GET /agent/:tokenId/relationship` API 端点
- 新增 `GET /agent/:tokenId/relationships` API 端点（排行榜）
- 新增 `RelationshipService` 服务
- 新增 `RelationshipPanel` 前端组件
- 智能体详情页新增"关系"标签页

#### 对话主题分析 (Conversation Topic Analysis)
- 自动分析对话主题偏好
- 13 种主题类别：greeting（问候）、daily_life（日常）、emotions（情感）、knowledge（知识）、creative（创意）、philosophy（哲学）、tech（科技）、entertainment（娱乐）、work（工作）、relationship（人际）、health（健康）、future（憧憬）、other（其他）
- 基于关键词模式匹配的主题识别
- 主题分布可视化
- 新增 `GET /agent/:tokenId/topics` API 端点（公开）
- 新增 `TopicService` 服务
- 新增 `TopicAnalysis` 前端组件
- 话题洞察摘要生成

### Changed
- `ChatService` 集成心情、关系、主题服务
- `sendMessage()` 在提示词中注入心情和关系上下文
- `endSession()` 更新心情、累积关系经验、提取话题
- Agent 详情页标签重组：基本信息、对话、历史、关系、成长、记忆

### Database Schema Changes
```sql
-- 智能体心情表
CREATE TABLE agent_mood (
  token_id INTEGER PRIMARY KEY,
  current_mood TEXT NOT NULL DEFAULT 'neutral',
  mood_intensity REAL NOT NULL DEFAULT 0.5,
  mood_stability REAL NOT NULL DEFAULT 0.5,
  last_interaction_at TEXT,
  positive_streak INTEGER NOT NULL DEFAULT 0,
  negative_streak INTEGER NOT NULL DEFAULT 0,
  total_interactions INTEGER NOT NULL DEFAULT 0,
  mood_history TEXT,
  updated_at TEXT NOT NULL
);

-- 用户-智能体关系表
CREATE TABLE agent_relationships (
  id TEXT PRIMARY KEY,
  token_id INTEGER NOT NULL,
  user_address TEXT NOT NULL,
  relationship_level INTEGER NOT NULL DEFAULT 1,
  experience_points INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  positive_interactions INTEGER NOT NULL DEFAULT 0,
  last_interaction_at TEXT,
  first_interaction_at TEXT NOT NULL,
  relationship_title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(token_id, user_address)
);

-- 对话主题表
CREATE TABLE conversation_topics (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  message_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
```

---

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
