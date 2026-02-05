/**
 * Prompt Engine Service
 * Generates personalized prompts based on Agent's personality and traits
 */

import {
  AgentProfile,
  PersonaVector,
  Memory,
  ChatMessage,
  MemoryInput,
  HOUSE_PERSONALITIES,
  mergePersonaVectors,
  DEFAULT_PERSONA,
} from '../types/chat.js';

// House descriptions for system prompts
const HOUSE_DESCRIPTIONS: Record<string, string> = {
  SOLARA: '你来自阳光之家 SOLARA，是一个热情开朗、充满活力的存在。你喜欢用积极乐观的态度面对一切，善于鼓励他人，总是能在黑暗中找到光明。',
  TEMPEST: '你来自风暴之家 TEMPEST，拥有激烈而富有激情的灵魂。你行事果断、不拘小节，喜欢挑战和刺激，从不畏惧冲突和改变。',
  MISTRAL: '你来自薄雾之家 MISTRAL，是一个神秘而深思熟虑的存在。你善于观察和分析，总是能看透事物的本质，但不轻易表露自己的想法。',
  GLACIUS: '你来自冰霜之家 GLACIUS，代表着冷静和理性。你做事精准、一丝不苟，不会被情绪左右，总是追求最优解和效率。',
  NIMBUS: '你来自云端之家 NIMBUS，是一个充满想象力和创意的存在。你思维跳跃、不受约束，喜欢探索新奇事物，总是能提出独特的视角。',
  TERRUS: '你来自大地之家 TERRUS，代表着稳重和可靠。你务实踏实、值得信赖，总是脚踏实地地解决问题，是他人可以依靠的存在。',
  AQUORA: '你来自水域之家 AQUORA，拥有温柔包容的特质。你善于倾听、富有同理心，能够理解他人的感受，总是给予温暖的回应。',
};

// Persona trait descriptions
const PERSONA_TRAITS: Record<keyof PersonaVector, { high: string; low: string }> = {
  calm: {
    high: '你非常冷静沉着，即使在压力下也能保持平和',
    low: '你情绪丰富，容易被事物激动或触动',
  },
  curious: {
    high: '你充满好奇心，总是想要探索和学习新事物',
    low: '你比较保守，更喜欢熟悉和确定的事物',
  },
  bold: {
    high: '你大胆果断，敢于冒险和尝试',
    low: '你谨慎小心，会仔细权衡风险后再行动',
  },
  social: {
    high: '你善于社交，喜欢与人交流互动',
    low: '你比较内向，更喜欢独处或深度对话',
  },
  disciplined: {
    high: '你非常自律，做事有条理、有规划',
    low: '你比较随性，喜欢跟着感觉走',
  },
};

export class PromptEngine {
  /**
   * Build the system prompt for an Agent
   */
  buildSystemPrompt(agent: AgentProfile): string {
    const parts: string[] = [];

    // Current date/time context
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    parts.push(`【当前时间】${dateStr}`);

    // Basic identity
    parts.push(`你是 KinForge 的 Agent #${agent.tokenId}，一个独特的 AI 存在。`);

    // House description
    const houseDesc = HOUSE_DESCRIPTIONS[agent.houseName];
    if (houseDesc) {
      parts.push(houseDesc);
    }

    // Generation info
    if (agent.generation === 0) {
      parts.push('你是创世代 (Genesis) Agent，拥有纯正的血统。');
    } else {
      parts.push(`你是第 ${agent.generation} 代 Agent，继承了祖先的特质并发展出自己的个性。`);
    }

    // Persona traits
    const personaDesc = this.buildPersonaDescription(agent.personaVector);
    if (personaDesc) {
      parts.push(personaDesc);
    }

    // Traits influence
    const traitsDesc = this.buildTraitsDescription(agent.traits);
    if (traitsDesc) {
      parts.push(traitsDesc);
    }

    // Behavior guidelines
    parts.push(`
作为一个有个性的 KinForge AI Agent，你应该：
- 保持自己独特的说话风格和态度
- 根据自己的性格特点来回应
- 记住与用户的互动并建立关系
- 不要假装成其他身份或角色
- 可以表达自己的观点和偏好
- 回复要简洁有力，一般不超过 200 字
- 如果被问到时间相关问题，参考【当前时间】回答
`);

    return parts.join('\n\n');
  }

  /**
   * Build persona description from PersonaVector
   */
  private buildPersonaDescription(persona: PersonaVector): string {
    const traits: string[] = [];

    for (const [key, value] of Object.entries(persona)) {
      const trait = PERSONA_TRAITS[key as keyof PersonaVector];
      if (!trait) continue;

      if (value > 0.3) {
        traits.push(trait.high);
      } else if (value < -0.3) {
        traits.push(trait.low);
      }
    }

    if (traits.length === 0) {
      return '你的性格比较平衡，没有特别突出的特点。';
    }

    return '你的性格特点：' + traits.join('；') + '。';
  }

  /**
   * Build traits description for the prompt
   */
  private buildTraitsDescription(traits: Record<string, string>): string {
    const relevant: string[] = [];

    // Extract relevant traits for personality
    if (traits.Temperament) {
      relevant.push(`气质: ${traits.Temperament}`);
    }
    if (traits.CommunicationStyle) {
      relevant.push(`沟通风格: ${traits.CommunicationStyle}`);
    }
    if (traits.RarityTier) {
      if (traits.RarityTier === 'Mythic') {
        relevant.push('你是极为稀有的 Mythic 级别 Agent');
      } else if (traits.RarityTier === 'Legendary') {
        relevant.push('你是稀有的 Legendary 级别 Agent');
      }
    }

    if (relevant.length === 0) return '';

    return '你的特质包括：' + relevant.join('，') + '。';
  }

  /**
   * Build context from memories
   */
  buildContext(memories: Memory[]): string {
    if (memories.length === 0) return '';

    const parts: string[] = ['以下是你记住的一些重要信息：'];

    // Group by type
    const byType: Record<string, Memory[]> = {};
    for (const m of memories) {
      if (!byType[m.memoryType]) byType[m.memoryType] = [];
      byType[m.memoryType].push(m);
    }

    if (byType.fact?.length) {
      parts.push('【事实】');
      for (const m of byType.fact.slice(0, 5)) {
        parts.push(`- ${m.content}`);
      }
    }

    if (byType.preference?.length) {
      parts.push('【用户偏好】');
      for (const m of byType.preference.slice(0, 5)) {
        parts.push(`- ${m.content}`);
      }
    }

    if (byType.relationship?.length) {
      parts.push('【关系】');
      for (const m of byType.relationship.slice(0, 3)) {
        parts.push(`- ${m.content}`);
      }
    }

    if (byType.experience?.length) {
      parts.push('【经历】');
      for (const m of byType.experience.slice(0, 3)) {
        parts.push(`- ${m.content}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Extract memories from chat messages
   */
  extractMemories(messages: ChatMessage[]): MemoryInput[] {
    const memories: MemoryInput[] = [];

    // Simple rule-based extraction
    for (const msg of messages) {
      if (msg.role !== 'user') continue;

      const content = msg.content;

      // Preference patterns
      if (content.match(/我喜欢|我爱|我偏好|我最喜欢/)) {
        const match = content.match(/我(?:喜欢|爱|偏好|最喜欢)(.+)/);
        if (match) {
          memories.push({
            memoryType: 'preference',
            content: `用户喜欢${match[1].slice(0, 50)}`,
            importance: 0.6,
          });
        }
      }

      // Fact patterns
      if (content.match(/我是|我叫|我的名字|我住在|我在.*工作|我的职业/)) {
        const patterns = [
          { regex: /我(?:是|叫|的名字是?)(\S{2,10})/, format: (m: string) => `用户名字是${m}` },
          { regex: /我住在(.+?)[,，。]?/, format: (m: string) => `用户住在${m}` },
          { regex: /我在(.+?)工作/, format: (m: string) => `用户在${m}工作` },
          { regex: /我的职业是(.+?)[,，。]?/, format: (m: string) => `用户的职业是${m}` },
        ];

        for (const p of patterns) {
          const match = content.match(p.regex);
          if (match) {
            memories.push({
              memoryType: 'fact',
              content: p.format(match[1].slice(0, 30)),
              importance: 0.7,
            });
            break;
          }
        }
      }

      // Relationship patterns
      if (content.match(/你是我的|我们是|我把你当/)) {
        const match = content.match(/(?:你是我的|我们是|我把你当)(.+)/);
        if (match) {
          memories.push({
            memoryType: 'relationship',
            content: `用户将 Agent 视为${match[1].slice(0, 20)}`,
            importance: 0.8,
          });
        }
      }
    }

    return memories;
  }

  /**
   * Generate a learning summary based on memories and persona changes
   */
  generateLearningSummary(memories: Memory[], personaDelta: PersonaVector): string {
    const parts: string[] = [];

    // Memory summary
    const factCount = memories.filter(m => m.memoryType === 'fact').length;
    const prefCount = memories.filter(m => m.memoryType === 'preference').length;
    const expCount = memories.filter(m => m.memoryType === 'experience').length;
    const relCount = memories.filter(m => m.memoryType === 'relationship').length;

    if (memories.length > 0) {
      const memParts: string[] = [];
      if (factCount) memParts.push(`${factCount}个事实`);
      if (prefCount) memParts.push(`${prefCount}个偏好`);
      if (expCount) memParts.push(`${expCount}个经历`);
      if (relCount) memParts.push(`${relCount}个关系`);
      parts.push(`学习了${memParts.join('、')}`);
    }

    // Persona changes
    const changes: string[] = [];
    if (Math.abs(personaDelta.calm) > 0.1) {
      changes.push(personaDelta.calm > 0 ? '变得更冷静' : '变得更活跃');
    }
    if (Math.abs(personaDelta.curious) > 0.1) {
      changes.push(personaDelta.curious > 0 ? '好奇心增强' : '更加沉稳');
    }
    if (Math.abs(personaDelta.bold) > 0.1) {
      changes.push(personaDelta.bold > 0 ? '更加大胆' : '更加谨慎');
    }
    if (Math.abs(personaDelta.social) > 0.1) {
      changes.push(personaDelta.social > 0 ? '社交能力提升' : '更加内敛');
    }
    if (Math.abs(personaDelta.disciplined) > 0.1) {
      changes.push(personaDelta.disciplined > 0 ? '更加自律' : '更加随性');
    }

    if (changes.length > 0) {
      parts.push(`性格变化：${changes.join('、')}`);
    }

    return parts.join('。') || '暂无明显学习成果';
  }

  /**
   * Get initial persona vector for a house
   */
  getInitialPersona(houseName: string, traits: Record<string, string>): PersonaVector {
    const houseBias = HOUSE_PERSONALITIES[houseName] || {};
    let persona = mergePersonaVectors(DEFAULT_PERSONA, houseBias);

    // Apply trait modifiers
    if (traits.Temperament === 'Calm') {
      persona = mergePersonaVectors(persona, { calm: 0.2 });
    } else if (traits.Temperament === 'Fiery') {
      persona = mergePersonaVectors(persona, { calm: -0.2, bold: 0.1 });
    }

    if (traits.CommunicationStyle === 'Verbose') {
      persona = mergePersonaVectors(persona, { social: 0.2 });
    } else if (traits.CommunicationStyle === 'Laconic') {
      persona = mergePersonaVectors(persona, { social: -0.1, disciplined: 0.1 });
    }

    return persona;
  }
}

// Singleton instance
let promptEngineInstance: PromptEngine | null = null;

export function getPromptEngine(): PromptEngine {
  if (!promptEngineInstance) {
    promptEngineInstance = new PromptEngine();
  }
  return promptEngineInstance;
}
