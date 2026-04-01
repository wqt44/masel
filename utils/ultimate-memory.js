/**
 * Ultimate Memory System - 终极记忆系统
 * 
 * 整合所有记忆功能：
 * 1. 基础规则提取
 * 2. 自适应规则学习
 * 3. 上下文感知记忆
 * 4. 话语模式分析
 * 5. 时间衰减权重
 */

const { SmartMemory } = require('./smart-memory.js');
const { AdaptiveRuleLearner } = require('./adaptive-learner.js');
const { ContextAwareMemory } = require('./context-memory.js');
const { TimeDecayMemory } = require('./time-decay-memory.js');
const { ProactiveConfirm } = require('./proactive-confirm.js');
const { PredictiveMemory } = require('./predictive-memory.js');
const { MaselSQLiteAdapter } = require('./sqlite-adapter.js');

class UltimateMemory {
  constructor(userId) {
    this.userId = userId;
    
    // 初始化各子系统
    this.smartMemory = new SmartMemory(userId);
    this.adaptiveLearner = new AdaptiveRuleLearner(userId);
    this.contextMemory = new ContextAwareMemory(userId);
    this.timeDecayMemory = new TimeDecayMemory(userId, {
      halfLifeDays: 30,
      boostRecent: true,
      recentWindowDays: 7
    });
    this.proactiveConfirm = new ProactiveConfirm(userId);
    this.predictiveMemory = new PredictiveMemory(userId);
    
    // v1.8.0: SQLite 长期记忆引擎
    try {
      this.sqlite = new MaselSQLiteAdapter();
      console.log(`🗄️ [UltimateMemory] SQLite 长期记忆引擎已连接`);
    } catch (e) {
      console.warn(`⚠️ [UltimateMemory] SQLite 初始化失败，降级到纯 JSON: ${e.message}`);
      this.sqlite = null;
    }
    
    // 对话计数
    this.conversationCount = 0;
    
    // 待确认的规则
    this.pendingConfirmations = [];
  }

  // 记录对话
  record(message, response) {
    this.conversationCount++;
    
    console.log(`\n💬 [UltimateMemory] 记录对话 #${this.conversationCount}`);
    
    // 1. 更新上下文
    this.contextMemory.updateContext(message, response);
    
    // 2. 自适应学习（可能学习新规则）
    const extracted = this.adaptiveLearner.learn(message);
    
    // 3. 基础规则提取
    const baseExtractedCount = this.smartMemory.learn(message, '');
    
    // 4. 使用自适应学习的结果
    const allExtracted = extracted;
    
    // 5. 上下文感知学习
    if (allExtracted.length > 0) {
      this.contextMemory.learn(message, allExtracted);
    }
    
    // 6. 时间衰减记忆
    for (const item of allExtracted) {
      this.timeDecayMemory.add({
        key: item.key,
        value: item.value,
        type: item.type,
        weight: item.weight,
        source: 'extracted'
      });
    }
    
    // 7. SQLite 长期记忆双写
    if (this.sqlite) {
      for (const item of allExtracted) {
        try {
          const category = this.sqlite._inferCategory(item.type || item.key);
          const tier = item.weight >= 0.9 ? 'critical' : item.weight >= 0.7 ? 'important' : 'temporary';
          this.sqlite.store({
            category,
            tier,
            key: item.key,
            value: item.value,
            type: item.type || 'fact',
            weight: item.weight,
            context: item.context || '',
            source: new Date().toISOString().split('T')[0]
          });
        } catch (e) { /* 静默失败，不影响主流程 */ }
      }
    }
    
    // 8. 主动确认检查
    this.checkForConfirmation(message);
    
    // 9. 预测性记忆
    this.predictiveMemory.recordMessage(message, allExtracted);
    
    return allExtracted.length;
  }

  // 检查是否需要确认
  checkForConfirmation(message) {
    // 检查频率统计
    for (const [template, data] of Object.entries(this.adaptiveLearner.phraseFrequency)) {
      if (data.count >= 3 && this.proactiveConfirm.shouldRequestConfirm(template, data.count)) {
        const confirmRequest = this.proactiveConfirm.requestConfirmation(template, {
          key: this.adaptiveLearner.generateKey(data.verb),
          type: this.adaptiveLearner.inferRuleType(data.verb).type,
          examples: data.examples,
          frequency: data.count
        });
        
        this.pendingConfirmations.push(confirmRequest);
        console.log(`\n❓ [UltimateMemory] 发现新规则，请求确认:`);
        console.log(confirmRequest.message);
      }
    }
  }

  // 确认规则
  confirmRule(confirmationId) {
    const confirmed = this.proactiveConfirm.confirm(confirmationId);
    if (confirmed) {
      // 从待确认列表移除
      this.pendingConfirmations = this.pendingConfirmations.filter(c => c.confirmationId !== confirmationId);
      console.log(`✅ [UltimateMemory] 规则已确认并激活: ${confirmed.pattern}`);
    }
    return confirmed;
  }

  // 拒绝规则
  rejectRule(confirmationId, reason) {
    const rejected = this.proactiveConfirm.reject(confirmationId, reason);
    if (rejected) {
      this.pendingConfirmations = this.pendingConfirmations.filter(c => c.confirmationId !== confirmationId);
      console.log(`❌ [UltimateMemory] 规则已拒绝: ${rejected.pattern}`);
    }
    return rejected;
  }

  // 获取预测
  getPrediction() {
    return this.predictiveMemory.predictNext();
  }

  // 获取待确认列表
  getPendingConfirmations() {
    return this.pendingConfirmations;
  }

  // 回忆（智能综合 + SQLite）
  recall(query) {
    console.log(`\n🔍 [UltimateMemory] 回忆: "${query}"`);
    
    const results = [];
    const seenValues = new Set();
    
    // 1. 上下文感知回忆
    const contextResults = this.contextMemory.recall(query);
    for (const r of contextResults) {
      if (!seenValues.has(r.value)) {
        seenValues.add(r.value);
        results.push({
          value: r.value, type: r.type, weight: r.weight,
          source: 'context', relevance: r.relevance, context: r.context
        });
      }
    }
    
    // 2. 基础记忆回忆
    const baseResults = this.smartMemory.recall(query);
    for (const r of baseResults) {
      if (!seenValues.has(r.value)) {
        seenValues.add(r.value);
        results.push({
          value: r.value, type: r.type, weight: r.weight,
          source: 'base', relevance: r.relevance
        });
      }
    }
    
    // 3. 时间衰减回忆
    const decayResults = this.timeDecayMemory.recall(query, 5);
    for (const r of decayResults) {
      if (!seenValues.has(r.value)) {
        seenValues.add(r.value);
        results.push({
          value: r.value, type: r.type, weight: r.currentWeight,
          source: 'time-decay', relevance: 0.5,
          daysAgo: r.decay.daysAgo, isRecent: r.decay.isRecent
        });
      }
    }
    
    // 4. SQLite 长期记忆查询
    if (this.sqlite) {
      try {
        const sqliteResults = this.sqlite.search(query, { limit: 5 });
        for (const r of sqliteResults) {
          if (!seenValues.has(r.value)) {
            seenValues.add(r.value);
            results.push({
              value: r.value, type: r.type, weight: r.decay_score * r.weight,
              source: 'sqlite', relevance: 0.8,
              tier: r.tier, category: r.category
            });
          }
        }
      } catch (e) { /* 静默 */ }
    }
    
    // 5. 按综合分数排序
    results.sort((a, b) => {
      const scoreA = (a.relevance || 0.5) * a.weight;
      const scoreB = (b.relevance || 0.5) * b.weight;
      return scoreB - scoreA;
    });
    
    return results.slice(0, 10);
  }

  // 获取完整画像
  getFullProfile() {
    const adaptiveStats = this.adaptiveLearner.getStats();
    const contextStats = this.contextMemory.getContextStats();
    const baseProfile = this.smartMemory.getProfile();
    const decayStats = this.timeDecayMemory.getStats();
    const confirmStats = this.proactiveConfirm.getStats();
    const predictiveStats = this.predictiveMemory.getStats();

    return {
      userId: this.userId,
      conversationCount: this.conversationCount,

      // 规则统计
      rules: {
        base: adaptiveStats.baseRules,
        learned: adaptiveStats.learnedRules,
        total: adaptiveStats.totalRules
      },

      // 上下文统计
      context: contextStats,

      // 基础偏好
      preferences: baseProfile,

      // 学习到的规则详情
      learnedRules: adaptiveStats.learnedRulesDetail,

      // 时间衰减统计
      timeDecay: decayStats,

      // 确认统计
      confirmations: confirmStats,

      // 预测统计
      predictions: predictiveStats,

      // 待确认
      pendingConfirmations: this.pendingConfirmations.length
    };
  }

  // 导出所有记忆
  exportAll() {
    return {
      userId: this.userId,
      baseMemories: this.smartMemory.export(),
      learnedRules: this.adaptiveLearner.learnedRules,
      contextMemories: this.contextMemory.contextMemories,
      conversationCount: this.conversationCount
    };
  }
}

// 全局实例
let ultimateMemory = null;

function initUltimateMemory(userId) {
  ultimateMemory = new UltimateMemory(userId);
  console.log(`\n🎯 [UltimateMemory] 终极记忆系统启动!`);
  console.log(`   用户: ${userId}`);
  console.log(`   功能: 基础规则 + 自适应学习 + 上下文感知 + 时间衰减 + 主动确认 + 预测性记忆`);
  return ultimateMemory;
}

function ultimateRecord(message, response) {
  if (!ultimateMemory) {
    console.warn('[UltimateMemory] 请先调用 initUltimateMemory()');
    return 0;
  }
  return ultimateMemory.record(message, response);
}

function ultimateRecall(query) {
  if (!ultimateMemory) return [];
  return ultimateMemory.recall(query);
}

function ultimateProfile() {
  if (!ultimateMemory) return null;
  return ultimateMemory.getFullProfile();
}

function ultimateConfirm(confirmationId) {
  if (!ultimateMemory) return null;
  return ultimateMemory.confirmRule(confirmationId);
}

function ultimateReject(confirmationId, reason) {
  if (!ultimateMemory) return null;
  return ultimateMemory.rejectRule(confirmationId, reason);
}

function ultimateGetPending() {
  if (!ultimateMemory) return [];
  return ultimateMemory.getPendingConfirmations();
}

function ultimatePredict() {
  if (!ultimateMemory) return null;
  return ultimateMemory.getPrediction();
}

// v1.8.0: 直接访问 SQLite 引擎
function ultimateSQLite() {
  if (!ultimateMemory || !ultimateMemory.sqlite) return null;
  return ultimateMemory.sqlite;
}

// v1.8.0: SQLite 全文搜索
function ultimateSearch(query, opts) {
  if (!ultimateMemory || !ultimateMemory.sqlite) return [];
  return ultimateMemory.sqlite.search(query, opts);
}

// v1.8.0: 运行衰减 + 清理
function ultimateDecay() {
  if (!ultimateMemory || !ultimateMemory.sqlite) return null;
  const decayed = ultimateMemory.sqlite.runDecay();
  const pruned = ultimateMemory.sqlite.prune();
  return { decayed, pruned };
}

// v1.8.0: 导出完整数据
function ultimateExport() {
  if (!ultimateMemory || !ultimateMemory.sqlite) return null;
  return ultimateMemory.sqlite.exportToJSON();
}

// v1.8.0: SQLite 统计
function ultimateSQLiteStats() {
  if (!ultimateMemory || !ultimateMemory.sqlite) return null;
  return ultimateMemory.sqlite.stats();
}

module.exports = {
  UltimateMemory,
  initUltimateMemory,
  ultimateRecord,
  ultimateRecall,
  ultimateProfile,
  ultimateConfirm,
  ultimateReject,
  ultimateGetPending,
  ultimatePredict,
  // v1.8.0
  ultimateSQLite,
  ultimateSearch,
  ultimateDecay,
  ultimateExport,
  ultimateSQLiteStats,
};

// 测试
if (require.main === module) {
  console.log('Ultimate Memory System loaded!');
}
