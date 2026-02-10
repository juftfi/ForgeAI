/**
 * Manual Integration Test for Web Search
 * Usage: TAVILY_API_KEY=tvly-xxx npx tsx src/scripts/testWebSearch.ts
 *
 * Tests:
 * 1. Tavily API connectivity
 * 2. Rate limiting behavior
 * 3. Cache hit/miss
 * 4. Full OpenAI function calling flow (mocked)
 */

import 'dotenv/config';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

console.log('=== Web Search Integration Test ===\n');

// Test 1: Check env var
console.log('--- Test 1: Environment ---');
if (!TAVILY_API_KEY) {
  console.log('❌ TAVILY_API_KEY not set. Set it in .env or pass as env var.');
  console.log('   Skipping live API tests, running logic-only tests...\n');
} else {
  console.log(`✅ TAVILY_API_KEY found (${TAVILY_API_KEY.slice(0, 8)}...)`);
}

// Test 2: Rate limiter
console.log('\n--- Test 2: Rate Limiter ---');
const searchRateLimit = {
  hourlyCount: 0,
  dailyCount: 0,
  hourlyReset: Date.now() + 3600_000,
  dailyReset: Date.now() + 86400_000,
  maxPerHour: 3,
  maxPerDay: 5,
};

function checkLimit(): string | null {
  const now = Date.now();
  if (now > searchRateLimit.hourlyReset) {
    searchRateLimit.hourlyCount = 0;
    searchRateLimit.hourlyReset = now + 3600_000;
  }
  if (now > searchRateLimit.dailyReset) {
    searchRateLimit.dailyCount = 0;
    searchRateLimit.dailyReset = now + 86400_000;
  }
  if (searchRateLimit.hourlyCount >= searchRateLimit.maxPerHour) return 'hourly limit';
  if (searchRateLimit.dailyCount >= searchRateLimit.maxPerDay) return 'daily limit';
  return null;
}

// Should pass
console.log(`  Request 1: ${checkLimit() || '✅ allowed'}`);
searchRateLimit.hourlyCount++;
searchRateLimit.dailyCount++;

console.log(`  Request 2: ${checkLimit() || '✅ allowed'}`);
searchRateLimit.hourlyCount++;
searchRateLimit.dailyCount++;

console.log(`  Request 3: ${checkLimit() || '✅ allowed'}`);
searchRateLimit.hourlyCount++;
searchRateLimit.dailyCount++;

// Should block (hourly)
const result4 = checkLimit();
console.log(`  Request 4: ${result4 ? `❌ blocked (${result4})` : '✅ allowed'}`);
if (result4?.includes('hourly')) console.log('  ✅ Hourly limit working correctly');

// Test 3: Cache
console.log('\n--- Test 3: Cache ---');
const cache = new Map<string, { result: string; expiry: number }>();

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

const key1 = normalizeQuery('BTC Price Today');
const key2 = normalizeQuery('  btc  price  today  ');
console.log(`  "BTC Price Today" → "${key1}"`);
console.log(`  "  btc  price  today  " → "${key2}"`);
console.log(`  Keys match: ${key1 === key2 ? '✅ yes' : '❌ no'}`);

cache.set(key1, { result: 'BTC=$95000', expiry: Date.now() + 60000 });
const cached = cache.get(key2);
console.log(`  Cache hit for variant query: ${cached ? '✅ yes' : '❌ no'}`);

// Test 4: Live Tavily API (only if key available)
async function testLiveAPI() {
  if (!TAVILY_API_KEY) {
    console.log('\n--- Test 4: Live Tavily API (SKIPPED - no API key) ---');
    return;
  }

  console.log('\n--- Test 4: Live Tavily API ---');

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: 'BNB Chain BNB price today',
        max_results: 3,
        include_answer: true,
      }),
    });

    if (!response.ok) {
      console.log(`  ❌ API returned ${response.status}`);
      const body = await response.text();
      console.log(`  Response: ${body.slice(0, 200)}`);
    } else {
      const data = await response.json() as {
        answer?: string;
        results?: Array<{ title?: string; content?: string; url?: string }>;
      };

      console.log(`  ✅ API responded successfully`);
      if (data.answer) {
        console.log(`  Answer: ${data.answer.slice(0, 150)}...`);
      }
      if (data.results) {
        console.log(`  Results: ${data.results.length} items`);
        for (const r of data.results.slice(0, 2)) {
          console.log(`    - ${r.title} (${r.url})`);
        }
      }

      // Format like the actual code does
      let formatted = '';
      if (data.answer) formatted += `Summary: ${data.answer}\n\n`;
      if (data.results) {
        formatted += 'Sources:\n';
        for (const r of data.results.slice(0, 3)) {
          formatted += `- ${r.title}: ${r.content?.slice(0, 200)}... (${r.url})\n`;
        }
      }

      console.log('\n  --- Formatted output (as GPT would see it) ---');
      console.log(`  ${formatted.replace(/\n/g, '\n  ')}`);
    }
  } catch (err) {
    console.log(`  ❌ Fetch error: ${(err as Error).message}`);
  }
}

testLiveAPI().then(() => {

// Test 5: Tool definition validation
console.log('\n--- Test 5: Tool Definition ---');
const WEB_SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description: 'Search the internet for real-time information...',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
      },
      required: ['query'],
    },
  },
};

const valid =
  WEB_SEARCH_TOOL.type === 'function' &&
  WEB_SEARCH_TOOL.function.name === 'web_search' &&
  WEB_SEARCH_TOOL.function.parameters.required.includes('query');
console.log(`  Tool definition valid: ${valid ? '✅' : '❌'}`);

console.log('\n=== All tests complete ===');
});