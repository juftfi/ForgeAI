/**
 * API Key Pool Manager
 * 支持多个 API Key 轮询、负载均衡和自动故障转移
 */

export interface KeyStatus {
  key: string;
  provider: 'openai' | 'anthropic';
  isAvailable: boolean;
  requestCount: number;
  errorCount: number;
  lastUsed: number;
  lastError: string | null;
  rateLimitedUntil: number | null;
}

export interface KeyPoolConfig {
  openaiKeys?: string[];
  anthropicKeys?: string[];
  strategy?: 'round-robin' | 'least-used' | 'random';
  rateLimitCooldown?: number; // ms to wait after rate limit
  maxErrorsBeforeDisable?: number;
  resetErrorsAfter?: number; // ms to reset error count
}

class KeyPool {
  private openaiKeys: KeyStatus[] = [];
  private anthropicKeys: KeyStatus[] = [];
  private openaiIndex = 0;
  private anthropicIndex = 0;
  private strategy: 'round-robin' | 'least-used' | 'random' = 'round-robin';
  private rateLimitCooldown = 60000; // 1 minute
  private maxErrorsBeforeDisable = 5;
  private resetErrorsAfter = 300000; // 5 minutes

  constructor(config?: KeyPoolConfig) {
    if (config?.strategy) this.strategy = config.strategy;
    if (config?.rateLimitCooldown) this.rateLimitCooldown = config.rateLimitCooldown;
    if (config?.maxErrorsBeforeDisable) this.maxErrorsBeforeDisable = config.maxErrorsBeforeDisable;
    if (config?.resetErrorsAfter) this.resetErrorsAfter = config.resetErrorsAfter;

    // 从环境变量加载 keys
    this.loadKeysFromEnv();

    // 如果配置中提供了 keys，添加它们
    if (config?.openaiKeys) {
      for (const key of config.openaiKeys) {
        this.addKey('openai', key);
      }
    }
    if (config?.anthropicKeys) {
      for (const key of config.anthropicKeys) {
        this.addKey('anthropic', key);
      }
    }
  }

  /**
   * 从环境变量加载 API Keys
   * 支持格式:
   *   OPENAI_API_KEY=sk-xxx (单个)
   *   OPENAI_API_KEYS=sk-xxx,sk-yyy,sk-zzz (多个，逗号分隔)
   */
  private loadKeysFromEnv(): void {
    // OpenAI keys
    const openaiKey = process.env.OPENAI_API_KEY;
    const openaiKeys = process.env.OPENAI_API_KEYS;

    if (openaiKeys) {
      const keys = openaiKeys.split(',').map(k => k.trim()).filter(k => k);
      for (const key of keys) {
        this.addKey('openai', key);
      }
    } else if (openaiKey) {
      this.addKey('openai', openaiKey);
    }

    // Anthropic keys
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const anthropicKeys = process.env.ANTHROPIC_API_KEYS;

    if (anthropicKeys) {
      const keys = anthropicKeys.split(',').map(k => k.trim()).filter(k => k);
      for (const key of keys) {
        this.addKey('anthropic', key);
      }
    } else if (anthropicKey) {
      this.addKey('anthropic', anthropicKey);
    }
  }

  /**
   * 添加 API Key
   */
  addKey(provider: 'openai' | 'anthropic', key: string): void {
    const keyList = provider === 'openai' ? this.openaiKeys : this.anthropicKeys;

    // 检查是否已存在
    if (keyList.some(k => k.key === key)) {
      return;
    }

    keyList.push({
      key,
      provider,
      isAvailable: true,
      requestCount: 0,
      errorCount: 0,
      lastUsed: 0,
      lastError: null,
      rateLimitedUntil: null,
    });

    console.log(`[KeyPool] Added ${provider} key: ${this.maskKey(key)} (total: ${keyList.length})`);
  }

  /**
   * 获取下一个可用的 API Key
   */
  getKey(provider: 'openai' | 'anthropic'): string | null {
    const keyList = provider === 'openai' ? this.openaiKeys : this.anthropicKeys;

    if (keyList.length === 0) {
      return null;
    }

    // 重置长时间未出错的 keys
    const now = Date.now();
    for (const key of keyList) {
      if (!key.isAvailable && key.errorCount > 0) {
        if (now - key.lastUsed > this.resetErrorsAfter) {
          key.isAvailable = true;
          key.errorCount = 0;
          console.log(`[KeyPool] Reset key: ${this.maskKey(key.key)}`);
        }
      }
      // 检查限流是否已过期
      if (key.rateLimitedUntil && now > key.rateLimitedUntil) {
        key.rateLimitedUntil = null;
        key.isAvailable = true;
      }
    }

    // 获取可用的 keys
    const availableKeys = keyList.filter(k => k.isAvailable && !k.rateLimitedUntil);

    if (availableKeys.length === 0) {
      // 所有 key 都不可用，尝试获取限流时间最短的
      const rateLimitedKeys = keyList.filter(k => k.rateLimitedUntil);
      if (rateLimitedKeys.length > 0) {
        rateLimitedKeys.sort((a, b) => (a.rateLimitedUntil || 0) - (b.rateLimitedUntil || 0));
        const nextAvailable = rateLimitedKeys[0];
        const waitTime = (nextAvailable.rateLimitedUntil || 0) - now;
        console.log(`[KeyPool] All keys rate limited. Next available in ${waitTime}ms`);
      }
      return null;
    }

    let selectedKey: KeyStatus;

    switch (this.strategy) {
      case 'least-used':
        // 选择使用次数最少的
        selectedKey = availableKeys.reduce((min, k) =>
          k.requestCount < min.requestCount ? k : min
        );
        break;

      case 'random':
        // 随机选择
        selectedKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
        break;

      case 'round-robin':
      default:
        // 轮询
        if (provider === 'openai') {
          this.openaiIndex = this.openaiIndex % availableKeys.length;
          selectedKey = availableKeys[this.openaiIndex];
          this.openaiIndex++;
        } else {
          this.anthropicIndex = this.anthropicIndex % availableKeys.length;
          selectedKey = availableKeys[this.anthropicIndex];
          this.anthropicIndex++;
        }
        break;
    }

    selectedKey.requestCount++;
    selectedKey.lastUsed = now;

    return selectedKey.key;
  }

  /**
   * 报告 Key 使用成功
   */
  reportSuccess(provider: 'openai' | 'anthropic', key: string): void {
    const keyStatus = this.findKey(provider, key);
    if (keyStatus) {
      // 成功使用后减少错误计数
      if (keyStatus.errorCount > 0) {
        keyStatus.errorCount = Math.max(0, keyStatus.errorCount - 1);
      }
    }
  }

  /**
   * 报告 Key 使用失败
   */
  reportError(provider: 'openai' | 'anthropic', key: string, error: string, isRateLimit = false): void {
    const keyStatus = this.findKey(provider, key);
    if (!keyStatus) return;

    keyStatus.errorCount++;
    keyStatus.lastError = error;
    keyStatus.lastUsed = Date.now();

    if (isRateLimit) {
      // 限流：暂时禁用
      keyStatus.rateLimitedUntil = Date.now() + this.rateLimitCooldown;
      console.log(`[KeyPool] Rate limited: ${this.maskKey(key)} until ${new Date(keyStatus.rateLimitedUntil).toISOString()}`);
    } else if (keyStatus.errorCount >= this.maxErrorsBeforeDisable) {
      // 错误过多：禁用
      keyStatus.isAvailable = false;
      console.log(`[KeyPool] Disabled key due to errors: ${this.maskKey(key)} (errors: ${keyStatus.errorCount})`);
    }
  }

  /**
   * 获取 Key 池状态
   */
  getStatus(): { openai: KeyStatus[]; anthropic: KeyStatus[] } {
    return {
      openai: this.openaiKeys.map(k => ({
        ...k,
        key: this.maskKey(k.key),
      })),
      anthropic: this.anthropicKeys.map(k => ({
        ...k,
        key: this.maskKey(k.key),
      })),
    };
  }

  /**
   * 获取可用 Key 数量
   */
  getAvailableCount(provider: 'openai' | 'anthropic'): number {
    const keyList = provider === 'openai' ? this.openaiKeys : this.anthropicKeys;
    return keyList.filter(k => k.isAvailable && !k.rateLimitedUntil).length;
  }

  /**
   * 获取总 Key 数量
   */
  getTotalCount(provider: 'openai' | 'anthropic'): number {
    return (provider === 'openai' ? this.openaiKeys : this.anthropicKeys).length;
  }

  private findKey(provider: 'openai' | 'anthropic', key: string): KeyStatus | undefined {
    const keyList = provider === 'openai' ? this.openaiKeys : this.anthropicKeys;
    return keyList.find(k => k.key === key);
  }

  private maskKey(key: string): string {
    if (key.length <= 8) return '***';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
}

// 单例实例
let keyPoolInstance: KeyPool | null = null;

export function getKeyPool(config?: KeyPoolConfig): KeyPool {
  if (!keyPoolInstance) {
    keyPoolInstance = new KeyPool(config);
  }
  return keyPoolInstance;
}

export function resetKeyPool(): void {
  keyPoolInstance = null;
}
