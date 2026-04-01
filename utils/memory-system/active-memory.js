/**
 * Active Memory Engine v2.0
 * Phase 3: 智能记录判断 + 智能遗忘 + 主动提醒触发
 */

const fs = require('fs');
const path = require('path');

// ─── 1. 智能记录判断 ───────────────────────────────────

/**
 * 判断一条对话是否值得记忆
 * @param {string} userMessage - 用户消息
 * @param {string} aiResponse - AI回复
 * @param {Object} context - 当前对话上下文
 * @returns {{ shouldRecord: boolean, type: string, reason: string, confidence: number }}
 */
function shouldRecord(userMessage, aiResponse, context = {}) {
  const text = `${userMessage || ''} ${aiResponse || ''}`.toLowerCase();
  const user = (userMessage || '').toLowerCase();

  // 纯闲聊 → 跳过
  if (isCasual(user)) {
    return { shouldRecord: false, type: null, reason: 'casual_chat', confidence: 0.9 };
  }

  // 系统命令 → 跳过
  if (/^[\/\\]/.test(user.trim()) || /^(new|reset|status|help|reasoning)/.test(user.trim())) {
    return { shouldRecord: false, type: null, reason: 'system_command', confidence: 1.0 };
  }

  // 超短消息且无实质内容 → 跳过
  if (user.trim().length < 3) {
    return { shouldRecord: false, type: null, reason: 'too_short', confidence: 0.8 };
  }

  // 检测各类值得记录的信号
  const signals = [];

  // 偏好信号
  if (hasPreferenceSignal(user)) {
    signals.push({ type: 'preference', confidence: 0.85, reason: 'preference_signal' });
  }

  // 决策信号
  if (/决定|确定|选|方案|用这个|就这个|不再|以后|从现在/.test(user)) {
    signals.push({ type: 'decision', confidence: 0.8, reason: 'decision_signal' });
  }

  // 项目信号
  if (/项目|project|版本|v\d|里程碑|阶段/.test(user)) {
    signals.push({ type: 'project', confidence: 0.75, reason: 'project_signal' });
  }

  // 错误/教训信号
  if (/错误|bug|踩坑|注意|不要|避免|教训|原因|因为/.test(user)) {
    signals.push({ type: 'error_pattern', confidence: 0.9, reason: 'error_signal' });
  }

  // 事实/知识信号
  if (/是|等于|定义|原理|规则|标准|规范/.test(user) && user.length > 15) {
    signals.push({ type: 'fact', confidence: 0.65, reason: 'fact_signal' });
  }

  // 多步骤/复杂任务
  if (user.length > 100 || (user.match(/[，,、；;]/g) || []).length >= 3) {
    signals.push({ type: 'task', confidence: 0.6, reason: 'complex_task' });
  }

  // 用户明确要求记住
  if (/记住|记下|别忘了|提醒我|备忘/.test(user)) {
    signals.push({ type: 'explicit', confidence: 1.0, reason: 'explicit_request' });
  }

  // 没有任何信号
  if (signals.length === 0) {
    // 长消息默认低优先级记录
    if (user.length > 50) {
      return { shouldRecord: true, type: 'context', reason: 'long_message', confidence: 0.3 };
    }
    return { shouldRecord: false, type: null, reason: 'no_signal', confidence: 0.7 };
  }

  // 取最高置信度的信号
  signals.sort((a, b) => b.confidence - a.confidence);
  const best = signals[0];

  return {
    shouldRecord: true,
    type: best.type,
    reason: best.reason,
    confidence: best.confidence,
    allSignals: signals
  };
}

function isCasual(text) {
  const casualPatterns = [
    /^(你好|嗨|hi|hello|hey|早上好|晚上好|晚安|拜拜|bye|ok|好的|收到|嗯|是的|对|谢|thanks)[\s!！。.]*$/i,
    /^(哈哈|呵呵|hh|233|666|牛|厉害|不错|好的呢|行吧|可以|行|ok)\s*$/i,
    /^(吃了吗|在吗|在不在|忙吗|睡了吗)\s*$/i,
    /^\s*[👍❤️😂🤔💡✅🙌🔥💯]+\s*$/u
  ];
  return casualPatterns.some(p => p.test(text.trim()));
}

function hasPreferenceSignal(text) {
  return /喜欢|偏好|习惯|prefer|want|风格|方式|习惯用|爱用|倾向|更喜|好用|推荐用|最好用/.test(text);
}

// ─── 2. 智能遗忘 ───────────────────────────────────────

const LIFECYCLE_PATH = path.join(__dirname, '../../memory/.memory-lifecycle.json');

/**
 * 计算记忆的生命周期状态
 * @param {Object} memory - 记忆对象
 * @returns {{ state: string, action: string, ttl: number }}
 */
function evaluateLifecycle(memory) {
  const now = Date.now();
  const created = new Date(memory.created_at || memory.timestamp || now).getTime();
  const updated = new Date(memory.updated_at || memory.created_at || now).getTime();
  const ageDays = (now - created) / 86400000;
  const idleDays = (now - updated) / 86400000;

  const importance = String(memory.importance || 'normal').toLowerCase();
  const type = String(memory.type || '').toLowerCase();

  // critical / error_pattern → 永不删除
  if (importance === 'critical' || type === 'error_pattern') {
    return { state: 'permanent', action: 'keep', ttl: Infinity };
  }

  // 被合并过的记忆 → 已归档
  if (memory.merged_into) {
    return { state: 'merged', action: 'archive', ttl: 0 };
  }

  // 非活跃 → 检查是否应该降级
  if (!memory.is_active) {
    return { state: 'inactive', action: 'archive', ttl: 0 };
  }

  // temporary → 7天过期
  if (importance === 'temporary' || importance === 'low') {
    if (ageDays > 7) return { state: 'expired', action: 'delete', ttl: 0 };
    return { state: 'active', action: 'keep', ttl: Math.max(0, 7 - ageDays) };
  }

  // important → 90天无更新考虑降级
  if (importance === 'important' || importance === 'high' || importance === 'normal') {
    if (idleDays > 90) return { state: 'cold', action: 'consider_archive', ttl: 0 };
    if (idleDays > 30) return { state: 'cooling', action: 'monitor', ttl: 90 - idleDays };
    return { state: 'active', action: 'keep', ttl: 30 - idleDays };
  }

  return { state: 'active', action: 'keep', ttl: 30 };
}

/**
 * 运行智能遗忘流程
 * @param {Object} options
 * @returns {{ scanned, archived, deleted, kept, details }}
 */
function runSmartForgetting(options = {}) {
  const { dryRun = true, memoryDir = path.join(__dirname, '../../memory/structured') } = options;

  const stats = { scanned: 0, archived: 0, deleted: 0, kept: 0, details: [] };

  if (!fs.existsSync(memoryDir)) return stats;

  const walkDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walkDir(full); continue; }
      if (!entry.name.endsWith('.json')) continue;

      try {
        const memory = JSON.parse(fs.readFileSync(full, 'utf-8'));
        stats.scanned++;

        const lifecycle = evaluateLifecycle(memory);

        if (lifecycle.action === 'delete') {
          stats.deleted++;
          stats.details.push({ id: memory.id, type: memory.type, state: lifecycle.state, action: 'delete' });
          if (!dryRun) {
            const archiveDir = path.join(path.dirname(memoryDir), 'archive');
            ensureDir(archiveDir);
            fs.renameSync(full, path.join(archiveDir, entry.name));
          }
        } else if (lifecycle.action === 'archive' || lifecycle.action === 'consider_archive') {
          stats.archived++;
          stats.details.push({ id: memory.id, type: memory.type, state: lifecycle.state, action: lifecycle.action });
        } else {
          stats.kept++;
        }
      } catch {}
    }
  };

  walkDir(memoryDir);

  // 保存生命周期报告
  const report = {
    timestamp: new Date().toISOString(),
    dryRun,
    stats: { scanned: stats.scanned, archived: stats.archived, deleted: stats.deleted, kept: stats.kept }
  };

  if (!dryRun) {
    const reportsDir = path.join(__dirname, '../../memory/reports');
    ensureDir(reportsDir);
    fs.writeFileSync(
      path.join(reportsDir, `forgetting-${new Date().toISOString().split('T')[0]}.json`),
      JSON.stringify(report, null, 2)
    );
  }

  return report;
}

// ─── 3. 主动提醒触发 ───────────────────────────────────

const REMINDERS_PATH = path.join(__dirname, '../../memory/active-reminders.json');

/**
 * 检测是否有值得主动提醒的内容
 * @param {Object} context - 当前状态（时间、活跃项目等）
 * @returns {Array<{ type, message, priority }>}
 */
function checkProactiveReminders(context = {}) {
  const reminders = [];
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // 加载模式
  let patterns = [];
  try {
    const { getActivePatterns } = require('./pattern-extractor');
    patterns = getActivePatterns({ minConfidence: 0.5 });
  } catch {}

  // 加载已有提醒
  let activeReminders = loadActiveReminders();

  // ── 周期模式触发 ──
  for (const pattern of patterns) {
    if (pattern.pattern_type !== 'cyclical') continue;

    // 周几活跃度低 → 不提醒
    if (pattern.category === 'weekly_rhythm' && /周[三四五六]/.test(pattern.content)) {
      if ([3, 4, 5, 6].includes(day)) continue;
    }

    // 活跃时段提醒
    if (pattern.category === 'time_rhythm' && hour >= 9 && hour <= 11) {
      // 早上高峰期，检查是否需要提醒项目
      reminders.push({
        type: 'pattern_trigger',
        message: `根据你的习惯，这个时段适合处理核心任务`,
        priority: 'low',
        patternId: pattern.id
      });
    }
  }

  // ── 未完成上下文提醒 ──
  // 检查最近对话中是否有未完成的讨论
  try {
    const { retrieve } = require('./retrieval-core');
    // 同步检查太重，用简化版
    const recentMemories = getRecentMemories(7);
    for (const mem of recentMemories) {
      const content = (mem.content || '').toLowerCase();
      // 检测标记了 TODO / 待办 / 待确认 的记忆
      if (/todo|待办|待确认|还没完成|下次继续|回头再/.test(content)) {
        const daysSince = (Date.now() - new Date(mem.created_at || 0).getTime()) / 86400000;
        if (daysSince >= 1 && daysSince <= 7) {
          reminders.push({
            type: 'unfinished_context',
            message: `有个待办可能需要跟进：${mem.content.slice(0, 80)}...`,
            priority: 'medium',
            memoryId: mem.id
          });
        }
      }
    }
  } catch {}

  // ── 相关记忆提醒 ──
  // 如果当前正在讨论某个话题，检查是否有相关的历史经验
  if (context.currentTopic) {
    reminders.push({
      type: 'related_context',
      message: `关于"${context.currentTopic}"，之前有相关经验可以参考`,
      priority: 'low'
    });
  }

  // 去重：不超过3个提醒
  return reminders.slice(0, 3);
}

function getRecentMemories(days) {
  const memDir = path.join(__dirname, '../../memory/structured');
  if (!fs.existsSync(memDir)) return [];

  const cutoff = Date.now() - days * 86400000;
  const memories = [];

  const walkDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walkDir(full); continue; }
      if (!entry.name.endsWith('.json')) continue;
      try {
        const m = JSON.parse(fs.readFileSync(full, 'utf-8'));
        const ts = new Date(m.created_at || m.updated_at || 0).getTime();
        if (ts >= cutoff && m.is_active !== false) memories.push(m);
      } catch {}
    }
  };
  walkDir(memDir);
  return memories;
}

function loadActiveReminders() {
  try {
    return JSON.parse(fs.readFileSync(REMINDERS_PATH, 'utf-8'));
  } catch { return []; }
}

function saveActiveReminders(reminders) {
  const dir = path.dirname(REMINDERS_PATH);
  ensureDir(dir);
  fs.writeFileSync(REMINDERS_PATH, JSON.stringify(reminders, null, 2));
}

// ─── 4. 主入口：自动处理一条对话 ────────────────────────

/**
 * 自动处理对话：判断是否记录 + 记录什么类型
 * @returns {{ recorded: boolean, type?: string, reason?: string }}
 */
function processConversation(userMessage, aiResponse, sessionId) {
  const decision = shouldRecord(userMessage, aiResponse);

  if (!decision.shouldRecord) {
    return { recorded: false, reason: decision.reason };
  }

  // 使用现有的 ultimate-memory 记录
  try {
    const um = require('./ultimate-memory');

    switch (decision.type) {
      case 'error_pattern':
        // 提取错误模式
        const errorInfo = extractErrorPattern(userMessage + ' ' + aiResponse);
        if (errorInfo) {
          um.recordErrorPattern(errorInfo);
        }
        break;

      case 'preference':
        um.storeStructuredMemory('preference', userMessage, {
          importance: 'important',
          confidence: decision.confidence
        });
        break;

      case 'decision':
        um.storeStructuredMemory('fact', `[决策] ${userMessage}`, {
          importance: 'important',
          confidence: decision.confidence
        });
        break;

      case 'project':
        um.storeStructuredMemory('project', userMessage, {
          importance: 'important',
          confidence: decision.confidence
        });
        break;

      default:
        um.storeStructuredMemory('fact', userMessage, {
          importance: 'temporary',
          confidence: decision.confidence
        });
        break;
    }

    // 同时记录原始对话
    um.storeRawConversation(sessionId || 'default', userMessage, aiResponse);

    return { recorded: true, type: decision.type, reason: decision.reason };
  } catch (e) {
    return { recorded: false, reason: 'error', error: e.message };
  }
}

function extractErrorPattern(text) {
  // 尝试从文本中提取结构化错误信息
  const text_lower = text.toLowerCase();

  // 模式1: 显式错误信息
  const errorMatch = text_lower.match(/错误[是为：:\s]+(.+?)(?:\n|$)/);
  const correctMatch = text_lower.match(/(?:正确|应该|fix)[是为：:\s]+(.+?)(?:\n|$)/);

  if (errorMatch) {
    return {
      scenario: text.slice(0, 80),
      error: errorMatch[1].trim(),
      correct: correctMatch ? correctMatch[1].trim() : '未知',
      context: 'auto_extracted'
    };
  }

  // 模式2: bug/问题关键词
  if (/bug|问题|不工作|报错|failed/.test(text_lower)) {
    return {
      scenario: text.slice(0, 80),
      error: text.slice(0, 150),
      correct: '待确认',
      context: 'auto_extracted'
    };
  }

  return null;
}

module.exports = {
  shouldRecord,
  evaluateLifecycle,
  runSmartForgetting,
  checkProactiveReminders,
  processConversation,
  isCasual,
  hasPreferenceSignal
};
