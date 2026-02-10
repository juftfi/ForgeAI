/**
 * AI Client Service
 * Supports OpenAI and Anthropic APIs for chat and embeddings
 * 支持多 API Key 轮询和自动故障转移
 */

import { AIMessage, ChatOptions, EmbeddingResult } from '../types/chat.js';
import { getKeyPool, KeyPoolConfig } from './keyPool.js';

export type AIProvider = 'openai' | 'anthropic';

// Web Search Tool Definition
const WEB_SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description: 'Search the internet for real-time information when the user asks about recent events, current prices, weather, news, live data, or anything requiring up-to-date information beyond your training data.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query in the same language as the user message' },
      },
      required: ['query'],
    },
  },
};

// Tavily Search with Rate Limiting & Caching
const searchRateLimit = {
  hourlyCount: 0,
  dailyCount: 0,
  hourlyReset: Date.now() + 3600_000,
  dailyReset: Date.now() + 86400_000,
  maxPerHour: parseInt(process.env.SEARCH_MAX_PER_HOUR || '50', 10),
  maxPerDay: parseInt(process.env.SEARCH_MAX_PER_DAY || '500', 10),
};

const searchCache = new Map<string, { result: string; expiry: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function checkSearchRateLimit(): string | null {
  const now = Date.now();
  if (now > searchRateLimit.hourlyReset) {
    searchRateLimit.hourlyCount = 0;
    searchRateLimit.hourlyReset = now + 3600_000;
  }
  if (now > searchRateLimit.dailyReset) {
    searchRateLimit.dailyCount = 0;
    searchRateLimit.dailyReset = now + 86400_000;
  }
  if (searchRateLimit.hourlyCount >= searchRateLimit.maxPerHour) {
    return 'Web search temporarily unavailable: hourly limit reached. Please try again later.';
  }
  if (searchRateLimit.dailyCount >= searchRateLimit.maxPerDay) {
    return 'Web search temporarily unavailable: daily limit reached. Please try again tomorrow.';
  }
  return null;
}

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function tavilySearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return 'Web search unavailable: TAVILY_API_KEY not configured';
  }

  // Check rate limit
  const rateLimitMsg = checkSearchRateLimit();
  if (rateLimitMsg) {
    console.warn(`[WebSearch] Rate limited: ${rateLimitMsg}`);
    return rateLimitMsg;
  }

  // Check cache
  const cacheKey = normalizeQuery(query);
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    console.log(`[WebSearch] Cache hit: "${query}"`);
    return cached.result;
  }

  // Clean expired cache entries periodically
  if (searchCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of searchCache) {
      if (v.expiry < now) searchCache.delete(k);
    }
  }

  try {
    searchRateLimit.hourlyCount++;
    searchRateLimit.dailyCount++;

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        include_answer: true,
      }),
    });

    if (!response.ok) {
      return `Search failed: ${response.status}`;
    }

    const data = await response.json() as {
      answer?: string;
      results?: Array<{ title?: string; content?: string; url?: string }>;
    };

    // Format results for the AI
    let formatted = '';
    if (data.answer) {
      formatted += `Summary: ${data.answer}\n\n`;
    }
    if (data.results) {
      formatted += 'Sources:\n';
      for (const r of data.results.slice(0, 3)) {
        formatted += `- ${r.title}: ${r.content?.slice(0, 200)}... (${r.url})\n`;
      }
    }
    const result = formatted || 'No results found';

    // Cache the result
    searchCache.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });

    console.log(`[WebSearch] Success (today: ${searchRateLimit.dailyCount}/${searchRateLimit.maxPerDay})`);
    return result;
  } catch (error) {
    return `Search error: ${(error as Error).message}`;
  }
}

// API Response Types
interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIChatResponse {
  choices: Array<{
    message?: {
      content?: string;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string;
  }>;
}

interface AnthropicChatResponse {
  content: Array<{
    text?: string;
  }>;
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding?: number[];
  }>;
  usage?: {
    total_tokens?: number;
  };
}

interface AIConfig {
  provider: AIProvider;
  apiKey?: string; // 可选，如果不提供则使用 KeyPool
  model?: string;
  embeddingModel?: string;
  baseUrl?: string;
  useKeyPool?: boolean; // 是否使用 Key Pool（默认 true）
  keyPoolConfig?: KeyPoolConfig;
}

export class AIClient {
  private config: AIConfig;
  private defaultModel: string;
  private defaultEmbeddingModel: string;
  private useKeyPool: boolean;

  constructor(config?: Partial<AIConfig>) {
    const provider = (config?.provider || process.env.AI_PROVIDER || 'openai') as AIProvider;

    // 默认启用 KeyPool
    this.useKeyPool = config?.useKeyPool !== false;

    // 初始化 KeyPool（如果启用）
    if (this.useKeyPool) {
      getKeyPool(config?.keyPoolConfig);
    }

    this.config = {
      provider,
      apiKey: config?.apiKey,
      model: config?.model,
      embeddingModel: config?.embeddingModel,
      baseUrl: config?.baseUrl,
      useKeyPool: this.useKeyPool,
    };

    // Set default models based on provider
    if (provider === 'openai') {
      this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      this.defaultEmbeddingModel = 'text-embedding-3-small';
    } else {
      this.defaultModel = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
      this.defaultEmbeddingModel = ''; // Anthropic doesn't have embeddings, will use OpenAI fallback
    }
  }

  /**
   * 获取 API Key（从 KeyPool 或配置）
   */
  private getApiKey(provider: AIProvider): string {
    // 如果配置了固定的 key，使用它
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    // 从 KeyPool 获取
    if (this.useKeyPool) {
      const key = getKeyPool().getKey(provider);
      if (key) {
        return key;
      }
    }

    // 回退到环境变量
    if (provider === 'openai') {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('No OpenAI API key available');
      return key;
    } else {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('No Anthropic API key available');
      return key;
    }
  }

  /**
   * Send a chat request to the AI
   * 支持多 Key 故障转移
   */
  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    const maxRetries = this.useKeyPool ? getKeyPool().getTotalCount(this.config.provider) + 2 : 3;
    let lastError: Error | null = null;
    const triedKeys = new Set<string>();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let currentKey: string;

      try {
        currentKey = this.getApiKey(this.config.provider);

        // 如果已经尝试过这个 key 且还有其他 key，跳过
        if (triedKeys.has(currentKey) && triedKeys.size < getKeyPool().getTotalCount(this.config.provider)) {
          continue;
        }
        triedKeys.add(currentKey);

        let result: string;
        if (this.config.provider === 'openai') {
          result = await this.chatOpenAI(messages, options, currentKey);
        } else {
          result = await this.chatAnthropic(messages, options, currentKey);
        }

        // 成功：报告并返回
        if (this.useKeyPool) {
          getKeyPool().reportSuccess(this.config.provider, currentKey);
        }
        return result;

      } catch (error) {
        lastError = error as Error;
        const errorMessage = (error as Error).message || '';

        console.error(`AI chat attempt ${attempt + 1} failed:`, errorMessage);

        // 报告错误到 KeyPool
        if (this.useKeyPool && currentKey!) {
          const isRateLimit = errorMessage.includes('429') ||
                             errorMessage.includes('rate') ||
                             errorMessage.includes('quota');
          getKeyPool().reportError(this.config.provider, currentKey!, errorMessage, isRateLimit);
        }

        // 认证错误不重试同一个 key
        if (errorMessage.includes('401') || errorMessage.includes('invalid_api_key')) {
          if (this.useKeyPool) {
            getKeyPool().reportError(this.config.provider, currentKey!, errorMessage, false);
          }
          // 但如果还有其他 key，继续尝试
          if (triedKeys.size >= getKeyPool().getTotalCount(this.config.provider)) {
            throw error;
          }
          continue;
        }

        // 等待后重试（指数退避）
        if (attempt < maxRetries - 1) {
          const waitTime = Math.min(Math.pow(2, attempt) * 1000, 10000);
          await this.sleep(waitTime);
        }
      }
    }

    throw lastError || new Error('AI chat failed after all retries');
  }

  private async chatOpenAI(messages: AIMessage[], options?: ChatOptions, apiKey?: string): Promise<string> {
    const model = this.config.model || this.defaultModel;
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const key = apiKey || this.getApiKey('openai');

    const enableSearch = options?.enableWebSearch && !!process.env.TAVILY_API_KEY;

    const body: Record<string, unknown> = {
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
      stop: options?.stopSequences,
    };

    if (enableSearch) {
      body.tools = [WEB_SEARCH_TOOL];
      body.tool_choice = 'auto';
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json() as OpenAIChatResponse;
    const choice = data.choices[0];

    // Handle tool calls (web search)
    if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      if (toolCall.function.name === 'web_search') {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[WebSearch] Query: ${args.query}`);
        const searchResults = await tavilySearch(args.query);

        // Build follow-up messages with search results
        const followUpMessages = [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'assistant' as const, content: null, tool_calls: [toolCall] },
          { role: 'tool' as const, tool_call_id: toolCall.id, content: searchResults },
        ];

        const followUpResponse = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: followUpMessages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 1024,
          }),
        });

        if (!followUpResponse.ok) {
          const error = await followUpResponse.json().catch(() => ({}));
          throw new Error(`OpenAI API error (follow-up): ${followUpResponse.status} - ${JSON.stringify(error)}`);
        }

        const followUpData = await followUpResponse.json() as OpenAIChatResponse;
        return followUpData.choices[0]?.message?.content || '';
      }
    }

    return choice?.message?.content || '';
  }

  private async chatAnthropic(messages: AIMessage[], options?: ChatOptions, apiKey?: string): Promise<string> {
    const model = this.config.model || this.defaultModel;
    const baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1';
    const key = apiKey || this.getApiKey('anthropic');

    // Extract system message and convert format
    let systemMessage = '';
    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessage = msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemMessage || undefined,
        messages: anthropicMessages,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.7,
        stop_sequences: options?.stopSequences,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json() as AnthropicChatResponse;
    return data.content[0]?.text || '';
  }

  /**
   * Generate embeddings for text (for semantic search)
   * Falls back to OpenAI for Anthropic provider since Anthropic doesn't have embeddings
   */
  async embed(text: string): Promise<EmbeddingResult> {
    let apiKey: string;

    if (this.useKeyPool) {
      const key = getKeyPool().getKey('openai');
      if (key) {
        apiKey = key;
      } else {
        apiKey = process.env.OPENAI_API_KEY || '';
      }
    } else {
      apiKey = this.config.provider === 'openai'
        ? (this.config.apiKey || process.env.OPENAI_API_KEY || '')
        : (process.env.OPENAI_API_KEY || '');
    }

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for embeddings');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.defaultEmbeddingModel,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));

      // 报告错误
      if (this.useKeyPool) {
        const isRateLimit = response.status === 429;
        getKeyPool().reportError('openai', apiKey, `Embeddings: ${response.status}`, isRateLimit);
      }

      throw new Error(`OpenAI Embeddings API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    // 报告成功
    if (this.useKeyPool) {
      getKeyPool().reportSuccess('openai', apiKey);
    }

    const data = await response.json() as OpenAIEmbeddingResponse;
    return {
      embedding: data.data[0]?.embedding || [],
      tokenCount: data.usage?.total_tokens || 0,
    };
  }

  /**
   * 获取 Key Pool 状态
   */
  getKeyPoolStatus() {
    return getKeyPool().getStatus();
  }

  /**
   * Simple text similarity using cosine similarity of embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Estimate token count (rough approximation)
   */
  static estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English, 1.5 for Chinese
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
}

// Singleton instance
let aiClientInstance: AIClient | null = null;

export function getAIClient(): AIClient {
  if (!aiClientInstance) {
    aiClientInstance = new AIClient();
  }
  return aiClientInstance;
}

export function resetAIClient(): void {
  aiClientInstance = null;
}
