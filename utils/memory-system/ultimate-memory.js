/**
 * Ultimate Memory System v2.0
 * L0-L3 分层记忆 + 冲突解决 + 智能存储管理
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置
const CONFIG = {
  // 存储路径
  dbPath: process.env.MEMORY_DB_PATH || path.join(__dirname, 'memory.db'),
  rawLogPath: path.join(__dirname, '../../memory/raw-conversations'),
  
  // 保留策略
  retention: {
    l0_raw: { days: 90, maxRecords: 10000 },  // L0: 90天或1万条
    l1_summary: { days: 365 },  // L1: 1年
    l2_structured: {  // L2: 分级保留
      critical: { days: Infinity },
      important: { days: 90 },
      temporary: { days: 7 }
    }
  },
  
  // 冲突检测阈值
  conflict: {
    similarityThreshold: 0.75,  // 相似度超过此值视为冲突
    autoResolve: false  // 是否自动解决（false=询问用户）
  }
};

// 内存缓存
const cache = {
  recentConversations: [],
  activeMemories: new Map(),
  userProfile: null,
  lastCleanup: null
};

/**
 * 生成唯一ID
 */
function generateId(prefix = 'mem') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * 计算文本相似度 (简单版，可用 embedding 替换)
 */
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

/**
 * L0: 存储原始对话 (无损)
 */
function storeRawConversation(sessionId, userMessage, aiResponse, metadata = {}) {
  const record = {
    id: generateId('conv'),
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    user_message: userMessage,
    ai_response: aiResponse,
    metadata: {
      ...metadata,
      stored_at: new Date().toISOString()
    }
  };
  
  // 写入 JSONL 文件 (简单实现，后续可迁移到 SQLite)
  const logFile = path.join(CONFIG.rawLogPath, `${new Date().toISOString().split('T')[0]}.jsonl`);
  
  // 确保目录存在
  if (!fs.existsSync(CONFIG.rawLogPath)) {
    fs.mkdirSync(CONFIG.rawLogPath, { recursive: true });
  }
  
  fs.appendFileSync(logFile, JSON.stringify(record) + '\n');
  
  // 更新内存缓存
  cache.recentConversations.push(record);
  if (cache.recentConversations.length > 100) {
    cache.recentConversations.shift();
  }
  
  return record;
}

/**
 * L1: 生成每日摘要
 */
function generateDailySummary(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  const logFile = path.join(CONFIG.rawLogPath, `${dateStr}.jsonl`);
  
  if (!fs.existsSync(logFile)) {
    return null;
  }
  
  const conversations = fs.readFileSync(logFile, 'utf-8')
    .trim()
    .split('\n')
    .filter(line => line)
    .map(line => JSON.parse(line));
  
  // 提取关键信息
  const keyDecisions = [];
  const projectsMentioned = new Set();
  const preferencesMentioned = [];
  
  for (const conv of conversations) {
    const text = `${conv.user_message} ${conv.ai_response}`.toLowerCase();
    
    // 检测决策 (简化版，可用 NLP 改进)
    if (text.includes('决定') || text.includes('确定') || text.includes('选择')) {
      keyDecisions.push({
        time: conv.timestamp,
        content: conv.user_message.substring(0, 200)
      });
    }
    
    // 检测项目提及
    const projectMatch = text.match(/(\w+)\s*(项目|project)/i);
    if (projectMatch) {
      projectsMentioned.add(projectMatch[1]);
    }
    
    // 检测偏好
    if (text.includes('喜欢') || text.includes('prefer') || text.includes('want')) {
      preferencesMentioned.push(conv.user_message.substring(0, 150));
    }
  }
  
  const summary = {
    id: generateId('summary'),
    date: dateStr,
    conversation_count: conversations.length,
    summary: `今日共 ${conversations.length} 条对话，涉及 ${projectsMentioned.size} 个项目`,
    key_decisions: keyDecisions.slice(0, 10),  // 最多10个
    projects_mentioned: Array.from(projectsMentioned),
    preferences_mentioned: preferencesMentioned.slice(0, 5),
    created_at: new Date().toISOString()
  };
  
  // 保存摘要
  const summaryPath = path.join(__dirname, '../../memory/daily-summaries');
  if (!fs.existsSync(summaryPath)) {
    fs.mkdirSync(summaryPath, { recursive: true });
  }
  fs.writeFileSync(
    path.join(summaryPath, `${dateStr}.json`),
    JSON.stringify(summary, null, 2)
  );
  
  return summary;
}

/**
 * L2: 存储结构化记忆，带冲突检测
 */
function storeStructuredMemory(type, content, options = {}) {
  const {
    importance = 'important',  // critical, important, temporary
    source = null,
    confidence = 1.0,
    checkConflict = true
  } = options;
  
  const memory = {
    id: generateId('mem'),
    type,
    content,
    importance,
    source,
    confidence,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
    version: 1
  };
  
  // 冲突检测
  if (checkConflict) {
    const conflicts = detectConflicts(memory);
    if (conflicts.length > 0) {
      return {
        status: 'conflict_detected',
        memory,
        conflicts,
        message: '检测到潜在冲突，需要解决'
      };
    }
  }
  
  // 保存到文件
  saveStructuredMemory(memory);
  
  // 更新缓存
  cache.activeMemories.set(memory.id, memory);
  
  return {
    status: 'stored',
    memory
  };
}

/**
 * 检测记忆冲突
 */
function detectConflicts(newMemory) {
  const conflicts = [];
  
  for (const [id, existing] of cache.activeMemories) {
    if (existing.type !== newMemory.type) continue;
    if (!existing.is_active) continue;
    
    const similarity = calculateSimilarity(newMemory.content, existing.content);
    
    if (similarity >= CONFIG.conflict.similarityThreshold) {
      conflicts.push({
        existing_memory: existing,
        similarity_score: similarity,
        conflict_type: similarity > 0.9 ? 'duplicate' : 'related'
      });
    }
  }
  
  return conflicts;
}

/**
 * 解决冲突
 */
function resolveConflict(newMemory, existingMemory, resolution) {
  switch (resolution) {
    case 'replace':
      // 标记旧记忆为已替换
      existingMemory.is_active = false;
      existingMemory.replaced_by = newMemory.id;
      saveStructuredMemory(existingMemory);
      
      // 保存新记忆
      newMemory.replaces_id = existingMemory.id;
      newMemory.version = existingMemory.version + 1;
      saveStructuredMemory(newMemory);
      cache.activeMemories.set(newMemory.id, newMemory);
      return { status: 'replaced', newMemory };
      
    case 'keep_both':
      // 保存为新记忆
      saveStructuredMemory(newMemory);
      cache.activeMemories.set(newMemory.id, newMemory);
      return { status: 'kept_both', newMemory };
      
    case 'discard_new':
      return { status: 'discarded', reason: 'user_chose_existing' };
      
    default:
      return { status: 'pending', message: '需要用户确认' };
  }
}

/**
 * 保存结构化记忆到文件
 */
function saveStructuredMemory(memory) {
  const memoriesPath = path.join(__dirname, '../../memory/structured');
  if (!fs.existsSync(memoriesPath)) {
    fs.mkdirSync(memoriesPath, { recursive: true });
  }
  
  // 按类型分目录存储
  const typePath = path.join(memoriesPath, memory.type);
  if (!fs.existsSync(typePath)) {
    fs.mkdirSync(typePath, { recursive: true });
  }
  
  const filePath = path.join(typePath, `${memory.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
}

/**
 * 加载所有结构化记忆
 */
function loadAllStructuredMemories() {
  const memoriesPath = path.join(__dirname, '../../memory/structured');
  if (!fs.existsSync(memoriesPath)) {
    return [];
  }
  
  const memories = [];
  const types = fs.readdirSync(memoriesPath);
  
  for (const type of types) {
    const typePath = path.join(memoriesPath, type);
    if (!fs.statSync(typePath).isDirectory()) continue;
    
    const files = fs.readdirSync(typePath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const memory = JSON.parse(fs.readFileSync(path.join(typePath, file), 'utf-8'));
        memories.push(memory);
        cache.activeMemories.set(memory.id, memory);
      } catch (e) {
        console.error(`Error loading memory ${file}:`, e.message);
      }
    }
  }
  
  return memories;
}

/**
 * 智能清理过期记忆
 */
function cleanupExpiredMemories(dryRun = false) {
  const now = new Date();
  const stats = {
    checked: 0,
    expired: 0,
    archived: 0,
    deleted: 0
  };
  
  for (const [id, memory] of cache.activeMemories) {
    stats.checked++;
    
    const age = now - new Date(memory.created_at);
    const ageDays = age / (1000 * 60 * 60 * 24);
    
    let shouldDelete = false;
    let retention = CONFIG.retention.l2_structured[memory.importance];
    
    if (retention && retention.days !== Infinity) {
      shouldDelete = ageDays > retention.days;
    }
    
    if (shouldDelete) {
      stats.expired++;
      
      if (!dryRun) {
        // 归档到历史记录
        const archivePath = path.join(__dirname, '../../memory/archive');
        if (!fs.existsSync(archivePath)) {
          fs.mkdirSync(archivePath, { recursive: true });
        }
        
        const fileName = `${memory.id}.json`;
        const sourcePath = path.join(__dirname, '../../memory/structured', memory.type, fileName);
        
        if (fs.existsSync(sourcePath)) {
          fs.renameSync(sourcePath, path.join(archivePath, fileName));
          memory.is_active = false;
          memory.archived_at = now.toISOString();
          stats.archived++;
        }
      }
    }
  }
  
  cache.lastCleanup = now.toISOString();
  return stats;
}

/**
 * 搜索记忆
 */
function searchMemories(query, options = {}) {
  const {
    type = null,
    limit = 10,
    includeInactive = false
  } = options;
  
  const results = [];
  const queryLower = query.toLowerCase();
  
  for (const [id, memory] of cache.activeMemories) {
    if (!includeInactive && !memory.is_active) continue;
    if (type && memory.type !== type) continue;
    
    const contentLower = memory.content.toLowerCase();
    const score = calculateSimilarity(queryLower, contentLower);
    
    if (score > 0.1 || contentLower.includes(queryLower)) {
      results.push({
        memory,
        relevance_score: score,
        matched: contentLower.includes(queryLower)
      });
    }
  }
  
  // 按相关度排序
  results.sort((a, b) => b.relevance_score - a.relevance_score);
  
  return results.slice(0, limit);
}

/**
 * 初始化记忆系统
 */
function initialize() {
  console.log('Initializing Ultimate Memory System v2.0...');
  
  // 加载所有结构化记忆
  const memories = loadAllStructuredMemories();
  console.log(`Loaded ${memories.length} structured memories`);
  
  // 执行清理
  const stats = cleanupExpiredMemories(true);  // dry run
  console.log(`Cleanup check: ${stats.expired} memories need archiving`);
  
  return {
    status: 'initialized',
    memories_count: memories.length,
    cleanup_stats: stats
  };
}

// 导出 API
module.exports = {
  // L0 - 原始层
  storeRawConversation,
  
  // L1 - 摘要层
  generateDailySummary,
  
  // L2 - 结构化层
  storeStructuredMemory,
  detectConflicts,
  resolveConflict,
  loadAllStructuredMemories,
  
  // 管理
  cleanupExpiredMemories,
  searchMemories,
  initialize,
  
  // 配置
  CONFIG,
  cache
};

// 如果直接运行，执行初始化
if (require.main === module) {
  const result = initialize();
  console.log('Initialization result:', result);
}
