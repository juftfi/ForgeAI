/**
 * AI Client Service
 * Supports OpenAI and Anthropic APIs for chat and embeddings
 */

import { AIMessage, ChatOptions, EmbeddingResult } from '../types/chat.js';

export type AIProvider = 'openai' | 'anthropic';

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  embeddingModel?: string;
  baseUrl?: string;
}

export class AIClient {
  private config: AIConfig;
  private defaultModel: string;
  private defaultEmbeddingModel: string;

  constructor(config?: Partial<AIConfig>) {
    const provider = (config?.provider || process.env.AI_PROVIDER || 'openai') as AIProvider;

    this.config = {
      provider,
      apiKey: config?.apiKey || this.getApiKey(provider),
      model: config?.model,
      embeddingModel: config?.embeddingModel,
      baseUrl: config?.baseUrl,
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

  private getApiKey(provider: AIProvider): string {
    if (provider === 'openai') {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY environment variable is required');
      return key;
    } else {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('ANTHROPIC_API_KEY environment variable is required');
      return key;
    }
  }

  /**
   * Send a chat request to the AI
   */
  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (this.config.provider === 'openai') {
          return await this.chatOpenAI(messages, options);
        } else {
          return await this.chatAnthropic(messages, options);
        }
      } catch (error) {
        lastError = error as Error;
        console.error(`AI chat attempt ${attempt + 1} failed:`, error);

        // Don't retry on auth errors
        if ((error as any)?.status === 401) {
          throw error;
        }

        // Wait before retry with exponential backoff
        if (attempt < maxRetries - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('AI chat failed after retries');
  }

  private async chatOpenAI(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    const model = this.config.model || this.defaultModel;
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
        stop: options?.stopSequences,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async chatAnthropic(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    const model = this.config.model || this.defaultModel;
    const baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1';

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
        'x-api-key': this.config.apiKey,
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

    const data = await response.json();
    return data.content[0]?.text || '';
  }

  /**
   * Generate embeddings for text (for semantic search)
   * Falls back to OpenAI for Anthropic provider since Anthropic doesn't have embeddings
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const apiKey = this.config.provider === 'openai'
      ? this.config.apiKey
      : process.env.OPENAI_API_KEY;

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
      throw new Error(`OpenAI Embeddings API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      embedding: data.data[0]?.embedding || [],
      tokenCount: data.usage?.total_tokens || 0,
    };
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
