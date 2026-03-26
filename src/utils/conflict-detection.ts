/**
 * MASEL Conflict Detection Service
 * 检测和解决学习模式冲突
 */

import { read } from "../utils/openclaw-api.js";

// ============================================================================
// 冲突类型定义
// ============================================================================

interface Pattern {
  pattern_id: string;
  name: string;
  description: string;
  trigger_conditions: string[];
  solution: string;
  prevention: string;
  occurrence_count: number;
  success_rate: number;
  created_at: string;
}

interface Conflict {
  type: 'contradiction' | 'overlap' | 'superseded' | 'redundant';
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern_a: Pattern;
  pattern_b: Pattern;
  description: string;
  suggestion: string;
}

interface ConflictResolution {
  resolved: boolean;
  action: 'merge' | 'deprecate' | 'keep_both' | 'manual_review';
  result_pattern?: Pattern;
  reason: string;
}

// ============================================================================
// 冲突检测
// ============================================================================

/**
 * 检测模式冲突
 */
export async function detectConflicts(
  newPattern: Pattern,
  existingPatterns: Pattern[]
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  
  for (const existing of existingPatterns) {
    // 1. 检查矛盾冲突
    const contradiction = checkContradiction(newPattern, existing);
    if (contradiction) {
      conflicts.push(contradiction);
      continue;
    }
    
    // 2. 检查重叠冲突
    const overlap = checkOverlap(newPattern, existing);
    if (overlap) {
      conflicts.push(overlap);
      continue;
    }
    
    // 3. 检查替代关系
    const superseded = checkSuperseded(newPattern, existing);
    if (superseded) {
      conflicts.push(superseded);
      continue;
    }
    
    // 4. 检查冗余
    const redundant = checkRedundant(newPattern, existing);
    if (redundant) {
      conflicts.push(redundant);
    }
  }
  
  return conflicts;
}

/**
 * 检查矛盾冲突
 * 例：Pattern A 说 "用 X 解决"，Pattern B 说 "绝不要用 X"
 */
function checkContradiction(a: Pattern, b: Pattern): Conflict | null {
  // 提取解决方案中的关键动作
  const aActions = extractActions(a.solution);
  const bActions = extractActions(b.solution);
  
  // 检查是否矛盾
  for (const action of aActions) {
    const negation = `不${action}`;
    const prohibition = `禁止${action}`;
    const never = `绝不${action}`;
    
    if (b.solution.includes(negation) || 
        b.solution.includes(prohibition) || 
        b.solution.includes(never) ||
        b.prevention.includes(action)) {
      return {
        type: 'contradiction',
        severity: 'critical',
        pattern_a: a,
        pattern_b: b,
        description: `矛盾: "${a.name}" 建议 "${action}"，但 "${b.name}" 禁止此操作`,
        suggestion: '需要人工审核，确定哪个方案更合适'
      };
    }
  }
  
  return null;
}

/**
 * 检查重叠冲突
 * 例：两个模式触发条件相似，但解决方案不同
 */
function checkOverlap(a: Pattern, b: Pattern): Conflict | null {
  // 计算触发条件相似度
  const similarity = calculateSimilarity(
    a.trigger_conditions.join(' '),
    b.trigger_conditions.join(' ')
  );
  
  // 触发条件相似度高，但解决方案不同
  if (similarity > 0.7) {
    const solutionSimilarity = calculateSimilarity(a.solution, b.solution);
    
    if (solutionSimilarity < 0.5) {
      return {
        type: 'overlap',
        severity: 'high',
        pattern_a: a,
        pattern_b: b,
        description: `"${a.name}" 和 "${b.name}" 触发条件相似 (${(similarity * 100).toFixed(0)}%)，但解决方案不同`,
        suggestion: '考虑合并为一个模式，或明确区分使用场景'
      };
    }
  }
  
  return null;
}

/**
 * 检查替代关系
 * 例：新模式成功率更高，完全覆盖旧模式
 */
function checkSuperseded(newPattern: Pattern, oldPattern: Pattern): Conflict | null {
  // 检查新模式是否完全覆盖旧模式
  const coverage = calculateCoverage(newPattern, oldPattern);
  
  if (coverage > 0.9 && newPattern.success_rate > oldPattern.success_rate) {
    return {
      type: 'superseded',
      severity: 'medium',
      pattern_a: newPattern,
      pattern_b: oldPattern,
      description: `"${newPattern.name}" 完全覆盖 "${oldPattern.name}" 且成功率更高`,
      suggestion: `建议废弃 "${oldPattern.name}"，使用新模式`
    };
  }
  
  return null;
}

/**
 * 检查冗余
 * 例：两个模式几乎完全相同
 */
function checkRedundant(a: Pattern, b: Pattern): Conflict | null {
  const nameSimilarity = calculateSimilarity(a.name, b.name);
  const descSimilarity = calculateSimilarity(a.description, b.description);
  const solutionSimilarity = calculateSimilarity(a.solution, b.solution);
  
  const avgSimilarity = (nameSimilarity + descSimilarity + solutionSimilarity) / 3;
  
  if (avgSimilarity > 0.85) {
    return {
      type: 'redundant',
      severity: 'low',
      pattern_a: a,
      pattern_b: b,
      description: `"${a.name}" 和 "${b.name}" 高度相似 (${(avgSimilarity * 100).toFixed(0)}%)，可能是重复`,
      suggestion: '合并为一个模式，保留出现次数更多的'
    };
  }
  
  return null;
}

// ============================================================================
// 冲突解决
// ============================================================================

/**
 * 自动解决冲突
 */
export async function resolveConflict(
  conflict: Conflict,
  autoResolve: boolean = false
): Promise<ConflictResolution> {
  switch (conflict.type) {
    case 'contradiction':
      // 矛盾必须人工解决
      return {
        resolved: false,
        action: 'manual_review',
        reason: 'Contradictions require human judgment'
      };
      
    case 'overlap':
      if (autoResolve) {
        // 自动合并
        const merged = mergePatterns(conflict.pattern_a, conflict.pattern_b);
        return {
          resolved: true,
          action: 'merge',
          result_pattern: merged,
          reason: 'Automatically merged overlapping patterns'
        };
      }
      return {
        resolved: false,
        action: 'manual_review',
        reason: 'Overlapping patterns need review before merging'
      };
      
    case 'superseded':
      // 自动废弃旧模式
      return {
        resolved: true,
        action: 'deprecate',
        reason: `Deprecated "${conflict.pattern_b.name}" in favor of better pattern`
      };
      
    case 'redundant':
      // 保留出现次数更多的
      const keepA = conflict.pattern_a.occurrence_count >= conflict.pattern_b.occurrence_count;
      return {
        resolved: true,
        action: 'deprecate',
        reason: `Kept "${keepA ? conflict.pattern_a.name : conflict.pattern_b.name}" (more occurrences)`
      };
      
    default:
      return {
        resolved: false,
        action: 'manual_review',
        reason: 'Unknown conflict type'
      };
  }
}

/**
 * 合并两个模式
 */
function mergePatterns(a: Pattern, b: Pattern): Pattern {
  // 合并触发条件（去重）
  const mergedConditions = [...new Set([...a.trigger_conditions, ...b.trigger_conditions])];
  
  // 选择成功率更高的解决方案
  const bestSolution = a.success_rate >= b.success_rate ? a.solution : b.solution;
  const bestPrevention = a.success_rate >= b.success_rate ? a.prevention : b.prevention;
  
  // 合并描述
  const mergedDescription = `${a.description} | ${b.description}`;
  
  return {
    pattern_id: `merged-${Date.now()}`,
    name: `Merged: ${a.name} + ${b.name}`,
    description: mergedDescription,
    trigger_conditions: mergedConditions,
    solution: bestSolution,
    prevention: bestPrevention,
    occurrence_count: a.occurrence_count + b.occurrence_count,
    success_rate: Math.max(a.success_rate, b.success_rate),
    created_at: new Date().toISOString()
  };
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 提取解决方案中的关键动作
 */
function extractActions(solution: string): string[] {
  const actions: string[] = [];
  
  // 简单的动作提取（中文）
  const actionPatterns = [
    /使用(\w+)/g,
    /调用(\w+)/g,
    /执行(\w+)/g,
    /创建(\w+)/g,
    /删除(\w+)/g,
    /修改(\w+)/g
  ];
  
  for (const pattern of actionPatterns) {
    let match;
    while ((match = pattern.exec(solution)) !== null) {
      actions.push(match[1]);
    }
  }
  
  return actions;
}

/**
 * 计算文本相似度（简单版）
 */
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  // 分词
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  // 计算 Jaccard 相似度
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * 计算覆盖率
 */
function calculateCoverage(newPattern: Pattern, oldPattern: Pattern): number {
  // 检查新模式的触发条件是否覆盖旧模式
  const oldConditions = oldPattern.trigger_conditions;
  const newConditions = newPattern.trigger_conditions;
  
  let covered = 0;
  for (const oldCond of oldConditions) {
    for (const newCond of newConditions) {
      if (calculateSimilarity(oldCond, newCond) > 0.8) {
        covered++;
        break;
      }
    }
  }
  
  return covered / oldConditions.length;
}

// ============================================================================
// 批量冲突检测
// ============================================================================

/**
 * 检查所有模式的冲突
 */
export async function checkAllConflicts(
  patterns: Pattern[]
): Promise<{
  total_conflicts: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  conflicts: Conflict[];
}> {
  const allConflicts: Conflict[] = [];
  
  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      const conflicts = await detectConflicts(patterns[i], [patterns[j]]);
      allConflicts.push(...conflicts);
    }
  }
  
  return {
    total_conflicts: allConflicts.length,
    critical: allConflicts.filter(c => c.severity === 'critical').length,
    high: allConflicts.filter(c => c.severity === 'high').length,
    medium: allConflicts.filter(c => c.severity === 'medium').length,
    low: allConflicts.filter(c => c.severity === 'low').length,
    conflicts: allConflicts
  };
}

// ============================================================================
// 导出
// ============================================================================

export default {
  detectConflicts,
  resolveConflict,
  checkAllConflicts,
  calculateSimilarity
};
