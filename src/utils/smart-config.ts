/**
 * MASEL Smart Configuration Service
 * 智能配置优化，减少误报，平衡学习
 */

// ============================================================================
// 自适应安全配置
// ============================================================================

interface AdaptiveSecurityConfig {
  // 基于历史误报调整
  false_positive_rate: number;
  adjustment_factor: number;
  
  // 动态白名单
  trusted_patterns: string[];
  blocked_patterns: string[];
  
  // 上下文感知
  context_aware: boolean;
  task_type_whitelist: Record<string, string[]>;
}

/**
 * 根据历史记录调整安全规则
 */
export function adjustSecurityRules(
  history: Array<{
    pattern: string;
    was_false_positive: boolean;
    context: string;
  }>
): AdaptiveSecurityConfig {
  const trustedPatterns: string[] = [];
  const blockedPatterns: string[] = [];
  
  // 统计每个模式的误报率
  const patternStats: Record<string, { total: number; fp: number }> = {};
  
  for (const record of history) {
    if (!patternStats[record.pattern]) {
      patternStats[record.pattern] = { total: 0, fp: 0 };
    }
    patternStats[record.pattern].total++;
    if (record.was_false_positive) {
      patternStats[record.pattern].fp++;
    }
  }
  
  // 调整规则
  for (const [pattern, stats] of Object.entries(patternStats)) {
    const fpRate = stats.fp / stats.total;
    
    if (fpRate > 0.5 && stats.total > 5) {
      // 误报率过高，加入信任列表
      trustedPatterns.push(pattern);
    } else if (fpRate < 0.1 && stats.total > 10) {
      // 误报率很低，保持拦截
      blockedPatterns.push(pattern);
    }
  }
  
  const totalFp = history.filter(h => h.was_false_positive).length;
  const fpRate = totalFp / history.length;
  
  return {
    false_positive_rate: fpRate,
    adjustment_factor: fpRate > 0.3 ? 0.8 : 1.0,  // 误报高时放宽
    trusted_patterns: trustedPatterns,
    blocked_patterns: blockedPatterns,
    context_aware: true,
    task_type_whitelist: {
      'coding': ['eval', 'Function', 'exec'],  // 编码任务允许这些
      'research': [],  // 研究任务更严格
      'review': []     // 审核任务最严格
    }
  };
}

// ============================================================================
// 上下文感知安全检查
// ============================================================================

/**
 * 根据任务类型调整安全检查
 */
export function contextAwareSecurityCheck(
  code: string,
  taskType: 'coding' | 'research' | 'review',
  config: AdaptiveSecurityConfig
): {
  safe: boolean;
  threats: string[];
  warnings: string[];
} {
  const threats: string[] = [];
  const warnings: string[] = [];
  
  // 获取该任务类型的白名单
  const whitelist = config.task_type_whitelist[taskType] || [];
  
  // 基础危险模式
  const dangerousPatterns = [
    { pattern: 'rm -rf /', level: 'critical' },
    { pattern: 'nc -e', level: 'critical' },
    { pattern: 'bash -i', level: 'critical' },
    { pattern: 'eval(', level: 'high' },
    { pattern: 'exec(', level: 'high' }
  ];
  
  for (const { pattern, level } of dangerousPatterns) {
    if (code.includes(pattern)) {
      // 检查是否在白名单中
      if (whitelist.some(wp => pattern.includes(wp))) {
        // 在白名单中，降级为警告
        warnings.push(`${pattern} (allowed for ${taskType})`);
      } else {
        // 不在白名单，正常处理
        if (level === 'critical') {
          threats.push(pattern);
        } else {
          warnings.push(pattern);
        }
      }
    }
  }
  
  return {
    safe: threats.length === 0,
    threats,
    warnings
  };
}

// ============================================================================
// 学习偏见缓解
// ============================================================================

interface BiasMitigationConfig {
  // 多样性采样
  diversity_boost: boolean;
  max_same_type_errors: number;
  
  // 时间平衡
  time_balanced: boolean;
  recent_weight: number;
  old_weight: number;
  
  // 反事实学习
  counterfactual_learning: boolean;
  success_examples_ratio: number;
}

const DEFAULT_BIAS_CONFIG: BiasMitigationConfig = {
  diversity_boost: true,
  max_same_type_errors: 5,      // 同类型错误最多学习5次
  time_balanced: true,
  recent_weight: 0.6,
  old_weight: 0.4,
  counterfactual_learning: true,
  success_examples_ratio: 0.3   // 30%成功案例
};

/**
 * 缓解学习偏见
 */
export function mitigateLearningBias(
  errors: Array<{
    error_type: string;
    timestamp: string;
    success?: boolean;
  }>,
  config: Partial<BiasMitigationConfig> = {}
): {
  selected: typeof errors;
  dropped: typeof errors;
  stats: {
    original_count: number;
    selected_count: number;
    type_distribution: Record<string, number>;
    time_distribution: { recent: number; old: number };
  };
} {
  const cfg = { ...DEFAULT_BIAS_CONFIG, ...config };
  const selected: typeof errors = [];
  const dropped: typeof errors = [];
  
  // 按类型分组
  const byType: Record<string, typeof errors> = {};
  for (const error of errors) {
    if (!byType[error.error_type]) {
      byType[error.error_type] = [];
    }
    byType[error.error_type].push(error);
  }
  
  // 多样性采样：每类最多取 max_same_type_errors 个
  for (const [type, typeErrors] of Object.entries(byType)) {
    // 按时间排序
    const sorted = typeErrors.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // 取最近的 N 个
    const toKeep = sorted.slice(0, cfg.max_same_type_errors);
    const toDrop = sorted.slice(cfg.max_same_type_errors);
    
    selected.push(...toKeep);
    dropped.push(...toDrop);
  }
  
  // 时间平衡
  if (cfg.time_balanced) {
    const now = Date.now();
    const recentThreshold = 7 * 24 * 60 * 60 * 1000;  // 7天
    
    const recent = selected.filter(e => now - new Date(e.timestamp).getTime() < recentThreshold);
    const old = selected.filter(e => now - new Date(e.timestamp).getTime() >= recentThreshold);
    
    // 如果近期太多，适当丢弃一些
    if (recent.length > old.length * 2) {
      const toRemove = recent.length - Math.floor(old.length * 1.5);
      for (let i = 0; i < toRemove && i < recent.length; i++) {
        const idx = selected.indexOf(recent[recent.length - 1 - i]);
        if (idx > -1) {
          dropped.push(selected.splice(idx, 1)[0]);
        }
      }
    }
  }
  
  // 统计
  const typeDistribution: Record<string, number> = {};
  for (const e of selected) {
    typeDistribution[e.error_type] = (typeDistribution[e.error_type] || 0) + 1;
  }
  
  const now = Date.now();
  const recentThreshold = 7 * 24 * 60 * 60 * 1000;
  const timeDistribution = {
    recent: selected.filter(e => now - new Date(e.timestamp).getTime() < recentThreshold).length,
    old: selected.filter(e => now - new Date(e.timestamp).getTime() >= recentThreshold).length
  };
  
  return {
    selected,
    dropped,
    stats: {
      original_count: errors.length,
      selected_count: selected.length,
      type_distribution: typeDistribution,
      time_distribution: timeDistribution
    }
  };
}

// ============================================================================
// 智能配置推荐
// ============================================================================

interface UsagePattern {
  task_types: string[];
  avg_complexity: number;
  error_rate: number;
  avg_execution_time: number;
}

/**
 * 根据使用模式推荐配置
 */
export function recommendConfiguration(
  usage: UsagePattern
): {
  security: { strictness: 'low' | 'medium' | 'high' };
  learning: { aggressiveness: 'conservative' | 'balanced' | 'aggressive' };
  cleanup: { frequency: 'low' | 'medium' | 'high' };
  reasoning: string[];
} {
  const recommendations: {
    security: { strictness: 'low' | 'medium' | 'high' };
    learning: { aggressiveness: 'conservative' | 'balanced' | 'aggressive' };
    cleanup: { frequency: 'low' | 'medium' | 'high' };
    reasoning: string[];
  } = {
    security: { strictness: 'medium' },
    learning: { aggressiveness: 'balanced' },
    cleanup: { frequency: 'medium' },
    reasoning: []
  };
  
  // 安全严格度
  if (usage.error_rate > 0.3) {
    recommendations.security.strictness = 'high';
    recommendations.reasoning.push('错误率较高，建议提高安全检查严格度');
  } else if (usage.error_rate < 0.1) {
    recommendations.security.strictness = 'low';
    recommendations.reasoning.push('错误率较低，可以适当放宽安全检查');
  }
  
  // 学习积极性
  if (usage.avg_complexity > 7) {
    recommendations.learning.aggressiveness = 'aggressive';
    recommendations.reasoning.push('任务复杂度高，建议积极学习');
  } else if (usage.avg_complexity < 3) {
    recommendations.learning.aggressiveness = 'conservative';
    recommendations.reasoning.push('任务复杂度低，保守学习即可');
  }
  
  // 清理频率
  if (usage.avg_execution_time > 300) {
    recommendations.cleanup.frequency = 'high';
    recommendations.reasoning.push('执行时间长，建议频繁清理临时文件');
  }
  
  return recommendations;
}

// ============================================================================
// 导出
// ============================================================================

export default {
  adjustSecurityRules,
  contextAwareSecurityCheck,
  mitigateLearningBias,
  recommendConfiguration,
  DEFAULT_BIAS_CONFIG
};
