/**
 * Speech Pattern Analyzer - 话语模式分析器
 * 
 * 从经常说的话中发现用户的隐藏偏好和性格特征
 */

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'memory', 'patterns');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class SpeechPatternAnalyzer {
  constructor(userId) {
    this.userId = userId;
    this.userPath = path.join(MEMORY_PATH, 'users', userId);
    ensureDir(this.userPath);
    
    // 加载历史对话
    this.conversations = this.loadConversations();
    
    // 发现的模式
    this.discoveredPatterns = this.loadDiscoveredPatterns();
  }

  loadConversations() {
    const file = path.join(this.userPath, 'conversations.jsonl');
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, 'utf8')
        .trim()
        .split('\n')
        .filter(line => line)
        .map(line => JSON.parse(line));
    }
    return [];
  }

  loadDiscoveredPatterns() {
    const file = path.join(this.userPath, 'discovered-patterns.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return {};
  }

  saveDiscoveredPatterns() {
    const file = path.join(this.userPath, 'discovered-patterns.json');
    fs.writeFileSync(file, JSON.stringify(this.discoveredPatterns, null, 2));
  }

  // 记录对话
  recordConversation(message, response) {
    const entry = {
      timestamp: new Date().toISOString(),
      message: message.substring(0, 500),
      response: response.substring(0, 500)
    };
    
    this.conversations.push(entry);
    
    // 保存到文件
    const file = path.join(this.userPath, 'conversations.jsonl');
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    
    // 分析模式
    this.analyzePatterns();
  }

  // 分析话语模式
  analyzePatterns() {
    const recentConvs = this.conversations.slice(-50);  // 分析最近50条
    const allMessages = recentConvs.map(c => c.message).join(' ');
    
    const newPatterns = [];

    // 1. 分析常用词汇
    const frequentWords = this.extractFrequentWords(allMessages);
    if (frequentWords.length > 0) {
      newPatterns.push({
        type: 'frequent_words',
        data: frequentWords,
        insight: `经常使用: ${frequentWords.slice(0, 5).join(', ')}`
      });
    }

    // 2. 分析句式模式
    const sentencePatterns = this.extractSentencePatterns(recentConvs.map(c => c.message));
    if (sentencePatterns.length > 0) {
      newPatterns.push({
        type: 'sentence_patterns',
        data: sentencePatterns,
        insight: `常用句式: ${sentencePatterns[0].pattern}`
      });
    }

    // 3. 分析情感倾向
    const emotionPattern = this.analyzeEmotion(recentConvs.map(c => c.message));
    if (emotionPattern) {
      newPatterns.push({
        type: 'emotion_tendency',
        data: emotionPattern,
        insight: `情感倾向: ${emotionPattern.dominant}`
      });
    }

    // 4. 分析关注话题
    const topics = this.extractTopics(allMessages);
    if (topics.length > 0) {
      newPatterns.push({
        type: 'interested_topics',
        data: topics,
        insight: `关注话题: ${topics.slice(0, 3).join(', ')}`
      });
    }

    // 5. 分析决策风格
    const decisionStyle = this.analyzeDecisionStyle(recentConvs.map(c => c.message));
    if (decisionStyle) {
      newPatterns.push({
        type: 'decision_style',
        data: decisionStyle,
        insight: `决策风格: ${decisionStyle.style}`
      });
    }

    // 保存新发现的模式
    for (const pattern of newPatterns) {
      if (!this.discoveredPatterns[pattern.type]) {
        this.discoveredPatterns[pattern.type] = pattern;
        console.log(`🔍 [PatternAnalyzer] 发现模式: ${pattern.insight}`);
      }
    }

    this.saveDiscoveredPatterns();
  }

  // 提取常用词汇
  extractFrequentWords(text) {
    // 过滤常见词
    const stopWords = new Set(['的', '了', '是', '我', '你', '在', '有', '个', '上', '们', '来', '到', '时', '大', '地', '为', '子', '中', '说', '生', '国', '年', '着', '就', '那', '和', '要', '她', '出', '也', '得', '里', '后', '以', '会', '家', '可', '下', '而', '过', '天', '去', '能', '对', '小', '多', '然', '于', '心', '学', '之', '都', '好', '看', '起', '发', '当', '没', '成', '只', '如', '事', '把', '还', '用', '第', '样', '道', '想', '作', '种', '开', '美', '总', '从', '无', '情', '己', '面', '最', '女', '但', '现', '前', '些', '所', '同', '日', '手', '又', '行', '意', '动', '方', '期', '它', '头', '经', '长', '儿', '回', '位', '分', '爱', '老', '因', '很', '给', '名', '法', '间', '斯', '知', '世', '什', '两', '次', '使', '身', '者', '被', '高', '已', '亲', '其', '进', '此', '话', '常', '与', '活', '正', '感', 'the', 'a', 'is', 'to', 'and', 'of', 'in', 'that', 'have', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me']);
    
    const words = text.toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stopWords.has(w));
    
    const freq = {};
    for (const word of words) {
      freq[word] = (freq[word] || 0) + 1;
    }
    
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
  }

  // 提取句式模式
  extractSentencePatterns(messages) {
    const patterns = [];
    
    // 检测 "能不能"、"可不可以" 等询问模式
    const questionPatterns = messages.filter(m => /能不能|可不可以|怎么样|如何|为什么/.test(m)).length;
    if (questionPatterns > messages.length * 0.3) {
      patterns.push({ pattern: '经常询问建议', count: questionPatterns });
    }
    
    // 检测 "我觉得"、"我认为" 等主观表达
    const opinionPatterns = messages.filter(m => /我觉得|我认为|我想|我看/.test(m)).length;
    if (opinionPatterns > messages.length * 0.3) {
      patterns.push({ pattern: '经常表达观点', count: opinionPatterns });
    }
    
    // 检测 "先...再..." 等流程表达
    const processPatterns = messages.filter(m => /先.+再|首先.+然后/.test(m)).length;
    if (processPatterns > messages.length * 0.2) {
      patterns.push({ pattern: '注重步骤和流程', count: processPatterns });
    }
    
    return patterns;
  }

  // 分析情感倾向
  analyzeEmotion(messages) {
    const positive = ['好', '棒', '优秀', '喜欢', '开心', '赞', '完美', 'good', 'great', 'excellent', 'love', 'like', 'happy'];
    const negative = ['坏', '差', '讨厌', '难过', '糟', '问题', '错误', 'bad', 'hate', 'sad', 'wrong', 'error'];
    const urgent = ['急', '快', '马上', '立即', '必须', 'urgent', 'quick', 'immediately', 'must'];
    
    let posCount = 0, negCount = 0, urgCount = 0;
    
    for (const msg of messages) {
      const lowerMsg = msg.toLowerCase();
      posCount += positive.filter(w => lowerMsg.includes(w)).length;
      negCount += negative.filter(w => lowerMsg.includes(w)).length;
      urgCount += urgent.filter(w => lowerMsg.includes(w)).length;
    }
    
    const total = posCount + negCount + urgCount;
    if (total === 0) return null;
    
    let dominant = 'neutral';
    if (posCount > negCount && posCount > urgCount) dominant = '积极正面';
    else if (negCount > posCount && negCount > urgCount) dominant = '谨慎批判';
    else if (urgCount > posCount && urgCount > negCount) dominant = '急切高效';
    
    return { positive: posCount, negative: negCount, urgent: urgCount, dominant };
  }

  // 提取关注话题
  extractTopics(text) {
    const topicKeywords = {
      '技术': ['代码', '编程', '开发', '系统', '架构', '设计', '实现', '技术', 'code', 'programming', 'system', 'architecture'],
      '产品': ['功能', '用户', '体验', '需求', '产品', 'feature', 'user', 'experience', 'product'],
      '管理': ['项目', '计划', '进度', '团队', '管理', 'project', 'plan', 'team', 'manage'],
      '学习': ['学习', '研究', '了解', '知识', '技能', 'learn', 'study', 'research', 'knowledge'],
      '创新': ['创新', '创意', '想法', '方案', '改进', 'innovation', 'creative', 'idea', 'solution']
    };
    
    const topics = [];
    const lowerText = text.toLowerCase();
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      const count = keywords.filter(k => lowerText.includes(k.toLowerCase())).length;
      if (count > 2) {
        topics.push(topic);
      }
    }
    
    return topics;
  }

  // 分析决策风格
  analyzeDecisionStyle(messages) {
    // 分析决策相关消息
    const decisionMsgs = messages.filter(m => 
      /决定|选择|用|采用|方案|策略|decide|choose|select|strategy/.test(m)
    );
    
    if (decisionMsgs.length === 0) return null;
    
    const cautious = decisionMsgs.filter(m => /考虑|分析|比较|权衡|think|analyze|compare/.test(m)).length;
    const intuitive = decisionMsgs.filter(m => /感觉|觉得|直觉|feel|intuition/.test(m)).length;
    const dataDriven = decisionMsgs.filter(m => /数据|证据|证明|统计|data|evidence|proof/.test(m)).length;
    
    let style = 'balanced';
    if (cautious > intuitive && cautious > dataDriven) style = '谨慎分析型';
    else if (intuitive > cautious && intuitive > dataDriven) style = '直觉判断型';
    else if (dataDriven > cautious && dataDriven > intuitive) style = '数据驱动型';
    
    return { style, cautious, intuitive, dataDriven };
  }

  // 生成用户画像报告
  generateReport() {
    const report = {
      userId: this.userId,
      totalConversations: this.conversations.length,
      discoveredPatterns: Object.keys(this.discoveredPatterns).length,
      insights: []
    };
    
    for (const [type, pattern] of Object.entries(this.discoveredPatterns)) {
      report.insights.push(pattern.insight);
    }
    
    return report;
  }
}

// 全局实例
let currentAnalyzer = null;

function initPatternAnalyzer(userId) {
  currentAnalyzer = new SpeechPatternAnalyzer(userId);
  console.log(`🔍 [PatternAnalyzer] 初始化用户分析: ${userId}`);
  return currentAnalyzer;
}

function analyzeMessage(message, response) {
  if (!currentAnalyzer) {
    console.warn('[PatternAnalyzer] 请先调用 initPatternAnalyzer()');
    return;
  }
  currentAnalyzer.recordConversation(message, response);
}

function getPatternReport() {
  if (!currentAnalyzer) return null;
  return currentAnalyzer.generateReport();
}

module.exports = {
  SpeechPatternAnalyzer,
  initPatternAnalyzer,
  analyzeMessage,
  getPatternReport
};

// 测试
if (require.main === module) {
  console.log('Speech Pattern Analyzer loaded!');
}
