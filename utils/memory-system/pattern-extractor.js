/**
 * L3 Pattern Extractor v2.0
 * 从 L0 对话 / L1 摘要 / L2 结构化记忆中提取行为、决策、沟通、周期模式
 *
 * Phase 1 核心模块
 */

const fs = require('fs');
const path = require('path');
const { getDB } = require('./db');
const crypto = require('crypto');

const PATTERNS_DIR = path.join(__dirname, '../../memory/patterns');
const HASH_PATH = path.join(PATTERNS_DIR, 'extracted-hash.json');

// ─── 文件 hash 缓存 ─────────────────────────────────────

function computeFileHash(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(data).digest('hex').slice(0, 8);
  } catch { return null; }
}

function loadExtractedHash() {
  try {
    if (fs.existsSync(HASH_PATH)) {
      return JSON.parse(fs.readFileSync(HASH_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveExtractedHash(prevHash) {
  // 合并新 hash
  const newHash = {};
  const rawDir = path.join(__dirname, '../../memory/raw-conversations');
  if (fs.existsSync(rawDir)) {
    const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.jsonl'));
    for (const file of files.slice(0, 15)) {
      const fullPath = path.join(rawDir, file);
      const hash = computeFileHash(fullPath);
      if (hash) newHash[fullPath] = hash;
    }
  }
  ensureDir(PATTERNS_DIR);
  fs.writeFileSync(HASH_PATH, JSON.stringify(newHash, null, 2));
}



// ─── 模式定义 ───────────────────────────────────────────

const PATTERN_TYPES = {
  behavioral: {
    // 行为模式：用户习惯、工作方式
    detectors: ['timeActivity', 'taskStyle', 'toolUsage'],
    minEvidence: 2,
    confidenceGrowth: 0.15  // 每次新证据增加的置信度上限
  },
  decision: {
    // 决策模式：选择偏好、权衡倾向
    detectors: ['preferenceSignals', 'tradeoffPatterns', 'decisionTriggers'],
    minEvidence: 2,
    confidenceGrowth: 0.12
  },
  communication: {
    // 沟通模式：交互风格、回复偏好
    detectors: ['responseLength', 'topicDepth', 'socialSignals'],
    minEvidence: 3,
    confidenceGrowth: 0.10
  },
  cyclical: {
    // 周期模式：时间规律、重复行为
    detectors: ['weeklyRhythm', 'dailyPeaks', 'recurringTopics'],
    minEvidence: 3,
    confidenceGrowth: 0.08
  }
};

// ─── 提取器基类 ─────────────────────────────────────────

/**
 * 时间活动模式提取
 * 分析用户活跃时间分布
 */
function extractTimeActivity(conversations) {
  const hourBuckets = new Array(24).fill(0);
  const dayBuckets = new Array(7).fill(0); // 0=Sun

  for (const conv of conversations) {
    const d = new Date(conv.timestamp);
    if (isNaN(d.getTime())) continue;
    hourBuckets[d.getHours()]++;
    dayBuckets[d.getDay()]++;
  }

  const total = conversations.length || 1;
  const patterns = [];

  // 活跃时段
  const peakHours = hourBuckets
    .map((count, hour) => ({ hour, count, ratio: count / total }))
    .filter(h => h.ratio > 0.08)
    .sort((a, b) => b.ratio - a.ratio);

  if (peakHours.length > 0 && peakHours[0].ratio > 0.12) {
    const range = peakHours.map(h => h.hour);
    const min = Math.min(...range);
    const max = Math.max(...range);
    patterns.push({
      pattern_type: 'behavioral',
      category: 'time_rhythm',
      content: `用户活跃时段集中在 ${min}:00-${max}:00，峰值在 ${peakHours[0].hour}:00`,
      evidence_count: peakHours.reduce((s, h) => s + h.count, 0),
      confidence: Math.min(0.9, 0.3 + peakHours[0].ratio * 2)
    });
  }

  // 活跃日
  const activeDays = dayBuckets
    .map((count, day) => ({ day: ['日', '一', '二', '三', '四', '五', '六'][day], count, ratio: count / total }))
    .filter(d => d.ratio > 0.1);

  const inactiveDays = dayBuckets
    .map((count, day) => ({ day: ['日', '一', '二', '三', '四', '五', '六'][day], count, ratio: count / total }))
    .filter(d => d.ratio < 0.05);

  if (inactiveDays.length > 0) {
    patterns.push({
      pattern_type: 'cyclical',
      category: 'weekly_rhythm',
      content: `用户在周${inactiveDays.map(d => d.day).join('、')}活跃度低`,
      evidence_count: total,
      confidence: 0.5
    });
  }

  return patterns;
}

/**
 * 任务风格模式提取
 * 分析用户的工作方式偏好
 */
function extractTaskStyle(conversations, memories) {
  const patterns = [];

  // 从对话中检测风格信号
  let discussFirst = 0;
  let directAction = 0;
  let detailOriented = 0;

  for (const conv of conversations) {
    const text = (conv.user_message || '').toLowerCase();

    if (/讨论|设计|方案|分析|想想|怎么|如何/.test(text)) discussFirst++;
    if (/直接|马上|快速|赶紧|开始|做/.test(text)) directAction++;
    if (/细节|质量|代码|架构|文档/.test(text)) detailOriented++;
  }

  const total = conversations.length || 1;

  if (discussFirst / total > 0.15) {
    patterns.push({
      pattern_type: 'behavioral',
      category: 'work_style',
      content: '用户偏好先充分讨论再动手执行',
      evidence_count: discussFirst,
      confidence: Math.min(0.85, 0.3 + (discussFirst / total) * 1.5)
    });
  }

  if (detailOriented / total > 0.15) {
    patterns.push({
      pattern_type: 'behavioral',
      category: 'quality_focus',
      content: '用户重视细节和代码质量，经常追问实现细节',
      evidence_count: detailOriented,
      confidence: Math.min(0.85, 0.3 + (detailOriented / total) * 1.5)
    });
  }

  // 从偏好记忆中提取
  const prefMemories = memories.filter(m =>
    m.type === 'preference' || (m.metadata?.type || '').includes('preference')
  );

  for (const mem of prefMemories) {
    const content = (mem.content || '').toLowerCase();
    if (content.includes('详细') || content.includes('讨论')) {
      patterns.push({
        pattern_type: 'decision',
        category: 'work_preference',
        content: `偏好：${mem.content.slice(0, 120)}`,
        evidence_count: 1,
        confidence: 0.7,
        source_memory: mem.id
      });
    }
  }

  return patterns;
}

/**
 * 偏好信号提取
 * 从对话中检测技术/设计偏好
 */
function extractPreferenceSignals(conversations) {
  const signals = {};
  const patterns = [];

  const prefKeywords = {
    '喜欢': 1, '偏好': 1, 'prefer': 1, 'want': 0.7,
    '好用': 0.8, '推荐': 0.5, '风格': 1, '习惯': 1
  };

  for (const conv of conversations) {
    const text = (conv.user_message || '').toLowerCase();
    for (const [keyword, weight] of Object.entries(prefKeywords)) {
      const idx = text.indexOf(keyword);
      if (idx === -1) continue;

      // 提取偏好上下文（关键词前后各30字）
      const start = Math.max(0, idx - 30);
      const end = Math.min(text.length, idx + 30 + keyword.length);
      const snippet = text.slice(start, end).trim();

      const key = snippet.replace(/\s+/g, ' ');
      if (!signals[key]) {
        signals[key] = { count: 0, weight: 0, snippets: [] };
      }
      signals[key].count++;
      signals[key].weight += weight;
      signals[key].snippets.push(snippet);
    }
  }

  // 聚合相似信号
  const aggregated = Object.entries(signals)
    .filter(([, s]) => s.count >= 2 || s.weight >= 1.5)
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 15);

  for (const [key, data] of aggregated) {
    patterns.push({
      pattern_type: 'decision',
      category: 'preference',
      content: key,
      evidence_count: data.count,
      confidence: Math.min(0.8, 0.3 + data.weight * 0.1)
    });
  }

  return patterns;
}

/**
 * 沟通风格提取
 * 分析消息长度、深度
 */
function extractCommunicationStyle(conversations) {
  const patterns = [];

  const lengths = conversations.map(c => (c.user_message || '').length).filter(l => l > 0);
  if (lengths.length < 5) return patterns;

  const avgLen = lengths.reduce((s, l) => s + l, 0) / lengths.length;
  const longRatio = lengths.filter(l => l > 100).length / lengths.length;

  if (avgLen > 60) {
    patterns.push({
      pattern_type: 'communication',
      category: 'message_length',
      content: `用户倾向于发送较长消息（平均 ${Math.round(avgLen)} 字），偏好详细描述需求`,
      evidence_count: lengths.length,
      confidence: Math.min(0.75, 0.3 + (avgLen / 200) * 0.5)
    });
  }

  // 多问题/多主题消息
  const multiTopic = conversations.filter(c => {
    const text = c.user_message || '';
    const questions = (text.match(/[？?]/g) || []).length;
    return questions >= 2 || text.split(/[，,；;]/).length >= 3;
  });

  if (multiTopic.length / (conversations.length || 1) > 0.2) {
    patterns.push({
      pattern_type: 'communication',
      category: 'topic_density',
      content: '用户常在一条消息中包含多个问题或主题',
      evidence_count: multiTopic.length,
      confidence: 0.6
    });
  }

  return patterns;
}

/**
 * 重复话题提取
 * 检测周期性出现的主题
 */
function extractRecurringTopics(conversations) {
  const patterns = [];
  const topicFreq = {};

  const topicKeywords = {
    '记忆系统': /记忆|memory|记忆系统/,
    'MASEL': /masel/i,
    '代码质量': /代码质量|重构|架构|设计/,
    '项目进度': /进度|里程碑|进展|todo/,
    '部署': /部署|deploy|发布|打包/,
    '设计讨论': /设计|方案|讨论|需求/,
    '性能优化': /性能|优化|速度|缓存/,
    '安全': /安全|权限|漏洞|认证/
  };

  // 按天统计
  const dailyTopics = {};
  for (const conv of conversations) {
    const text = `${conv.user_message || ''} ${conv.ai_response || ''}`;
    const date = (conv.timestamp || '').slice(0, 10);

    for (const [topic, regex] of Object.entries(topicKeywords)) {
      if (regex.test(text)) {
        if (!dailyTopics[topic]) dailyTopics[topic] = new Set();
        dailyTopics[topic].add(date);

        if (!topicFreq[topic]) topicFreq[topic] = 0;
        topicFreq[topic]++;
      }
    }
  }

  // 跨多天出现的主题 = 周期性话题
  for (const [topic, days] of Object.entries(dailyTopics)) {
    if (days.size >= 3 && topicFreq[topic] >= 5) {
      patterns.push({
        pattern_type: 'cyclical',
        category: 'recurring_topic',
        content: `"${topic}" 是高频话题，在 ${days.size} 天中被讨论 ${topicFreq[topic]} 次`,
        evidence_count: topicFreq[topic],
        confidence: Math.min(0.85, 0.3 + days.size * 0.1)
      });
    }
  }

  return patterns;
}

// ─── 主提取流程 ─────────────────────────────────────────

/**
 * 从所有数据源提取模式
 * @returns {{ new: number, updated: number, patterns: Array }}
 */
function extractAll() {
  const prevHash = loadExtractedHash();
  const rawDir = path.join(__dirname, '../../memory/raw-conversations');
  const conversations = [];
  if (fs.existsSync(rawDir)) {
    const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.jsonl')).sort().reverse();
    for (const file of files.slice(0, 15)) { // 最近15天
      try {
        const fullPath = path.join(rawDir, file);
        const currentHash = computeFileHash(fullPath);

        // 增量：文件未修改则跳过
        if (currentHash && prevHash[fullPath] === currentHash) continue;

        const lines = fs.readFileSync(fullPath, 'utf-8').split('\n').filter(Boolean);
        for (const line of lines) {
          try { conversations.push(JSON.parse(line)); } catch {}
        }
        // 更新 hash
        prevHash[fullPath] = currentHash;
      } catch {}
    }
  }

  // 加载 L2 结构化记忆
  const memDir = path.join(__dirname, '../../memory/structured');
  const memories = [];
  if (fs.existsSync(memDir)) {
    const walkDir = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walkDir(full); continue; }
        if (!entry.name.endsWith('.json')) continue;
        try { memories.push(JSON.parse(fs.readFileSync(full, 'utf-8'))); } catch {}
      }
    };
    walkDir(memDir);
  }

  // 运行所有提取器
  const rawPatterns = [
    ...extractTimeActivity(conversations),
    ...extractTaskStyle(conversations, memories),
    ...extractPreferenceSignals(conversations),
    ...extractCommunicationStyle(conversations),
    ...extractRecurringTopics(conversations)
  ];

  // 加载已有模式做增量更新
  const existingPatterns = loadExistingPatterns();
  const { newPatterns, updatedPatterns } = mergePatternUpdates(rawPatterns, existingPatterns);

  // 保存到文件
  savePatterns(newPatterns, updatedPatterns);

  // 保存 hash map（增量提取用）
  if (!fs.existsSync(path.dirname(HASH_PATH))) {
    ensureDir(path.dirname(HASH_PATH));
  }
  fs.writeFileSync(HASH_PATH, JSON.stringify(prevHash, null, 2));

  return {
    totalExtracted: rawPatterns.length,
    new: newPatterns.length,
    updated: updatedPatterns.length,
    total: existingPatterns.length + newPatterns.length,
    patterns: [...updatedPatterns, ...newPatterns]
  };
}

/**
 * 加载已有模式
 */
function loadExistingPatterns() {
  const patterns = [];

  // 从文件系统加载
  if (fs.existsSync(PATTERNS_DIR)) {
    for (const file of fs.readdirSync(PATTERNS_DIR).filter(f => f.endsWith('.json'))) {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(PATTERNS_DIR, file), 'utf-8'));
        patterns.push(p);
      } catch {}
    }
  }

  // 尝试从 SQLite 加载（如果表存在）
  try {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM patterns WHERE is_active = 1').all();
    // db shared, do not close
    for (const row of rows) {
      patterns.push({
        id: row.id,
        pattern_type: row.pattern_type,
        category: row.category,
        content: row.content,
        evidence: JSON.parse(row.evidence || '[]'),
        confidence: row.confidence,
        frequency: row.frequency,
        first_seen: row.first_seen,
        last_seen: row.last_seen
      });
    }
  } catch {}

  return patterns;
}

/**
 * 合并新提取的模式与已有模式
 */
function mergePatternUpdates(rawPatterns, existingPatterns) {
  const newPatterns = [];
  const updatedPatterns = [];

  for (const raw of rawPatterns) {
    // 查找相似已有模式
    const match = findSimilarPattern(raw, existingPatterns);

    if (match) {
      // 增量更新：增加频率和置信度
      const typeConfig = PATTERN_TYPES[raw.pattern_type] || { confidenceGrowth: 0.1 };
      match.frequency = (match.frequency || 1) + 1;
      match.confidence = Math.min(0.95,
        match.confidence + typeConfig.confidenceGrowth
      );
      match.last_seen = new Date().toISOString();
      match.content = raw.content; // 用最新描述更新
      updatedPatterns.push(match);
    } else {
      // 新模式
      const pattern = {
        id: `pat-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        pattern_type: raw.pattern_type,
        category: raw.category,
        content: raw.content,
        evidence: [],
        confidence: raw.confidence || 0.3,
        frequency: raw.evidence_count || 1,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        is_active: true
      };

      if (raw.source_memory) {
        pattern.evidence = [{ source: raw.source_memory, timestamp: new Date().toISOString() }];
      }

      newPatterns.push(pattern);
      existingPatterns.push(pattern); // 加入已有列表，避免后续重复
    }
  }

  return { newPatterns, updatedPatterns };
}

/**
 * 查找相似模式
 * 用内容相似度 + 类型匹配
 */
function findSimilarPattern(raw, existingPatterns) {
  for (const existing of existingPatterns) {
    if (existing.pattern_type !== raw.pattern_type) continue;
    if (existing.category !== raw.category) continue;

    // 内容相似度（简化 Jaccard）
    const words1 = new Set(existing.content.toLowerCase().split(/\s+/));
    const words2 = new Set(raw.content.toLowerCase().split(/\s+/));
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    const similarity = union > 0 ? intersection / union : 0;

    if (similarity > 0.5) return existing;
  }
  return null;
}

/**
 * 保存模式到文件系统
 */
function savePatterns(newPatterns, updatedPatterns) {
  if (!fs.existsSync(PATTERNS_DIR)) {
    ensureDir(PATTERNS_DIR);
  }

  for (const pattern of [...newPatterns, ...updatedPatterns]) {
    const filePath = path.join(PATTERNS_DIR, `${pattern.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(pattern, null, 2));
  }

  // 尝试写入 SQLite
  try {
    const db = getDB();
    // 确保表存在
    db.exec(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL,
        category TEXT,
        content TEXT NOT NULL,
        evidence JSON,
        confidence REAL DEFAULT 0.5,
        frequency INTEGER DEFAULT 1,
        first_seen DATETIME,
        last_seen DATETIME,
        is_active BOOLEAN DEFAULT 1,
        supersedes_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata JSON
      )
    `);

    const upsert = db.prepare(`
      INSERT INTO patterns (id, pattern_type, category, content, evidence, confidence, frequency, first_seen, last_seen, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        confidence = excluded.confidence,
        frequency = excluded.frequency,
        last_seen = excluded.last_seen,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const pattern of [...newPatterns, ...updatedPatterns]) {
      upsert.run(
        pattern.id,
        pattern.pattern_type,
        pattern.category || null,
        pattern.content,
        JSON.stringify(pattern.evidence || []),
        pattern.confidence,
        pattern.frequency,
        pattern.first_seen,
        pattern.last_seen
      );
    }

    // db shared, do not close
  } catch (e) {
    // SQLite 不可用时静默降级到文件
    console.warn('Pattern SQLite write failed, file-only mode:', e.message);
  }
}

/**
 * 获取活跃模式（供检索层调用）
 */
function getActivePatterns(options = {}) {
  const { type = null, category = null, minConfidence = 0.3 } = options;

  let patterns = loadExistingPatterns();

  if (type) patterns = patterns.filter(p => p.pattern_type === type);
  if (category) patterns = patterns.filter(p => p.category === category);
  patterns = patterns.filter(p => p.is_active !== false && p.confidence >= minConfidence);

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

/**
 * 衰减低频模式（定期调用）
 */
function decayPatterns(decayDays = 60) {
  const patterns = loadExistingPatterns();
  const threshold = Date.now() - decayDays * 86400000;
  let decayed = 0;

  for (const pattern of patterns) {
    const lastSeen = new Date(pattern.last_seen).getTime();
    if (lastSeen < threshold && pattern.frequency < 3) {
      pattern.confidence *= 0.7;
      pattern.is_active = pattern.confidence > 0.15;
      if (!pattern.is_active) decayed++;
    }
  }

  // 保存更新
  savePatterns([], patterns.filter(p => p.confidence <= 0.3));

  return { total: patterns.length, decayed, remaining: patterns.filter(p => p.is_active).length };
}

module.exports = {
  extractAll,
  getActivePatterns,
  decayPatterns,
  loadExistingPatterns,
  PATTERN_TYPES,
  // 单独导出提取器供测试
  extractTimeActivity,
  extractTaskStyle,
  extractPreferenceSignals,
  extractCommunicationStyle,
  extractRecurringTopics
};
