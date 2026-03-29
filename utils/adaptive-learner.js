/**
 * Adaptive Rule Learner - 自适应规则学习器
 * 
 * 从用户经常说的话中动态学习新的提取规则
 * 越聊越懂你，规则自动增长！
 */

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'memory', 'adaptive');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class AdaptiveRuleLearner {
  constructor(userId) {
    this.userId = userId;
    this.userPath = path.join(MEMORY_PATH, 'users', userId);
    ensureDir(this.userPath);
    
    // 基础规则
    this.baseRules = [
      { pattern: '我喜欢(.+)', key: 'likes', type: 'preference', weight: 0.8 },
      { pattern: '我讨厌(.+)', key: 'dislikes', type: 'preference', weight: 0.8 },
      { pattern: '我希望(.+)', key: 'wishes', type: 'preference', weight: 0.7 },
      { pattern: '请叫我(.+)', key: 'preferred_name', type: 'identity', weight: 0.9 },
      { pattern: '我的名字是(.+)', key: 'name', type: 'identity', weight: 1.0 },
      { pattern: '我是(.+)', key: 'identity', type: 'identity', weight: 0.8 },
      { pattern: '我擅长(.+)', key: 'skills', type: 'ability', weight: 0.7 },
      { pattern: '我的目标是(.+)', key: 'goals', type: 'future', weight: 0.9 },
    ];
    
    // 学习到的规则
    this.learnedRules = this.loadLearnedRules();
    
    // 话语频率统计
    this.phraseFrequency = this.loadPhraseFrequency();
    
    // 候选模式池
    this.candidatePatterns = new Map();
  }

  loadLearnedRules() {
    const file = path.join(this.userPath, 'learned-rules.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return [];
  }

  saveLearnedRules() {
    const file = path.join(this.userPath, 'learned-rules.json');
    fs.writeFileSync(file, JSON.stringify(this.learnedRules, null, 2));
  }

  loadPhraseFrequency() {
    const file = path.join(this.userPath, 'phrase-frequency.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return {};
  }

  savePhraseFrequency() {
    const file = path.join(this.userPath, 'phrase-frequency.json');
    fs.writeFileSync(file, JSON.stringify(this.phraseFrequency, null, 2));
  }

  // 分析消息，学习新规则
  learn(message) {
    // 1. 提取潜在模式
    const potentialPatterns = this.extractPotentialPatterns(message);
    
    // 2. 更新频率统计
    for (const pattern of potentialPatterns) {
      this.updateFrequency(pattern);
    }
    
    // 3. 检查是否达到学习阈值
    this.checkAndLearnNewRules();
    
    // 4. 使用所有规则提取记忆
    return this.extractWithAllRules(message);
  }

  // 提取潜在模式
  extractPotentialPatterns(message) {
    const patterns = [];
    
    // 寻找 "我Xxx..." 结构
    const selfPatterns = [
      /我(\w{2,6})(?:要|想|会|能|需|用|在|从|到|给|对|和|跟|与|比|像|如)(.+)/,
      /我(\w{2,6})[:：](.+)/,
      /我(\w{2,6})是(.+)/,
      /我(\w{2,6})有(.+)/,
    ];
    
    for (const regex of selfPatterns) {
      const match = message.match(regex);
      if (match && match[1] && match[2]) {
        const verb = match[1];
        const content = match[2].trim();
        
        // 过滤无效内容
        if (content.length >= 2 && content.length <= 50) {
          patterns.push({
            verb: verb,
            template: `我${verb}(.+)`,
            example: message.substring(0, 100)
          });
        }
      }
    }
    
    // 寻找其他重复结构
    const otherPatterns = [
      { regex: /(?:关键是|重点是|核心是)(.+)/, prefix: '关键是' },
      { regex: /(?:首先|第一步|先)(.+)/, prefix: '首先' },
      { regex: /(?:然后|接着|下一步)(.+)/, prefix: '然后' },
      { regex: /(?:总之|总的来说|最后)(.+)/, prefix: '总之' },
      { regex: /(?:例如|比如|像)(.+)/, prefix: '例如' },
      { regex: /(?:特别是|尤其是|主要是)(.+)/, prefix: '特别是' },
    ];
    
    for (const { regex, prefix } of otherPatterns) {
      const match = message.match(regex);
      if (match && match[1]) {
        patterns.push({
          verb: prefix,
          template: `${prefix}(.+)`,
          example: message.substring(0, 100)
        });
      }
    }
    
    return patterns;
  }

  // 更新频率统计
  updateFrequency(pattern) {
    const key = pattern.template;
    
    if (!this.phraseFrequency[key]) {
      this.phraseFrequency[key] = {
        count: 0,
        verb: pattern.verb,
        examples: [],
        firstSeen: new Date().toISOString()
      };
    }
    
    this.phraseFrequency[key].count++;
    
    // 保存示例（最多5个）
    if (this.phraseFrequency[key].examples.length < 5) {
      this.phraseFrequency[key].examples.push(pattern.example);
    }
    
    this.phraseFrequency[key].lastSeen = new Date().toISOString();
  }

  // 检查并学习新规则
  checkAndLearnNewRules() {
    const threshold = 3;  // 出现3次就学习
    
    for (const [template, data] of Object.entries(this.phraseFrequency)) {
      // 检查是否已达到阈值且未学习过
      if (data.count >= threshold && !this.isAlreadyLearned(template)) {
        this.learnNewRule(template, data);
      }
    }
    
    this.savePhraseFrequency();
    this.saveLearnedRules();
  }

  // 检查是否已学习
  isAlreadyLearned(template) {
    const allRules = [...this.baseRules, ...this.learnedRules];
    return allRules.some(r => r.pattern === template);
  }

  // 学习新规则
  learnNewRule(template, data) {
    // 推断规则类型和权重
    const { type, weight } = this.inferRuleType(data.verb);
    
    // 生成 key
    const key = this.generateKey(data.verb);
    
    const newRule = {
      pattern: template,
      key: key,
      type: type,
      weight: weight,
      source: 'learned',
      learnedFrom: {
        verb: data.verb,
        frequency: data.count,
        examples: data.examples,
        learnedAt: new Date().toISOString()
      }
    };
    
    this.learnedRules.push(newRule);
    
    console.log(`🎓 [AdaptiveLearner] 学习新规则!`);
    console.log(`   模式: "${template}"`);
    console.log(`   提取: ${key} (${type})`);
    console.log(`   权重: ${weight}`);
    console.log(`   基于: 你说了 ${data.count} 次 "${data.verb}"`);
    console.log(`   示例: "${data.examples[0].substring(0, 50)}..."`);
  }

  // 推断规则类型
  inferRuleType(verb) {
    const typeMap = {
      '喜欢': { type: 'preference', weight: 0.8 },
      '爱': { type: 'preference', weight: 0.9 },
      '讨厌': { type: 'aversion', weight: 0.8 },
      '想': { type: 'desire', weight: 0.7 },
      '要': { type: 'need', weight: 0.8 },
      '需要': { type: 'requirement', weight: 0.8 },
      '觉得': { type: 'opinion', weight: 0.6 },
      '认为': { type: 'belief', weight: 0.7 },
      '坚持': { type: 'principle', weight: 0.9 },
      '重视': { type: 'value', weight: 0.8 },
      '关注': { type: 'interest', weight: 0.7 },
      '关心': { type: 'concern', weight: 0.7 },
      '担心': { type: 'worry', weight: 0.6 },
      '相信': { type: 'faith', weight: 0.8 },
      '期待': { type: 'expectation', weight: 0.7 },
      '关键是': { type: 'key_point', weight: 0.9 },
      '重点是': { type: 'key_point', weight: 0.9 },
      '首先是': { type: 'priority', weight: 0.8 },
      '然后是': { type: 'sequence', weight: 0.6 },
    };
    
    return typeMap[verb] || { type: 'learned_' + verb, weight: 0.5 };
  }

  // 生成 key
  generateKey(verb) {
    const keyMap = {
      '喜欢': 'likes',
      '爱': 'loves',
      '讨厌': 'hates',
      '想': 'wants',
      '要': 'needs',
      '需要': 'requirements',
      '觉得': 'opinions',
      '认为': 'beliefs',
      '坚持': 'principles',
      '重视': 'values',
      '关注': 'interests',
      '关心': 'concerns',
      '担心': 'worries',
      '相信': 'faiths',
      '期待': 'expectations',
      '关键是': 'key_points',
      '重点是': 'key_points',
      '首先是': 'priorities',
      '然后是': 'next_steps',
    };
    
    return keyMap[verb] || verb + '_statements';
  }

  // 使用所有规则提取
  extractWithAllRules(message) {
    const allRules = [...this.baseRules, ...this.learnedRules];
    const results = [];
    
    for (const rule of allRules) {
      const regex = new RegExp(rule.pattern);
      const match = message.match(regex);
      
      if (match && match[1]) {
        results.push({
          key: rule.key,
          value: match[1].trim(),
          type: rule.type,
          weight: rule.weight,
          source: rule.source || 'base'
        });
      }
    }
    
    return results;
  }

  // 获取学习统计
  getStats() {
    return {
      baseRules: this.baseRules.length,
      learnedRules: this.learnedRules.length,
      totalRules: this.baseRules.length + this.learnedRules.length,
      phrasePatterns: Object.keys(this.phraseFrequency).length,
      learnedRulesDetail: this.learnedRules.map(r => ({
        pattern: r.pattern,
        key: r.key,
        learnedFrom: r.learnedFrom.verb,
        frequency: r.learnedFrom.frequency
      }))
    };
  }
}

// 全局实例
let currentLearner = null;

function initAdaptiveLearner(userId) {
  currentLearner = new AdaptiveRuleLearner(userId);
  console.log(`🎓 [AdaptiveLearner] 初始化: ${userId}`);
  console.log(`   基础规则: ${currentLearner.baseRules.length} 个`);
  console.log(`   已学习: ${currentLearner.learnedRules.length} 个`);
  return currentLearner;
}

function adaptiveLearn(message) {
  if (!currentLearner) {
    console.warn('[AdaptiveLearner] 请先调用 initAdaptiveLearner()');
    return [];
  }
  return currentLearner.learn(message);
}

function getAdaptiveStats() {
  if (!currentLearner) return null;
  return currentLearner.getStats();
}

module.exports = {
  AdaptiveRuleLearner,
  initAdaptiveLearner,
  adaptiveLearn,
  getAdaptiveStats
};

// 测试
if (require.main === module) {
  console.log('Adaptive Rule Learner loaded!');
  console.log('This system learns new extraction rules from your speech patterns.');
}
