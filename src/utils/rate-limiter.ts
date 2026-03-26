/**
 * MASEL Rate Limiting Service
 * API 限流保护和退避机制
 */

// ============================================================================
// 限流配置
// ============================================================================

interface RateLimitConfig {
  max_requests_per_minute: number;
  max_requests_per_hour: number;
  max_concurrent_requests: number;
  backoff_strategy: 'fixed' | 'exponential' | 'linear';
  initial_retry_delay_ms: number;
  max_retry_delay_ms: number;
  max_retries: number;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  max_requests_per_minute: 30,
  max_requests_per_hour: 500,
  max_concurrent_requests: 5,
  backoff_strategy: 'exponential',
  initial_retry_delay_ms: 1000,
  max_retry_delay_ms: 60000,
  max_retries: 3
};

// ============================================================================
// 请求追踪
// ============================================================================

interface RequestRecord {
  timestamp: number;
  task_id: string;
  success: boolean;
  retry_count: number;
}

class RateLimiter {
  private requests: RequestRecord[] = [];
  private concurrentRequests = 0;
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  }

  /**
   * 检查是否可以发起请求
   */
  canMakeRequest(): {
    allowed: boolean;
    reason?: string;
    wait_time_ms?: number;
  } {
    const now = Date.now();

    // 清理过期记录
    this.cleanupOldRecords(now);

    // 检查并发限制
    if (this.concurrentRequests >= this.config.max_concurrent_requests) {
      return {
        allowed: false,
        reason: `Concurrent limit reached: ${this.concurrentRequests}/${this.config.max_concurrent_requests}`
      };
    }

    // 检查每分钟限制
    const requestsLastMinute = this.requests.filter(
      r => now - r.timestamp < 60000
    ).length;
    if (requestsLastMinute >= this.config.max_requests_per_minute) {
      const oldestRequest = this.requests.find(r => now - r.timestamp < 60000);
      const waitTime = oldestRequest ? 60000 - (now - oldestRequest.timestamp) : 60000;
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${requestsLastMinute}/${this.config.max_requests_per_minute} per minute`,
        wait_time_ms: waitTime
      };
    }

    // 检查每小时限制
    const requestsLastHour = this.requests.filter(
      r => now - r.timestamp < 3600000
    ).length;
    if (requestsLastHour >= this.config.max_requests_per_hour) {
      const oldestRequest = this.requests.find(r => now - r.timestamp < 3600000);
      const waitTime = oldestRequest ? 3600000 - (now - oldestRequest.timestamp) : 3600000;
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${requestsLastHour}/${this.config.max_requests_per_hour} per hour`,
        wait_time_ms: waitTime
      };
    }

    return { allowed: true };
  }

  /**
   * 记录请求开始
   */
  startRequest(taskId: string): void {
    this.concurrentRequests++;
    this.requests.push({
      timestamp: Date.now(),
      task_id: taskId,
      success: false,
      retry_count: 0
    });
  }

  /**
   * 记录请求完成
   */
  endRequest(taskId: string, success: boolean): void {
    this.concurrentRequests = Math.max(0, this.concurrentRequests - 1);
    const record = this.requests.find(r => r.task_id === taskId);
    if (record) {
      record.success = success;
    }
  }

  /**
   * 计算退避延迟
   */
  calculateBackoff(retryCount: number): number {
    const { backoff_strategy, initial_retry_delay_ms, max_retry_delay_ms } = this.config;

    let delay: number;

    switch (backoff_strategy) {
      case 'fixed':
        delay = initial_retry_delay_ms;
        break;
      case 'linear':
        delay = initial_retry_delay_ms * (retryCount + 1);
        break;
      case 'exponential':
      default:
        delay = initial_retry_delay_ms * Math.pow(2, retryCount);
        break;
    }

    // 添加随机抖动 (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    delay += jitter;

    return Math.min(delay, max_retry_delay_ms);
  }

  /**
   * 清理过期记录
   */
  private cleanupOldRecords(now: number): void {
    // 保留最近2小时的记录
    const cutoff = now - 7200000;
    this.requests = this.requests.filter(r => r.timestamp > cutoff);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total_requests: number;
    concurrent_requests: number;
    requests_per_minute: number;
    requests_per_hour: number;
    success_rate: number;
  } {
    const now = Date.now();
    this.cleanupOldRecords(now);

    const requestsLastMinute = this.requests.filter(
      r => now - r.timestamp < 60000
    ).length;
    const requestsLastHour = this.requests.filter(
      r => now - r.timestamp < 3600000
    ).length;

    const completedRequests = this.requests.filter(r => r.success !== undefined);
    const successfulRequests = completedRequests.filter(r => r.success);
    const successRate = completedRequests.length > 0
      ? successfulRequests.length / completedRequests.length
      : 1;

    return {
      total_requests: this.requests.length,
      concurrent_requests: this.concurrentRequests,
      requests_per_minute: requestsLastMinute,
      requests_per_hour: requestsLastHour,
      success_rate: successRate
    };
  }
}

// ============================================================================
// 全局限流器实例
// ============================================================================

const globalRateLimiter = new RateLimiter();

// ============================================================================
// 带限流的执行包装器
// ============================================================================

interface RateLimitedResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  retry_count: number;
  total_delay_ms: number;
}

/**
 * 带限流保护的执行函数
 */
export async function executeWithRateLimit<T>(
  fn: () => Promise<T>,
  taskId: string,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitedResult<T>> {
  const limiter = new RateLimiter(config);
  const maxRetries = config?.max_retries ?? DEFAULT_RATE_LIMIT_CONFIG.max_retries;

  let retryCount = 0;
  let totalDelay = 0;

  while (retryCount <= maxRetries) {
    // 检查限流
    const check = limiter.canMakeRequest();

    if (!check.allowed) {
      if (retryCount >= maxRetries) {
        return {
          success: false,
          error: `Rate limit exceeded after ${maxRetries} retries: ${check.reason}`,
          retry_count: retryCount,
          total_delay_ms: totalDelay
        };
      }

      // 等待后重试
      const waitTime = check.wait_time_ms ?? limiter.calculateBackoff(retryCount);
      console.log(`   ⏳ Rate limited, waiting ${waitTime}ms...`);
      await sleep(waitTime);
      totalDelay += waitTime;
      retryCount++;
      continue;
    }

    // 执行请求
    limiter.startRequest(taskId);

    try {
      const result = await fn();
      limiter.endRequest(taskId, true);
      return {
        success: true,
        result,
        retry_count: retryCount,
        total_delay_ms: totalDelay
      };
    } catch (error) {
      limiter.endRequest(taskId, false);

      const errorMessage = error instanceof Error ? error.message : String(error);

      // 检查是否是限流错误
      if (isRateLimitError(errorMessage)) {
        if (retryCount >= maxRetries) {
          return {
            success: false,
            error: `API rate limit hit after ${maxRetries} retries`,
            retry_count: retryCount,
            total_delay_ms: totalDelay
          };
        }

        const delay = limiter.calculateBackoff(retryCount);
        console.log(`   🔄 API rate limit hit, retrying in ${delay}ms...`);
        await sleep(delay);
        totalDelay += delay;
        retryCount++;
      } else {
        // 非限流错误，直接返回
        return {
          success: false,
          error: errorMessage,
          retry_count: retryCount,
          total_delay_ms: totalDelay
        };
      }
    }
  }

  return {
    success: false,
    error: `Max retries exceeded`,
    retry_count: retryCount,
    total_delay_ms: totalDelay
  };
}

/**
 * 检查错误是否是限流错误
 */
function isRateLimitError(errorMessage: string): boolean {
  const rateLimitPatterns = [
    /rate limit/i,
    /too many requests/i,
    /429/i,
    /throttled/i,
    /quota exceeded/i
  ];

  return rateLimitPatterns.some(pattern => pattern.test(errorMessage));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// 批量执行限流
// ============================================================================

/**
 * 批量执行任务，带限流控制
 */
export async function executeBatchWithRateLimit<T>(
  tasks: Array<() => Promise<T>>,
  taskIds: string[],
  config?: Partial<RateLimitConfig>
): Promise<Array<RateLimitedResult<T>>> {
  const results: Array<RateLimitedResult<T>> = [];

  for (let i = 0; i < tasks.length; i++) {
    const result = await executeWithRateLimit(tasks[i], taskIds[i], config);
    results.push(result);

    // 如果限流严重，添加额外延迟
    if (!result.success && result.error?.includes('Rate limit')) {
      await sleep(1000);
    }
  }

  return results;
}

// ============================================================================
// 统计和监控
// ============================================================================

/**
 * 获取限流统计
 */
export function getRateLimitStats(): ReturnType<RateLimiter['getStats']> {
  return globalRateLimiter.getStats();
}

/**
 * 重置限流器（主要用于测试）
 */
export function resetRateLimiter(): void {
  // 创建新的限流器实例
  Object.assign(globalRateLimiter, new RateLimiter());
}

// ============================================================================
// 导出
// ============================================================================

export default {
  RateLimiter,
  executeWithRateLimit,
  executeBatchWithRateLimit,
  getRateLimitStats,
  resetRateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG
};
