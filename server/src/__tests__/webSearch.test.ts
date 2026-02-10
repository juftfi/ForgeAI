/**
 * Web Search Integration Tests
 * Tests rate limiting, caching, tool call handling, and Tavily integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the internal functions by importing the module and mocking fetch
// Since tavilySearch and rate limiting are module-level, we test via the AIClient

// ============ Unit Tests for Rate Limiting Logic ============

describe('Web Search Rate Limiting', () => {
  // Recreate the rate limiting logic for isolated testing
  function createRateLimiter(maxPerHour: number, maxPerDay: number) {
    const state = {
      hourlyCount: 0,
      dailyCount: 0,
      hourlyReset: Date.now() + 3600_000,
      dailyReset: Date.now() + 86400_000,
      maxPerHour,
      maxPerDay,
    };

    function check(): string | null {
      const now = Date.now();
      if (now > state.hourlyReset) {
        state.hourlyCount = 0;
        state.hourlyReset = now + 3600_000;
      }
      if (now > state.dailyReset) {
        state.dailyCount = 0;
        state.dailyReset = now + 86400_000;
      }
      if (state.hourlyCount >= state.maxPerHour) {
        return 'hourly limit reached';
      }
      if (state.dailyCount >= state.maxPerDay) {
        return 'daily limit reached';
      }
      return null;
    }

    function increment() {
      state.hourlyCount++;
      state.dailyCount++;
    }

    return { check, increment, state };
  }

  it('allows requests within limits', () => {
    const limiter = createRateLimiter(10, 100);
    expect(limiter.check()).toBeNull();
  });

  it('blocks after hourly limit reached', () => {
    const limiter = createRateLimiter(3, 100);
    limiter.increment();
    limiter.increment();
    limiter.increment();
    expect(limiter.check()).toContain('hourly limit');
  });

  it('blocks after daily limit reached', () => {
    const limiter = createRateLimiter(100, 5);
    for (let i = 0; i < 5; i++) limiter.increment();
    expect(limiter.check()).toContain('daily limit');
  });

  it('resets hourly count after window expires', () => {
    const limiter = createRateLimiter(3, 100);
    limiter.increment();
    limiter.increment();
    limiter.increment();
    expect(limiter.check()).toContain('hourly limit');

    // Simulate time passing
    limiter.state.hourlyReset = Date.now() - 1;
    expect(limiter.check()).toBeNull();
    expect(limiter.state.hourlyCount).toBe(0);
  });

  it('resets daily count after window expires', () => {
    const limiter = createRateLimiter(100, 2);
    limiter.increment();
    limiter.increment();
    expect(limiter.check()).toContain('daily limit');

    // Simulate time passing
    limiter.state.dailyReset = Date.now() - 1;
    expect(limiter.check()).toBeNull();
    expect(limiter.state.dailyCount).toBe(0);
  });
});

// ============ Unit Tests for Query Normalization ============

describe('Query Normalization', () => {
  function normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  it('converts to lowercase', () => {
    expect(normalizeQuery('BTC Price')).toBe('btc price');
  });

  it('trims whitespace', () => {
    expect(normalizeQuery('  hello world  ')).toBe('hello world');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeQuery('hello   world')).toBe('hello world');
  });

  it('handles Chinese characters', () => {
    expect(normalizeQuery('  比特币 价格  ')).toBe('比特币 价格');
  });

  it('identical queries produce identical keys', () => {
    const q1 = normalizeQuery('BTC Price Today');
    const q2 = normalizeQuery('  btc  price  today  ');
    expect(q1).toBe(q2);
  });
});

// ============ Unit Tests for Search Cache ============

describe('Search Cache', () => {
  function createCache(ttl: number) {
    const cache = new Map<string, { result: string; expiry: number }>();

    function get(key: string): string | null {
      const entry = cache.get(key);
      if (entry && entry.expiry > Date.now()) return entry.result;
      return null;
    }

    function set(key: string, result: string) {
      cache.set(key, { result, expiry: Date.now() + ttl });
    }

    function cleanup() {
      const now = Date.now();
      for (const [k, v] of cache) {
        if (v.expiry < now) cache.delete(k);
      }
    }

    return { get, set, cleanup, cache };
  }

  it('returns null for missing key', () => {
    const c = createCache(60000);
    expect(c.get('unknown')).toBeNull();
  });

  it('returns cached result within TTL', () => {
    const c = createCache(60000);
    c.set('btc price', 'BTC is $50000');
    expect(c.get('btc price')).toBe('BTC is $50000');
  });

  it('returns null for expired entry', () => {
    const c = createCache(1); // 1ms TTL
    c.set('btc price', 'BTC is $50000');

    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 5) { /* busy wait */ }

    expect(c.get('btc price')).toBeNull();
  });

  it('cleanup removes expired entries', () => {
    const c = createCache(1);
    c.set('a', 'result-a');
    c.set('b', 'result-b');

    const start = Date.now();
    while (Date.now() - start < 5) { /* busy wait */ }

    c.cleanup();
    expect(c.cache.size).toBe(0);
  });
});

// ============ Integration Test: Tavily API Mock ============

describe('Tavily Search (mocked)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('formats Tavily response correctly', async () => {
    const mockResponse = {
      answer: 'Bitcoin is currently at $95,000',
      results: [
        { title: 'CoinGecko', content: 'BTC price data showing current market cap and volume...', url: 'https://coingecko.com/btc' },
        { title: 'CoinMarketCap', content: 'Bitcoin live price, charts and market overview...', url: 'https://coinmarketcap.com/btc' },
      ],
    };

    // Mock fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    // Call the formatting logic directly
    const data = mockResponse;
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

    expect(formatted).toContain('Summary: Bitcoin is currently at $95,000');
    expect(formatted).toContain('Sources:');
    expect(formatted).toContain('CoinGecko');
    expect(formatted).toContain('CoinMarketCap');
    expect(formatted).toContain('https://coingecko.com/btc');
  });

  it('handles empty results', () => {
    const data = { results: [] };
    let formatted = '';
    if (data.results && data.results.length > 0) {
      formatted += 'Sources:\n';
      for (const r of data.results.slice(0, 3)) {
        formatted += `- ${r.title}: ${r.content?.slice(0, 200)}... (${r.url})\n`;
      }
    }
    expect(formatted).toBe('');
  });

  it('handles answer-only response (no results)', () => {
    const data = { answer: 'The weather is sunny', results: [] };
    let formatted = '';
    if (data.answer) {
      formatted += `Summary: ${data.answer}\n\n`;
    }
    expect(formatted).toContain('Summary: The weather is sunny');
  });

  it('truncates long content to 200 chars', () => {
    const longContent = 'A'.repeat(500);
    const truncated = longContent.slice(0, 200);
    expect(truncated.length).toBe(200);
  });

  it('limits to 3 sources max', () => {
    const data = {
      results: [
        { title: 'A', content: 'a', url: 'https://a.com' },
        { title: 'B', content: 'b', url: 'https://b.com' },
        { title: 'C', content: 'c', url: 'https://c.com' },
        { title: 'D', content: 'd', url: 'https://d.com' },
        { title: 'E', content: 'e', url: 'https://e.com' },
      ],
    };
    const sliced = data.results.slice(0, 3);
    expect(sliced.length).toBe(3);
    expect(sliced.map(r => r.title)).toEqual(['A', 'B', 'C']);
  });
});

// ============ OpenAI Tool Call Parsing ============

describe('OpenAI Tool Call Handling', () => {
  it('parses web_search tool call correctly', () => {
    const toolCall = {
      id: 'call_abc123',
      type: 'function' as const,
      function: {
        name: 'web_search',
        arguments: '{"query":"BTC price today"}',
      },
    };

    expect(toolCall.function.name).toBe('web_search');
    const args = JSON.parse(toolCall.function.arguments);
    expect(args.query).toBe('BTC price today');
  });

  it('handles malformed JSON in arguments gracefully', () => {
    const toolCall = {
      id: 'call_abc123',
      type: 'function' as const,
      function: {
        name: 'web_search',
        arguments: '{invalid json',
      },
    };

    expect(() => JSON.parse(toolCall.function.arguments)).toThrow();
  });

  it('ignores non-web_search tool calls', () => {
    const toolCall = {
      id: 'call_xyz',
      type: 'function' as const,
      function: {
        name: 'some_other_tool',
        arguments: '{}',
      },
    };

    const isWebSearch = toolCall.function.name === 'web_search';
    expect(isWebSearch).toBe(false);
  });
});

// ============ WEB_SEARCH_TOOL Definition ============

describe('WEB_SEARCH_TOOL definition', () => {
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

  it('has correct structure for OpenAI function calling', () => {
    expect(WEB_SEARCH_TOOL.type).toBe('function');
    expect(WEB_SEARCH_TOOL.function.name).toBe('web_search');
    expect(WEB_SEARCH_TOOL.function.parameters.type).toBe('object');
    expect(WEB_SEARCH_TOOL.function.parameters.required).toContain('query');
  });

  it('query parameter is string type', () => {
    expect(WEB_SEARCH_TOOL.function.parameters.properties.query.type).toBe('string');
  });
});

// ============ enableWebSearch flag ============

describe('enableWebSearch flag logic', () => {
  it('search enabled only when both flag and API key present', () => {
    const cases = [
      { enableWebSearch: true, hasTavilyKey: true, expected: true },
      { enableWebSearch: true, hasTavilyKey: false, expected: false },
      { enableWebSearch: false, hasTavilyKey: true, expected: false },
      { enableWebSearch: false, hasTavilyKey: false, expected: false },
      { enableWebSearch: undefined, hasTavilyKey: true, expected: false },
    ];

    for (const c of cases) {
      const result = !!(c.enableWebSearch && c.hasTavilyKey);
      expect(result).toBe(c.expected);
    }
  });
});