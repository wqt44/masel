/**
 * MASEL Execute Tool
 * 
 * Executes subtasks with parallel sub-agents and Worktree isolation
 */

import {
  sessions_spawn,
  write,
  read,
  exec
} from "../utils/openclaw-api.js";
import { VikingManager, ErrorRecord } from "../memory/viking-store.js";
import { smartCleanup } from "../utils/cleanup.js";
import { executeWithFallback, handlePartialSuccess } from "../utils/resilience.js";
import { scanCode, reviewSubAgentCode, executeInSandbox } from "../utils/security.js";
import { sanitizeForStorage } from "../utils/privacy.js";
import { initRootContext, createChildContext, cleanupContext } from "../utils/depth-limiter.js";
import { executeWithRateLimit } from "../utils/rate-limiter.js";
import { contextAwareSecurityCheck } from "../utils/smart-config.js";

interface ExecuteOptions {
  plan: ExecutionPlan;
  options?: {
    parallel?: boolean;
    checkpoint?: boolean;
    worktree_isolation?: boolean;
    silent?: boolean;  // 静默模式：不输出中间步骤
    enable_cleanup?: boolean;  // 执行后自动清理
    enable_fallback?: boolean; // 启用失败降级
    enable_security?: boolean; // 启用安全检查
  };
}

interface ExecutionPlan {
  task_id: string;
  original_task: string;
  subtasks: Subtask[];
}

interface Subtask {
  id: string;
  name: string;
  description: string;
  agent_type: "coder" | "researcher" | "reviewer";
  dependencies: string[];
  estimated_time: number;
  test_cases?: any[];
}

interface SubtaskResult {
  subtask_id: string;
  success: boolean;
  output: string;
  error?: string;
  execution_time: number;
  worktree_path?: string;
  checkpoint_id?: string;
}

interface ExecutionResult {
  task_id: string;
  status: "completed" | "failed" | "partial";
  results: SubtaskResult[];
  total_execution_time: number;
  summary: string;
}

/**
 * Main entry point for masel_execute tool
 */
export async function maselExecute(options: ExecuteOptions): Promise<ExecutionResult> {
  const { plan, options: execOptions = {} } = options;
  const {
    parallel = false,
    checkpoint = true,
    worktree_isolation = true,
    silent = false,
    enable_cleanup = true,    // 默认启用自动清理
    enable_fallback = true,   // 默认启用失败降级
    enable_security = true    // 默认启用安全检查
  } = execOptions;

  const log = silent ? () => {} : console.log;

  // P1: 初始化深度限制上下文
  initRootContext(plan.task_id);

  log(`🚀 MASEL Execute: Starting execution...`);
  log(`   Task ID: ${plan.task_id}`);
  log(`   Subtasks: ${plan.subtasks.length}`);
  log(`   Parallel: ${parallel}`);
  log(`   Worktree isolation: ${worktree_isolation}`);
  log(`   Silent mode: ${silent}`);
  log(`   Auto cleanup: ${enable_cleanup}`);
  log(`   Fallback: ${enable_fallback}`);
  log(`   Security: ${enable_security}`);
  
  const startTime = Date.now();
  const results: SubtaskResult[] = [];
  const completedSubtasks = new Set<string>();
  
  // Build dependency graph
  const dependencyGraph = buildDependencyGraph(plan.subtasks);
  
  // Execute subtasks
  if (parallel) {
    // Parallel execution: execute subtasks without dependencies in parallel
    await executeParallel(
      plan,
      dependencyGraph,
      results,
      completedSubtasks,
      worktree_isolation,
      silent
    );
  } else {
    // Sequential execution: execute in order respecting dependencies
    await executeSequential(
      plan,
      dependencyGraph,
      results,
      completedSubtasks,
      worktree_isolation,
      silent
    );
  }
  
  const totalExecutionTime = Date.now() - startTime;

  // Handle partial success with new resilience logic
  const partialResult = handlePartialSuccess(results);
  const status = partialResult.status;

  // Generate summary
  const summary = generateSummary(results, status);

  const executionResult: ExecutionResult = {
    task_id: plan.task_id,
    status,
    results,
    total_execution_time: totalExecutionTime,
    summary
  };

  // Save execution result
  await saveExecutionResult(executionResult);

  // Auto cleanup if enabled (smart cleanup v2)
  if (enable_cleanup) {
    log(`\n🧹 Smart cleanup...`);
    try {
      const cleanupResult = await smartCleanup({
        dry_run: false,  // 实际执行
        force: silent    // 静默模式下强制清理，不提示
      });
      if (cleanupResult.files_deleted > 0) {
        log(`   Protected: ${cleanupResult.files_protected} files`);
        log(`   Deleted: ${cleanupResult.files_deleted} files`);
        log(`   Freed: ${(cleanupResult.space_freed / 1024 / 1024).toFixed(2)} MB`);
      } else {
        log(`   No files to cleanup`);
      }
    } catch (error) {
      log(`   Cleanup skipped: ${error}`);
    }
  }

  log(`\n✅ Execution ${status}`);
  log(`   Total time: ${(totalExecutionTime / 1000).toFixed(2)}s`);
  log(`   Success: ${partialResult.success_count}/${results.length}`);

  if (partialResult.failed_count > 0) {
    log(`   Failed subtasks: ${partialResult.failed_subtasks.join(', ')}`);
  }

  // P1: 清理深度限制上下文
  cleanupContext(plan.task_id);

  // P1: 脱敏结果（隐私保护）
  if (enable_security) {
    const sanitizedResult = sanitizeForStorage(executionResult);
    return sanitizedResult;
  }

  return executionResult;
}

/**
 * Build dependency graph from subtasks
 */
function buildDependencyGraph(subtasks: Subtask[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  
  for (const subtask of subtasks) {
    graph.set(subtask.id, subtask.dependencies);
  }
  
  return graph;
}

/**
 * Execute subtasks sequentially respecting dependencies
 */
async function executeSequential(
  plan: ExecutionPlan,
  dependencyGraph: Map<string, string[]>,
  results: SubtaskResult[],
  completedSubtasks: Set<string>,
  worktree_isolation: boolean,
  silent: boolean = false
): Promise<void> {
  const pendingSubtasks = [...plan.subtasks];
  
  while (pendingSubtasks.length > 0) {
    // Find subtask with all dependencies satisfied
    const executableIndex = pendingSubtasks.findIndex(st => 
      st.dependencies.every(dep => completedSubtasks.has(dep))
    );
    
    if (executableIndex === -1) {
      // Deadlock or circular dependency
      throw new Error("Dependency resolution failed - possible circular dependency");
    }
    
    const subtask = pendingSubtasks.splice(executableIndex, 1)[0];
    
    // Execute subtask
    const result = await executeSubtask(
      subtask,
      plan.task_id,
      worktree_isolation,
      silent
    );
    
    results.push(result);
    
    if (result.success) {
      completedSubtasks.add(subtask.id);
    } else {
      // Record error for learning
      await recordError(plan.task_id, subtask, result);
      
      // Continue with other subtasks or stop?
      // For now, continue but mark as failed
      console.warn(`   ⚠ Subtask ${subtask.id} failed, continuing...`);
      completedSubtasks.add(subtask.id); // Mark as completed to unblock dependents
    }
  }
}

/**
 * Execute subtasks in parallel where possible
 */
async function executeParallel(
  plan: ExecutionPlan,
  dependencyGraph: Map<string, string[]>,
  results: SubtaskResult[],
  completedSubtasks: Set<string>,
  worktree_isolation: boolean,
  silent: boolean = false
): Promise<void> {
  const pendingSubtasks = [...plan.subtasks];
  const executingPromises = new Map<string, Promise<SubtaskResult>>();
  
  while (pendingSubtasks.length > 0 || executingPromises.size > 0) {
    // Find all subtasks with satisfied dependencies
    const executableSubtasks = pendingSubtasks.filter(st => 
      st.dependencies.every(dep => completedSubtasks.has(dep))
    );
    
    // Start executing them
    for (const subtask of executableSubtasks) {
      // Remove from pending
      const index = pendingSubtasks.indexOf(subtask);
      pendingSubtasks.splice(index, 1);
      
      // Start execution
      const promise = executeSubtask(
        subtask,
        plan.task_id,
        worktree_isolation,
        silent
      );
      
      executingPromises.set(subtask.id, promise);
    }
    
    // Wait for at least one to complete
    if (executingPromises.size > 0) {
      const [completedId, result] = await waitForAny(executingPromises);
      executingPromises.delete(completedId);
      
      results.push(result);
      
      if (result.success) {
        completedSubtasks.add(completedId);
      } else {
        await recordError(plan.task_id, 
          plan.subtasks.find(st => st.id === completedId)!, 
          result
        );
        completedSubtasks.add(completedId); // Unblock dependents
      }
    }
  }
}

/**
 * Wait for any promise to complete
 */
async function waitForAny(
  promises: Map<string, Promise<SubtaskResult>>
): Promise<[string, SubtaskResult]> {
  const entries = Array.from(promises.entries());
  const results = await Promise.race(
    entries.map(async ([id, promise]) => {
      const result = await promise;
      return [id, result] as [string, SubtaskResult];
    })
  );
  return results;
}

/**
 * Execute a single subtask
 */
async function executeSubtask(
  subtask: Subtask,
  taskId: string,
  worktree_isolation: boolean,
  silent: boolean = false,
  enable_security: boolean = true
): Promise<SubtaskResult> {
  const log = silent ? () => {} : console.log;
  log(`\n📋 Executing: ${subtask.name}`);
  log(`   Agent: ${subtask.agent_type}`);
  log(`   Estimated: ${subtask.estimated_time} minutes`);

  // P1: 检查深度限制
  const subtaskId = `${taskId}-${subtask.id}`;
  const depthCheck = createChildContext(taskId, subtaskId);
  if (!depthCheck.allowed) {
    log(`   ❌ Depth limit: ${depthCheck.reason}`);
    return {
      subtask_id: subtask.id,
      success: false,
      output: '',
      error: `Depth limit exceeded: ${depthCheck.reason}`,
      execution_time: 0
    };
  }

  const startTime = Date.now();

  // Create worktree if isolation enabled
  let worktreePath: string | undefined;
  if (worktree_isolation) {
    worktreePath = await createWorktree(taskId, subtask.id);
    log(`   Worktree: ${worktreePath}`);
  }

  try {
    // Load agent soul
    const soul = await loadAgentSoul(subtask.agent_type);

    // Search for relevant historical errors
    const similarErrors = await searchSimilarErrors(subtask);

    // Build task prompt
    const prompt = buildTaskPrompt(subtask, soul, similarErrors);

    // Security: Scan prompt for injection attempts
    if (enable_security) {
      log(`   🔒 Security scan...`);
      const securityScan = await scanCode(prompt, 'unknown');
      if (!securityScan.safe) {
        const criticalThreats = securityScan.threats.filter(t => t.level === 'critical');
        if (criticalThreats.length > 0) {
          log(`   ❌ Security violation: ${criticalThreats.map(t => t.message).join(', ')}`);
          throw new Error(`Security violation: ${criticalThreats[0].message}`);
        }
      }
      log(`   ✅ Security check passed`);
    }

    // P2: Execute with rate limiting protection
    const rateLimitResult = await executeWithRateLimit(
      () => sessions_spawn({
        task: prompt,
        runtime: "subagent",
        mode: "run",
        timeoutSeconds: subtask.estimated_time * 60,
        masel_context: {
          task_id: taskId,
          subtask_id: subtask.id,
          agent_type: subtask.agent_type,
          worktree_path: worktreePath
        }
      }),
      subtaskId,
      {
        max_requests_per_minute: 20,  // 子代理限制更严格
        max_retries: 2
      }
    );

    if (!rateLimitResult.success) {
      throw new Error(`Rate limit or API error: ${rateLimitResult.error}`);
    }

    const result = rateLimitResult.result!;

    // Security: Review sub-agent output if it contains code
    if (enable_security && result.success && result.output) {
      const looksLikeCode = /^(const|let|var|function|import|def|class)\s/m.test(result.output) ||
                            result.output.includes('```');
      if (looksLikeCode) {
        log(`   🔒 Reviewing generated code...`);
        const codeReview = await reviewSubAgentCode(
          result.output,
          subtask.agent_type,
          subtask.description
        );
        if (!codeReview.approved) {
          log(`   ⚠️  Code review warnings: ${codeReview.review_notes.join(', ')}`);
          // 记录但不阻止，让上层决定
        } else {
          log(`   ✅ Code review passed`);
        }
      }
    }
    
    const executionTime = Date.now() - startTime;

    if (result.success) {
      log(`   ✅ Success (${(executionTime / 1000).toFixed(2)}s)`);

      // Save checkpoint
      const checkpointId = await saveCheckpoint(taskId, subtask.id, result);

      return {
        subtask_id: subtask.id,
        success: true,
        output: result.output,
        execution_time: executionTime,
        worktree_path: worktreePath,
        checkpoint_id: checkpointId
      };
    } else {
      throw new Error(result.error || "Sub-agent execution failed");
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    log(`   ❌ Failed (${(executionTime / 1000).toFixed(2)}s)`);
    
    return {
      subtask_id: subtask.id,
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
      execution_time: executionTime,
      worktree_path: worktreePath
    };
  }
}

/**
 * Create isolated worktree for subtask
 */
async function createWorktree(
  taskId: string, 
  subtaskId: string
): Promise<string> {
  const worktreePath = `workspace/agents/${taskId}/${subtaskId}`;
  
  try {
    // Create directory
    await exec({
      command: `mkdir -p ${worktreePath}`,
      timeout: 5000
    });
    
    return worktreePath;
  } catch (error) {
    console.warn(`Warning: Could not create worktree at ${worktreePath}`);
    return worktreePath; // Return path anyway, will fail later if truly inaccessible
  }
}

/**
 * Load agent soul
 */
async function loadAgentSoul(agentType: string): Promise<string> {
  try {
    const soulPath = `souls/${agentType}/soul.md`;
    return await read({ path: soulPath });
  } catch (error) {
    console.warn(`Warning: Could not load soul for ${agentType}`);
    return ""; // Return empty if not found
  }
}

/**
 * Search for similar historical errors
 */
async function searchSimilarErrors(subtask: Subtask): Promise<any[]> {
  try {
    // Search in memory for similar errors
    const errors = []; // TODO: Implement memory search
    return errors;
  } catch (error) {
    return [];
  }
}

/**
 * Build task prompt for sub-agent
 */
function buildTaskPrompt(
  subtask: Subtask,
  soul: string,
  similarErrors: any[]
): string {
  let prompt = `# Task: ${subtask.name}\n\n`;
  prompt += `## Description\n${subtask.description}\n\n`;
  
  if (soul) {
    prompt += `## Agent Soul\n${soul}\n\n`;
  }
  
  if (similarErrors.length > 0) {
    prompt += `## Historical Errors to Avoid\n`;
    similarErrors.forEach((err, i) => {
      prompt += `${i + 1}. ${err.description}\n`;
    });
    prompt += `\n`;
  }
  
  if (subtask.test_cases && subtask.test_cases.length > 0) {
    prompt += `## Test Cases\n`;
    subtask.test_cases.forEach((tc, i) => {
      prompt += `Test ${i + 1}: ${tc.description}\n`;
      prompt += `  Input: ${JSON.stringify(tc.input)}\n`;
      prompt += `  Expected: ${JSON.stringify(tc.expected_output)}\n\n`;
    });
  }
  
  prompt += `## Instructions\n`;
  prompt += `1. Complete the task described above\n`;
  prompt += `2. Follow the guidelines in your Agent Soul\n`;
  prompt += `3. Avoid the historical errors listed\n`;
  prompt += `4. Ensure all test cases pass\n`;
  prompt += `5. Report your progress and any issues\n`;
  
  return prompt;
}

/**
 * Save checkpoint
 */
async function saveCheckpoint(
  taskId: string,
  subtaskId: string,
  result: any
): Promise<string> {
  const checkpointId = `chk-${Date.now()}`;
  const checkpointPath = `memory/checkpoints/${taskId}/${subtaskId}/${checkpointId}.json`;
  
  try {
    await write({
      path: checkpointPath,
      content: JSON.stringify({
        checkpoint_id: checkpointId,
        task_id: taskId,
        subtask_id: subtaskId,
        timestamp: new Date().toISOString(),
        result
      }, null, 2)
    });
    
    return checkpointId;
  } catch (error) {
    console.warn(`Warning: Could not save checkpoint`);
    return checkpointId;
  }
}

// Initialize Viking
const viking = new VikingManager();

/**
 * Record error for learning using Viking
 */
async function recordError(
  taskId: string,
  subtask: Subtask,
  result: SubtaskResult
): Promise<void> {
  const errorRecord: ErrorRecord = {
    error_id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    task_id: taskId,
    subtask_id: subtask.id,
    agent_type: subtask.agent_type,
    timestamp: new Date().toISOString(),
    error_type: result.error?.split(':')[0] || 'UnknownError',
    error_message: result.error || 'Unknown error',
    context: {
      task_description: subtask.description,
      subtask_name: subtask.name
    }
  };
  
  // Store in Viking (all three layers)
  try {
    await viking.storeError(errorRecord);
  } catch (error) {
    console.warn(`Warning: Could not record error to Viking`);
  }
}

/**
 * Save execution result
 */
async function saveExecutionResult(result: ExecutionResult): Promise<void> {
  const resultPath = `memory/executions/${result.task_id}.json`;
  
  try {
    await write({
      path: resultPath,
      content: JSON.stringify(result, null, 2)
    });
  } catch (error) {
    console.warn(`Warning: Could not save execution result`);
  }
}

/**
 * Generate execution summary
 */
function generateSummary(
  results: SubtaskResult[],
  status: string
): string {
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const successRate = (successCount / totalCount * 100).toFixed(1);
  
  let summary = `Execution ${status}. `;
  summary += `${successCount}/${totalCount} subtasks succeeded (${successRate}%). `;
  
  if (status === "completed") {
    summary += "All objectives achieved.";
  } else if (status === "partial") {
    summary += "Some objectives achieved, review recommended.";
  } else {
    summary += "Execution failed, manual intervention required.";
  }
  
  return summary;
}

// Export for OpenClaw tool registration
export default maselExecute;
