/**
 * Global Memory System - 全局记忆系统
 * 
 * 基于 MASEL-Viking 三层记忆架构
 * 让 AI 自动记住用户的一切
 * 
 * 三层架构:
 * - 🔥 Hot: 内存缓存 (最近对话)
 * - 📁 Warm: 文件系统 (用户偏好、重要事件)
 * - ❄️ Cold: 向量搜索 (长期记忆)
 */

// ============================================================================
// 简单实现 - 不依赖 TypeScript 编译
// ============================================================================

const fs = require('fs');
const path = require('path');

// 记忆存储路径
const MEMORY_BASE_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'memory', 'global');

// 确保目录存在
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================================================
// 🔥 Hot Memory - 内存缓存
// ============================================================================

class HotMemory {
  constructor() {
    this.cache = new Map();
    this.maxSize = 100;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    // LRU: 如果满了，删除最旧的
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  getUserMemories(userId) {
    return this.get(`user:${userId}`) || {};
  }

  setUserMemories(userId, memories) {
    this.set(`user:${userId}`, memories);
  }
}

// ============================================================================
// 📁 Warm Memory - 文件系统
// ============================================================================

class WarmMemory {
  constructor() {
    ensureDir(MEMORY_BASE_PATH);
  }

  getUserPath(userId) {
    return path.join(MEMORY_BASE_PATH, 'users', userId);
  }

  // 保存用户偏好
  savePreference(userId, key, value, importance = 0.5) {
    const userPath = this.getUserPath(userId);
    ensureDir(userPath);
    
    const prefPath = path.join(userPath, 'preferences.json');
    let prefs = {};
    
    if (fs.existsSync(prefPath)) {
      prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
    }
    
    prefs[key] = {
      value,
      importance,
      updated_at: new Date().toISOString()
    };
    
    fs.writeFileSync(prefPath, JSON.stringify(prefs, null, 2));
  }

  // 加载用户偏好
  loadPreferences(userId) {
    const prefPath = path.join(this.getUserPath(userId), 'preferences.json');
    
    if (fs.existsSync(prefPath)) {
      return JSON.parse(fs.readFileSync(prefPath, 'utf8'));
    }
    return {};
  }

  // 保存对话
  saveConversation(userId, message, response) {
    const userPath = this.getUserPath(userId);
    const convPath = path.join(userPath, 'conversations');
    ensureDir(convPath);
    
    const date = new Date().toISOString().split('T')[0];
    const filePath = path.join(convPath, `${date}.jsonl`);
    
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      message: message.substring(0, 500),  // 限制长度
      response: response.substring(0, 500)
    }) + '\n';
    
    fs.appendFileSync(filePath, entry);
  }

  // 保存重要事件
  saveEvent(userId, type, description, importance = 0.5) {
    const userPath = this.getUserPath(userId);
    const eventsPath = path.join(userPath, 'events');
    ensureDir(eventsPath);
    
    const date = new Date().toISOString().split('T')[0];
    const filePath = path.join(eventsPath, `${date}.json`);
    
    let events = [];
    if (fs.existsSync(filePath)) {
      events = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    
    events.push({
      type,
      description,
      importance,
      timestamp: new Date().toISOString()
    });
    
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2));
  }

  // 获取今日对话
  getTodayConversations(userId) {
    const convPath = path.join(this.getUserPath(userId), 'conversations');
    const date = new Date().toISOString().split('T')[0];
    const filePath = path.join(convPath, `${date}.jsonl`);
    
    if (!fs.existsSync(filePath)) return [];
    
    const content = fs.readFileSync(filePath, 'utf8');
    return content.trim().split('\n').filter(line => line).map(line => JSON.parse(line));
  }
}

// ============================================================================
// ❄️ Cold Memory - 长期记忆 (简化版)
// ============================================================================

class ColdMemory {
  constructor() {
    this.indexPath = path.join(MEMORY_BASE_PATH, 'index.json');
    this.index = this.loadIndex();
  }

  loadIndex() {
    if (fs.existsSync(this.indexPath)) {
      return JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
    }
    return {};
  }

  saveIndex() {
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  // 添加记忆到索引
  addToIndex(userId, key, content) {
    if (!this.index[userId]) {
      this.index[userId] = [];
    }
    
    this.index[userId].push({
      key,
      content: content.substring(0, 200),
      timestamp: new Date().toISOString()
    });
    
    // 只保留最近 1000 条
    if (this.index[userId].length > 1000) {
      this.index[userId] = this.index[userId].slice(-1000);
    }
    
    this.saveIndex();
  }

  // 搜索相关记忆
  search(userId, query) {
    if (!this.index[userId]) return [];
    
    const lowerQuery = query.toLowerCase();
    return this.index[userId]
      .filter(item => item.content.toLowerCase().includes(lowerQuery))
      .slice(-10);  // 返回最近 10 条相关
  }
}

// ============================================================================
// 🧠 Global Memory Manager
// ============================================================================

class GlobalMemory {
  constructor() {
    this.hot = new HotMemory();
    this.warm = new WarmMemory();
    this.cold = new ColdMemory();
    this.currentUser = null;
  }

  // 初始化用户
  initUser(userId) {
    this.currentUser = userId;
    console.log(`🧠 [GlobalMemory] 初始化用户: ${userId}`);
    
    // 从 Warm 加载到 Hot
    const prefs = this.warm.loadPreferences(userId);
    this.hot.setUserMemories(userId, prefs);
    
    return this;
  }

  // 记住偏好
  rememberPreference(key, value, importance = 0.5) {
    if (!this.currentUser) {
      console.warn('[GlobalMemory] 未初始化用户');
      return;
    }

    // 保存到 Warm (文件)
    this.warm.savePreference(this.currentUser, key, value, importance);
    
    // 更新 Hot (内存)
    const memories = this.hot.getUserMemories(this.currentUser);
    memories[key] = { value, importance };
    this.hot.setUserMemories(this.currentUser, memories);
    
    // 添加到 Cold (索引)
    this.cold.addToIndex(this.currentUser, key, `${key}: ${value}`);
    
    console.log(`📝 [GlobalMemory] 记住: ${key} = ${value}`);
  }

  // 记住事件
  rememberEvent(type, description, importance = 0.5) {
    if (!this.currentUser) return;
    
    this.warm.saveEvent(this.currentUser, type, description, importance);
    this.cold.addToIndex(this.currentUser, `event:${Date.now()}`, description);
    
    console.log(`📌 [GlobalMemory] 记录事件: ${type} - ${description.substring(0, 50)}...`);
  }

  // 记录对话
  recordConversation(message, response) {
    if (!this.currentUser) return;
    
    this.warm.saveConversation(this.currentUser, message, response);
    
    // 自动提取偏好
    this.extractPreferences(message);
  }

  // 提取偏好
  extractPreferences(message) {
    const patterns = [
      { regex: /我喜欢(.+)/, key: 'likes', importance: 0.8 },
      { regex: /我讨厌(.+)/, key: 'dislikes', importance: 0.8 },
      { regex: /我希望(.+)/, key: 'wishes', importance: 0.7 },
      { regex: /请叫我(.+)/, key: 'preferred_name', importance: 0.9 },
      { regex: /我的名字是(.+)/, key: 'name', importance: 1.0 },
      { regex: /我是(.+)/, key: 'identity', importance: 0.8 },
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern.regex);
      if (match) {
        this.rememberPreference(pattern.key, match[1].trim(), pattern.importance);
      }
    }
  }

  // 回忆相关记忆
  recall(context) {
    if (!this.currentUser) return [];

    const memories = [];
    
    // 1. 从 Hot 获取高重要性偏好
    const hotMemories = this.hot.getUserMemories(this.currentUser);
    for (const [key, data] of Object.entries(hotMemories)) {
      if (data.importance >= 0.7) {
        memories.push(`用户的${key}: ${data.value}`);
      }
    }
    
    // 2. 从 Cold 搜索相关记忆
    const coldResults = this.cold.search(this.currentUser, context);
    for (const item of coldResults) {
      memories.push(item.content);
    }
    
    return memories;
  }

  // 获取用户画像
  getProfile() {
    if (!this.currentUser) return null;
    
    return {
      userId: this.currentUser,
      preferences: this.warm.loadPreferences(this.currentUser),
      todayConversations: this.warm.getTodayConversations(this.currentUser).length
    };
  }
}

// ============================================================================
// 全局实例
// ============================================================================

const globalMemory = new GlobalMemory();

// ============================================================================
// 便捷函数
// ============================================================================

function initMemory(userId) {
  return globalMemory.initUser(userId);
}

function remember(key, value, importance) {
  globalMemory.rememberPreference(key, value, importance);
}

function rememberEvent(type, description, importance) {
  globalMemory.rememberEvent(type, description, importance);
}

function recordChat(message, response) {
  globalMemory.recordConversation(message, response);
}

function recall(context) {
  return globalMemory.recall(context);
}

function getProfile() {
  return globalMemory.getProfile();
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  GlobalMemory,
  globalMemory,
  // 便捷函数
  initMemory,
  remember,
  rememberEvent,
  recordChat,
  recall,
  getProfile
};

// 如果直接运行
if (require.main === module) {
  console.log('Global Memory System loaded!');
  console.log('Usage:');
  console.log('  const { initMemory, remember, recall } = require("./global-memory");');
  console.log('  initMemory("TvTongg");');
  console.log('  remember("likes", "详细设计讨论");');
  console.log('  const memories = recall("设计功能");');
}
