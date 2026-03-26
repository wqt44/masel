/**
 * MASEL Safe Learning Service
 * 保守学习，避免过度优化
 */

interface LearningConfig {
  min_error_count: number;        // 最少错误次数才学习
  min_confidence: number;         // 最小置信度（0-1）
  require_approval: boolean;      // 是否需要人工审核
  max_soul_size_kb: number;       // Soul 文件最大大小
}

const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  min_error_count: 3,             // 至少 3 次相同错误才学习
  min_confidence: 0.7,            // 70% 置信度
  require_approval: true,         // 默认需要审核
  max_soul_size_kb: 50            // Soul 最大 50KB
};

/**
 * 保守学习：只学习高置信度模式
 */
export async function safeLearn(
  errors: any[],
  config: Partial<LearningConfig> = {}
): Promise<{
  learned: boolean;
  patterns: string[];
  confidence: number;
  needs_approval: boolean;
}> {
  const cfg = { ...DEFAULT_LEARNING_CONFIG, ...config };

  // 1. 检查错误数量
  if (errors.length < cfg.min_error_count) {
    console.log(`   Insufficient errors (${errors.length}/${cfg.min_error_count}), skipping learning`);
    return { learned: false, patterns: [], confidence: 0, needs_approval: false };
  }

  // 2. 提取模式并计算置信度
  const patterns = extractPatterns(errors);
  const confidence = calculateConfidence(errors, patterns);

  console.log(`   Found ${patterns.length} patterns, confidence: ${(confidence * 100).toFixed(1)}%`);

  // 3. 检查置信度
  if (confidence < cfg.min_confidence) {
    console.log(`   Confidence too low (${(confidence * 100).toFixed(1)}% < ${(cfg.min_confidence * 100).toFixed(0)}%), skipping`);
    return { learned: false, patterns, confidence, needs_approval: false };
  }

  // 4. 检查是否需要审核
  const needs_approval = cfg.require_approval;

  if (needs_approval) {
    console.log('   ⚠️  Learning requires approval');
    console.log('   Patterns found:');
    patterns.forEach((p, i) => console.log(`     ${i + 1}. ${p}`));
  }

  return {
    learned: !needs_approval,
    patterns,
    confidence,
    needs_approval
  };
}

/**
 * 检查 Soul 大小，防止过度膨胀
 */
export async function checkSoulSize(
  soulPath: string
): Promise<{
  valid: boolean;
  size_kb: number;
  message: string;
}> {
  try {
    const { exec } = require('../utils/openclaw-api.js');
    const { stdout } = await exec({
      command: `stat -f%z "${soulPath}" 2>/dev/null || stat -c%s "${soulPath}" 2>/dev/null || echo "0"`,
      timeout: 5000
    });

    const size_bytes = parseInt(stdout.trim()) || 0;
    const size_kb = size_bytes / 1024;
    const max_kb = DEFAULT_LEARNING_CONFIG.max_soul_size_kb;

    if (size_kb > max_kb) {
      return {
        valid: false,
        size_kb,
        message: `Soul too large (${size_kb.toFixed(1)}KB > ${max_kb}KB). Consider archiving old patterns.`
      };
    }

    return {
      valid: true,
      size_kb,
      message: `Soul size OK (${size_kb.toFixed(1)}KB)`
    };
  } catch (error) {
    return {
      valid: true,
      size_kb: 0,
      message: 'Could not check soul size'
    };
  }
}

/**
 * 归档旧模式
 */
export async function archiveOldPatterns(
  soulPath: string,
  archivePath: string
): Promise<void> {
  console.log(`   Archiving old patterns from ${soulPath} to ${archivePath}`);
  // 实现：保留最近 N 条模式，其余移到归档
}

/**
 * 提取错误模式（简化版）
 */
function extractPatterns(errors: any[]): string[] {
  // 按错误类型分组
  const byType: Record<string, number> = {};
  errors.forEach(e => {
    const type = e.error_type || 'Unknown';
    byType[type] = (byType[type] || 0) + 1;
  });

  // 返回出现次数 > 1 的模式
  return Object.entries(byType)
    .filter(([_, count]) => count > 1)
    .map(([type, count]) => `${type} (${count} times)`);
}

/**
 * 计算置信度
 */
function calculateConfidence(errors: any[], patterns: string[]): number {
  if (patterns.length === 0) return 0;

  // 简单计算：模式覆盖的错误比例
  const totalErrors = errors.length;
  const patternedErrors = patterns.reduce((sum, p) => {
    const match = p.match(/\((\d+) times\)/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);

  return patternedErrors / totalErrors;
}

export default {
  safeLearn,
  checkSoulSize,
  archiveOldPatterns
};
