/**
 * Context-Aware Retrieval v2.0
 * Phase 2: 上下文感知检索 + 频率加权 + 实体增强
 */

const { tokenize } = require('./vector-index-store');

// ─── 召回频率追踪 ──────────────────────────────────────

const RECALL_LOG_PATH = (() => {
  const path = require('path');
  return path.join(__dirname, '../../memory/.recall-stats.json');
})();

function loadRecallStats() {
  try {
    const fs = require('fs');
    return JSON.parse(fs.readFileSync(RECALL_LOG_PATH, 'utf-8'));
  } catch {
    return { recalls: {}, lastUpdate: null };
  }
}

function saveRecallStats(stats) {
  const fs = require('fs');
  const path = require('path');
  const dir = path.dirname(RECALL_LOG_PATH);
  ensureDir(dir);
  fs.writeFileSync(RECALL_LOG_PATH, JSON.stringify(stats, null, 2));
}

/**
 * 记录一次召回
 */
function recordRecall(memoryId) {
  const stats = loadRecallStats();
  if (!stats.recalls[memoryId]) {
    stats.recalls[memoryId] = { count: 0, firstRecall: null, lastRecall: null };
  }
  const r = stats.recalls[memoryId];
  r.count++;
  r.lastRecall = new Date().toISOString();
  if (!r.firstRecall) r.firstRecall = r.lastRecall;
  stats.lastUpdate = new Date().toISOString();
  saveRecallStats(stats);
  return r;
}

/**
 * 获取召回频率分数 (0-1)
 * 经常被召回的记忆优先级更高
 */
function getRecallFrequencyScore(memoryId) {
  const stats = loadRecallStats();
  const r = stats.recalls[memoryId];
  if (!r) return 0;
  // 对数缩放，避免高频记忆过度占优
  return Math.min(1, Math.log(r.count + 1) / Math.log(20));
}

// ─── 上下文构建 ────────────────────────────────────────

/**
 * 从当前对话历史构建检索上下文
 * @param {string} query - 当前查询
 * @param {Array} recentMessages - 最近几条消息 [{role, content}]
 * @returns {Object} context
 */
function buildQueryContext(query, recentMessages = []) {
  const context = {
    // 原始查询
    query,
    // 增强查询（原始 + 提取的实体/意图）
    enhancedQuery: query,
    // 检测到的实体
    entities: {
      projects: [],
      files: [],
      tools: [],
      people: []
    },
    // 检测到的意图
    intent: {
      coding: false,
      design: false,
      management: false,
      recall: false,
      casual: false
    },
    // 时间上下文
    timeContext: {
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      isWeekend: [0, 6].includes(new Date().getDay())
    },
    // 从历史中提取的活跃话题
    activeTopics: []
  };

  // 合并最近消息提取上下文
  const recentText = recentMessages
    .slice(-5) // 最近5条
    .map(m => m.content || '')
    .join(' ');

  const fullText = `${query} ${recentText}`;

  // ── 实体提取 ──
  // 项目名
  const projectMatches = [...fullText.matchAll(/([A-Za-z][A-Za-z0-9_-]{1,20})(?:项目|project|的)/gi)];
  context.entities.projects = [...new Set(projectMatches.map(m => m[1]))];

  // 文件路径
  const fileMatches = [...fullText.matchAll(/([\w/.-]+\.\w{1,10})/g)];
  context.entities.files = [...new Set(fileMatches.map(m => m[1]))].slice(0, 5);

  // 工具/技术
  const toolKeywords = ['masel', 'gimp', 'blender', 'libreoffice', 'openclaw', 'node', 'python', 'flask', 'sqlite', 'mcp'];
  const lowerText = fullText.toLowerCase();
  context.entities.tools = toolKeywords.filter(t => lowerText.includes(t));

  // ── 意图检测（增强版）──
  const q = query.toLowerCase();
  context.intent = {
    coding: /编码|代码|code|函数|实现|开发|脚本|script|debug|修复|bug|error|执行|exec|运行|run|编译|build/.test(q),
    design: /设计|方案|架构|讨论|分析|规划|roadmap|路线图/.test(q),
    management: /进度|里程碑|任务|todo|计划|部署|发布|打包/.test(q),
    recall: /之前|上次|以前|记住|回忆|历史|记忆|之前说过/.test(q),
    casual: /你好|嗨|哈哈|不错|晚安|早上好|吃了吗/.test(q)
  };

  // ── 活跃话题（从最近消息中提取高频词）──
  const recentTokens = tokenize(recentText);
  const freq = {};
  for (const t of recentTokens) {
    if (t.length < 2) continue;
    freq[t] = (freq[t] || 0) + 1;
  }
  context.activeTopics = Object.entries(freq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // ── 构建增强查询 ──
  const extraTerms = [
    ...context.entities.projects,
    ...context.entities.tools,
    ...context.activeTopics
  ].filter(Boolean);

  if (extraTerms.length > 0) {
    context.enhancedQuery = `${query} ${extraTerms.join(' ')}`;
  }

  return context;
}

/**
 * 基于上下文的检索增强分数
 * @param {Object} candidate - 检索候选项
 * @param {Object} context - buildQueryContext 返回的上下文
 * @returns {number} 额外的 boost (-0.1 ~ 0.25)
 */
function computeContextBoost(candidate, queryOrContext) {
  // 兼容：传入 query 字符串或 context 对象
  const context = typeof queryOrContext === 'string' ? buildQueryContext(queryOrContext) : queryOrContext;

  let boost = 0;
  const content = `${candidate.summary || ''} ${candidate.content || ''}`.toLowerCase();
  const candidateId = candidate.id || '';

  // ── 实体匹配 boost ──
  const projects = context.entities?.projects || [];
  const tools = context.entities?.tools || [];
  for (const project of projects) {
    if (content.includes(project.toLowerCase())) boost += 0.06;
  }

  for (const tool of tools) {
    if (content.includes(tool)) boost += 0.05;
  }

  // ── 活跃话题匹配 ──
  for (const topic of (context.activeTopics || [])) {
    if (content.includes(topic)) boost += 0.03;
  }

  // ── 意图-类型对齐 ──
  const type = String(candidate.metadata?.type || candidate.metadata?.fileType || '').toLowerCase();

  if (context.intent?.coding && type.includes('error_pattern')) boost += 0.08;
  if (context.intent?.coding && type.includes('project')) boost += 0.04;
  if (context.intent?.design && type.includes('preference')) boost += 0.06;
  if (context.intent?.management && type.includes('project')) boost += 0.06;
  if (context.intent?.recall && ['l1', 'l2', 'l3'].includes(candidate.layer)) boost += 0.05;

  // ── 时间上下文 ──
  // 如果是 cyclical 模式且匹配当前时间段，额外加分
  if (type.includes('pattern') || type.includes('cyclical')) {
    if (content.includes(`${context.timeContext?.hour}:00`)) boost += 0.04;
  }

  // ── 召回频率 boost ──
  const recallScore = getRecallFrequencyScore(candidateId);
  boost += recallScore * 0.08; // 最高 0.08

  // ── 弱信号惩罚 ──
  // 如果查询很简短且是闲聊，降低结构化记忆的优先级
  if (context.intent?.casual && candidate.layer === 'l2') {
    boost -= 0.05;
  }

  return Math.max(-0.1, Math.min(0.25, boost));
}

/**
 * 批量记录召回（检索完成后调用）
 */
function recordBatchRecalls(resultIds) {
  for (const id of resultIds) {
    recordRecall(id);
  }
}

module.exports = {
  buildQueryContext,
  computeContextBoost,
  recordRecall,
  recordBatchRecalls,
  getRecallFrequencyScore,
  loadRecallStats
};
