/**
 * MASEL Resilience Service
 * 失败重试和优雅降级
 */

interface RetryConfig {
  max_retries: number;        // 最大重试次数
  retry_delay_ms: number;     // 重试间隔
  fallback_to_main: boolean;  // 失败后是否降级到主代理
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_retries: 2,
  retry_delay_ms: 1000,
  fallback_to_main: true
};

/**
 * 带重试的执行器
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<{
  success: boolean;
  result?: T;
  error?: string;
  attempts: number;
}> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: string = '';

  for (let attempt = 1; attempt <= cfg.max_retries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${cfg.max_retries}...`);
      const result = await fn();
      return { success: true, result, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(`   Attempt ${attempt} failed: ${lastError}`);

      if (attempt < cfg.max_retries) {
        console.log(`   Retrying in ${cfg.retry_delay_ms}ms...`);
        await sleep(cfg.retry_delay_ms);
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: cfg.max_retries
  };
}

/**
 * 优雅降级：子代理失败 → 主代理接管
 */
export async function executeWithFallback(
  subtask: any,
  taskId: string,
  mainAgentExecutor: (task: string) => Promise<string>
): Promise<{
  success: boolean;
  output: string;
  used_fallback: boolean;
  error?: string;
}> {
  // 1. 尝试子代理执行（带重试）
  const subagentResult = await executeWithRetry(
    () => executeSubtask(subtask, taskId),
    { max_retries: 2 }
  );

  if (subagentResult.success) {
    return {
      success: true,
      output: subagentResult.result!.output,
      used_fallback: false
    };
  }

  // 2. 子代理失败，降级到主代理
  console.log('   🔄 Sub-agent failed, falling back to main agent...');

  const fallbackResult = await executeWithRetry(
    () => mainAgentExecutor(subtask.description),
    { max_retries: 1 }
  );

  if (fallbackResult.success) {
    return {
      success: true,
      output: fallbackResult.result!,
      used_fallback: true
    };
  }

  // 3. 都失败了
  return {
    success: false,
    output: '',
    used_fallback: true,
    error: `Sub-agent: ${subagentResult.error}; Main agent: ${fallbackResult.error}`
  };
}

/**
 * 部分成功处理：合并成功结果，标记失败部分
 */
export function handlePartialSuccess(
  results: any[]
): {
  status: 'completed' | 'partial' | 'failed';
  success_count: number;
  failed_count: number;
  merged_output: string;
  failed_subtasks: string[];
} {
  const successResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);

  const status = failedResults.length === 0
    ? 'completed'
    : successResults.length === 0
      ? 'failed'
      : 'partial';

  return {
    status,
    success_count: successResults.length,
    failed_count: failedResults.length,
    merged_output: successResults.map(r => r.output).join('\n\n---\n\n'),
    failed_subtasks: failedResults.map(r => r.subtask_id || 'unknown')
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 模拟子代理执行
async function executeSubtask(subtask: any, taskId: string): Promise<any> {
  // 实际实现会调用 sessions_spawn
  throw new Error('Not implemented - placeholder');
}

export default {
  executeWithRetry,
  executeWithFallback,
  handlePartialSuccess
};
