/**
 * Predictive Memory - 预测性记忆系统
 * 
 * 根据历史模式预测用户下一步
 * 提前准备上下文
 */

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'memory', 'predictive');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class PredictiveMemory {
  constructor(userId) {
    this.userId = userId;
    this.userPath = path.join(MEMORY_PATH, 'users', userId);
    ensureDir(this.userPath);
    
    // 序列模式
    this.sequencePatterns = this.loadSequencePatterns();
    
    // 当前上下文
    this.currentContext = [];
    
    // 预测缓存
    this.predictions = [];
  }

  loadSequencePatterns() {
    const file = path.join(this.userPath, 'sequences.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return {};
  }

  saveSequencePatterns() {
    const file = path.join(this.userPath, 'sequences.json');
    fs.writeFileSync(file, JSON.stringify(this.sequencePatterns, null, 2));
  }

  // 记录消息到上下文
  recordMessage(message, extractedKeys = []) {
    // 提取消息的关键特征
    const features = this.extractFeatures(message, extractedKeys);
    
    // 添加到当前上下文
    this.currentContext.push({
      message: message.substring(0, 100),
      features: features,
      timestamp: Date.now()
    });
    
    // 只保留最近5条
    if (this.currentContext.length > 5) {
      this.currentContext.shift();
    }
    
    // 学习序列模式
    if (this.currentContext.length >= 2) {
      this.learnSequence();
    }
    
    // 生成预测
    this.generatePredictions();
  }

  // 提取消息特征
  extractFeatures(message, extractedKeys) {
    const features = {
      keys: extractedKeys.map(k => k.key),
      topics: this.detectTopics(message),
      intents: this.detectIntents(message),
      hasQuestion: /\?|？|吗|呢|吧/.test(message),
      length: message.length
    };
    return features;
  }

  // 检测话题
  detectTopics(message) {
    const topics = [];
    const keywords = {
      'design': ['设计', '架构', '方案', '规划'],
      'code': ['代码', '编程', '实现', '开发'],
      'problem': ['问题', '错误', 'bug', '故障'],
      'plan': ['计划', '安排', '时间', '进度']
    };
    
    for (const [topic, words] of Object.entries(keywords)) {
      if (words.some(w => message.includes(w))) {
        topics.push(topic);
      }
    }
    
    return topics;
  }

  // 检测意图
  detectIntents(message) {
    const intents = [];
    
    if (/讨论|聊聊|说说/.test(message)) intents.push('discuss');
    if (/实现|做|写|开发/.test(message)) intents.push('implement');
    if (/问题|错误|bug/.test(message)) intents.push('debug');
    if (/优化|改进|提升/.test(message)) intents.push('optimize');
    if (/学习|了解|研究/.test(message)) intents.push('learn');
    if (/决定|选择|用/.test(message)) intents.push('decide');
    
    return intents;
  }

  // 学习序列模式
  learnSequence() {
    if (this.currentContext.length < 2) return;
    
    const prev = this.currentContext[this.currentContext.length - 2];
    const curr = this.currentContext[this.currentContext.length - 1];
    
    // 创建序列键
    const sequenceKey = this.createSequenceKey(prev.features);
    
    if (!this.sequencePatterns[sequenceKey]) {
      this.sequencePatterns[sequenceKey] = {
        count: 0,
        nextPatterns: {}
      };
    }
    
    const nextKey = this.createSequenceKey(curr.features);
    
    if (!this.sequencePatterns[sequenceKey].nextPatterns[nextKey]) {
      this.sequencePatterns[sequenceKey].nextPatterns[nextKey] = {
        count: 0,
        examples: []
      };
    }
    
    this.sequencePatterns[sequenceKey].count++;
    this.sequencePatterns[sequenceKey].nextPatterns[nextKey].count++;
    this.sequencePatterns[sequenceKey].nextPatterns[nextKey].examples.push({
      prev: prev.message,
      next: curr.message
    });
    
    // 只保留最近5个示例
    const examples = this.sequencePatterns[sequenceKey].nextPatterns[nextKey].examples;
    if (examples.length > 5) {
      examples.shift();
    }
    
    this.saveSequencePatterns();
  }

  // 创建序列键
  createSequenceKey(features) {
    const parts = [];
    if (features.keys.length > 0) parts.push(`keys:${features.keys.join(',')}`);
    if (features.topics.length > 0) parts.push(`topics:${features.topics.join(',')}`);
    if (features.intents.length > 0) parts.push(`intents:${features.intents.join(',')}`);
    return parts.join('|') || 'general';
  }

  // 生成预测
  generatePredictions() {
    if (this.currentContext.length === 0) {
      this.predictions = [];
      return;
    }
    
    const current = this.currentContext[this.currentContext.length - 1];
    const sequenceKey = this.createSequenceKey(current.features);
    
    this.predictions = [];
    
    // 基于序列模式预测
    if (this.sequencePatterns[sequenceKey]) {
      const pattern = this.sequencePatterns[sequenceKey];
      const totalCount = pattern.count;
      
      for (const [nextKey, data] of Object.entries(pattern.nextPatterns)) {
        const probability = data.count / totalCount;
        if (probability > 0.3) {  // 概率>30%才预测
          this.predictions.push({
            type: 'sequence',
            predictedFeatures: this.parseSequenceKey(nextKey),
            probability: probability,
            confidence: this.calculateConfidence(data.count, probability),
            basedOn: data.examples[data.examples.length - 1]
          });
        }
      }
    }
    
    // 按概率排序
    this.predictions.sort((a, b) => b.probability - a.probability);
  }

  // 解析序列键
  parseSequenceKey(key) {
    const features = { keys: [], topics: [], intents: [] };
    const parts = key.split('|');
    
    for (const part of parts) {
      if (part.startsWith('keys:')) {
        features.keys = part.replace('keys:', '').split(',');
      } else if (part.startsWith('topics:')) {
        features.topics = part.replace('topics:', '').split(',');
      } else if (part.startsWith('intents:')) {
        features.intents = part.replace('intents:', '').split(',');
      }
    }
    
    return features;
  }

  // 计算置信度
  calculateConfidence(count, probability) {
    // 次数越多、概率越高，置信度越高
    const countScore = Math.min(count / 5, 1) * 0.4;
    const probScore = probability * 0.6;
    return countScore + probScore;
  }

  // 获取预测
  getPredictions(limit = 3) {
    return this.predictions.slice(0, limit);
  }

  // 预测下一步
  predictNext() {
    if (this.predictions.length === 0) {
      return null;
    }
    
    const topPrediction = this.predictions[0];
    
    return {
      predictedTopics: topPrediction.predictedFeatures.topics,
      predictedIntents: topPrediction.predictedFeatures.intents,
      probability: topPrediction.probability,
      confidence: topPrediction.confidence,
      suggestion: this.generateSuggestion(topPrediction)
    };
  }

  // 生成建议
  generateSuggestion(prediction) {
    const intents = prediction.predictedFeatures.intents;
    const topics = prediction.predictedFeatures.topics;
    
    if (intents.includes('implement') && topics.includes('code')) {
      return '你可能准备开始写代码了，需要我提供代码模板吗？';
    }
    if (intents.includes('discuss') && topics.includes('design')) {
      return '你可能想继续讨论设计，有什么新想法吗？';
    }
    if (intents.includes('debug') && topics.includes('problem')) {
      return '你可能遇到了问题，需要我帮你分析吗？';
    }
    if (intents.includes('decide')) {
      return '你可能要做决定，需要我列出优缺点吗？';
    }
    
    return '我注意到你可能想继续这个话题，有什么我可以帮忙的吗？';
  }

  // 获取统计
  getStats() {
    const totalSequences = Object.keys(this.sequencePatterns).length;
    let totalTransitions = 0;
    
    for (const pattern of Object.values(this.sequencePatterns)) {
      totalTransitions += Object.keys(pattern.nextPatterns).length;
    }
    
    return {
      sequencePatterns: totalSequences,
      totalTransitions: totalTransitions,
      currentContextLength: this.currentContext.length,
      activePredictions: this.predictions.length
    };
  }
}

// 全局实例
let predictiveMemory = null;

function initPredictiveMemory(userId) {
  predictiveMemory = new PredictiveMemory(userId);
  console.log(`🔮 [PredictiveMemory] 初始化: ${userId}`);
  return predictiveMemory;
}

function recordForPrediction(message, extractedKeys) {
  if (!predictiveMemory) {
    console.warn('[PredictiveMemory] 请先调用 initPredictiveMemory()');
    return;
  }
  predictiveMemory.recordMessage(message, extractedKeys);
}

function getPredictions(limit) {
  if (!predictiveMemory) return [];
  return predictiveMemory.getPredictions(limit);
}

function predictNext() {
  if (!predictiveMemory) return null;
  return predictiveMemory.predictNext();
}

module.exports = {
  PredictiveMemory,
  initPredictiveMemory,
  recordForPrediction,
  getPredictions,
  predictNext
};

// 测试
if (require.main === module) {
  console.log('Predictive Memory System loaded!');
}
