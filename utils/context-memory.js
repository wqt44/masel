/**
 * Context-Aware Memory - 上下文感知记忆系统
 * 
 * 学习你在什么情境下说什么
 * 让记忆更精准、更智能
 */

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'memory', 'context');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class ContextAwareMemory {
  constructor(userId) {
    this.userId = userId;
    this.userPath = path.join(MEMORY_PATH, 'users', userId);
    ensureDir(this.userPath);
    
    // 当前上下文
    this.currentContext = {
      topic: null,      // 当前话题
      phase: null,      // 对话阶段
      emotion: null,    // 情感状态
      lastMessages: []  // 最近消息
    };
    
    // 上下文关联记忆
    this.contextMemories = this.loadContextMemories();
  }

  loadContextMemories() {
    const file = path.join(this.userPath, 'context-memories.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return {};
  }

  saveContextMemories() {
    const file = path.join(this.userPath, 'context-memories.json');
    fs.writeFileSync(file, JSON.stringify(this.contextMemories, null, 2));
  }

  // 更新上下文
  updateContext(message, response) {
    // 保存最近消息
    this.currentContext.lastMessages.push(message);
    if (this.currentContext.lastMessages.length > 5) {
      this.currentContext.lastMessages.shift();
    }
    
    // 检测话题
    this.currentContext.topic = this.detectTopic(message);
    
    // 检测阶段
    this.currentContext.phase = this.detectPhase(message);
    
    // 检测情感
    this.currentContext.emotion = this.detectEmotion(message);
  }

  // 检测话题
  detectTopic(message) {
    const topics = {
      '设计': ['设计', '架构', '方案', '规划', '结构'],
      '代码': ['代码', '编程', '实现', '开发', '函数', '类'],
      '需求': ['需求', '功能', '用户', '场景', '用例'],
      '问题': ['问题', '错误', 'bug', '故障', '异常'],
      '优化': ['优化', '改进', '提升', '性能', '效率'],
      '学习': ['学习', '了解', '研究', '探索', '尝试'],
      '决策': ['决定', '选择', '方案', '策略', '计划']
    };
    
    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(k => message.includes(k))) {
        return topic;
      }
    }
    
    return 'general';
  }

  // 检测阶段
  detectPhase(message) {
    if (/开始|首先|第一步|准备|规划/.test(message)) return 'start';
    if (/讨论|分析|研究|思考|考虑/.test(message)) return 'discuss';
    if (/实现|开发|编写|创建|构建/.test(message)) return 'implement';
    if (/测试|验证|检查|确认/.test(message)) return 'test';
    if (/完成|结束|总结|回顾/.test(message)) return 'finish';
    return 'ongoing';
  }

  // 检测情感
  detectEmotion(message) {
    if (/开心|高兴|棒|赞|优秀|完美|喜欢/.test(message)) return 'positive';
    if (/难过|失望|糟|差|讨厌|问题/.test(message)) return 'negative';
    if (/着急|快|马上|立即|必须/.test(message)) return 'urgent';
    if (/担心|怕|可能|也许|不确定/.test(message)) return 'uncertain';
    return 'neutral';
  }

  // 学习记忆（带上下文）
  learn(message, extracted) {
    const context = { ...this.currentContext };
    
    for (const item of extracted) {
      const memoryKey = `${context.topic || 'general'}_${item.key}`;
      
      if (!this.contextMemories[memoryKey]) {
        this.contextMemories[memoryKey] = [];
      }
      
      this.contextMemories[memoryKey].push({
        value: item.value,
        type: item.type,
        weight: item.weight,
        context: {
          topic: context.topic,
          phase: context.phase,
          emotion: context.emotion
        },
        timestamp: new Date().toISOString()
      });
      
      console.log(`🧠 [ContextMemory] 学习: [${context.topic}] ${item.key} = "${item.value.substring(0, 30)}..."`);
      console.log(`   情境: ${context.phase} | 情感: ${context.emotion}`);
    }
    
    this.saveContextMemories();
  }

  // 回忆（基于当前上下文）
  recall(query) {
    const currentTopic = this.detectTopic(query);
    const currentPhase = this.detectPhase(query);
    
    console.log(`🔍 [ContextMemory] 当前情境: [${currentTopic}] ${currentPhase}`);
    
    const results = [];
    
    // 1. 优先匹配相同话题的记忆
    for (const [key, memories] of Object.entries(this.contextMemories)) {
      if (key.startsWith(currentTopic + '_')) {
        for (const mem of memories) {
          results.push({
            ...mem,
            relevance: 1.0,
            matchType: 'same_topic'
          });
        }
      }
    }
    
    // 2. 匹配相关话题
    const relatedTopics = this.getRelatedTopics(currentTopic);
    for (const topic of relatedTopics) {
      for (const [key, memories] of Object.entries(this.contextMemories)) {
        if (key.startsWith(topic + '_')) {
          for (const mem of memories) {
            results.push({
              ...mem,
              relevance: 0.7,
              matchType: 'related_topic'
            });
          }
        }
      }
    }
    
    // 3. 通用记忆
    for (const [key, memories] of Object.entries(this.contextMemories)) {
      if (key.startsWith('general_')) {
        for (const mem of memories) {
          const searchable = `${mem.value} ${mem.type}`.toLowerCase();
          if (searchable.includes(query.toLowerCase())) {
            results.push({
              ...mem,
              relevance: 0.5,
              matchType: 'general'
            });
          }
        }
      }
    }
    
    // 按相关性和权重排序
    results.sort((a, b) => (b.relevance * b.weight) - (a.relevance * a.weight));
    
    return results.slice(0, 5);
  }

  // 获取相关话题
  getRelatedTopics(topic) {
    const relations = {
      '设计': ['代码', '需求'],
      '代码': ['设计', '测试'],
      '需求': ['设计', '决策'],
      '问题': ['优化', '代码'],
      '优化': ['代码', '性能'],
      '学习': ['探索', '研究'],
      '决策': ['规划', '策略']
    };
    return relations[topic] || [];
  }

  // 获取上下文统计
  getContextStats() {
    const stats = {
      topics: {},
      phases: {},
      emotions: {},
      total: 0
    };
    
    for (const memories of Object.values(this.contextMemories)) {
      for (const mem of memories) {
        stats.total++;
        
        const ctx = mem.context;
        stats.topics[ctx.topic] = (stats.topics[ctx.topic] || 0) + 1;
        stats.phases[ctx.phase] = (stats.phases[ctx.phase] || 0) + 1;
        stats.emotions[ctx.emotion] = (stats.emotions[ctx.emotion] || 0) + 1;
      }
    }
    
    return stats;
  }
}

// 全局实例
let currentContextMemory = null;

function initContextMemory(userId) {
  currentContextMemory = new ContextAwareMemory(userId);
  console.log(`🧠 [ContextMemory] 初始化: ${userId}`);
  return currentContextMemory;
}

function updateContext(message, response) {
  if (!currentContextMemory) return;
  currentContextMemory.updateContext(message, response);
}

function contextLearn(message, extracted) {
  if (!currentContextMemory) return;
  currentContextMemory.learn(message, extracted);
}

function contextRecall(query) {
  if (!currentContextMemory) return [];
  return currentContextMemory.recall(query);
}

function getContextStats() {
  if (!currentContextMemory) return null;
  return currentContextMemory.getContextStats();
}

module.exports = {
  ContextAwareMemory,
  initContextMemory,
  updateContext,
  contextLearn,
  contextRecall,
  getContextStats
};

// 测试
if (require.main === module) {
  console.log('Context-Aware Memory System loaded!');
}
