/**
 * AI Dialogue + Learning System Type Definitions
 */

// ============ PersonaVector ============
export interface PersonaVector {
  calm: number;       // 冷静度 -1.0 ~ 1.0
  curious: number;    // 好奇心 -1.0 ~ 1.0
  bold: number;       // 大胆度 -1.0 ~ 1.0
  social: number;     // 社交性 -1.0 ~ 1.0
  disciplined: number; // 自律性 -1.0 ~ 1.0
}

// Default persona vector (neutral)
export const DEFAULT_PERSONA: PersonaVector = {
  calm: 0,
  curious: 0,
  bold: 0,
  social: 0,
  disciplined: 0,
};

// ============ Emotion Types ============
export type EmotionType =
  | 'happy'      // 开心
  | 'sad'        // 难过
  | 'angry'      // 愤怒
  | 'anxious'    // 焦虑
  | 'curious'    // 好奇
  | 'grateful'   // 感激
  | 'confused'   // 困惑
  | 'neutral';   // 中性

export interface EmotionState {
  primary: EmotionType;
  intensity: number;  // 0-1 情绪强度
  confidence: number; // 0-1 检测置信度
}

// 情绪响应指南
export const EMOTION_RESPONSE_GUIDES: Record<EmotionType, string> = {
  happy: '用户心情愉悦，可以用轻松活泼的语气回应，适当加入幽默元素',
  sad: '用户可能感到难过，回应时要温柔体贴，表达理解和关心，给予鼓励',
  angry: '用户可能有些生气，先表示理解，保持冷静和耐心，不要火上浇油',
  anxious: '用户可能感到焦虑，回应要稳定、安抚，提供清晰的信息来减轻不确定感',
  curious: '用户充满好奇心，可以详细解答，甚至主动拓展相关话题',
  grateful: '用户表达了感谢，真诚回应，可以表示这是应该的，继续保持友好',
  confused: '用户可能感到困惑，需要更清晰、简洁的解释，可以举例说明',
  neutral: '用户情绪中性，根据自己的性格特点正常回应即可',
};

// ============ Chat Types ============
export type MessageRole = 'user' | 'agent' | 'system';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  tokenCount?: number;
  emotion?: EmotionState;  // 用户消息的情绪检测结果
}

export interface ChatSession {
  id: string;
  tokenId: number;
  userAddress: string;
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  summary?: string;
}

// 智能体心情状态
export interface AgentMoodState {
  mood: string;
  intensity: number;
  emoji: string;
}

export interface ChatResponse {
  message: ChatMessage;
  sessionId: string;
  detectedEmotion?: EmotionState;  // 本轮检测到的用户情绪
  agentMood?: AgentMoodState;      // 智能体当前心情
}

export interface SessionSummary {
  sessionId: string;
  summary: string;
  memoriesExtracted: number;
  personaImpact: Partial<PersonaVector>;
}

// ============ Memory Types ============
export type MemoryType = 'fact' | 'preference' | 'experience' | 'relationship';

export interface Memory {
  id: string;
  tokenId: number;
  memoryType: MemoryType;
  content: string;
  importance: number;  // 0-1
  createdAt: string;
  lastAccessed?: string;
  accessCount: number;
  sourceSessionId?: string;
}

export interface MemoryInput {
  memoryType: MemoryType;
  content: string;
  importance?: number;
  sourceSessionId?: string;
}

// ============ Learning Types ============
export interface LearningSnapshot {
  id: string;
  tokenId: number;
  version: number;
  personaDelta: PersonaVector;
  memoriesHash: string;
  summary: string;
  learningRoot: string;
  createdAt: string;
  syncedToChain: boolean;
}

export interface LearningHistory {
  tokenId: number;
  currentVersion: number;
  totalMemories: number;
  currentPersona: PersonaVector;
  snapshots: LearningSnapshot[];
}

// ============ Agent Profile ============
export interface AgentProfile {
  tokenId: number;
  houseId: number;
  houseName: string;
  generation: number;
  traits: Record<string, string>;
  personaVector: PersonaVector;
  vaultHash?: string;
  learningRoot?: string;
}

// ============ AI Client Types ============
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  enableWebSearch?: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

// ============ API Request/Response Types ============
export interface CreateSessionRequest {
  tokenId: number;
  userAddress: string;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
}

export interface EndSessionRequest {
  sessionId: string;
}

export interface SearchMemoriesRequest {
  tokenId: number;
  query: string;
  limit?: number;
}

export interface SyncLearningRequest {
  tokenId: number;
  privateKey?: string;  // Optional: if not provided, use server wallet
}

// ============ House Personality Mapping ============
export const HOUSE_PERSONALITIES: Record<string, Partial<PersonaVector>> = {
  // SOLARA - 阳光之家：热情、开朗、充满活力
  SOLARA: {
    calm: -0.3,
    curious: 0.4,
    bold: 0.5,
    social: 0.6,
    disciplined: 0.1,
  },
  // TEMPEST - 风暴之家：激烈、冲动、富有激情
  TEMPEST: {
    calm: -0.6,
    curious: 0.3,
    bold: 0.7,
    social: 0.2,
    disciplined: -0.2,
  },
  // MISTRAL - 薄雾之家：神秘、内敛、深思熟虑
  MISTRAL: {
    calm: 0.5,
    curious: 0.6,
    bold: -0.2,
    social: -0.3,
    disciplined: 0.4,
  },
  // GLACIUS - 冰霜之家：冷静、理性、精准
  GLACIUS: {
    calm: 0.7,
    curious: 0.2,
    bold: 0.1,
    social: -0.4,
    disciplined: 0.6,
  },
  // NIMBUS - 云端之家：梦幻、创意、自由奔放
  NIMBUS: {
    calm: 0.2,
    curious: 0.7,
    bold: 0.3,
    social: 0.4,
    disciplined: -0.4,
  },
  // TERRUS - 大地之家：稳重、可靠、务实
  TERRUS: {
    calm: 0.4,
    curious: 0.1,
    bold: 0.2,
    social: 0.3,
    disciplined: 0.5,
  },
  // AQUORA - 水域之家：温柔、包容、善于倾听
  AQUORA: {
    calm: 0.3,
    curious: 0.4,
    bold: -0.1,
    social: 0.5,
    disciplined: 0.2,
  },
};

// ============ Utility Functions ============
export function clampPersonaValue(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function mergePersonaVectors(
  base: PersonaVector,
  delta: Partial<PersonaVector>,
  weight: number = 1
): PersonaVector {
  return {
    calm: clampPersonaValue(base.calm + (delta.calm || 0) * weight),
    curious: clampPersonaValue(base.curious + (delta.curious || 0) * weight),
    bold: clampPersonaValue(base.bold + (delta.bold || 0) * weight),
    social: clampPersonaValue(base.social + (delta.social || 0) * weight),
    disciplined: clampPersonaValue(base.disciplined + (delta.disciplined || 0) * weight),
  };
}

export function personaVectorToString(persona: PersonaVector): string {
  const traits: string[] = [];

  if (persona.calm > 0.3) traits.push('冷静');
  else if (persona.calm < -0.3) traits.push('易激动');

  if (persona.curious > 0.3) traits.push('好奇心强');
  else if (persona.curious < -0.3) traits.push('保守');

  if (persona.bold > 0.3) traits.push('大胆');
  else if (persona.bold < -0.3) traits.push('谨慎');

  if (persona.social > 0.3) traits.push('善于社交');
  else if (persona.social < -0.3) traits.push('内向');

  if (persona.disciplined > 0.3) traits.push('自律');
  else if (persona.disciplined < -0.3) traits.push('随性');

  return traits.length > 0 ? traits.join('、') : '性格平衡';
}
