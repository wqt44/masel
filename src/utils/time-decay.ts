/**
 * MASEL Time Decay Service
 * 学习模式的时间衰减机制
 */

// ============================================================================
// 衰减配置
// ============================================================================

interface DecayConfig {
  half_life_days: number;        // 半衰期（天）
  min_weight: number;            // 最小权重
  max_weight: number;            // 最大权重
  boost_recent: boolean;         // 是否提升近期模式
  recent_window_days: number;    // 近期窗口（天）
}

const DEFAULT_DECAY_CONFIG: DecayConfig = {
  half_life_days: 30,            // 30天半衰期
  min_weight: 0.1,               // 最小10%权重
  max_weight: 1.0,               // 最大100%权重
  boost_recent: true,
  recent_window_days: 7          // 7天内算近期
};

// ============================================================================
// 模式权重计算
// ============================================================================

interface WeightedPattern {
  pattern_id: string;
  name: string;
  base_weight: number;           // 基础权重（基于成功率）
  time_weight: number;           // 时间权重（衰减后）
  final_weight: number;          // 最终权重
  age_days: number;              // 模式年龄（天）
  last_occurrence: string;       // 最后出现时间
  occurrence_count: number;      // 出现次数
}

/**
 * 计算时间衰减权重
 * 
 * 使用指数衰减公式: weight = max_weight * (0.5 ^ (age / half_life))
 */
export function calculateTimeWeight(
  ageDays: number,
  config: Partial<DecayConfig> = {}
): number {
  const cfg = { ...DEFAULT_DECAY_CONFIG, ...config };

  // 指数衰减
  const decayFactor = Math.pow(0.5, ageDays / cfg.half_life_days);
  let weight = cfg.max_weight * decayFactor;

  // 确保不低于最小权重
  weight = Math.max(weight, cfg.min_weight);

  return weight;
}

/**
 * 计算模式最终权重
 */
export function calculateFinalWeight(
  pattern: {
    success_rate: number;
    occurrence_count: number;
    created_at: string;
    last_occurrence?: string;
  },
  config: Partial<DecayConfig> = {}
): WeightedPattern {
  const cfg = { ...DEFAULT_DECAY_CONFIG, ...config };
  const now = new Date();

  // 计算模式年龄
  const lastOccurrence = pattern.last_occurrence || pattern.created_at;
  const lastDate = new Date(lastOccurrence);
  const ageDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

  // 基础权重：基于成功率和出现次数
  const baseWeight = Math.min(
    pattern.success_rate * (1 + Math.log10(pattern.occurrence_count + 1) / 10),
    cfg.max_weight
  );

  // 时间权重
  let timeWeight = calculateTimeWeight(ageDays, config);

  // 近期模式提升
  if (cfg.boost_recent && ageDays < cfg.recent_window_days) {
    const boostFactor = 1 + (cfg.recent_window_days - ageDays) / cfg.recent_window_days;
    timeWeight = Math.min(timeWeight * boostFactor, cfg.max_weight);
  }

  // 最终权重
  const finalWeight = baseWeight * timeWeight;

  return {
    pattern_id: '',  // 由调用者填充
    name: '',
    base_weight: baseWeight,
    time_weight: timeWeight,
    final_weight: finalWeight,
    age_days: ageDays,
    last_occurrence: lastOccurrence,
    occurrence_count: pattern.occurrence_count
  };
}

// ============================================================================
// 模式排序和筛选
// ============================================================================

/**
 * 根据权重排序模式
 */
export function sortPatternsByWeight(
  patterns: Array<{
    pattern_id: string;
    name: string;
    success_rate: number;
    occurrence_count: number;
    created_at: string;
    last_occurrence?: string;
  }>,
  config?: Partial<DecayConfig>
): WeightedPattern[] {
  const weighted = patterns.map(p => ({
    ...calculateFinalWeight(p, config),
    pattern_id: p.pattern_id,
    name: p.name
  }));

  // 按最终权重降序排序
  return weighted.sort((a, b) => b.final_weight - a.final_weight);
}

/**
 * 筛选高权重模式
 */
export function filterHighWeightPatterns(
  patterns: WeightedPattern[],
  threshold: number = 0.5
): WeightedPattern[] {
  return patterns.filter(p => p.final_weight >= threshold);
}

/**
 * 标记过期模式
 */
export function markExpiredPatterns(
  patterns: WeightedPattern[],
  expiryDays: number = 90
): Array<WeightedPattern & { expired: boolean }> {
  return patterns.map(p => ({
    ...p,
    expired: p.age_days > expiryDays && p.final_weight < 0.2
  }));
}

// ============================================================================
// 学习权重调整
// ============================================================================

/**
 * 根据时间衰减调整学习强度
 */
export function adjustLearningIntensity(
  baseIntensity: number,
  patternAgeDays: number,
  config?: Partial<DecayConfig>
): number {
  const cfg = { ...DEFAULT_DECAY_CONFIG, ...config };

  // 旧模式的学习强度降低
  const timeWeight = calculateTimeWeight(patternAgeDays, config);

  // 新模式（7天内）学习强度提升
  if (patternAgeDays < cfg.recent_window_days) {
    return Math.min(baseIntensity * 1.5, 1.0);
  }

  // 老模式学习强度降低
  return baseIntensity * timeWeight;
}

/**
 * 计算模式的新鲜度分数
 */
export function calculateFreshnessScore(
  lastOccurrence: string,
  occurrenceCount: number,
  config?: Partial<DecayConfig>
): number {
  const cfg = { ...DEFAULT_DECAY_CONFIG, ...config };
  const now = new Date();
  const lastDate = new Date(lastOccurrence);
  const ageDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

  // 新鲜度 = 频率 * 时间衰减
  const frequency = Math.log10(occurrenceCount + 1);
  const timeDecay = calculateTimeWeight(ageDays, config);

  return frequency * timeDecay;
}

// ============================================================================
// Soul 更新权重
// ============================================================================

/**
 * 计算 Soul 中各部分的权重
 */
export function calculateSoulSectionWeights(
  sections: Array<{
    name: string;
    patterns: Array<{
      created_at: string;
      last_used?: string;
      use_count: number;
    }>;
  }>,
  config?: Partial<DecayConfig>
): Array<{
  section_name: string;
  avg_weight: number;
  max_weight: number;
  min_weight: number;
  should_refresh: boolean;
}> {
  return sections.map(section => {
    const weights = section.patterns.map(p => {
      const lastUsed = p.last_used || p.created_at;
      const ageDays = (Date.now() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24);
      return calculateTimeWeight(ageDays, config);
    });

    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);

    // 如果平均权重过低，建议刷新
    const shouldRefresh = avgWeight < 0.3;

    return {
      section_name: section.name,
      avg_weight: avgWeight,
      max_weight: maxWeight,
      min_weight: minWeight,
      should_refresh: shouldRefresh
    };
  });
}

// ============================================================================
// 报告生成
// ============================================================================

interface DecayReport {
  total_patterns: number;
  avg_age_days: number;
  avg_weight: number;
  expired_count: number;
  recent_count: number;      // 7天内
  needs_refresh: string[];
  recommendations: string[];
}

/**
 * 生成时间衰减报告
 */
export function generateDecayReport(
  patterns: WeightedPattern[],
  config?: Partial<DecayConfig>
): DecayReport {
  const cfg = { ...DEFAULT_DECAY_CONFIG, ...config };

  const totalPatterns = patterns.length;
  const avgAge = patterns.reduce((sum, p) => sum + p.age_days, 0) / totalPatterns;
  const avgWeight = patterns.reduce((sum, p) => sum + p.final_weight, 0) / totalPatterns;
  const expiredCount = patterns.filter(p => p.age_days > 90 && p.final_weight < 0.2).length;
  const recentCount = patterns.filter(p => p.age_days < cfg.recent_window_days).length;

  const needsRefresh = patterns
    .filter(p => p.final_weight < 0.3 && p.age_days > 30)
    .map(p => p.name);

  const recommendations: string[] = [];

  if (expiredCount > totalPatterns * 0.3) {
    recommendations.push(`发现 ${expiredCount} 个过期模式，建议清理`);
  }

  if (recentCount < totalPatterns * 0.1) {
    recommendations.push('近期模式较少，建议增加学习频率');
  }

  if (avgWeight < 0.5) {
    recommendations.push('平均权重较低，建议审查模式质量');
  }

  return {
    total_patterns: totalPatterns,
    avg_age_days: avgAge,
    avg_weight: avgWeight,
    expired_count: expiredCount,
    recent_count: recentCount,
    needs_refresh: needsRefresh,
    recommendations
  };
}

// ============================================================================
// 导出
// ============================================================================

export default {
  calculateTimeWeight,
  calculateFinalWeight,
  sortPatternsByWeight,
  filterHighWeightPatterns,
  markExpiredPatterns,
  adjustLearningIntensity,
  calculateFreshnessScore,
  calculateSoulSectionWeights,
  generateDecayReport,
  DEFAULT_DECAY_CONFIG
};
