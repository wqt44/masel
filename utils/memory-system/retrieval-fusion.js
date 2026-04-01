const defaultConfig = require('./retrieval-config');
const { tokenize, cosineSimilarity } = require('./vector-index-store');

function clamp(n, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

function scoreKeyword(query, candidate) {
  const qTokens = tokenize(query);
  const summary = String(candidate.summary || '');
  const content = String(candidate.content || '');
  const text = `${summary} ${content}`;
  const cTokens = tokenize(text);
  const tokenSet = new Set(cTokens);
  const overlap = qTokens.filter(t => tokenSet.has(t)).length;
  const overlapScore = qTokens.length ? overlap / qTokens.length : 0;
  const phraseBonus = text.toLowerCase().includes(String(query).toLowerCase()) ? 0.25 : 0;
  const summaryBonus = qTokens.length
    ? qTokens.filter(t => summary.toLowerCase().includes(t)).length / qTokens.length * 0.25
    : 0;
  const compactQuery = String(query).replace(/\s+/g, '').toLowerCase();
  const compactText = text.replace(/\s+/g, '').toLowerCase();
  const compactBonus = compactQuery && compactText.includes(compactQuery) ? 0.2 : 0;
  return clamp(overlapScore + phraseBonus + summaryBonus + compactBonus);
}

/**
 * v2.0: 非线性衰减曲线
 * 前7天缓衰减 → 7-30天中速 → 30-90天快速 → critical/error_pattern 不衰减
 *
 * 曲线：score = base - segment_rate * age
 * 分段速率：[0,7]=0.01, [7,30]=0.015, [30,90]=0.025, [90+]=0.04
 */
function scoreRecency(timestamp, layer, importance) {
  if (!timestamp) return 0.5;

  const ageDays = (Date.now() - new Date(timestamp).getTime()) / 86400000;
  if (ageDays < 0) return 1.0;

  // critical / error_pattern 不衰减
  const imp = String(importance || '').toLowerCase();
  if (imp === 'critical' || imp === 'error_pattern') return 1.0;

  // 基础半衰期按层定
  const baseHalfLife = { l0: 7, l1: 30, l2: 180, l3: 365 }[layer] || 30;

  // 分段衰减
  let score = 1.0;

  // 段1: 0-7天 (缓衰减，日常上下文保留)
  const s1 = Math.min(ageDays, 7);
  score -= s1 * 0.01; // 7天后 → -0.07

  // 段2: 7-30天 (中速，项目周期)
  if (ageDays > 7) {
    const s2 = Math.min(ageDays - 7, 23);
    score -= s2 * 0.015; // 30天后累计 → -0.07 - 0.345 = -0.415
  }

  // 段3: 30-90天 (快速衰减)
  if (ageDays > 30) {
    const s3 = Math.min(ageDays - 30, 60);
    score -= s3 * 0.025; // 90天后累计 → -0.415 - 1.5 = -1.915
  }

  // 段4: 90天+ (加速衰减)
  if (ageDays > 90) {
    const s4 = ageDays - 90;
    score -= s4 * 0.04;
  }

  // temporary 类型额外加速衰减
  if (imp === 'temporary' || imp === 'low') {
    score *= 0.7;
  }

  return clamp(score);
}

function scoreImportance(importance, config = defaultConfig) {
  return config.importanceWeight[importance] ?? 0.55;
}

function scoreLayerPrior(layer, config = defaultConfig) {
  return config.layerPrior[layer] ?? 0.5;
}

function scoreSemantic(queryVector, candidateVector) {
  if (!queryVector || !candidateVector) return 0;
  return cosineSimilarity(queryVector, candidateVector);
}

function fuseScores(parts, config = defaultConfig) {
  const w = config.weights;
  const final =
    parts.keyword * w.keyword +
    parts.semantic * w.semantic +
    parts.recency * w.recency +
    parts.importance * w.importance +
    parts.layerPrior * w.layerPrior -
    (parts.duplicatePenalty || 0);
  return clamp(final);
}

module.exports = {
  clamp,
  scoreKeyword,
  scoreRecency,
  scoreImportance,
  scoreLayerPrior,
  scoreSemantic,
  fuseScores
};
