/**
 * MASEL Depth Limiter Service
 * 防止无限嵌套 spawn
 */

// ============================================================================
// 深度限制配置
// ============================================================================

interface DepthConfig {
  max_nesting_depth: number;        // 最大嵌套深度
  max_siblings_per_level: number;   // 每级最大兄弟节点数
  max_total_subagents: number;      // 总子代理数上限
}

const DEFAULT_DEPTH_CONFIG: DepthConfig = {
  max_nesting_depth: 2,      // 最多2层：主代理 → 子代理 → 子子代理
  max_siblings_per_level: 8, // 每级最多8个并行子代理
  max_total_subagents: 20    // 总共最多20个子代理
};

// ============================================================================
// 深度追踪
// ============================================================================

interface SpawnContext {
  depth: number;
  parent_id?: string;
  root_task_id: string;
  spawn_chain: string[];
}

// 使用 Map 存储当前会话的 spawn 上下文
const spawnContexts = new Map<string, SpawnContext>();

/**
 * 初始化根任务上下文
 */
export function initRootContext(taskId: string): SpawnContext {
  const context: SpawnContext = {
    depth: 0,
    root_task_id: taskId,
    spawn_chain: [taskId]
  };
  
  spawnContexts.set(taskId, context);
  return context;
}

/**
 * 创建子代理上下文
 */
export function createChildContext(
  parentTaskId: string,
  childTaskId: string,
  config: Partial<DepthConfig> = {}
): {
  allowed: boolean;
  context?: SpawnContext;
  reason?: string;
} {
  const cfg = { ...DEFAULT_DEPTH_CONFIG, ...config };
  
  // 获取父上下文
  const parentContext = spawnContexts.get(parentTaskId);
  if (!parentContext) {
    return {
      allowed: false,
      reason: `Parent context not found: ${parentTaskId}`
    };
  }
  
  const newDepth = parentContext.depth + 1;
  
  // 检查深度限制
  if (newDepth > cfg.max_nesting_depth) {
    return {
      allowed: false,
      reason: `Max nesting depth exceeded: ${newDepth} > ${cfg.max_nesting_depth}`
    };
  }
  
  // 检查总子代理数
  const totalSubagents = countTotalSubagents(parentContext.root_task_id);
  if (totalSubagents >= cfg.max_total_subagents) {
    return {
      allowed: false,
      reason: `Max total subagents exceeded: ${totalSubagents} >= ${cfg.max_total_subagents}`
    };
  }
  
  // 检查同级数量
  const siblings = countSiblings(parentContext);
  if (siblings >= cfg.max_siblings_per_level) {
    return {
      allowed: false,
      reason: `Max siblings per level exceeded: ${siblings} >= ${cfg.max_siblings_per_level}`
    };
  }
  
  // 创建新上下文
  const childContext: SpawnContext = {
    depth: newDepth,
    parent_id: parentTaskId,
    root_task_id: parentContext.root_task_id,
    spawn_chain: [...parentContext.spawn_chain, childTaskId]
  };
  
  spawnContexts.set(childTaskId, childContext);
  
  return {
    allowed: true,
    context: childContext
  };
}

/**
 * 检查是否可以 spawn
 */
export function canSpawn(
  currentTaskId: string,
  config: Partial<DepthConfig> = {}
): {
  can_spawn: boolean;
  current_depth: number;
  remaining_depth: number;
  remaining_slots: number;
  reason?: string;
} {
  const cfg = { ...DEFAULT_DEPTH_CONFIG, ...config };
  const context = spawnContexts.get(currentTaskId);
  
  if (!context) {
    return {
      can_spawn: false,
      current_depth: 0,
      remaining_depth: 0,
      remaining_slots: 0,
      reason: 'Context not found'
    };
  }
  
  const nextDepth = context.depth + 1;
  const remainingDepth = cfg.max_nesting_depth - context.depth;
  
  const totalSubagents = countTotalSubagents(context.root_task_id);
  const remainingSlots = cfg.max_total_subagents - totalSubagents;
  
  const canSpawn = nextDepth <= cfg.max_nesting_depth && remainingSlots > 0;
  
  return {
    can_spawn: canSpawn,
    current_depth: context.depth,
    remaining_depth: remainingDepth,
    remaining_slots: remainingSlots,
    reason: canSpawn ? undefined : 'Depth or slot limit reached'
  };
}

/**
 * 清理上下文（任务完成时）
 */
export function cleanupContext(taskId: string): void {
  // 清理该任务及其所有子任务的上下文
  const toDelete: string[] = [];
  
  for (const [id, context] of spawnContexts.entries()) {
    if (id === taskId || context.spawn_chain.includes(taskId)) {
      toDelete.push(id);
    }
  }
  
  for (const id of toDelete) {
    spawnContexts.delete(id);
  }
}

/**
 * 获取当前深度信息
 */
export function getDepthInfo(taskId: string): {
  depth: number;
  chain: string[];
  is_root: boolean;
} | null {
  const context = spawnContexts.get(taskId);
  if (!context) return null;
  
  return {
    depth: context.depth,
    chain: context.spawn_chain,
    is_root: context.depth === 0
  };
}

// ============================================================================
// 统计函数
// ============================================================================

function countTotalSubagents(rootTaskId: string): number {
  let count = 0;
  
  for (const context of spawnContexts.values()) {
    if (context.root_task_id === rootTaskId && context.depth > 0) {
      count++;
    }
  }
  
  return count;
}

function countSiblings(parentContext: SpawnContext): number {
  let count = 0;
  
  for (const context of spawnContexts.values()) {
    if (context.parent_id === parentContext.spawn_chain[parentContext.spawn_chain.length - 1]) {
      count++;
    }
  }
  
  return count;
}

// ============================================================================
// 循环检测
// ============================================================================

/**
 * 检测循环 spawn
 */
export function detectCycle(
  currentTaskId: string,
  targetTaskId: string
): {
  has_cycle: boolean;
  cycle_path?: string[];
} {
  const currentContext = spawnContexts.get(currentTaskId);
  if (!currentContext) {
    return { has_cycle: false };
  }
  
  // 检查目标是否在当前链中（会导致循环）
  if (currentContext.spawn_chain.includes(targetTaskId)) {
    const cycleIndex = currentContext.spawn_chain.indexOf(targetTaskId);
    return {
      has_cycle: true,
      cycle_path: [...currentContext.spawn_chain.slice(cycleIndex), targetTaskId]
    };
  }
  
  return { has_cycle: false };
}

// ============================================================================
// 安全包装器
// ============================================================================

/**
 * 安全的 spawn 包装器
 */
export async function safeSpawn<T>(
  spawnFn: () => Promise<T>,
  parentTaskId: string,
  childTaskId: string,
  config?: Partial<DepthConfig>
): Promise<{
  success: boolean;
  result?: T;
  error?: string;
}> {
  // 检查循环
  const cycleCheck = detectCycle(parentTaskId, childTaskId);
  if (cycleCheck.has_cycle) {
    return {
      success: false,
      error: `Cycle detected: ${cycleCheck.cycle_path?.join(' -> ')}`
    };
  }
  
  // 检查深度限制
  const depthCheck = createChildContext(parentTaskId, childTaskId, config);
  if (!depthCheck.allowed) {
    return {
      success: false,
      error: depthCheck.reason
    };
  }
  
  try {
    const result = await spawnFn();
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ============================================================================
// 监控和报告
// ============================================================================

interface DepthReport {
  total_contexts: number;
  root_tasks: number;
  max_depth_observed: number;
  average_depth: number;
  tasks_at_limit: string[];
}

/**
 * 生成深度报告
 */
export function generateDepthReport(): DepthReport {
  const depths: number[] = [];
  const rootTasks = new Set<string>();
  const tasksAtLimit: string[] = [];
  
  for (const [taskId, context] of spawnContexts.entries()) {
    depths.push(context.depth);
    rootTasks.add(context.root_task_id);
    
    if (context.depth >= DEFAULT_DEPTH_CONFIG.max_nesting_depth) {
      tasksAtLimit.push(taskId);
    }
  }
  
  const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
  const avgDepth = depths.length > 0 
    ? depths.reduce((a, b) => a + b, 0) / depths.length 
    : 0;
  
  return {
    total_contexts: spawnContexts.size,
    root_tasks: rootTasks.size,
    max_depth_observed: maxDepth,
    average_depth: avgDepth,
    tasks_at_limit: tasksAtLimit
  };
}

// ============================================================================
// 导出
// ============================================================================

export default {
  initRootContext,
  createChildContext,
  canSpawn,
  cleanupContext,
  getDepthInfo,
  detectCycle,
  safeSpawn,
  generateDepthReport,
  DEFAULT_DEPTH_CONFIG
};
