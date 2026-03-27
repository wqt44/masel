/**
 * Viking Memory Lite
 * 
 * 轻量级记忆系统 - 简单任务也能使用 MASEL-Viking 记忆方法
 * 无需完整 MASEL 流程，只使用记忆功能
 */

import { VikingManager, ErrorRecord } from "../memory/viking-store.js";

// ============================================================================
// 轻量级记忆接口
// ============================================================================

interface LiteMemoryConfig {
  agent_type: string;           // 代理类型: "coder" | "researcher" | "reviewer" | "assistant"
  enable_hot?: boolean;         // 启用 Hot Memory (默认 true)
  enable_warm?: boolean;        // 启用 Warm Memory (默认 true)
  context_prefix?: string;      // 上下文前缀，用于分类
}

interface TaskRecord {
  task_id: string;
  description: string;
  result: "success" | "failure" | "partial";
  output?: string;
  error?: string;
  duration_ms: number;
  metadata?: Record<string, any>;
}

interface MemoryHint {
  type: "warning" | "tip" | "pattern";
  message: string;
  source: string;  // 来自哪个历史记录
  confidence: number;
}

// ============================================================================
// Viking Lite 主类
// ============================================================================

export class VikingLite {
  private viking: VikingManager;
  private config: LiteMemoryConfig;
  private currentTaskId: string | null = null;

  constructor(config: LiteMemoryConfig) {
    this.config = {
      enable_hot: true,
      enable_warm: true,
      ...config
    };
    this.viking = new VikingManager();
  }

  /**
   * 开始记录一个任务
   */
  startTask(description: string): string {
    this.currentTaskId = `lite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`📝 [VikingLite] Task started: ${description.substring(0, 50)}...`);
    
    return this.currentTaskId;
  }

  /**
   * 记录成功的任务
   */
  async recordSuccess(output: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.currentTaskId) {
      console.warn("[VikingLite] No active task to record");
      return;
    }

    const record: TaskRecord = {
      task_id: this.currentTaskId,
      description: this.getTaskDescription(),
      result: "success",
      output: output.substring(0, 1000), // 限制大小
      duration_ms: 0, // 可由外部传入
      metadata
    };

    // 存储为 Warm Memory（成功记录也保存，用于模式学习）
    if (this.config.enable_warm) {
      await this.storeAsWarmMemory(record);
    }

    console.log(`✅ [VikingLite] Task recorded: ${this.currentTaskId}`);
    this.currentTaskId = null;
  }

  /**
   * 记录失败的任务
   */
  async recordFailure(error: Error | string, context?: Record<string, any>): Promise<void> {
    if (!this.currentTaskId) {
      console.warn("[VikingLite] No active task to record");
      return;
    }

    const errorMessage = error instanceof Error ? error.message : error;
    const errorType = error instanceof Error ? error.constructor.name : "UnknownError";

    const errorRecord: ErrorRecord = {
      error_id: `err-${this.currentTaskId}`,
      task_id: this.currentTaskId,
      subtask_id: "main",
      agent_type: this.config.agent_type,
      timestamp: new Date().toISOString(),
      error_type: errorType,
      error_message: errorMessage,
      context: {
        task_description: this.getTaskDescription(),
        subtask_name: "main",
        inputs: context
      }
    };

    // 使用完整的 Viking 存储（三层）
    await this.viking.storeError(errorRecord);

    console.log(`❌ [VikingLite] Error recorded: ${errorType}`);
    this.currentTaskId = null;
  }

  /**
   * 获取相关记忆提示
   * 在执行任务前调用，获取历史经验教训
   */
  async getHints(taskDescription: string): Promise<MemoryHint[]> {
    const hints: MemoryHint[] = [];

    // 1. 搜索相关错误
    const relevantErrors = await this.viking.searchRelevant(
      this.config.agent_type,
      taskDescription,
      5
    );

    for (const error of relevantErrors) {
      if (error.solution) {
        hints.push({
          type: "warning",
          message: `之前遇到过: ${error.error_message}. 解决方法: ${error.solution}`,
          source: error.error_id,
          confidence: 0.8
        });
      } else if (error.prevention) {
        hints.push({
          type: "tip",
          message: `建议: ${error.prevention}`,
          source: error.error_id,
          confidence: 0.7
        });
      }
    }

    // 2. 搜索成功模式
    const successPatterns = await this.searchSuccessPatterns(taskDescription);
    hints.push(...successPatterns);

    console.log(`💡 [VikingLite] Found ${hints.length} hints`);
    return hints;
  }

  /**
   * 快速记录 - 一行代码记录完整任务
   */
  async quickRecord<T>(
    description: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    this.startTask(description);

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      await this.recordSuccess(String(result), { duration_ms: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await this.recordFailure(error as Error, { duration_ms: duration });
      throw error;
    }
  }

  /**
   * 获取记忆统计
   */
  async getStats(): Promise<{
    recent_errors: number;
    today_errors: number;
    hints_available: boolean;
  }> {
    const stats = await this.viking.getStatistics();
    
    return {
      recent_errors: stats.hot_count,
      today_errors: stats.total_today,
      hints_available: stats.hot_count > 0 || stats.total_today > 0
    };
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  private getTaskDescription(): string {
    // 简化版，实际可以从上下文获取
    return this.currentTaskId || "unknown";
  }

  private async storeAsWarmMemory(record: TaskRecord): Promise<void> {
    const { write } = await import("../utils/openclaw-api.js");
    
    const date = new Date().toISOString().split('T')[0];
    const filePath = `memory/viking/success/${this.config.agent_type}/${date}/${record.task_id}.json`;
    
    try {
      await write({
        path: filePath,
        content: JSON.stringify(record, null, 2)
      });
    } catch (err) {
      console.warn(`[VikingLite] Failed to store success record: ${err}`);
    }
  }

  private async searchSuccessPatterns(taskDescription: string): Promise<MemoryHint[]> {
    // 简化实现 - 搜索成功记录中的模式
    const hints: MemoryHint[] = [];
    
    // 这里可以实现更复杂的模式匹配
    // 比如：如果任务包含 "fetch"，检查之前成功的 fetch 任务有什么共同点
    
    return hints;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 VikingLite 实例
 */
export function createMemory(agentType: string, contextPrefix?: string): VikingLite {
  return new VikingLite({
    agent_type: agentType,
    context_prefix: contextPrefix
  });
}

/**
 * 带记忆的执行任务
 * 
 * 示例:
 * ```typescript
 * const result = await withMemory("coder", "解析JSON文件", async () => {
 *   // 你的任务代码
 *   return parseJson(data);
 * });
 * ```
 */
export async function withMemory<T>(
  agentType: string,
  taskDescription: string,
  fn: () => Promise<T>,
  options?: {
    showHints?: boolean;
    onError?: (error: Error, hints: MemoryHint[]) => void;
  }
): Promise<T> {
  const memory = createMemory(agentType);
  
  // 1. 获取历史提示
  const hints = await memory.getHints(taskDescription);
  
  if (options?.showHints && hints.length > 0) {
    console.log("\n💡 历史提示:");
    hints.forEach(h => console.log(`   [${h.type}] ${h.message}`));
  }

  // 2. 执行任务
  const startTime = Date.now();
  memory.startTask(taskDescription);

  try {
    const result = await fn();
    
    await memory.recordSuccess(String(result), {
      duration_ms: Date.now() - startTime,
      hints_used: hints.length
    });
    
    return result;
  } catch (error) {
    await memory.recordFailure(error as Error, {
      duration_ms: Date.now() - startTime,
      hints_available: hints.length
    });
    
    if (options?.onError) {
      options.onError(error as Error, hints);
    }
    
    throw error;
  }
}

// ============================================================================
// 导出
// ============================================================================

export default VikingLite;
