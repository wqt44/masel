/**
 * Smart Memory - 智能记忆系统
 * 
 * 更聪明地记住用户的一切
 * 支持动态学习和多维度记忆
 */

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'memory', 'smart');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 基础模式
const BASE_PATTERNS = [
  { pattern: /我喜欢(.+)/, key: 'likes', type: 'preference', weight: 0.8 },
  { pattern: /我讨厌(.+)/, key: 'dislikes', type: 'preference', weight: 0.8 },
  { pattern: /我希望(.+)/, key: 'wishes', type: 'preference', weight: 0.7 },
  { pattern: /请叫我(.+)/, key: 'preferred_name', type: 'identity', weight: 0.9 },
  { pattern: /我的名字是(.+)/, key: 'name', type: 'identity', weight: 1.0 },
  { pattern: /我是(.+)/, key: 'identity', type: 'identity', weight: 0.8 },
  { pattern: /我擅长(.+)/, key: 'skills', type: 'ability', weight: 0.7 },
  { pattern: /我不擅长(.+)/, key: 'weaknesses', type: 'ability', weight: 0.7 },
  { pattern: /我的目标是(.+)/, key: 'goals', type: 'future', weight: 0.9 },
  { pattern: /我的梦想是(.+)/, key: 'dreams', type: 'future', weight: 0.9 },
  { pattern: /我记得(.+)/, key: 'memories', type: 'past', weight: 0.8 },
  { pattern: /我曾经(.+)/, key: 'experiences', type: 'past', weight: 0.7 },
  { pattern: /我习惯(.+)/, key: 'habits', type: 'behavior', weight: 0.8 },
  { pattern: /我通常(.+)/, key: 'habits', type: 'behavior', weight: 0.7 },
  { pattern: /我觉得(.+)/, key: 'opinions', type: 'thought', weight: 0.6 },
  { pattern: /我认为(.+)/, key: 'beliefs', type: 'thought', weight: 0.7 },
  { pattern: /我的(.+?)是(.+)/, key: 'possessions', type: 'attribute', weight: 0.7 },
  { pattern: /我需要(.+)/, key: 'needs', type: 'requirement', weight: 0.8 },
  { pattern: /我坚持(.+)/, key: 'principles', type: 'value', weight: 0.9 },
  { pattern: /我重视(.+)/, key: 'values', type: 'value', weight: 0.8 },
];

class SmartMemory {
  constructor(userId) {
    this.userId = userId;
    this.userPath = path.join(MEMORY_PATH, 'users', userId);
    ensureDir(this.userPath);
    this.memories = this.loadMemories();
  }

  loadMemories() {
    const file = path.join(this.userPath, 'memories.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return {};
  }

  saveMemories() {
    const file = path.join(this.userPath, 'memories.json');
    fs.writeFileSync(file, JSON.stringify(this.memories, null, 2));
  }

  // 学习消息
  learn(message, context = '') {
    const extracted = [];

    // 使用基础模式提取
    for (const rule of BASE_PATTERNS) {
      const match = message.match(rule.pattern);
      if (match) {
        const value = match[2] || match[1];  // 支持 "我的X是Y" 和 "我喜欢X"
        if (value && value.trim().length > 1) {
          extracted.push({
            key: rule.key,
            value: value.trim(),
            type: rule.type,
            weight: rule.weight,
            context: context,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // 保存提取的记忆
    for (const item of extracted) {
      if (!this.memories[item.key]) {
        this.memories[item.key] = [];
      }
      
      // 避免完全重复
      const exists = this.memories[item.key].some(m => m.value === item.value);
      if (!exists) {
        this.memories[item.key].push(item);
        console.log(`🧠 [SmartMemory] 学习: [${item.type}] ${item.key} = "${item.value.substring(0, 40)}..."`);
      }
    }

    this.saveMemories();
    return extracted.length;
  }

  // 回忆相关记忆
  recall(query, limit = 5) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const [key, items] of Object.entries(this.memories)) {
      for (const item of items) {
        const searchable = `${key} ${item.value} ${item.type} ${item.context || ''}`.toLowerCase();
        const relevance = this.calculateRelevance(lowerQuery, searchable, item.weight);
        
        if (relevance > 0.3) {
          results.push({ ...item, relevance });
        }
      }
    }

    // 按相关性和权重排序
    results.sort((a, b) => b.relevance * b.weight - a.relevance * a.weight);
    
    return results.slice(0, limit);
  }

  calculateRelevance(query, searchable, weight) {
    if (searchable.includes(query)) return 1.0;
    
    // 计算词重叠
    const queryWords = query.split(/\s+/);
    const matchCount = queryWords.filter(w => searchable.includes(w)).length;
    return matchCount / queryWords.length;
  }

  // 获取用户画像
  getProfile() {
    const summary = {
      userId: this.userId,
      totalMemories: 0,
      categories: {},
      topPreferences: []
    };

    for (const [key, items] of Object.entries(this.memories)) {
      summary.totalMemories += items.length;
      
      for (const item of items) {
        if (!summary.categories[item.type]) {
          summary.categories[item.type] = 0;
        }
        summary.categories[item.type]++;
      }
    }

    // 获取高权重偏好
    const allMemories = [];
    for (const [key, items] of Object.entries(this.memories)) {
      allMemories.push(...items.map(i => ({ ...i, key })));
    }
    
    allMemories.sort((a, b) => b.weight - a.weight);
    summary.topPreferences = allMemories.slice(0, 5).map(m => ({
      key: m.key,
      value: m.value,
      weight: m.weight
    }));

    return summary;
  }

  // 导出所有记忆
  export() {
    return this.memories;
  }
}

// 全局实例
let currentMemory = null;

function initSmartMemory(userId) {
  currentMemory = new SmartMemory(userId);
  console.log(`🧠 [SmartMemory] 初始化用户: ${userId}`);
  return currentMemory;
}

function smartLearn(message, context = '') {
  if (!currentMemory) {
    console.warn('[SmartMemory] 请先调用 initSmartMemory()');
    return 0;
  }
  return currentMemory.learn(message, context);
}

function smartRecall(query, limit = 5) {
  if (!currentMemory) return [];
  return currentMemory.recall(query, limit);
}

function smartProfile() {
  if (!currentMemory) return null;
  return currentMemory.getProfile();
}

module.exports = {
  SmartMemory,
  initSmartMemory,
  smartLearn,
  smartRecall,
  smartProfile
};

// 测试
if (require.main === module) {
  console.log('Smart Memory System loaded!');
}
