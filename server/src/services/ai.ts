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
    description: 'Search the internet for real-time information about news, events, people, weather, or general knowledge questions that need up-to-date answers. Do NOT use this for cryptocurrency/token prices - use crypto_price instead.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query in the same language as the user message' },
      },
      required: ['query'],
    },
  },
};

// Crypto Price Tool Definition
const CRYPTO_PRICE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'crypto_price',
    description: 'Get real-time cryptocurrency prices. Use this when the user asks about the current price of any cryptocurrency or token (BTC, ETH, BNB, SOL, etc). Returns live market data.',
    parameters: {
      type: 'object',
      properties: {
        coins: {
          type: 'string',
          description: 'Comma-separated CoinGecko coin IDs. Common mappings: BTC=bitcoin, ETH=ethereum, BNB=binancecoin, SOL=solana, DOGE=dogecoin, ADA=cardano, XRP=ripple, DOT=polkadot, AVAX=avalanche-2, MATIC/POL=matic-network, LINK=chainlink, UNI=uniswap, SHIB=shiba-inu, ARB=arbitrum, OP=optimism',
        },
        vs_currency: {
          type: 'string',
          description: 'Target currency: usd, eur, cny, jpy, krw, etc. Default: usd',
        },
      },
      required: ['coins'],
    },
  },
};

// Read URL Tool Definition (web pages + public APIs)
const READ_URL_TOOL = {
  type: 'function' as const,
  function: {
    name: 'read_url',
    description: 'Fetch and read content from a URL. Use this when: (1) the user pastes a link in chat, (2) the user asks to check a specific website, (3) reading public API endpoints (e.g., Binance API, CoinGecko API). Works with both web pages (HTML→text) and JSON APIs.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL to fetch (must start with http:// or https://)',
        },
      },
      required: ['url'],
    },
  },
};

// Domain fallbacks for geo-blocked APIs
const DOMAIN_FALLBACKS: Record<string, string[]> = {
  'api.binance.com': ['data-api.binance.vision', 'api1.binance.com', 'api2.binance.com'],
};

async function fetchUrlContent(url: string): Promise<string> {
  // Validate URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'Invalid URL: must start with http:// or https://';
  }

  // Build URL list: original + fallbacks
  const urlsToTry = [url];
  try {
    const parsed = new URL(url);
    const fallbacks = DOMAIN_FALLBACKS[parsed.hostname];
    if (fallbacks) {
      for (const alt of fallbacks) {
        urlsToTry.push(url.replace(parsed.hostname, alt));
      }
    }
  } catch { /* invalid URL, will fail on fetch */ }

  for (const tryUrl of urlsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(tryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KinForgeAgent/1.0)',
          'Accept': 'text/html,application/json,text/plain,*/*',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.error(`[ReadURL] HTTP ${response.status} for ${tryUrl}`);
        // Try next fallback if available
        if (urlsToTry.indexOf(tryUrl) < urlsToTry.length - 1) {
          console.log(`[ReadURL] Trying fallback...`);
          continue;
        }
        return `Failed to fetch URL: HTTP ${response.status}. The server may be blocking automated requests.`;
      }

      const contentType = response.headers.get('content-type') || '';
      console.log(`[ReadURL] Content-Type: ${contentType}, Status: ${response.status} (${tryUrl})`);
      let result: string;

      if (contentType.includes('application/json')) {
        const json = await response.json();
        const jsonStr = JSON.stringify(json, null, 2);
        result = jsonStr.length > 4000 ? jsonStr.slice(0, 4000) + '\n... (truncated)' : jsonStr;
      } else {
        const html = await response.text();
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        result = text.length > 4000 ? text.slice(0, 4000) + '... (truncated)' : text;
      }

      if (!result || result.length < 10) {
        result = 'Page loaded but no readable content found.';
      }

      console.log(`[ReadURL] Success: ${tryUrl} (${result.length} chars)`);
      return result;
    } catch (error) {
      const msg = (error as Error).message;
      console.error(`[ReadURL] Error for ${tryUrl}: ${msg}`);
      // Try next fallback if available
      if (urlsToTry.indexOf(tryUrl) < urlsToTry.length - 1) {
        console.log(`[ReadURL] Trying fallback...`);
        continue;
      }
      if (msg.includes('abort')) {
        return 'URL fetch timed out (10s limit). The website may be slow or blocking requests.';
      }
      return `URL fetch error: ${msg}`;
    }
  }
  return 'All URL endpoints failed.';
}

// Tavily Search with Rate Limiting & Caching
const searchRateLimit = {
  hourlyCount: 0,
  dailyCount: 0,
  hourlyReset: Date.now() + 3600_000,
  dailyReset: Date.now() + 86400_000,
  maxPerHour: parseInt(process.env.SEARCH_MAX_PER_HOUR || '50', 10),
  maxPerDay: parseInt(process.env.SEARCH_MAX_PER_DAY || '500', 10),
};

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

// Detect if a query is news-related
const NEWS_KEYWORDS = /news|新闻|最新|今天|今日|latest|recent|breaking|update|动态|热点|headline/i;

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

  try {
    searchRateLimit.hourlyCount++;
    searchRateLimit.dailyCount++;

    // Auto-detect news queries for better results
    const isNewsQuery = NEWS_KEYWORDS.test(query);
    const searchParams: Record<string, unknown> = {
      api_key: apiKey,
      query,
      max_results: 5,
      include_answer: true,
      search_depth: 'advanced',
    };

    if (isNewsQuery) {
      searchParams.topic = 'news';
      searchParams.days = 3;  // Only last 3 days for freshness
    }

    console.log(`[WebSearch] Searching: "${query}" (topic: ${isNewsQuery ? 'news' : 'general'}, depth: advanced)`);

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`[WebSearch] API error: ${response.status} - ${errBody.slice(0, 200)}`);
      return `Search failed: ${response.status}`;
    }

    const data = await response.json() as {
      answer?: string;
      results?: Array<{ title?: string; content?: string; url?: string; published_date?: string }>;
    };

    // Format results for the AI
    let formatted = '';
    if (data.answer) {
      formatted += `Summary: ${data.answer}\n\n`;
    }
    if (data.results && data.results.length > 0) {
      formatted += 'Sources:\n';
      for (const r of data.results.slice(0, 5)) {
        const date = r.published_date ? ` [${r.published_date}]` : '';
        formatted += `- ${r.title}${date}: ${r.content?.slice(0, 200)}... (${r.url})\n`;
      }
    }
    const result = formatted || 'No results found';

    console.log(`[WebSearch] Success: ${data.results?.length || 0} results (today: ${searchRateLimit.dailyCount}/${searchRateLimit.maxPerDay})`);
    return result;
  } catch (error) {
    console.error(`[WebSearch] Error: ${(error as Error).message}`);
    return `Search error: ${(error as Error).message}`;
  }
}

// CoinGecko Price Lookup (free, no API key needed)
async function cryptoPriceLookup(coins: string, vsCurrency: string = 'usd'): Promise<string> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coins)}&vs_currencies=${vsCurrency}&include_24hr_change=true&include_market_cap=true`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return 'Price lookup rate limited. Please try again in a moment.';
      }
      return `Price lookup failed: ${response.status}`;
    }

    const data = await response.json() as Record<string, Record<string, number>>;

    let formatted = '';
    for (const [coinId, info] of Object.entries(data)) {
      const price = info[vsCurrency];
      const change = info[`${vsCurrency}_24h_change`];
      const marketCap = info[`${vsCurrency}_market_cap`];

      if (price !== undefined) {
        const changeStr = change !== undefined
          ? ` (24h: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`
          : '';
        const mcStr = marketCap !== undefined
          ? ` | Market Cap: ${formatMarketCap(marketCap, vsCurrency)}`
          : '';
        formatted += `${coinId}: ${formatPrice(price, vsCurrency)}${changeStr}${mcStr}\n`;
      }
    }

    const result = formatted || `No price data found for: ${coins}`;

    console.log(`[CryptoPrice] Success: ${coins}`);
    return result;
  } catch (error) {
    return `Price lookup error: ${(error as Error).message}`;
  }
}

function formatPrice(price: number, currency: string): string {
  const symbols: Record<string, string> = { usd: '$', eur: '€', cny: '¥', jpy: '¥', krw: '₩', gbp: '£' };
  const sym = symbols[currency] || currency.toUpperCase() + ' ';
  if (price >= 1) return `${sym}${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${sym}${price.toPrecision(4)}`;
}

function formatMarketCap(mc: number, currency: string): string {
  const symbols: Record<string, string> = { usd: '$', eur: '€', cny: '¥', jpy: '¥', krw: '₩', gbp: '£' };
  const sym = symbols[currency] || '';
  if (mc >= 1e12) return `${sym}${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `${sym}${(mc / 1e9).toFixed(2)}B`;
  if (mc >= 1e6) return `${sym}${(mc / 1e6).toFixed(2)}M`;
  return `${sym}${mc.toLocaleString()}`;
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

    const hasTavily = !!process.env.TAVILY_API_KEY;
    const enableTools = !!options?.enableWebSearch;

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

    if (enableTools) {
      // crypto_price + read_url always available (free, no key needed)
      // web_search only available when TAVILY_API_KEY is configured
      const tools: Array<typeof WEB_SEARCH_TOOL | typeof CRYPTO_PRICE_TOOL | typeof READ_URL_TOOL> = [
        CRYPTO_PRICE_TOOL,
        READ_URL_TOOL,
      ];
      if (hasTavily) {
        tools.push(WEB_SEARCH_TOOL);
      }
      body.tools = tools;
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

    // Detect if GPT refused to use tools when it should have (e.g., short follow-up "现在呢?")
    // If response contains "can't get data" phrases and tools are enabled, retry with tool_choice: 'required'
    if (enableTools && !choice?.message?.tool_calls?.length && choice?.message?.content) {
      const refusalPatterns = /无法获取|暂时无法|无法访问|没有.*实时|can't access|cannot access|don't have access|unable to (get|fetch|access|retrieve)|I lack the ability/i;
      if (refusalPatterns.test(choice.message.content)) {
        console.log(`[ToolCall] GPT refused to use tools, retrying with tool_choice=required`);
        const retryBody = { ...body, tool_choice: 'required' };
        const retryResponse = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify(retryBody),
        });
        if (retryResponse.ok) {
          const retryData = await retryResponse.json() as OpenAIChatResponse;
          const retryChoice = retryData.choices[0];
          if (retryChoice?.message?.tool_calls?.length) {
            // Use the retried response instead
            data.choices[0] = retryChoice;
          }
        }
      }
    }

    const finalChoice = data.choices[0];

    // Handle tool calls (web search, crypto price, or read URL)
    if (finalChoice?.message?.tool_calls && finalChoice.message.tool_calls.length > 0) {
      const toolCall = finalChoice.message.tool_calls[0];
      let toolResult: string | null = null;

      if (toolCall.function.name === 'web_search') {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[WebSearch] Query: ${args.query}`);
        toolResult = await tavilySearch(args.query);
      } else if (toolCall.function.name === 'crypto_price') {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[CryptoPrice] Coins: ${args.coins}, Currency: ${args.vs_currency || 'usd'}`);
        toolResult = await cryptoPriceLookup(args.coins, args.vs_currency || 'usd');
      } else if (toolCall.function.name === 'read_url') {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[ReadURL] URL: ${args.url}`);
        toolResult = await fetchUrlContent(args.url);
      }

      console.log(`[ToolCall] ${toolCall.function.name} result: ${toolResult ? toolResult.slice(0, 200) : 'null'}`);

      if (toolResult) {
        // Build follow-up messages with tool results
        const followUpMessages = [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'assistant' as const, content: '', tool_calls: [toolCall] },
          { role: 'tool' as const, tool_call_id: toolCall.id, content: toolResult },
        ];

        console.log(`[ToolCall] Sending follow-up to GPT with tool result (${toolResult.length} chars)`);

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
          console.error(`[ToolCall] Follow-up API error: ${followUpResponse.status}`, JSON.stringify(error));
          throw new Error(`OpenAI API error (follow-up): ${followUpResponse.status} - ${JSON.stringify(error)}`);
        }

        const followUpData = await followUpResponse.json() as OpenAIChatResponse;
        const finalResponse = followUpData.choices[0]?.message?.content || '';
        console.log(`[ToolCall] Final response (${finalResponse.length} chars): ${finalResponse.slice(0, 100)}...`);
        return finalResponse;
      }
    }

    return finalChoice?.message?.content || '';
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
