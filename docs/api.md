# ForgeAI API 文档

## 基础信息

- **Base URL**: `https://api.kinforge.xyz` (或您自己的后端地址)
- **格式**: JSON
- **认证**: 无 (公开 API)

---

## 目录

1. [健康检查](#健康检查)
2. [Vault 接口](#vault-接口)
3. [元数据接口](#元数据接口)
4. [对话接口](#对话接口)
5. [记忆接口](#记忆接口)
6. [学习接口](#学习接口)
7. [心情接口](#心情接口) *(v0.5.0)*
8. [关系接口](#关系接口) *(v0.5.0)*
9. [主题接口](#主题接口) *(v0.5.0)*
10. [融合接口](#融合接口)
11. [Genesis 接口](#genesis-接口)
12. [血脉接口](#血脉接口)
13. [图片接口](#图片接口)

---

## 健康检查

### GET /health

检查服务状态

**响应**

```json
{
  "status": "ok",
  "timestamp": "2024-02-04T15:30:00.000Z"
}
```

---

## Vault 接口

### POST /vault/create

创建新的 Vault 记录

**请求体**

```json
{
  "tokenId": 1,
  "parentAId": 0,
  "parentBId": 0,
  "parentALearningRoot": "0x0000...",
  "parentBLearningRoot": "0x0000...",
  "fusionVersion": "1.0.0",
  "seed": "0xabc123...",
  "traits": {
    "House": "MONSOON",
    "RarityTier": "Rare",
    "WeatherID": "S0-MONSOON-0001",
    "Expression": "Serene",
    "Posture": "Balanced"
  },
  "personaDelta": {
    "calm": 0.2,
    "curious": 0.3
  },
  "summary": "Genesis agent from House MONSOON"
}
```

**响应**

```json
{
  "vaultId": "uuid-xxxx",
  "vaultURI": "https://api.kinforge.io/vault/uuid-xxxx",
  "vaultHash": "0x1234...",
  "learningRoot": "0x5678..."
}
```

### GET /vault/:id

获取 Vault 详情

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| id | string | Vault UUID |

**响应**

```json
{
  "id": "uuid-xxxx",
  "tokenId": 1,
  "parentAId": null,
  "parentBId": null,
  "traits": { ... },
  "personaDelta": { ... },
  "summary": "...",
  "seed": "0x...",
  "createdAt": "2024-02-04T10:00:00.000Z"
}
```

### GET /vault/token/:tokenId

通过 Token ID 获取 Vault

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |

**响应**: 同 GET /vault/:id

---

## 元数据接口

### GET /metadata/:tokenId

获取 OpenSea 兼容的元数据

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |

**响应**

```json
{
  "name": "ForgeAI Agent #1 — MONSOON — Monsoon 家族",
  "description": "在 ForgeAI 诞生的可交易非同质化智能体。",
  "image": "/images/1.webp",
  "attributes": [
    { "trait_type": "House", "value": "MONSOON" },
    { "trait_type": "RarityTier", "value": "Rare" },
    { "trait_type": "WeatherID", "value": "S0-MONSOON-0001" },
    { "trait_type": "Expression", "value": "Serene" }
  ]
}
```

### GET /metadata/collection

获取集合元数据

**响应**

```json
{
  "name": "ForgeAI Genesis",
  "description": "ForgeAI 非同质化智能体创世系列。",
  "image": "/placeholder/collection.svg",
  "external_link": "https://kinforge.io"
}
```

---

## 对话接口

### POST /chat/session

创建新的对话会话

**请求体**

```json
{
  "tokenId": 7,
  "userAddress": "0x1234567890abcdef..."
}
```

**响应**

```json
{
  "id": "session-uuid",
  "tokenId": 7,
  "userAddress": "0x1234...",
  "startedAt": "2024-02-04T15:30:00.000Z",
  "messageCount": 0
}
```

### POST /chat/message

发送消息并获取 AI 回复

**请求体**

```json
{
  "sessionId": "session-uuid",
  "content": "你好！你是谁？"
}
```

**响应**

```json
{
  "message": {
    "id": "msg-uuid",
    "sessionId": "session-uuid",
    "role": "agent",
    "content": "你好！我是来自 Monsoon 家族的 ForgeAI Agent...",
    "createdAt": "2024-02-04T15:31:00.000Z",
    "tokenCount": 45
  },
  "sessionId": "session-uuid"
}
```

### GET /chat/session/:sessionId

获取会话详情和历史

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| sessionId | string | 会话 ID |
| limit | number | 消息数量限制 (默认 50) |

**响应**

```json
{
  "id": "session-uuid",
  "tokenId": 7,
  "userAddress": "0x1234...",
  "startedAt": "2024-02-04T15:30:00.000Z",
  "messageCount": 4,
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "你好！",
      "createdAt": "..."
    },
    {
      "id": "msg-2",
      "role": "agent",
      "content": "你好！...",
      "createdAt": "..."
    }
  ]
}
```

### GET /chat/sessions/:tokenId

获取 Token 的所有会话

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |
| limit | number | 限制数量 (默认 20) |

**响应**

```json
{
  "tokenId": 7,
  "sessions": [
    {
      "id": "session-1",
      "startedAt": "...",
      "endedAt": "...",
      "messageCount": 10
    }
  ]
}
```

### POST /chat/session/:sessionId/end

结束会话并提取记忆

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| sessionId | string | 会话 ID |

**响应**

```json
{
  "sessionId": "session-uuid",
  "summary": "讨论了: 自我介绍, 编程学习 等话题 (6 条消息)",
  "memoriesExtracted": 2,
  "personaImpact": {
    "curious": 0.02
  }
}
```

### GET /chat/stats/:tokenId

获取对话统计数据

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |

**响应**

```json
{
  "tokenId": 7,
  "totalSessions": 5,
  "totalMessages": 42,
  "avgMessagesPerSession": 8.4,
  "firstChatAt": "2025-02-01T10:00:00.000Z",
  "lastChatAt": "2025-02-05T15:30:00.000Z",
  "emotionDistribution": {
    "happy": 12,
    "curious": 8,
    "neutral": 15,
    "sad": 2,
    "grateful": 3,
    "angry": 0,
    "anxious": 1,
    "confused": 1
  },
  "dominantEmotion": "neutral",
  "totalMemories": 8,
  "memoryCount": {
    "fact": 3,
    "preference": 2,
    "experience": 2,
    "relationship": 1
  }
}
```

### GET /chat/history/:tokenId

> v0.5.0 新增

获取对话历史（支持日期过滤和分页）

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |
| userAddress | string | 用户钱包地址 (必需) |
| startDate | string | 开始日期 (ISO 格式，可选) |
| endDate | string | 结束日期 (ISO 格式，可选) |
| limit | number | 限制数量 (默认 20) |
| offset | number | 偏移量 (默认 0) |
| includeMessages | boolean | 是否包含消息内容 (默认 false) |

**响应**

```json
{
  "tokenId": 7,
  "sessions": [
    {
      "id": "session-uuid",
      "tokenId": 7,
      "userAddress": "0x1234...",
      "startedAt": "2025-02-05T10:00:00.000Z",
      "endedAt": "2025-02-05T10:30:00.000Z",
      "messageCount": 12,
      "summary": "讨论了科技和区块链话题",
      "messages": [
        {
          "id": "msg-1",
          "role": "user",
          "content": "你好！",
          "createdAt": "2025-02-05T10:00:00.000Z",
          "emotion": { "primary": "happy", "intensity": 0.7, "confidence": 0.8 }
        }
      ]
    }
  ],
  "total": 15,
  "hasMore": true
}
```

---

## 记忆接口

### GET /agent/:tokenId/memories

获取 Agent 的记忆列表

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |
| limit | number | 限制数量 (默认 50) |
| type | string | 记忆类型筛选 (fact/preference/experience/relationship) |

**响应**

```json
{
  "tokenId": 7,
  "count": 3,
  "totalCount": 3,
  "memories": [
    {
      "id": "mem-uuid",
      "tokenId": 7,
      "memoryType": "fact",
      "content": "用户是一名来自中国的大学生",
      "importance": 0.7,
      "createdAt": "2024-02-04T15:35:00.000Z",
      "lastAccessed": null,
      "accessCount": 0
    }
  ]
}
```

### GET /agent/:tokenId/memories/search

搜索 Agent 记忆

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |
| q | string | 搜索关键词 |
| limit | number | 限制数量 (默认 10) |

**响应**

```json
{
  "tokenId": 7,
  "query": "大学",
  "count": 1,
  "memories": [
    {
      "id": "mem-uuid",
      "content": "用户是一名来自中国的大学生",
      "importance": 0.7,
      "relevance": 0.85
    }
  ]
}
```

---

## 学习接口

### GET /agent/:tokenId/learning

获取学习历史

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |

**响应**

```json
{
  "tokenId": 7,
  "learningVersions": 2,
  "totalMemories": 3,
  "snapshotCount": 2,
  "currentPersona": {
    "calm": 0.1,
    "curious": 0.35,
    "bold": 0.1,
    "social": 0.3,
    "disciplined": 0.0
  },
  "snapshots": [
    {
      "id": "snap-uuid",
      "version": 2,
      "personaDelta": { "curious": 0.02 },
      "memoriesHash": "0xabc...",
      "summary": "暂无明显学习成果",
      "learningRoot": "0xe7ee19194ab713a1...",
      "createdAt": "2024-02-04T15:40:00.000Z",
      "syncedToChain": false
    }
  ]
}
```

### GET /agent/:tokenId/learning/:version

获取特定版本的学习快照

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |
| version | number | 版本号 |

**响应**

```json
{
  "id": "snap-uuid",
  "tokenId": 7,
  "version": 2,
  "personaDelta": { "curious": 0.02 },
  "memoriesHash": "0xabc...",
  "summary": "暂无明显学习成果",
  "learningRoot": "0xe7ee...",
  "createdAt": "2024-02-04T15:40:00.000Z",
  "syncedToChain": false
}
```

### POST /agent/:tokenId/learning/snapshot

创建新的学习快照

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |

**响应**

```json
{
  "id": "snap-uuid",
  "version": 3,
  "learningRoot": "0xnew...",
  "memoriesHash": "0xabc...",
  "summary": "...",
  "createdAt": "..."
}
```

### POST /agent/:tokenId/learning/sync

同步 learningRoot 到链上

**请求体**

```json
{
  "version": 2,
  "privateKey": "0x..."
}
```

**响应**

```json
{
  "tokenId": 7,
  "version": 2,
  "txHash": "0xtx...",
  "synced": true
}
```

### GET /agent/:tokenId/profile

获取 Agent 资料

**响应**

```json
{
  "tokenId": 7,
  "houseId": 2,
  "houseName": "MONSOON",
  "generation": 0,
  "traits": {
    "House": "MONSOON",
    "RarityTier": "Rare"
  },
  "personaVector": {
    "calm": 0.1,
    "curious": 0.35,
    "bold": 0.1,
    "social": 0.3,
    "disciplined": 0.0
  }
}
```

---

## 心情接口

> v0.5.0 新增

### GET /agent/:tokenId/mood

获取智能体当前心情状态（公开接口）

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |

**响应**

```json
{
  "tokenId": 7,
  "currentMood": "content",
  "moodLabel": "满足",
  "moodEmoji": "😊",
  "moodColor": "#34d399",
  "moodIntensity": 0.6,
  "moodStability": 0.7,
  "positiveStreak": 3,
  "negativeStreak": 0,
  "totalInteractions": 15,
  "lastInteractionAt": "2025-02-05T10:30:00.000Z",
  "recentMoodHistory": [
    { "mood": "content", "timestamp": "2025-02-05T10:30:00.000Z" },
    { "mood": "joyful", "timestamp": "2025-02-05T09:15:00.000Z" }
  ]
}
```

**心情类型**

| 类型 | 标签 | 表情 | 回复风格 |
|------|------|------|---------|
| joyful | 愉悦 | 😄 | 充满活力和热情 |
| content | 满足 | 😊 | 温和友好 |
| neutral | 平静 | 😐 | 正常回复 |
| melancholy | 忧郁 | 😔 | 稍微沉静 |
| irritated | 烦躁 | 😤 | 略带急躁 |
| curious | 好奇 | 🤔 | 多问问题 |
| energetic | 充沛 | ⚡ | 节奏快、有活力 |
| tired | 疲惫 | 😴 | 回复简短 |

---

## 关系接口

> v0.5.0 新增

### GET /agent/:tokenId/relationship

获取用户与智能体的关系等级

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |
| userAddress | string | 用户钱包地址 (查询参数) |

**响应**

```json
{
  "tokenId": 7,
  "userAddress": "0x1234...",
  "level": 3,
  "levelTitle": "朋友",
  "levelTitleEn": "Friend",
  "levelColor": "#34d399",
  "benefits": ["优先回复", "专属问候"],
  "experiencePoints": 450,
  "expProgress": {
    "current": 150,
    "required": 300,
    "percentage": 50
  },
  "stats": {
    "totalSessions": 12,
    "totalMessages": 87,
    "positiveInteractions": 23
  },
  "firstInteractionAt": "2025-01-15T08:00:00.000Z",
  "lastInteractionAt": "2025-02-05T10:30:00.000Z",
  "allLevels": [
    { "level": 1, "title": "初识", "titleEn": "Stranger", "minExp": 0, "color": "#9ca3af" },
    { "level": 2, "title": "相识", "titleEn": "Acquaintance", "minExp": 100, "color": "#60a5fa" },
    { "level": 3, "title": "朋友", "titleEn": "Friend", "minExp": 300, "color": "#34d399" },
    { "level": 4, "title": "挚友", "titleEn": "Close Friend", "minExp": 600, "color": "#a78bfa" },
    { "level": 5, "title": "知己", "titleEn": "Confidant", "minExp": 1000, "color": "#f472b6" },
    { "level": 6, "title": "羁绊", "titleEn": "Bonded", "minExp": 1800, "color": "#fbbf24" },
    { "level": 7, "title": "灵魂伴侣", "titleEn": "Soulmate", "minExp": 3000, "color": "#ef4444" }
  ]
}
```

### GET /agent/:tokenId/relationships

获取智能体的所有关系（排行榜）

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |
| limit | number | 限制数量 (默认 10) |

**响应**

```json
{
  "tokenId": 7,
  "relationships": [
    {
      "userAddress": "0x1234...",
      "level": 5,
      "levelTitle": "知己",
      "levelColor": "#f472b6",
      "experiencePoints": 1250,
      "totalSessions": 45,
      "lastInteractionAt": "2025-02-05T10:30:00.000Z"
    },
    {
      "userAddress": "0x5678...",
      "level": 3,
      "levelTitle": "朋友",
      "levelColor": "#34d399",
      "experiencePoints": 420,
      "totalSessions": 18,
      "lastInteractionAt": "2025-02-04T16:20:00.000Z"
    }
  ],
  "total": 2
}
```

**经验获取方式**

| 操作 | 经验值 |
|------|--------|
| 发送消息 | +2 |
| 完成会话 | +10 |
| 正面情绪互动 | +5 |
| 长对话 (>10条消息) | +15 |
| 连续互动 | +8 |

---

## 主题接口

> v0.5.0 新增

### GET /agent/:tokenId/topics

获取对话主题统计（公开接口）

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |

**响应**

```json
{
  "tokenId": 7,
  "totalTopics": 42,
  "topTopics": [
    {
      "topic": "tech",
      "count": 15,
      "percentage": 36,
      "label": "科技技术",
      "emoji": "💻",
      "color": "#06b6d4"
    },
    {
      "topic": "emotions",
      "count": 10,
      "percentage": 24,
      "label": "情感倾诉",
      "emoji": "💭",
      "color": "#f472b6"
    }
  ],
  "distribution": [
    { "topic": "tech", "count": 15, "label": "科技技术", "emoji": "💻", "color": "#06b6d4" },
    { "topic": "emotions", "count": 10, "label": "情感倾诉", "emoji": "💭", "color": "#f472b6" },
    { "topic": "daily_life", "count": 8, "label": "日常生活", "emoji": "🏠", "color": "#34d399" },
    { "topic": "knowledge", "count": 5, "label": "知识问答", "emoji": "📚", "color": "#a78bfa" }
  ],
  "recentTopics": [
    {
      "id": "topic-uuid",
      "sessionId": "session-uuid",
      "topic": "tech",
      "confidence": 0.85,
      "messageCount": 12,
      "createdAt": "2025-02-05T10:30:00.000Z",
      "label": "科技技术",
      "emoji": "💻"
    }
  ]
}
```

**主题类别**

| 类别 | 标签 | 表情 | 关键词示例 |
|------|------|------|-----------|
| greeting | 日常问候 | 👋 | 你好、早安、在吗 |
| daily_life | 日常生活 | 🏠 | 吃饭、天气、周末 |
| emotions | 情感倾诉 | 💭 | 开心、难过、压力 |
| knowledge | 知识问答 | 📚 | 为什么、怎么、什么是 |
| creative | 创意想象 | 🎨 | 想象、故事、设计 |
| philosophy | 哲学思考 | 🤔 | 人生、意义、存在 |
| tech | 科技技术 | 💻 | 编程、AI、区块链 |
| entertainment | 娱乐休闲 | 🎮 | 电影、游戏、音乐 |
| work | 工作事业 | 💼 | 上班、项目、面试 |
| relationship | 人际关系 | 👥 | 朋友、家人、恋爱 |
| health | 健康生活 | 🏃 | 锻炼、睡眠、减肥 |
| future | 未来憧憬 | 🌟 | 计划、目标、梦想 |
| other | 其他话题 | 💬 | (默认) |

---

## 融合接口

### POST /fusion/prepare-commit

准备融合提交数据

**请求体**

```json
{
  "parentAId": 1,
  "parentBId": 2,
  "salt": "0xrandomsalt...",
  "mode": 0,
  "userAddress": "0x1234..."
}
```

**响应**

```json
{
  "commitHash": "0xhash...",
  "parentA": 1,
  "parentB": 2,
  "mode": 0,
  "estimatedBlock": 12345678
}
```

### POST /fusion/prepare-reveal

准备融合揭示数据

**请求体**

```json
{
  "parentAId": 1,
  "parentBId": 2,
  "salt": "0xrandomsalt...",
  "commitBlockHash": "0xblock..."
}
```

**响应**

```json
{
  "offspring": {
    "name": "ForgeAI Agent #3 — MONSOON",
    "attributes": [ ... ]
  },
  "vault": {
    "vaultId": "uuid",
    "vaultURI": "...",
    "vaultHash": "0x...",
    "learningRoot": "0x..."
  },
  "offspringHouseId": 2,
  "offspringPersona": "{...}",
  "offspringExperience": "Offspring of #1 and #2",
  "offspringRarityTier": 1,
  "traitsHash": "0x...",
  "isMythic": false,
  "mythicKey": null
}
```

---

## Genesis 接口

### GET /genesis/preview/:house

预览指定 House 的 Genesis Agent

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| house | string | House 名称 (CLEAR/MONSOON/...) |

**响应**

```json
{
  "tokenId": 42,
  "metadata": {
    "name": "ForgeAI Agent #42 — MONSOON",
    "image": "/images/42.webp",
    "attributes": [ ... ]
  },
  "hasRender": true,
  "imageUrl": "/images/42.webp",
  "previewOnly": true
}
```

### GET /genesis/available/:house

获取可用的 Genesis Agent 列表

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| house | string | House 名称 |
| limit | number | 限制数量 (默认 20) |

**响应**

```json
{
  "house": "MONSOON",
  "available": [
    { "tokenId": 1, "rarity": "Rare", "weatherId": "S0-MONSOON-0001" },
    { "tokenId": 2, "rarity": "Common", "weatherId": "S0-MONSOON-0002" }
  ],
  "total": 300
}
```

### POST /genesis/reserve

预留 Genesis Agent 用于铸造

**请求体**

```json
{
  "tokenId": 42
}
```

**响应**

```json
{
  "tokenId": 42,
  "metadata": { ... },
  "vault": {
    "vaultId": "uuid",
    "vaultURI": "...",
    "vaultHash": "0x...",
    "learningRoot": "0x..."
  },
  "mintParams": {
    "houseId": 2,
    "persona": "{...}",
    "experience": "Genesis S0",
    "vaultURI": "...",
    "vaultHash": "0x...",
    "learningRoot": "0x...",
    "traitsHash": "0x...",
    "rarityTier": 2
  }
}
```

---

## 血脉接口

### GET /lineage/:tokenId

获取 Token 的血脉信息

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |

**响应**

```json
{
  "tokenId": 7,
  "parent1": 0,
  "parent2": 0,
  "generation": 0,
  "houseId": 2,
  "houseName": "MONSOON",
  "sealed": false,
  "isSealed": false
}
```

---

## 图片接口

### GET /images/:filename

获取渲染图片

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| filename | string | 文件名 (如 1.webp, 1.png) |

**响应**: 图片文件

### GET /placeholder/:tokenId.svg

获取占位符 SVG

**参数**

| 参数 | 类型 | 描述 |
|------|------|------|
| tokenId | number | Token ID |

**响应**: SVG 图片

---

## 统计接口

### GET /stats

获取集合统计

**响应**

```json
{
  "totalSupply": 2100,
  "generatedMetadata": 2100,
  "houses": [
    { "key": "CLEAR", "count": 300 },
    { "key": "MONSOON", "count": 300 }
  ],
  "rarityDistribution": {
    "Common": 0.62,
    "Uncommon": 0.23,
    "Rare": 0.10,
    "Epic": 0.04,
    "Legendary": 0.009,
    "Mythic": 0.001
  }
}
```

---

## 错误响应

所有错误响应格式:

```json
{
  "error": "错误描述",
  "details": "详细信息 (可选)"
}
```

### HTTP 状态码

| 状态码 | 描述 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

*最后更新: 2025-02-05*
