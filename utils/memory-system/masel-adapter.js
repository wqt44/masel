/**
 * MASEL Memory Adapter v2.0
 * 桥接 MASEL 和 Ultimate Memory System
 */

const ultimateMemory = require('./ultimate-memory.js');
const importanceManager = require('./importance-manager.js');
const fs = require('fs');
const path = require('path');

// 会话ID (用于 L0 原始记录)
let currentSessionId = null;

/**
 * 初始化记忆适配器
 */
function initAdapter(sessionId) {
  currentSessionId = sessionId || `session-${Date.now()}`;
  
  // 初始化终极记忆系统
  const result = ultimateMemory.initialize();
  
  console.log(`[MemoryAdapter] Initialized with session: ${currentSessionId}`);
  
  return {
    sessionId: currentSessionId,
    ...result
  };
}

/**
 * 记录对话 (L0 + L2 + 防遗忘检测)
 */
function recordConversation(userMessage, aiResponse, metadata = {}) {
  // L0: 无损存储原始对话
  const rawRecord = ultimateMemory.storeRawConversation(
    currentSessionId,
    userMessage,
    aiResponse,
    metadata
  );
  
  // L2: 提取结构化记忆 (简化版，可用 NLP 改进)
  extractAndStoreMemories(userMessage, aiResponse, rawRecord.id);
  
  // 防遗忘：检测项目提及并刷新重要性
  const forgetfulnessCheck = importanceManager.afterConversation(userMessage, aiResponse);
  
  return {
    ...rawRecord,
    forgetfulnessCheck
  };
}

/**
 * 从对话中提取结构化记忆
 */
function extractAndStoreMemories(userMessage, aiResponse, sourceId) {
  const text = `${userMessage} ${aiResponse}`;
  const memories = [];
  
  // 提取项目信息
  const projectPatterns = [
    /我有(?:一个|个)?(?:叫)?\s*(\w+)\s*(?:项目|project)/i,
    /(?:项目|project)\s*(\w+)\s*(?:是|正在)/i,
    /在做\s*(\w+)\s*(?:项目|project)/i
  ];
  
  for (const pattern of projectPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      const result = ultimateMemory.storeStructuredMemory(
        'project',
        `用户有一个叫 ${match[1]} 的项目`,
        {
          importance: 'important',
          source: sourceId,
          confidence: 0.8
        }
      );
      memories.push(result);
    }
  }
  
  // 提取偏好
  const preferencePatterns = [
    /我喜欢\s*(.+?)(?:\.|$|，)/i,
    /我(?:比较)?喜欢\s*(.+?)(?:\.|$|，)/i,
    /我偏好\s*(.+?)(?:\.|$|，)/i
  ];
  
  for (const pattern of preferencePatterns) {
    const match = text.match(pattern);
    if (match) {
      const result = ultimateMemory.storeStructuredMemory(
        'preference',
        `用户喜欢: ${match[1]}`,
        {
          importance: 'important',
          source: sourceId,
          confidence: 0.7
        }
      );
      memories.push(result);
    }
  }
  
  // 提取重要事实
  const factPatterns = [
    /(?:记住|note that)\s*(.+?)(?:\.|$|，)/i,
    /(?:重要的是|importantly)\s*(.+?)(?:\.|$|，)/i
  ];
  
  for (const pattern of factPatterns) {
    const match = text.match(pattern);
    if (match) {
      const result = ultimateMemory.storeStructuredMemory(
        'fact',
        match[1],
        {
          importance: 'critical',
          source: sourceId,
          confidence: 0.9
        }
      );
      memories.push(result);
    }
  }
  
  return memories;
}

/**
 * 搜索记忆 (增强版)
 */
function searchMemories(query, options = {}) {
  // 搜索 L2 结构化记忆
  const structuredResults = ultimateMemory.searchMemories(query, options);
  
  // 搜索 L1 每日摘要
  const summaryResults = searchDailySummaries(query);
  
  // 搜索 L0 原始对话 (最近 7 天)
  const rawResults = searchRawConversations(query, 7);
  
  return {
    structured: structuredResults,
    summaries: summaryResults,
    raw: rawResults,
    combined: combineResults(structuredResults, summaryResults, rawResults)
  };
}

/**
 * 搜索每日摘要
 */
function searchDailySummaries(query) {
  const summaryPath = path.join(__dirname, '../../memory/daily-summaries');
  if (!fs.existsSync(summaryPath)) {
    return [];
  }
  
  const results = [];
  const files = fs.readdirSync(summaryPath).filter(f => f.endsWith('.json'));
  const queryLower = query.toLowerCase();
  
  for (const file of files.slice(-30)) {  // 只搜索最近 30 天
    try {
      const summary = JSON.parse(fs.readFileSync(path.join(summaryPath, file), 'utf-8'));
      const text = JSON.stringify(summary).toLowerCase();
      
      if (text.includes(queryLower)) {
        results.push({
          type: 'daily_summary',
          date: summary.date,
          summary: summary.summary,
          relevance: text.split(queryLower).length - 1
        });
      }
    } catch (e) {
      // ignore
    }
  }
  
  return results.sort((a, b) => b.relevance - a.relevance);
}

/**
 * 搜索原始对话
 */
function searchRawConversations(query, daysBack = 7) {
  const results = [];
  const queryLower = query.toLowerCase();
  
  for (let i = 0; i < daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const logFile = path.join(__dirname, '../../memory/raw-conversations', `${dateStr}.jsonl`);
    if (!fs.existsSync(logFile)) continue;
    
    try {
      const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n').filter(l => l);
      
      for (const line of lines) {
        const record = JSON.parse(line);
        const text = `${record.user_message} ${record.ai_response}`.toLowerCase();
        
        if (text.includes(queryLower)) {
          results.push({
            type: 'raw_conversation',
            timestamp: record.timestamp,
            preview: record.user_message.substring(0, 100),
            relevance: text.split(queryLower).length - 1
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }
  
  return results.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
}

/**
 * 合并搜索结果
 */
function combineResults(structured, summaries, raw) {
  const combined = [];
  
  // 结构化记忆权重最高
  for (const item of structured.slice(0, 5)) {
    combined.push({
      source: 'structured',
      content: item.memory.content,
      type: item.memory.type,
      score: item.relevance_score * 1.5,  // 加权
      timestamp: item.memory.created_at
    });
  }
  
  // 每日摘要
  for (const item of summaries.slice(0, 3)) {
    combined.push({
      source: 'summary',
      content: item.summary,
      type: 'daily_summary',
      score: item.relevance,
      timestamp: item.date
    });
  }
  
  // 原始对话
  for (const item of raw.slice(0, 3)) {
    combined.push({
      source: 'raw',
      content: item.preview,
      type: 'conversation',
      score: item.relevance * 0.5,  // 较低权重
      timestamp: item.timestamp
    });
  }
  
  // 按分数排序
  return combined.sort((a, b) => b.score - a.score);
}

/**
 * 获取会话启动上下文
 */
function getSessionContext(options = {}) {
  const {
    conversationLimit = 10,
    summaryDays = 3,
    memoryLimit = 20
  } = options;
  
  const context = {
    timestamp: new Date().toISOString(),
    session_id: currentSessionId,
    sections: []
  };
  
  // 1. 活跃记忆
  const activeMemories = Array.from(ultimateMemory.cache.activeMemories.values())
    .filter(m => m.is_active)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, memoryLimit);
  
  if (activeMemories.length > 0) {
    context.sections.push({
      title: '活跃记忆',
      content: activeMemories.map(m => `- [${m.type}] ${m.content}`).join('\n')
    });
  }
  
  // 2. 最近每日摘要
  const recentSummaries = [];
  for (let i = 0; i < summaryDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const summaryFile = path.join(__dirname, '../../memory/daily-summaries', `${dateStr}.json`);
    if (fs.existsSync(summaryFile)) {
      try {
        const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
        recentSummaries.push(summary);
      } catch (e) {
        // ignore
      }
    }
  }
  
  if (recentSummaries.length > 0) {
    context.sections.push({
      title: '近期动态',
      content: recentSummaries.map(s => `### ${s.date}\n- ${s.summary}\n- 关键决策: ${s.key_decisions.length} 个`).join('\n\n')
    });
  }
  
  // 3. 最近原始对话
  const recentConversations = [];
  for (let i = 0; i < 3 && recentConversations.length < conversationLimit; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const logFile = path.join(__dirname, '../../memory/raw-conversations', `${dateStr}.jsonl`);
    if (!fs.existsSync(logFile)) continue;
    
    try {
      const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n').filter(l => l);
      const records = lines.slice(-5).map(l => JSON.parse(l));  // 每天最近 5 条
      recentConversations.push(...records);
    } catch (e) {
      // ignore
    }
  }
  
  if (recentConversations.length > 0) {
    context.sections.push({
      title: '最近对话',
      content: recentConversations
        .slice(-conversationLimit)
        .map(r => `[${new Date(r.timestamp).toLocaleTimeString()}] ${r.user_message.substring(0, 80)}`)
        .join('\n')
    });
  }
  
  // 4. 防遗忘提醒
  const forgetfulnessAlert = importanceManager.generateForgetfulnessAlert();
  if (forgetfulnessAlert) {
    context.sections.push({
      title: '🧠 记忆提醒',
      content: forgetfulnessAlert.message + '\n\n（如需继续跟踪这些项目，请在对话中提及它们）'
    });
    context.hasForgetfulnessAlert = true;
  }
  
  // 格式化输出
  context.formatted = context.sections
    .map(s => `## ${s.title}\n${s.content}`)
    .join('\n\n---\n\n');
  
  return context;
}

/**
 * 执行每日维护任务
 */
function dailyMaintenance() {
  console.log('[MemoryAdapter] Running daily maintenance...');
  
  // 1. 生成昨日摘要
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const summary = ultimateMemory.generateDailySummary(yesterday);
  
  if (summary) {
    console.log(`[MemoryAdapter] Generated summary for ${summary.date}: ${summary.summary}`);
  }
  
  // 2. 清理过期记忆
  const cleanupStats = ultimateMemory.cleanupExpiredMemories(false);
  console.log(`[MemoryAdapter] Cleanup: ${cleanupStats.archived} memories archived`);
  
  return {
    summary,
    cleanup: cleanupStats
  };
}

// 导出 API
module.exports = {
  initAdapter,
  recordConversation,
  searchMemories,
  getSessionContext,
  dailyMaintenance,
  
  // 透传终极记忆系统 API
  storeStructuredMemory: ultimateMemory.storeStructuredMemory,
  detectConflicts: ultimateMemory.detectConflicts,
  resolveConflict: ultimateMemory.resolveConflict,
  cleanupExpiredMemories: ultimateMemory.cleanupExpiredMemories
};

// 如果直接运行，执行初始化
if (require.main === module) {
  const result = initAdapter(`session-${Date.now()}`);
  console.log('Adapter initialized:', result);
  
  // 测试记录
  const testRecord = recordConversation(
    '我有一个叫 chachacha 的企业级项目',
    '好的，我记住了你的 chachacha 项目！'
  );
  console.log('Test record:', testRecord.id);
  
  // 测试搜索
  const searchResult = searchMemories('chachacha');
  console.log('Search result:', JSON.stringify(searchResult.combined, null, 2));
  
  // 测试会话上下文
  const context = getSessionContext();
  console.log('\nSession context preview:');
  console.log(context.formatted.substring(0, 500));
}
