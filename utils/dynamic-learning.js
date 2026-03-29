/**
 * Dynamic Pattern Learning - 动态模式学习
 * 
 * 让 AI 自动学习新的记忆提取规则
 * 越聊越懂你！
 */

const fs = require('fs');
const path = require('path');

const MEMORY_BASE_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'memory', 'global');

// 确保目录存在
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================================================
// 动态模式学习器
// ============================================================================

class DynamicPatternLearner {
  constructor(userId) {
    this.userId = userId;
    this.patternsPath = path.join(MEMORY_BASE_PATH, 'users', userId, 'learned-patterns.json');
    this.patterns = this.loadPatterns();
    
    // 基础模式
    this.basePatterns = [
      { regex: /我喜欢(.+)/, key: 'likes', importance: 0.8, type: 'preference' },
      { regex: /我讨厌(.+)/, key: 'dislikes', importance: 0.8, type: 'preference' },
      { regex: /我希望(.+)/, key: 'wishes', importance: 0.7, type: 'preference' },
      { regex: /请叫我(.+)/, key: 'preferred_name', importance: 0.9, type: 'identity' },
      { regex: /我的名字是(.+)/, key: 'name', importance: 1.0, type: 'identity' },
      { regex: /我是(.+)/, key: 'identity', importance: 0.8, type: 'identity' },
      { regex: /我擅长(.+)/, key: 'skills', importance: 0.7, type: 'ability' },
      { regex: /我不擅长(.+)/, key: 'weaknesses', importance: 0.7, type: 'ability' },
      { regex: /我的目标是(.+)/, key: 'goals', importance: 0.9, type: 'future' },
      { regex: /我的梦想是(.+)/, key: 'dreams', importance: 0.9, type: 'future' },
      { regex: /我记得(.+)/, key: 'memories', importance: 0.8, type: 'past' },
      { regex: /我曾经(.+)/, key: 'experiences', importance: 0.7, type: 'past' },
      { regex: /我习惯(.+)/, key: 'habits', importance: 0.8, type: 'behavior' },
      { regex: /我通常(.+)/, key: 'habits', importance: 0.7, type: 'behavior' },
      { regex: /我觉得(.+)/, key: 'opinions', importance: 0.6, type: 'thought' },
      { regex: /我认为(.+)/, key: 'beliefs', importance: 0.7, type: 'thought' },
    ];
  }

  // 加载学习到的模式
  loadPatterns() {
    if (fs.existsSync(this.patternsPath)) {
      return JSON.parse(fs.readFileSync(this.patternsPath, 'utf8'));
    }
    return { learned: [], statistics: {} };
  }

  // 保存学习到的模式
  savePatterns() {
    ensureDir(path.dirname(this.patternsPath));
    fs.writeFileSync(this.patternsPath, JSON.stringify(this.patterns, null, 2));
  }

  // 提取所有记忆
  extractAll(message) {
    const results = [];
    const allPatterns = [...this.basePatterns, ...this.patterns.learned];

    for (const pattern of allPatterns) {
      const match = message.match(pattern.regex);
      if (match) {
        results.push({
          key: pattern.key,
          value: match[1].trim(),
          importance: pattern.importance,
          type: pattern.type,
          source: 'pattern'
        });
      }
    }

    // 如果没有匹配到已知模式，尝试学习新规则
    if (results.length === 0) {
      const learned = this.tryLearnNewPattern(message);
      if (learned) {
        results.push(learned);
      }
    }

    return results;
  }

  // 尝试学习新模式
  tryLearnNewPattern(message) {
    // 启发式学习：寻找 "我Xxx..." 的模式
    const selfPatterns = [
      { regex: /我(\w+)(?:是|为|有|会|能|想|要|需|用|在|从|到|给|对|和|跟|与|比|像|如|似)(.+)/, type: 'relation' },
      { regex: /我(\w+)?[:：](.+)/, type: 'statement' },
      { regex: /对我来说(.+)/, type: 'perspective' },
      { regex: /我的(.+?)(?:是|为)(.+)/, type: 'possession' },
    ];

    for (const pattern of selfPatterns) {
      const match = message.match(pattern.regex);
      if (match && match[2] && match[2].length > 2) {
        const key = match[1] || 'statement';
        const value = match[2].trim();
        
        // 记录学习到的模式
        this.recordLearnedPattern(message, key, value, pattern.type);
        
        return {
          key: `learned_${key}`,
          value: value,
          importance: 0.5,
          type: pattern.type,
          source: 'learned'
        };
      }
    }

    return null;
  }

  // 记录学习到的模式
  recordLearnedPattern(original, key, value, type) {
    const pattern = {
      original_message: original.substring(0, 100),
      extracted_key: key,
      extracted_value: value.substring(0, 100),
      type: type,
      timestamp: new Date().toISOString(),
      confidence: 0.5
    };

    this.patterns.learned.push(pattern);
    
    // 统计
    if (!this.patterns.statistics[type]) {
      this.patterns.statistics[type] = 0;
    }
    this.patterns.statistics[type]++;

    this.savePatterns();
    
    console.log(`🧠 [DynamicLearning] 学习新模式: "${key}" = "${value.substring(0, 50)}..."`);
  }

  // 获取学习统计
  getStatistics() {
    return {
      base_patterns: this.basePatterns.length,
      learned_patterns: this.patterns.learned.length,
      statistics: this.patterns.statistics
    };
  }

  // 手动添加模式（用户 teaching）
  addPattern(regex, key, importance, type) {
    this.basePatterns.push({
      regex: new RegExp(regex),
      key,
      importance,
      type
    });
    console.log(`✅ [DynamicLearning] 添加模式: ${key}`);
  }
}

// ============================================================================
// 增强版全局记忆
// ============================================================================

class EnhancedGlobalMemory {
  constructor() {
    this.currentUser = null;
    this.learner = null;
  }

  initUser(userId) {
    this.currentUser = userId;
    this.learner = new DynamicPatternLearner(userId);
    console.log(`🧠 [EnhancedMemory] 初始化用户: ${userId}`);
    console.log(`   基础模式: ${this.learner.basePatterns.length} 个`);
    console.log(`   已学习: ${this.learner.patterns.learned.length} 个`);
    return this;
  }

  record(message, response) {
    if (!this.currentUser) return;

    // 使用动态学习提取所有可能的记忆
    const extractions = this.learner.extractAll(message);
    
    if (extractions.length > 0) {
      console.log(`\n💡 [EnhancedMemory] 从消息中提取到 ${extractions.length} 条记忆:`);
      extractions.forEach((ext, i) => {
        console.log(`   ${i + 1}. [${ext.type}] ${ext.key}: ${ext.value.substring(0, 40)}... (${ext.source})`);
        this.saveToFile(ext.key, ext.value, ext.importance, ext.type);
      });
    }
  }

  saveToFile(key, value, importance, type) {
    const userPath = path.join(MEMORY_BASE_PATH, 'users', this.currentUser);
    ensureDir(userPath);
    
    const prefPath = path.join(userPath, 'preferences.json');
    let prefs = {};
    
    if (fs.existsSync(prefPath)) {
      prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
    }
    
    if (!prefs[key]) {
      prefs[key] = [];
    }
    
    // 避免重复
    const exists = prefs[key].some(p => p.value === value);
    if (!exists) {
      prefs[key].push({
        value,
        importance,
        type,
        timestamp: new Date().toISOString()
      });
      
      fs.writeFileSync(prefPath, JSON.stringify(prefs, null, 2));
    }
  }

  recall(context) {
    if (!this.currentUser) return [];
    
    const userPath = path.join(MEMORY_BASE_PATH, 'users', this.currentUser);
    const prefPath = path.join(userPath, 'preferences.json');
    
    if (!fs.existsSync(prefPath)) return [];
    
    const prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
    const memories = [];
    
    // 搜索相关记忆
    const lowerContext = context.toLowerCase();
    
    for (const [key, values] of Object.entries(prefs)) {
      for (const item of values) {
        const searchable = `${key} ${item.value} ${item.type}`.toLowerCase();
        if (searchable.includes(lowerContext) || lowerContext.includes(key.toLowerCase())) {
          memories.push({
            key,
            value: item.value,
            importance: item.importance,
            type: item.type
          });
        }
      }
    }
    
    // 按重要性排序
    memories.sort((a, b) => b.importance - a.importance);
    
    return memories.slice(0, 5);  // 返回前5条
  }

  getProfile() {
    if (!this.currentUser) return null;
    
    const userPath = path.join(MEMORY_BASE_PATH, 'users', this.currentUser);
    const prefPath = path.join(userPath, 'preferences.json');
    
    if (!fs.existsSync(prefPath)) return null;
    
    const prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
    const stats = this.learner.getStatistics();
    
    return {
      userId: this.currentUser,
      preferences: prefs,
      learnedPatterns: stats.learned_patterns,
      totalPatterns: stats.base_patterns + stats.learned_patterns
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

const enhancedMemory = new EnhancedGlobalMemory();

function initEnhancedMemory(userId) {
  return enhancedMemory.initUser(userId);
}

function learnFromMessage(message, response) {
  enhancedMemory.record(message, response);
}

function recallMemories(context) {
  return enhancedMemory.recall(context);
}

function getEnhancedProfile() {
  return enhancedMemory.getProfile();
}

module.exports = {
  DynamicPatternLearner,
  EnhancedGlobalMemory,
  initEnhancedMemory,
  learnFromMessage,
  recallMemories,
  getEnhancedProfile
};

// 测试
if (require.main === module) {
  console.log('Dynamic Pattern Learning System loaded!');
  console.log('This system can learn new patterns dynamically.');
}
