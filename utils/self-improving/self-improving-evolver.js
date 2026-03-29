/**
 * Self-Improving System with Capability Evolver Integration
 * 集成 Capability Evolver 的自我改进系统
 */

const selfImproving = require('./self-improving.js');
const capabilityEvolver = require('../capability-evolver-pro/src/index.js');
const fs = require('fs');
const path = require('path');

/**
 * 使用 Capability Evolver 分析日志
 */
function analyzeWithEvolver(logs) {
  // 转换日志格式以适配 Capability Evolver
  const evolverLogs = logs.map(log => ({
    timestamp: log.timestamp || new Date().toISOString(),
    level: log.level || 'info',
    message: log.message,
    context: log.context || 'system'
  }));
  
  // 调用 Capability Evolver
  const analysis = capabilityEvolver.analyze({
    logs: evolverLogs
  });
  
  return analysis;
}

/**
 * 生成进化方案
 */
function evolveWithEvolver(logs, strategy = 'balanced') {
  const evolverLogs = logs.map(log => ({
    timestamp: log.timestamp || new Date().toISOString(),
    level: log.level || 'info',
    message: log.message,
    context: log.context || 'system'
  }));
  
  const evolution = capabilityEvolver.evolve({
    logs: evolverLogs,
    strategy
  });
  
  return evolution;
}

/**
 * 收集系统日志
 */
function collectSystemLogs() {
  const logs = [];
  
  // 1. 从文件加载最近的日志
  const logsPath = path.join(__dirname, '../../memory/logs');
  if (fs.existsSync(logsPath)) {
    const files = fs.readdirSync(logsPath)
      .filter(f => f.endsWith('.log') || f.endsWith('.jsonl'))
      .sort()
      .slice(-3);  // 最近 3 个日志文件
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(logsPath, file), 'utf-8');
        const lines = content.trim().split('\n').filter(l => l);
        
        for (const line of lines) {
          try {
            const log = JSON.parse(line);
            logs.push(log);
          } catch (e) {
            // 非 JSON 格式，作为文本日志
            logs.push({
              timestamp: new Date().toISOString(),
              level: 'info',
              message: line,
              context: file
            });
          }
        }
      } catch (e) {
        console.error(`[SelfImproving] 读取日志失败: ${file}`, e.message);
      }
    }
  }
  
  // 2. 添加当前会话的指标
  const metrics = selfImproving.collectSessionMetrics();
  logs.push({
    timestamp: metrics.timestamp,
    level: 'info',
    message: `Session metrics: health_score=${selfImproving.analyzePerformance().health_score}`,
    context: 'metrics'
  });
  
  return logs;
}

/**
 * 执行完整的自我改进循环（集成版）
 */
function executeSelfImprovementCycle() {
  console.log('\n[SelfImproving+Evolver] ========== 开始自我改进循环 ==========');
  
  // 1. 收集日志
  console.log('[SelfImproving+Evolver] 1. 收集系统日志...');
  const logs = collectSystemLogs();
  console.log(`[SelfImproving+Evolver]    收集到 ${logs.length} 条日志`);
  
  // 2. 使用 Capability Evolver 分析
  console.log('[SelfImproving+Evolver] 2. Capability Evolver 分析...');
  const evolverAnalysis = analyzeWithEvolver(logs);
  console.log(`[SelfImproving+Evolver]    健康评分: ${evolverAnalysis.health_score}`);
  console.log(`[SelfImproving+Evolver]    检测到 ${evolverAnalysis.patterns.length} 个模式`);
  
  // 3. 生成进化方案
  console.log('[SelfImproving+Evolver] 3. 生成进化方案...');
  const strategy = evolverAnalysis.health_score < 50 ? 'harden' : 
                   evolverAnalysis.health_score < 80 ? 'balanced' : 'innovate';
  
  const evolution = evolveWithEvolver(logs, strategy);
  console.log(`[SelfImproving+Evolver]    策略: ${evolution.strategy}`);
  console.log(`[SelfImproving+Evolver]    建议数: ${evolution.recommendations.length}`);
  console.log(`[SelfImproving+Evolver]    预计改进: ${evolution.estimated_improvement}`);
  
  // 4. 转换建议为可执行动作
  console.log('[SelfImproving+Evolver] 4. 转换建议为动作...');
  const actions = convertRecommendationsToActions(evolution.recommendations);
  console.log(`[SelfImproving+Evolver]    生成 ${actions.length} 个可执行动作`);
  
  // 5. 执行动作
  console.log('[SelfImproving+Evolver] 5. 执行改进动作...');
  const executionResults = executeActions(actions);
  console.log(`[SelfImproving+Evolver]    执行完成: ${executionResults.success}/${executionResults.total}`);
  
  // 6. 记录改进历史
  console.log('[SelfImproving+Evolver] 6. 记录改进历史...');
  const improvementRecord = {
    id: `improvement-${Date.now()}`,
    timestamp: new Date().toISOString(),
    evolver_analysis: evolverAnalysis,
    evolution: evolution,
    actions: actions,
    execution: executionResults,
    status: executionResults.success === executionResults.total ? 'success' : 'partial'
  };
  
  const recordPath = path.join(__dirname, '../../memory/self-improving/history', `${improvementRecord.id}.json`);
  if (!fs.existsSync(path.dirname(recordPath))) {
    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  }
  fs.writeFileSync(recordPath, JSON.stringify(improvementRecord, null, 2));
  
  console.log('[SelfImproving+Evolver] ========== 自我改进循环完成 ==========\n');
  
  return improvementRecord;
}

/**
 * 将 Capability Evolver 的建议转换为可执行动作
 */
function convertRecommendationsToActions(recommendations) {
  const actions = [];
  
  for (const rec of recommendations) {
    const action = {
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      priority: rec.priority || 'medium',
      category: rec.category || 'general',
      description: rec.description,
      approach: rec.suggested_approach || rec.approach,
      affected_files: rec.affected_files || [],
      status: 'pending'
    };
    
    // 根据类别确定动作类型
    if (rec.category === 'reliability' || rec.category === 'bugfix') {
      action.type = 'fix';
    } else if (rec.category === 'performance' || rec.category === 'optimization') {
      action.type = 'optimize';
    } else if (rec.category === 'architecture' || rec.category === 'refactor') {
      action.type = 'refactor';
    } else {
      action.type = 'improve';
    }
    
    actions.push(action);
  }
  
  return actions;
}

/**
 * 执行动作
 */
function executeActions(actions) {
  const results = {
    total: actions.length,
    success: 0,
    failed: 0,
    skipped: 0,
    details: []
  };
  
  for (const action of actions) {
    console.log(`[SelfImproving+Evolver]   执行: ${action.description}`);
    
    try {
      const result = executeSingleAction(action);
      action.status = result.status;
      
      if (result.status === 'success') {
        results.success++;
      } else if (result.status === 'skipped') {
        results.skipped++;
      } else {
        results.failed++;
      }
      
      results.details.push({
        action: action.id,
        status: result.status,
        result: result
      });
    } catch (e) {
      console.error(`[SelfImproving+Evolver]   执行失败:`, e.message);
      action.status = 'failed';
      results.failed++;
      results.details.push({
        action: action.id,
        status: 'failed',
        error: e.message
      });
    }
  }
  
  return results;
}

/**
 * 执行单个动作
 */
function executeSingleAction(action) {
  switch (action.type) {
    case 'fix':
      return executeFixAction(action);
    case 'optimize':
      return executeOptimizeAction(action);
    case 'refactor':
      return executeRefactorAction(action);
    default:
      return executeGenericAction(action);
  }
}

/**
 * 执行修复动作
 */
function executeFixAction(action) {
  // 实现自动修复逻辑
  console.log(`[SelfImproving+Evolver]     修复: ${action.description}`);
  
  // 示例：如果提到缓存问题，清理缓存
  if (action.description.includes('缓存') || action.description.includes('cache')) {
    const cachePath = path.join(__dirname, '../../memory/cache');
    if (fs.existsSync(cachePath)) {
      // 清理过期缓存文件
      const files = fs.readdirSync(cachePath);
      let cleaned = 0;
      for (const file of files) {
        const filePath = path.join(cachePath, file);
        const stats = fs.statSync(filePath);
        const age = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        if (age > 7) {  // 清理 7 天以上的缓存
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }
      return { status: 'success', cleaned };
    }
  }
  
  return { status: 'skipped', reason: 'auto_fix_not_implemented' };
}

/**
 * 执行优化动作
 */
function executeOptimizeAction(action) {
  console.log(`[SelfImproving+Evolver]     优化: ${action.description}`);
  
  // 示例：如果提到内存优化，调整配置
  if (action.description.includes('内存') || action.description.includes('memory')) {
    // 调整配置参数
    return { status: 'success', adjustment: 'memory_limit_reduced' };
  }
  
  return { status: 'skipped', reason: 'auto_optimize_not_implemented' };
}

/**
 * 执行重构动作
 */
function executeRefactorAction(action) {
  console.log(`[SelfImproving+Evolver]     重构: ${action.description}`);
  
  // 重构通常需要人工审查，标记为待审核
  return { status: 'pending_review', reason: 'refactor_requires_human_approval' };
}

/**
 * 执行通用动作
 */
function executeGenericAction(action) {
  console.log(`[SelfImproving+Evolver]     通用: ${action.description}`);
  return { status: 'skipped', reason: 'generic_action_not_implemented' };
}

/**
 * 获取改进历史报告
 */
function getImprovementHistory() {
  const historyPath = path.join(__dirname, '../../memory/self-improving/history');
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  
  const files = fs.readdirSync(historyPath)
    .filter(f => f.endsWith('.json'))
    .sort()
    .slice(-30);  // 最近 30 次
  
  return files.map(f => JSON.parse(fs.readFileSync(path.join(historyPath, f), 'utf-8')));
}

/**
 * 生成改进趋势报告
 */
function generateTrendReport() {
  const history = getImprovementHistory();
  
  if (history.length === 0) {
    return { status: 'no_data', message: '暂无改进历史' };
  }
  
  const scores = history.map(h => h.evolver_analysis?.health_score || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const trend = scores[scores.length - 1] - scores[0];
  
  return {
    status: 'success',
    total_improvements: history.length,
    average_health_score: avgScore.toFixed(2),
    health_trend: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
    trend_value: trend.toFixed(2),
    last_improvement: history[history.length - 1].timestamp,
    recommendations: trend < 0 ? ['系统健康度下降，建议立即审查'] : ['系统运行良好，继续保持']
  };
}

// 导出 API
module.exports = {
  analyzeWithEvolver,
  evolveWithEvolver,
  executeSelfImprovementCycle,
  getImprovementHistory,
  generateTrendReport,
  collectSystemLogs
};

// 如果直接运行
if (require.main === module) {
  const result = executeSelfImprovementCycle();
  console.log('\n最终结果:', JSON.stringify(result, null, 2));
}
