/**
 * Self-Improving System Core
 * 自我改进系统核心
 * 
 * 功能：
 * 1. 持续监控自身表现
 * 2. 识别错误和低效模式
 * 3. 生成并执行改进方案
 * 4. 验证改进效果
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const CONFIG = {
  // 监控频率
  checkInterval: 60 * 60 * 1000,  // 每小时检查一次
  
  // 改进阈值
  thresholds: {
    healthScore: 70,      // 健康分低于此值触发改进
    errorRate: 0.1,       // 错误率超过此值触发改进
    repetitionRate: 0.3   // 重复错误率超过此值触发改进
  },
  
  // 存储路径
  paths: {
    logs: path.join(__dirname, '../../memory/logs'),
    patterns: path.join(__dirname, '../../memory/self-improving/patterns'),
    improvements: path.join(__dirname, '../../memory/self-improving/improvements'),
    metrics: path.join(__dirname, '../../memory/self-improving/metrics')
  }
};

/**
 * 初始化自我改进系统
 */
function initialize() {
  console.log('[SelfImproving] 初始化自我改进系统...');
  
  // 确保目录存在
  Object.values(CONFIG.paths).forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // 加载历史模式
  const patterns = loadPatterns();
  console.log(`[SelfImproving] 已加载 ${patterns.length} 个历史模式`);
  
  return {
    status: 'initialized',
    patterns: patterns.length
  };
}

/**
 * 收集当前会话的日志和指标
 */
function collectSessionMetrics() {
  const sessionId = `session-${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  // 收集系统信息
  const metrics = {
    session_id: sessionId,
    timestamp,
    system: {
      node_version: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    },
    // 这里可以扩展更多指标
    tasks_completed: 0,
    errors_encountered: 0,
    tool_calls: 0,
    user_satisfaction: null  // 可由用户反馈填充
  };
  
  return metrics;
}

/**
 * 分析当前表现
 */
function analyzePerformance() {
  const metrics = collectSessionMetrics();
  
  // 加载历史指标进行对比
  const historicalMetrics = loadHistoricalMetrics();
  
  // 计算健康评分
  const healthScore = calculateHealthScore(metrics, historicalMetrics);
  
  // 检测退化
  const regressions = detectRegressions(metrics, historicalMetrics);
  
  // 识别改进机会
  const opportunities = identifyOpportunities(metrics, historicalMetrics);
  
  return {
    metrics,
    health_score: healthScore,
    regressions,
    opportunities,
    timestamp: new Date().toISOString()
  };
}

/**
 * 计算健康评分
 */
function calculateHealthScore(current, historical) {
  let score = 100;
  
  // 基于错误率扣分
  if (current.errors_encountered > 0) {
    score -= current.errors_encountered * 10;
  }
  
  // 基于内存使用扣分
  const memoryMB = current.system.memory.heapUsed / 1024 / 1024;
  if (memoryMB > 500) {
    score -= 10;
  }
  
  // 基于历史趋势调整
  if (historical.length > 0) {
    const avgHistorical = historical.reduce((sum, m) => sum + (m.health_score || 80), 0) / historical.length;
    if (score < avgHistorical - 10) {
      score -= 5;  // 显著退步额外扣分
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 检测退化
 */
function detectRegressions(current, historical) {
  const regressions = [];
  
  if (historical.length < 2) return regressions;
  
  const recent = historical.slice(-5);
  const avgRecent = recent.reduce((sum, m) => sum + (m.health_score || 80), 0) / recent.length;
  
  // 健康分显著下降
  if (current.health_score < avgRecent - 15) {
    regressions.push({
      type: 'health_decline',
      severity: 'high',
      description: `健康分从 ${avgRecent.toFixed(1)} 下降到 ${current.health_score}`,
      recommendation: '需要立即分析和改进'
    });
  }
  
  // 错误率上升
  const recentErrors = recent.reduce((sum, m) => sum + (m.errors_encountered || 0), 0);
  if (recentErrors > 0 && current.errors_encountered > recentErrors / recent.length) {
    regressions.push({
      type: 'error_increase',
      severity: 'medium',
      description: '错误率呈上升趋势',
      recommendation: '检查最近修改的代码'
    });
  }
  
  return regressions;
}

/**
 * 识别改进机会
 */
function identifyOpportunities(current, historical) {
  const opportunities = [];
  
  // 内存优化机会
  const memoryMB = current.system.memory.heapUsed / 1024 / 1024;
  if (memoryMB > 300) {
    opportunities.push({
      category: 'performance',
      description: '内存使用较高，可优化缓存策略',
      potential_impact: 'high',
      approach: '实现 LRU 缓存，限制内存中的历史数据量'
    });
  }
  
  // 响应速度优化
  if (current.system.uptime > 3600) {
    opportunities.push({
      category: 'reliability',
      description: '长时间运行，建议定期重启或清理',
      potential_impact: 'medium',
      approach: '实现 graceful restart 机制'
    });
  }
  
  return opportunities;
}

/**
 * 生成改进方案
 */
function generateImprovementPlan(analysis) {
  const plan = {
    id: `improvement-${Date.now()}`,
    timestamp: new Date().toISOString(),
    trigger: analysis.health_score < CONFIG.thresholds.healthScore ? 'low_health' : 'periodic',
    health_score: analysis.health_score,
    actions: []
  };
  
  // 基于退化生成修复动作
  for (const regression of analysis.regressions) {
    plan.actions.push({
      type: 'fix',
      priority: regression.severity === 'high' ? 'critical' : 'high',
      description: regression.description,
      approach: regression.recommendation,
      target: 'system'
    });
  }
  
  // 基于机会生成优化动作
  for (const opp of analysis.opportunities) {
    plan.actions.push({
      type: 'optimize',
      priority: opp.potential_impact === 'high' ? 'high' : 'medium',
      description: opp.description,
      approach: opp.approach,
      target: opp.category
    });
  }
  
  // 排序：critical > high > medium > low
  plan.actions.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  return plan;
}

/**
 * 执行改进方案
 */
function executeImprovement(plan) {
  const results = [];
  
  for (const action of plan.actions) {
    console.log(`[SelfImproving] 执行: ${action.description}`);
    
    const result = executeAction(action);
    results.push(result);
    
    // 记录执行结果
    recordActionResult(action, result);
  }
  
  return {
    plan_id: plan.id,
    executed_at: new Date().toISOString(),
    results
  };
}

/**
 * 执行单个改进动作
 */
function executeAction(action) {
  switch (action.type) {
    case 'fix':
      return executeFix(action);
    case 'optimize':
      return executeOptimization(action);
    case 'learn':
      return executeLearning(action);
    default:
      return { status: 'skipped', reason: 'unknown_action_type' };
  }
}

/**
 * 执行修复
 */
function executeFix(action) {
  // 这里可以实现自动修复逻辑
  // 例如：清理缓存、重启服务、回滚配置等
  
  return {
    status: 'completed',
    action: action.description,
    timestamp: new Date().toISOString()
  };
}

/**
 * 执行优化
 */
function executeOptimization(action) {
  // 这里可以实现自动优化逻辑
  // 例如：调整配置参数、优化算法等
  
  return {
    status: 'completed',
    action: action.description,
    timestamp: new Date().toISOString()
  };
}

/**
 * 执行学习
 */
function executeLearning(action) {
  // 从经验中学习，更新模式库
  
  return {
    status: 'completed',
    action: action.description,
    timestamp: new Date().toISOString()
  };
}

/**
 * 验证改进效果
 */
function verifyImprovement(planId) {
  // 重新分析表现
  const newAnalysis = analyzePerformance();
  
  // 加载之前的分析结果进行对比
  const planPath = path.join(CONFIG.paths.improvements, `${planId}.json`);
  if (!fs.existsSync(planPath)) {
    return { status: 'error', reason: 'plan_not_found' };
  }
  
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
  
  // 计算改进幅度
  const improvement = newAnalysis.health_score - plan.health_score;
  
  return {
    status: 'verified',
    plan_id: planId,
    before_health: plan.health_score,
    after_health: newAnalysis.health_score,
    improvement: improvement,
    success: improvement > 0,
    timestamp: new Date().toISOString()
  };
}

/**
 * 加载历史模式
 */
function loadPatterns() {
  const patternsPath = CONFIG.paths.patterns;
  if (!fs.existsSync(patternsPath)) return [];
  
  const files = fs.readdirSync(patternsPath).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(patternsPath, f), 'utf-8')));
}

/**
 * 加载历史指标
 */
function loadHistoricalMetrics() {
  const metricsPath = CONFIG.paths.metrics;
  if (!fs.existsSync(metricsPath)) return [];
  
  const files = fs.readdirSync(metricsPath)
    .filter(f => f.endsWith('.json'))
    .sort()
    .slice(-30);  // 最近 30 条
  
  return files.map(f => JSON.parse(fs.readFileSync(path.join(metricsPath, f), 'utf-8')));
}

/**
 * 记录动作执行结果
 */
function recordActionResult(action, result) {
  const record = {
    timestamp: new Date().toISOString(),
    action,
    result
  };
  
  const recordPath = path.join(CONFIG.paths.improvements, `action-${Date.now()}.json`);
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
}

/**
 * 主循环：自我改进
 */
function selfImprove() {
  console.log('\n[SelfImproving] ========== 开始自我改进循环 ==========');
  
  // 1. 分析当前表现
  console.log('[SelfImproving] 1. 分析当前表现...');
  const analysis = analyzePerformance();
  console.log(`[SelfImproving]    健康评分: ${analysis.health_score}`);
  console.log(`[SelfImproving]    退化问题: ${analysis.regressions.length} 个`);
  console.log(`[SelfImproving]    改进机会: ${analysis.opportunities.length} 个`);
  
  // 2. 检查是否需要改进
  if (analysis.health_score >= CONFIG.thresholds.healthScore && 
      analysis.regressions.length === 0) {
    console.log('[SelfImproving] 系统健康，无需改进');
    return { status: 'healthy', health_score: analysis.health_score };
  }
  
  // 3. 生成改进方案
  console.log('[SelfImproving] 2. 生成改进方案...');
  const plan = generateImprovementPlan(analysis);
  console.log(`[SelfImproving]    生成 ${plan.actions.length} 个改进动作`);
  
  // 保存改进方案
  const planPath = path.join(CONFIG.paths.improvements, `${plan.id}.json`);
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  
  // 4. 执行改进
  console.log('[SelfImproving] 3. 执行改进...');
  const execution = executeImprovement(plan);
  console.log(`[SelfImproving]    执行完成: ${execution.results.length} 个动作`);
  
  // 5. 验证改进效果
  console.log('[SelfImproving] 4. 验证改进效果...');
  const verification = verifyImprovement(plan.id);
  console.log(`[SelfImproving]    改进幅度: ${verification.improvement} 分`);
  console.log(`[SelfImproving]    改进成功: ${verification.success ? '是' : '否'}`);
  
  console.log('[SelfImproving] ========== 自我改进循环完成 ==========\n');
  
  return {
    status: 'improved',
    analysis,
    plan,
    execution,
    verification
  };
}

/**
 * 启动持续自我改进
 */
function startContinuousImprovement() {
  console.log('[SelfImproving] 启动持续自我改进模式');
  console.log(`[SelfImproving] 检查间隔: ${CONFIG.checkInterval / 1000} 秒`);
  
  // 立即执行一次
  selfImprove();
  
  // 定时执行
  setInterval(selfImprove, CONFIG.checkInterval);
  
  return { status: 'started', interval: CONFIG.checkInterval };
}

// 导出 API
module.exports = {
  initialize,
  analyzePerformance,
  generateImprovementPlan,
  executeImprovement,
  verifyImprovement,
  selfImprove,
  startContinuousImprovement,
  CONFIG
};

// 如果直接运行
if (require.main === module) {
  initialize();
  const result = selfImprove();
  console.log('\n最终结果:', JSON.stringify(result, null, 2));
}
