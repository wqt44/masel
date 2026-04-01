/**
 * Memory Dedup & Merge v2.0
 * 记忆去重与智能合并引擎
 *
 * Phase 1 核心模块
 * - 向量级相似度检测（TF-IDF + 余弦）
 * - 多策略合并（内容合并 / 取新 / 置信度优先）
 * - 合并审计追踪
 */

const fs = require('fs');
const path = require('path');
const { tokenize } = require('./vector-index-store');
const { textSimilarity, normalizeText } = require('./retrieval-dedupe');

const STRUCTURED_DIR = path.join(__dirname, '../../memory/structured');
const ARCHIVE_DIR = path.join(__dirname, '../../memory/archive');
const MERGE_LOG = path.join(__dirname, '../../memory/merge-log.jsonl');

// ─── TF-IDF 相似度 ─────────────────────────────────────

/**
 * 计算 TF-IDF 向量并做余弦相似度
 * 比纯 Jaccard 更准确
 */
function computeTFIDFSimilarity(text1, text2) {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (!tokens1.length || !tokens2.length) return 0;

  // 词频
  const tf1 = termFrequency(tokens1);
  const tf2 = termFrequency(tokens2);

  // 合并词汇表
  const vocab = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
  const n = 2; // 只有2个文档

  // IDF 向量
  const idf = {};
  for (const term of vocab) {
    const df = (tf1[term] ? 1 : 0) + (tf2[term] ? 1 : 0);
    idf[term] = Math.log((n + 1) / (df + 1)) + 1; // 平滑 IDF
  }

  // TF-IDF 向量
  const vec1 = {};
  const vec2 = {};
  for (const term of vocab) {
    vec1[term] = (tf1[term] || 0) * idf[term];
    vec2[term] = (tf2[term] || 0) * idf[term];
  }

  // 余弦相似度
  let dot = 0, norm1 = 0, norm2 = 0;
  for (const term of vocab) {
    dot += (vec1[term] || 0) * (vec2[term] || 0);
    norm1 += (vec1[term] || 0) ** 2;
    norm2 += (vec2[term] || 0) ** 2;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

function termFrequency(tokens) {
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  // 归一化
  const len = tokens.length || 1;
  for (const k of Object.keys(tf)) tf[k] /= len;
  return tf;
}

// ─── 去重扫描 ──────────────────────────────────────────

/**
 * 扫描结构化记忆，找出重复/高度相似的记忆对
 * @param {Object} options
 * @param {number} options.threshold - 相似度阈值 (默认 0.85)
 * @param {string} options.type - 只扫描特定类型
 * @param {boolean} options.dryRun - 只报告不执行
 */
function scanDuplicates(options = {}) {
  const {
    threshold = 0.85,
    type = null,
    dryRun = true
  } = options;

  // 加载所有活跃记忆
  const memories = loadStructuredMemories(type);
  const duplicates = [];

  // O(n²) 比对（记忆量可控，通常 <500）
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const a = memories[i];
      const b = memories[j];

      // 不同类型跳过
      if (a.type !== b.type) continue;
      // 非活跃跳过
      if (!a.is_active || !b.is_active) continue;

      // 先用快速 Jaccard 过滤
      const quickSim = textSimilarity(
        normalizeText(a.content || ''),
        normalizeText(b.content || '')
      );

      if (quickSim < threshold - 0.1) continue; // 快速剪枝

      // 再用 TF-IDF 精确计算
      const tfidfSim = computeTFIDFSimilarity(
        a.content || '',
        b.content || ''
      );

      if (tfidfSim >= threshold) {
        duplicates.push({
          pair: [a.id, b.id],
          similarity: tfidfSim,
          memories: [a, b],
          strategy: suggestMergeStrategy(a, b)
        });
      }
    }
  }

  duplicates.sort((a, b) => b.similarity - a.similarity);
  return duplicates;
}

/**
 * 根据两个记忆的特征建议合并策略
 */
function suggestMergeStrategy(a, b) {
  const timeA = new Date(a.created_at || 0).getTime();
  const timeB = new Date(b.created_at || 0).getTime();

  // 置信度差异大 → 取高置信度
  const confDiff = Math.abs((a.confidence || 0.5) - (b.confidence || 0.5));
  if (confDiff > 0.3) {
    return (a.confidence || 0.5) > (b.confidence || 0.5) ? 'keep_higher_confidence' : 'keep_higher_confidence';
  }

  // 版本差异 → 取新版本
  if (a.version && b.version && a.version !== b.version) {
    return a.version > b.version ? 'keep_newer' : 'keep_newer';
  }

  // 时间差异大 → 取新的
  if (Math.abs(timeA - timeB) > 7 * 86400000) {
    return 'keep_newer';
  }

  // 默认：合并内容
  return 'merge_content';
}

/**
 * 执行合并
 */
function executeMerge(duplicate, strategy) {
  const [a, b] = duplicate.memories;
  const timeA = new Date(a.created_at || 0).getTime();
  const timeB = new Date(b.created_at || 0).getTime();

  let survivor, absorbed;

  switch (strategy) {
    case 'keep_newer':
      survivor = timeA > timeB ? a : b;
      absorbed = timeA > timeB ? b : a;
      break;
    case 'keep_higher_confidence':
      survivor = (a.confidence || 0.5) >= (b.confidence || 0.5) ? a : b;
      absorbed = (a.confidence || 0.5) >= (b.confidence || 0.5) ? b : a;
      break;
    case 'merge_content':
    default:
      // 默认：a 保留，b 的内容合并进来
      survivor = timeA >= timeB ? a : b;
      absorbed = timeA >= timeB ? b : a;
      // 合并内容
      survivor.content = mergeContent(survivor.content, absorbed.content);
      survivor.confidence = Math.max(survivor.confidence || 0.5, absorbed.confidence || 0.5);
      break;
  }

  // 更新存活记忆
  survivor.version = (survivor.version || 1) + 1;
  survivor.updated_at = new Date().toISOString();
  survivor.merged_from = [...(survivor.merged_from || []), absorbed.id].filter(Boolean);

  // 标记被合并记忆为非活跃
  absorbed.is_active = false;
  absorbed.merged_into = survivor.id;
  absorbed.archived_at = new Date().toISOString();

  // 保存
  saveStructuredMemory(survivor);
  archiveStructuredMemory(absorbed);

  // 记录合并日志
  logMerge(survivor.id, absorbed.id, duplicate.similarity, strategy);

  return { survivor, absorbed };
}

/**
 * 智能合并两段内容
 * 保留两段中不重复的部分，去除冗余
 */
function mergeContent(contentA, contentB) {
  const linesA = String(contentA || '').split('\n').map(l => l.trim()).filter(Boolean);
  const linesB = String(contentB || '').split('\n').map(l => l.trim()).filter(Boolean);

  const seen = new Set();
  const merged = [];

  for (const line of [...linesA, ...linesB]) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(line);
  }

  return merged.join('\n');
}

/**
 * 批量去重
 */
function deduplicateAll(options = {}) {
  const { dryRun = true, autoMerge = false, threshold = 0.85 } = options;

  const duplicates = scanDuplicates({ threshold, dryRun: true });

  if (dryRun) {
    return {
      mode: 'dry_run',
      duplicatesFound: duplicates.length,
      wouldMerge: duplicates.length,
      pairs: duplicates.map(d => ({
        ids: d.pair,
        similarity: Math.round(d.similarity * 100) / 100,
        strategy: d.strategy
      }))
    };
  }

  const results = [];
  for (const dup of duplicates) {
    if (autoMerge || dup.similarity >= 0.92) {
      // 高相似度自动合并
      const result = executeMerge(dup, dup.strategy);
      results.push({ merged: true, ...result });
    } else {
      results.push({ merged: false, needsReview: true, ...dup });
    }
  }

  return {
    mode: 'execute',
    duplicatesFound: duplicates.length,
    autoMerged: results.filter(r => r.merged).length,
    needsReview: results.filter(r => !r.merged).length,
    results
  };
}

// ─── 文件操作（使用共享模块，避免重复定义）──────────────

const { saveStructuredMemory: saveMemory, archiveStructuredMemory, loadStructuredMemories } = require('./memory-fs');

function logMerge(survivorId, absorbedId, similarity, strategy) {
  const mergeLogPath = path.join(__dirname, '../../memory/merge-log.jsonl');
  const dir = path.dirname(mergeLogPath);
  ensureDir(dir);

  fs.appendFileSync(mergeLogPath, JSON.stringify({
    survivor_id: survivorId,
    absorbed_id: absorbedId,
    similarity,
    strategy,
    merged_at: new Date().toISOString()
  }) + '\n');
}

module.exports = {
  scanDuplicates,
  executeMerge,
  deduplicateAll,
  computeTFIDFSimilarity,
  suggestMergeStrategy,
  mergeContent
};
