/**
 * MASEL Wrapper for OpenClaw - v1.9.1
 * 
 * 架构：router + agents + workflows + sqlite 统一记忆
 * 
 * v1.9.1:
 * - FileBasedMemory → UltimateMemory + SQLite
 * - 拆分核心模块（router/agents/workflows）
 * - sessions_spawn 集成（真正多Agent）
 * - 智能路由（关键词 → 拓扑并行）
 * - 向后兼容：所有旧接口不变
 */

const fs = require('fs');
const path = require('path');

const MASEL_DIR = __dirname;

// ============================================================================
// 核心模块加载
// ============================================================================
const { MaselRouter } = require('./src/core/router');
const { MaselAgents } = require('./src/core/agents');
const { MaselWorkflows } = require('./src/core/workflows');

const router = new MaselRouter();
const agents = new MaselAgents();
const workflows = new MaselWorkflows({
  onStoreLesson: (data) => {
    const db = getSQLite();
    if (db) db.store(data);
  }
});

// ============================================================================
// 统一记忆系统
// ============================================================================
let _ultimateMemory = null;
let _sqliteAdapter = null;

function getUltimateMemory() {
  if (_ultimateMemory) return _ultimateMemory;
  try {
    const { initUltimateMemory } = require('../../utils/ultimate-memory.js');
    let userId = 'TvTongg';
    const userMd = path.join(MASEL_DIR, '..', '..', 'USER.md');
    if (fs.existsSync(userMd)) {
      const m = fs.readFileSync(userMd, 'utf8').match(/名字[：:]\s*\*?\*?(\S+?)\*?\*?\s*$/m);
      if (m) userId = m[1];
    }
    _ultimateMemory = initUltimateMemory(userId);
    return _ultimateMemory;
  } catch (e) {
    console.warn('[MASEL] UltimateMemory unavailable:', e.message);
    return null;
  }
}

function getSQLite() {
  if (_sqliteAdapter) return _sqliteAdapter;
  try {
    const { getAdapter } = require('../../utils/sqlite-adapter.js');
    _sqliteAdapter = getAdapter();
    return _sqliteAdapter;
  } catch (e) {
    console.warn('[MASEL] SQLite unavailable:', e.message);
    return null;
  }
}

// ============================================================================
// Auto Memory API
// ============================================================================
let _memoryConfig = { userId: 'TvTongg', agentId: 'TwTongg' };

async function initAutoMemory(userId, agentId) {
  _memoryConfig = { userId, agentId };
  getUltimateMemory();
  console.log(`[MASEL v1.9.1] Memory initialized: ${userId} <-> ${agentId}`);
}

async function autoRecord(message, response, metadata = {}) {
  try {
    const mem = getUltimateMemory();
    if (mem) { mem.record(message, response); return; }
  } catch (e) { /* fall through */ }

  try {
    const db = getSQLite();
    if (db) {
      db.store({
        category: 'conversation', tier: 'temporary', key: 'conversation',
        value: `${message} → ${response}`.substring(0, 500),
        type: 'conversation', weight: 0.3,
        source: new Date().toISOString().split('T')[0],
      });
      return;
    }
  } catch (e) { /* fall through */ }
  console.error('[MASEL] autoRecord: all backends failed');
}

async function autoRecall(context, limit = 5) {
  try {
    const db = getSQLite();
    if (db) {
      const results = db.search(context, { limit });
      if (results.length > 0) return results.map(r => `[${r.category}/${r.tier}] ${r.value}`);
      return db.recall(context, { limit }).map(r => `[${r.category}/${r.tier}] ${r.value}`);
    }
  } catch (e) { /* fall through */ }

  try {
    const mem = getUltimateMemory();
    if (mem) return mem.recall(context).slice(0, limit).map(r => r.value);
  } catch (e) { /* fall through */ }
  return [];
}

async function getUserProfile() {
  const db = getSQLite();
  return db ? db.getProfile() : null;
}

async function setPreference(key, value) {
  const db = getSQLite();
  if (db) db.store({ category: 'preference', tier: 'important', key, value, type: 'preference', weight: 0.8 });
}

async function getPreference(key) {
  const db = getSQLite();
  if (!db) return undefined;
  const r = db.getByKey(key);
  return r.length > 0 ? r[0].value : undefined;
}

// ============================================================================
// MASEL 工具（保持兼容）
// ============================================================================
function createMockTools() {
  return {
    maselPlan: async ({ task, workflow_type }) => ({
      task_id: `mock-${Date.now()}`,
      original_task: task,
      workflow_type,
      brainstorm: { approaches: ['Approach 1', 'Approach 2'], selected_approach: 'Approach 1', rationale: 'Best' },
      spec: { requirements: ['Req 1'], acceptance_criteria: ['Criteria 1'], constraints: [], boundary_conditions: [] },
      subtasks: [
        { id: 'st-1', name: 'Analyze', agent_type: 'coder', dependencies: [], estimated_time: 10 },
        { id: 'st-2', name: 'Implement', agent_type: 'coder', dependencies: ['st-1'], estimated_time: 20 }
      ],
      created_at: new Date().toISOString(),
      estimated_total_time: 30
    }),
    maselExecute: async ({ plan }) => {
      // v1.9.1: 尝试并行执行
      const results = await agents.executeParallel(plan.subtasks, { task: plan.original_task });
      return {
        task_id: plan.task_id,
        status: 'completed',
        results,
        total_execution_time: results.reduce((s, r) => s + (r.execution_time || 0), 0),
        summary: 'All subtasks completed',
        parallel: results.length > 1
      };
    },
    maselReview: async ({ results }) => ({
      review_id: `review-${Date.now()}`,
      overall_score: 85,
      dimensions: [
        { name: 'Correctness', score: 90, weight: 0.35 }, { name: 'Completeness', score: 80, weight: 0.25 },
        { name: 'Efficiency', score: 85, weight: 0.15 }, { name: 'Readability', score: 88, weight: 0.15 },
        { name: 'Robustness', score: 82, weight: 0.10 }
      ],
      issues: [], decision: 'APPROVE', summary: 'Good quality', recommendations: []
    }),
    maselLearn: async () => ({ learning_id: `learn-${Date.now()}`, patterns_found: 1, soul_updates: [] }),
    maselStatus: async () => {
      const overlay = clawteamOverlaySummary ? clawteamOverlaySummary.getGlobalOverlaySummary({ maxPausedTasks: 5 }) : null;
      return {
        version: '1.9.1',
        active_tasks: agents.getActiveCount(),
        completed_tasks: 1,
        memory_stats: { backend: 'sqlite', memories_stored: getSQLite()?.stats()?.memories || 0, auto_initialized: !!_ultimateMemory },
        clawteam_overlay: overlay,
        clawteam_overlay_text: clawteamOverlayFormat ? clawteamOverlayFormat.formatOverlaySummaryBlock(overlay) : null
      };
    },
    maselSouls: async ({ action }) => ({ action, souls: ['coder', 'researcher', 'reviewer'] })
  };
}

const maselTools = createMockTools();

// ============================================================================
// CLI-Anything
// ============================================================================
let cliAnything = null, qualityChecker = null;
try { cliAnything = require('./src/tools/cli-anything.js'); } catch (e) {}
try { qualityChecker = require('./src/tools/quality-checker.js'); } catch (e) {}

let clawteamOverlaySummary = null;
try { clawteamOverlaySummary = require('./src/tools/clawteam-overlay-summary.js'); } catch (e) {}

let clawteamOverlayFormat = null;
try { clawteamOverlayFormat = require('./src/tools/clawteam-overlay-format.js'); } catch (e) {}

async function cliAnythingWorkflow(steps, memory) {
  if (!cliAnything) throw new Error('CLI-Anything not available.');
  return cliAnything.cliAnythingWorkflow(steps, memory);
}

async function routeToCliAnything(taskDescription, memory) {
  if (!cliAnything) return { available: false, reason: 'CLI-Anything not installed' };
  return { available: true, ...(await cliAnything.routeTask(taskDescription, memory)) };
}

async function routeToLocalCreativeSuite(taskDescription, memory) {
  if (!cliAnything) return { available: false, reason: 'CLI-Anything not installed' };
  const route = await cliAnything.routeTask(taskDescription, memory);
  return {
    available: true, suite: route.suite || 'local-creative-mcp-suite',
    workflowType: route.workflowType || 'single-app',
    apps: route.apps || (route.app ? [route.app] : []),
    primaryApp: route.app || null,
    handlerAvailable: !!route.handler
  };
}

// ============================================================================
// MASEL 主类
// ============================================================================
class MASEL {
  constructor() {
    this.tools = maselTools;
    this.router = router;
    this.agents = agents;
    this.workflows = workflows;
  }

  async detectCreativeRoute(task) {
    try {
      const route = await routeToLocalCreativeSuite(task);
      return route?.available ? route : null;
    } catch (e) { return null; }
  }

  shouldUseMASEL(task) {
    return router.shouldUseMASEL(task);
  }

  async complete(task, options = {}) {
    const { workflow_type = 'simple', verbose = true, silent = false, auto = false } = options;
    const creativeRoute = await this.detectCreativeRoute(task);
    const isCreative = creativeRoute?.handlerAvailable && (creativeRoute.workflowType === 'multi-app' || (creativeRoute.apps?.length || 0) > 0);

    if (auto && !this.shouldUseMASEL(task) && !isCreative) {
      return { auto_skipped: true, reason: 'Task does not require multi-agent workflow' };
    }

    const log = silent ? () => {} : (verbose ? console.log : () => {});
    const resolvedType = router.route(task, creativeRoute);

    log(`\n${"=".repeat(60)}`);
    log(`🚀 MASEL v1.9.1 | ${resolvedType} workflow`);
    log(`${"=".repeat(60)}\nTask: ${task}`);

    if (isCreative) log(`Creative: ${(creativeRoute.apps || []).join(', ')}`);

    const result = await workflows.complete(task, {
      workflowType: resolvedType,
      plan: this.tools.maselPlan,
      execute: this.tools.maselExecute,
      review: this.tools.maselReview,
      learn: this.tools.maselLearn,
      creativeRoute: isCreative ? creativeRoute : null,
    });

    log(`✅ ${result.success ? 'APPROVED' : 'NEEDS WORK'} (${result.review.overall_score}/100)`);
    return result;
  }

  async plan(task, workflow_type) { return this.tools.maselPlan({ task, workflow_type: workflow_type || 'simple' }); }
  async execute(plan) { return this.tools.maselExecute({ plan }); }
  async review(results, plan) { return this.tools.maselReview({ results, plan }); }
  async status() { return this.tools.maselStatus({}); }
  async souls() { return this.tools.maselSouls({ action: 'list' }); }

  async silent(task, options = {}) { return this.complete(task, { ...options, silent: true, verbose: false }); }

  async auto(task, options = {}) {
    const creativeRoute = await this.detectCreativeRoute(task);
    const isCreative = creativeRoute?.handlerAvailable && (creativeRoute.workflowType === 'multi-app' || (creativeRoute.apps?.length || 0) > 0);
    if (!this.shouldUseMASEL(task) && !isCreative) {
      return { auto_skipped: true, task, action: 'execute_directly', reason: 'Simple task does not require multi-agent workflow' };
    }
    if (isCreative) {
      return this.silent(task, { ...options, workflow_type: creativeRoute.workflowType === 'multi-app' ? 'creative-suite' : 'creative-single' });
    }
    return this.silent(task, options);
  }

  /**
   * v1.9.1: 注入 sessions_spawn 函数
   */
  setSpawnFn(fn) {
    agents.setSpawnFn(fn);
  }
}

const masel = new MASEL();

// ============================================================================
// Viking Lite
// ============================================================================
function createMemory(agentType, contextPrefix) {
  return {
    startTask: (d) => `task-${Date.now()}`,
    recordSuccess: async (o) => autoRecord(`[${agentType}] Success: ${contextPrefix}`, String(o).substring(0, 200)),
    recordFailure: async (e) => autoRecord(`[${agentType}] Failure: ${contextPrefix}`, e.message || String(e)),
    getHints: async (d) => (await autoRecall(`${agentType} ${contextPrefix} ${d}`, 3)).map(m => ({ type: 'historical', message: m })),
    quickRecord: async (d, fn) => fn(),
    getStats: async () => { const db = getSQLite(); return db ? db.stats() : { memories: 0 }; }
  };
}

async function withMemory(agentType, taskDescription, fn, options = {}) {
  const memory = createMemory(agentType, taskDescription);
  const hints = await memory.getHints(taskDescription);
  if (options.showHints && hints.length > 0) console.log("\n💡 历史提示:", hints);
  memory.startTask(taskDescription);
  try {
    const result = await fn();
    await memory.recordSuccess(String(result));
    return result;
  } catch (error) {
    await memory.recordFailure(error);
    throw error;
  }
}

// ============================================================================
// v1.7.0+ 兼容接口
// ============================================================================
function getUnifiedMemory() { return getUltimateMemory(); }
function getOAC() { try { return require('../../utils/oac/openclaw-automation'); } catch (e) { return null; } }
function getErrorHandler() { try { return require('../../utils/error-handler'); } catch (e) { return null; } }

async function unifiedRecord(data, options = {}) {
  const db = getSQLite();
  if (db) {
    db.store({
      category: options.type || 'fact',
      tier: options.importance === 'critical' ? 'critical' : options.importance === 'temporary' ? 'temporary' : 'important',
      key: data.key || 'general', value: data.message || JSON.stringify(data),
      type: options.type || 'general', weight: options.weight || 0.5, source: data.response || '',
    });
    return;
  }
  return autoRecord(data.message || JSON.stringify(data), data.response || '');
}

async function unifiedRecall(query, options = {}) { return autoRecall(query, options.limit || 10); }

async function resilientComplete(task, options = {}) {
  const eh = getErrorHandler();
  if (!eh) return masel.complete(task, options);
  return eh.wrap(() => masel.complete(task, options), {
    context: 'masel-complete', retries: options.retries || 2,
    fallback: async (error) => ({ status: 'fallback', result: `Fallback: ${task}`, error: error.message })
  });
}

// ============================================================================
// 导出
// ============================================================================
// ClawTeam Bridge
let clawteamBridge;
try {
  clawteamBridge = require('./src/tools/clawteam-bridge');
} catch {
  clawteamBridge = null;
}

module.exports = {
  MASEL, masel,
  createMemory, withMemory,
  initAutoMemory, autoRecord, autoRecall, getUserProfile, setPreference, getPreference,
  cliAnythingWorkflow, routeToCliAnything, routeToLocalCreativeSuite,
  cliAnything: cliAnything || {},
  qualityCheck: qualityChecker ? qualityChecker.quickCheck : null,
  strictQualityCheck: qualityChecker ? qualityChecker.strictCheck : null,
  qualityChecker: qualityChecker || {},
  getUnifiedMemory, getOAC, getErrorHandler,
  unifiedRecord, unifiedRecall, resilientComplete,
  getSQLite,
  // v1.9.1 新导出
  router, agents, workflows,
  // ClawTeam 集成
  clawteamBridge: clawteamBridge || {},
  buildEnhancedSpawnPrompt: clawteamBridge ? clawteamBridge.buildEnhancedSpawnPrompt : null,
  extractAndRecordErrors: clawteamBridge ? clawteamBridge.extractAndRecordErrors : null,
  teamRetrospective: clawteamBridge ? clawteamBridge.teamRetrospective : null,
};

if (require.main === module) {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  MASEL v1.9.1 - Modular Architecture + SQLite         ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  const db = getSQLite();
  if (db) {
    const s = db.stats();
    console.log(`📊 ${s.memories} memories | ${s.byTier.map(t => `${t.tier}=${t.c}`).join(' ')}`);
  }
  console.log(`📦 Modules: router + agents + workflows`);
}
