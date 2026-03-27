/**
 * MASEL Wrapper for OpenClaw
 * 
 * 简化在 OpenClaw 中使用 MASEL 的接口
 */

// 导入 MASEL 工具
const path = require('path');
const maselPath = path.join(__dirname, 'src', 'tools', 'index.js');

// 动态导入（处理 TypeScript/ESM）
let maselTools;

try {
  // 尝试直接导入（如果已编译）
  maselTools = require(maselPath);
} catch (e) {
  // 如果失败，提供模拟实现
  console.log("⚠️  MASEL tools not compiled. Run 'npx tsc' first.");
  maselTools = createMockTools();
}

/**
 * 创建模拟工具（用于演示）
 */
function createMockTools() {
  return {
    maselPlan: async ({ task, workflow_type }) => ({
      task_id: `mock-${Date.now()}`,
      original_task: task,
      workflow_type,
      brainstorm: {
        approaches: ['Approach 1', 'Approach 2'],
        selected_approach: 'Approach 1',
        rationale: 'Best for this task'
      },
      spec: {
        requirements: ['Req 1', 'Req 2'],
        acceptance_criteria: ['Criteria 1'],
        constraints: [],
        boundary_conditions: []
      },
      subtasks: [
        { id: 'st-1', name: 'Analyze', agent_type: 'coder', dependencies: [], estimated_time: 10 },
        { id: 'st-2', name: 'Implement', agent_type: 'coder', dependencies: ['st-1'], estimated_time: 20 }
      ],
      created_at: new Date().toISOString(),
      estimated_total_time: 30
    }),
    
    maselExecute: async ({ plan }) => ({
      task_id: plan.task_id,
      status: 'completed',
      results: plan.subtasks.map(st => ({
        subtask_id: st.id,
        success: true,
        output: `Completed ${st.name}`,
        execution_time: st.estimated_time * 1000
      })),
      total_execution_time: plan.estimated_total_time * 1000,
      summary: 'All subtasks completed successfully'
    }),
    
    maselReview: async ({ results }) => ({
      review_id: `review-${Date.now()}`,
      overall_score: 85,
      dimensions: [
        { name: 'Correctness', score: 90, weight: 0.35, comments: ['Good'] },
        { name: 'Completeness', score: 80, weight: 0.25, comments: ['OK'] },
        { name: 'Efficiency', score: 85, weight: 0.15, comments: ['Good'] },
        { name: 'Readability', score: 88, weight: 0.15, comments: ['Good'] },
        { name: 'Robustness', score: 82, weight: 0.10, comments: ['OK'] }
      ],
      issues: [],
      decision: 'APPROVE',
      summary: 'Good quality output',
      recommendations: ['Keep up the good work']
    }),
    
    maselLearn: async () => ({
      learning_id: `learn-${Date.now()}`,
      patterns_found: 1,
      soul_updates: []
    }),
    
    maselStatus: async () => ({
      version: '1.0.0',
      active_tasks: 0,
      completed_tasks: 1,
      memory_stats: { hot_errors: 0, warm_errors_today: 0, total_errors: 0 }
    }),
    
    maselSouls: async ({ action }) => ({
      action,
      souls: ['coder', 'researcher', 'reviewer']
    })
  };
}

/**
 * MASEL 主接口 - 简化使用
 */
class MASEL {
  constructor() {
    this.tools = maselTools;
  }

  /**
   * 自动判断任务是否需要使用 MASEL 多智能体工作流
   */
  shouldUseMASEL(task) {
    const task_lower = task.toLowerCase();

    // 简单任务关键词 - 不需要 MASEL（严格匹配短句）
    const simplePatterns = [
      /^你好$/, /^hi$/, /^hello$/,
      /^谢谢$/, /^thanks$/,
      /^再见$/, /^bye$/,
      /^(今天)?天气/, /^(现在)?时间/, /^(今天)?日期/,
      /^帮助$/, /^help$/
    ];

    // 检查是否匹配简单模式
    const isSimple = simplePatterns.some(pattern => pattern.test(task_lower.trim()));
    if (isSimple) return false;

    // 复杂任务关键词 - 需要 MASEL
    const complexKeywords = [
      // 中文
      '写', '编写', '开发', '实现', '创建', '做', '制作',
      '分析', '研究', '调查',
      '设计', '架构', '规划',
      '测试', '调试', '验证',
      '优化', '重构', '改进', '完善',
      '项目', '系统', '程序', '应用', '工具', '脚本',
      '代码', '函数', '类', '模块', '库', '框架',
      '网站', '网页', '接口', 'api', '数据库',
      '爬虫', '自动化', '工作流', '流程',
      // 英文
      'create', 'develop', 'build', 'write', 'implement', 'make',
      'analyze', 'research', 'investigate',
      'design', 'architect',
      'test', 'debug', 'verify',
      'optimize', 'refactor', 'improve',
      'project', 'system', 'program', 'app', 'tool', 'script',
      'code', 'function', 'class', 'module', 'library', 'framework',
      'website', 'web', 'api', 'database',
      'scraper', 'automation', 'workflow'
    ];

    // 检查是否包含复杂关键词
    const hasComplex = complexKeywords.some(kw => task_lower.includes(kw.toLowerCase()));
    if (hasComplex) return true;

    // 默认：任务长度超过 30 字符或包含多个句子，认为是复杂任务
    return task.length > 30 || task.includes('。') || task.includes('. ') || task.includes('，');
  }

  /**
   * 快速完成任务 - 一键执行完整工作流
   */
  async complete(task, options = {}) {
    const { workflow_type = 'simple', verbose = true, silent = false, auto = false, enable_cleanup = true, enable_fallback = true } = options;

    // 自动判断是否需要 MASEL
    if (auto) {
      const needsMASEL = this.shouldUseMASEL(task);
      if (!needsMASEL) {
        return { auto_skipped: true, reason: 'Task does not require multi-agent workflow' };
      }
    }

    const log = silent ? () => {} : (verbose ? console.log : () => {});

    log("\n" + "=".repeat(60));
    log("🚀 MASEL: Starting Complete Workflow");
    log("=".repeat(60));
    log(`Task: ${task}`);
    log(`Type: ${workflow_type}`);
    log(`Silent: ${silent}`);
    log(`Cleanup: ${enable_cleanup}`);
    log(`Fallback: ${enable_fallback}`);

    // Step 1: Plan
    log("\n📋 Step 1: Planning...");
    const plan = await this.tools.maselPlan({ task, workflow_type });
    log(`✅ Plan created: ${plan.task_id}`);
    log(`   Subtasks: ${plan.subtasks.length}`);

    // Step 2: Execute (with silent option and new safety features)
    log("\n⚙️  Step 2: Executing...");
    const execution = await this.tools.maselExecute({
      plan,
      options: {
        silent,
        enable_cleanup,
        enable_fallback
      }
    });
    log(`✅ Execution: ${execution.status}`);
    log(`   Success: ${execution.results.filter(r => r.success).length}/${execution.results.length}`);

    // Step 3: Review
    log("\n🔍 Step 3: Reviewing...");
    const review = await this.tools.maselReview({
      results: execution.results,
      plan
    });
    log(`✅ Review: ${review.decision}`);
    log(`   Score: ${review.overall_score}/100`);

    // Step 4: Learn (optional)
    if (options.learn !== false && !silent) {
      log("\n🧠 Step 4: Learning...");
      const learning = await this.tools.maselLearn({
        review_report: review,
        auto_update: true
      });
      log(`✅ Learning: ${learning.patterns_found} patterns found`);
    }

    log("\n" + "=".repeat(60));
    log("✅ MASEL Workflow Complete!");
    log("=".repeat(60));

    return {
      plan,
      execution,
      review,
      success: review.decision === 'APPROVE'
    };
  }

  /**
   * 仅规划
   */
  async plan(task, workflow_type = 'simple') {
    return this.tools.maselPlan({ task, workflow_type });
  }

  /**
   * 仅执行
   */
  async execute(plan) {
    return this.tools.maselExecute({ plan });
  }

  /**
   * 仅审核
   */
  async review(results, plan) {
    return this.tools.maselReview({ results, plan });
  }

  /**
   * 获取状态
   */
  async status() {
    return this.tools.maselStatus({});
  }

  /**
   * 列出 Souls
   */
  async souls() {
    return this.tools.maselSouls({ action: 'list' });
  }

  /**
   * 静默执行任务 - 直接返回结果，无中间输出
   */
  async silent(task, options = {}) {
    return this.complete(task, { ...options, silent: true, verbose: false });
  }

  /**
   * 自动模式 - 判断是否需要 MASEL，需要则静默执行
   */
  async auto(task, options = {}) {
    if (!this.shouldUseMASEL(task)) {
      return { auto_skipped: true, task, suggestion: 'Use direct response' };
    }
    return this.silent(task, options);
  }
}

// 创建全局实例
const masel = new MASEL();

// ============================================================================
// Viking Lite - 轻量级记忆系统
// 简单任务也能使用 MASEL 记忆方法，无需完整 MASEL 流程
// ============================================================================

/**
 * 创建 Viking Lite 记忆实例
 * 
 * @param {string} agentType - 代理类型: "coder" | "researcher" | "reviewer" | "assistant"
 * @param {string} contextPrefix - 上下文前缀，用于分类
 * @returns {VikingLite} 记忆实例
 * 
 * 示例:
 * ```javascript
 * const memory = createMemory("assistant", "文件操作");
 * 
 * // 开始任务
 * memory.startTask("读取配置文件");
 * 
 * try {
 *   const result = await doSomething();
 *   await memory.recordSuccess(result);
 * } catch (error) {
 *   await memory.recordFailure(error);
 * }
 * ```
 */
function createMemory(agentType, contextPrefix) {
  // 动态导入 Viking Lite
  const vikingLitePath = path.join(__dirname, 'src', 'utils', 'viking-lite.js');
  
  try {
    const { createMemory: createVikingLite } = require(vikingLitePath);
    return createVikingLite(agentType, contextPrefix);
  } catch (e) {
    // 如果 Viking Lite 未编译，提供模拟实现
    console.log("⚠️  Viking Lite not compiled. Run 'npx tsc' first.");
    return createMockVikingLite(agentType, contextPrefix);
  }
}

/**
 * 带记忆的执行任务
 * 
 * @param {string} agentType - 代理类型
 * @param {string} taskDescription - 任务描述
 * @param {Function} fn - 要执行的函数
 * @param {Object} options - 选项
 * @returns {Promise<any>} 任务结果
 * 
 * 示例:
 * ```javascript
 * const result = await withMemory("coder", "解析JSON文件", async () => {
 *   return JSON.parse(data);
 * }, { showHints: true });
 * ```
 */
async function withMemory(agentType, taskDescription, fn, options = {}) {
  const memory = createMemory(agentType);
  
  // 1. 获取历史提示
  const hints = await memory.getHints(taskDescription);
  
  if (options.showHints && hints.length > 0) {
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
    await memory.recordFailure(error, {
      duration_ms: Date.now() - startTime,
      hints_available: hints.length
    });
    
    if (options.onError) {
      options.onError(error, hints);
    }
    
    throw error;
  }
}

/**
 * Viking Lite 模拟实现（用于演示）
 */
function createMockVikingLite(agentType, contextPrefix) {
  return {
    startTask: (description) => {
      console.log(`[VikingLite] Task started: ${description.substring(0, 50)}...`);
      return `lite-${Date.now()}`;
    },
    recordSuccess: async (output, metadata) => {
      console.log(`[VikingLite] Task recorded as success`);
    },
    recordFailure: async (error, context) => {
      console.log(`[VikingLite] Task recorded as failure: ${error.message}`);
    },
    getHints: async (taskDescription) => {
      // 模拟返回历史提示
      return [];
    },
    quickRecord: async (description, fn) => {
      const startTime = Date.now();
      try {
        const result = await fn();
        console.log(`[VikingLite] Quick record success (${Date.now() - startTime}ms)`);
        return result;
      } catch (error) {
        console.log(`[VikingLite] Quick record failure: ${error.message}`);
        throw error;
      }
    },
    getStats: async () => ({
      recent_errors: 0,
      today_errors: 0,
      hints_available: false
    })
  };
}

// 导出
module.exports = { 
  MASEL, 
  masel,
  // Viking Lite API
  createMemory,
  withMemory,
  // Auto Memory API - 让 AI 自动记住你！
  initAutoMemory,
  autoRecord,
  autoRecall
};

// ============================================================================
// Auto Memory System - 自动记忆系统
// 让 AI 自动记住用户的一切！
// ============================================================================

/**
 * 初始化自动记忆系统
 * 
 * @param {string} userId - 用户ID (例如: "TvTongg")
 * @param {string} agentId - 代理ID (例如: "TwTongg")
 * @returns {AutoMemory} 自动记忆实例
 * 
 * 示例:
 * ```javascript
 * // 只需要初始化一次
 * initAutoMemory("TvTongg", "TwTongg");
 * 
 * // 之后每次对话自动记录
 * await autoRecord("用户消息", "AI回复");
 * 
 * // 自动获取相关记忆
 * const memories = await autoRecall("当前上下文");
 * ```
 */
function initAutoMemory(userId, agentId) {
  const autoMemoryPath = path.join(__dirname, 'src', 'utils', 'auto-memory.js');
  
  try {
    const { initAutoMemory: init } = require(autoMemoryPath);
    return init(userId, agentId);
  } catch (e) {
    console.log("⚠️  Auto Memory not compiled. Run 'npx tsc' first.");
    return createMockAutoMemory(userId, agentId);
  }
}

/**
 * 自动记录对话
 * 
 * @param {string} message - 用户消息
 * @param {string} response - AI回复
 */
async function autoRecord(message, response) {
  const autoMemoryPath = path.join(__dirname, 'src', 'utils', 'auto-memory.js');
  
  try {
    const { autoRecord: record } = require(autoMemoryPath);
    await record(message, response);
  } catch (e) {
    // 静默失败，不影响主流程
  }
}

/**
 * 自动获取相关记忆
 * 
 * @param {string} context - 当前上下文
 * @returns {Promise<string[]>} 相关记忆列表
 */
async function autoRecall(context) {
  const autoMemoryPath = path.join(__dirname, 'src', 'utils', 'auto-memory.js');
  
  try {
    const { autoRecall: recall } = require(autoMemoryPath);
    return await recall(context);
  } catch (e) {
    return [];
  }
}

/**
 * Auto Memory 模拟实现
 */
function createMockAutoMemory(userId, agentId) {
  return {
    initialize: async () => {
      console.log(`[AutoMemory] Mock initialized for ${userId}`);
    },
    recordConversation: async (msg, resp) => {
      console.log(`[AutoMemory] Mock recorded: ${msg.substring(0, 30)}...`);
    },
    getRelevantMemories: async (context) => {
      return [];
    },
    getUserProfile: async () => {
      return { preferences: {}, events: [], patterns: [] };
    }
  };
}

// 如果直接运行
if (require.main === module) {
  // 演示
  console.log("MASEL Wrapper loaded!");
  console.log("Usage:");
  console.log("  const { masel } = require('./masel-wrapper');");
  console.log("  await masel.complete('Your task here');");
  console.log("");
  console.log("Auto Memory:");
  console.log("  const { initAutoMemory, autoRecord, autoRecall } = require('./masel-wrapper');");
  console.log("  initAutoMemory('TvTongg', 'TwTongg');");
  console.log("  await autoRecord('用户消息', 'AI回复');");
}
