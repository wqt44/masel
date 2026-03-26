/**
 * MASEL Smart Cleanup Service v2
 * B+D 结合方案：分级策略 + 智能保留
 */

import { exec, read, write } from "../utils/openclaw-api.js";

// ============================================================================
// 分级保留策略
// ============================================================================

interface RetentionPolicy {
  level: 'critical' | 'important' | 'temporary' | 'immediate';
  days: number | 'infinity';
  paths: string[];
  description: string;
}

const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    level: 'critical',
    days: 'infinity',
    paths: [
      'memory/learning/*.json',
      'memory/souls/*.md',
      'souls/**/*.md',
      'memory/viking/errors/**/pattern-*.json'  // 已识别的模式
    ],
    description: '永不删除：学习记录、Souls、重要模式'
  },
  {
    level: 'important',
    days: 90,
    paths: [
      'memory/executions/*.json',
      'memory/viking/errors/*/*/*.json'  // 按日期组织的错误
    ],
    description: '长期保留90天：执行结果、错误记录'
  },
  {
    level: 'temporary',
    days: 7,
    paths: [
      'memory/checkpoints/**/*',
      'workspace/agents/*/*/'  // 工作目录
    ],
    description: '短期保留7天：Checkpoints、临时工作目录'
  },
  {
    level: 'immediate',
    days: 0,
    paths: [
      'workspace/agents/*/temp/*',
      '*.tmp',
      '*.log'
    ],
    description: '立即清理：临时文件、日志'
  }
];

// ============================================================================
// 智能保护规则
// ============================================================================

interface SmartProtectionConfig {
  keep_if_referenced: boolean;
  keep_if_unique: boolean;
  keep_if_high_severity: boolean;
  allow_user_override: boolean;
}

const SMART_PROTECTION: SmartProtectionConfig = {
  keep_if_referenced: true,      // 被其他文件引用则保留
  keep_if_unique: true,          // 唯一模式则保留
  keep_if_high_severity: true,   // 高严重错误保留
  allow_user_override: true      // 用户可标记保留
};

// ============================================================================
// 确认策略
// ============================================================================

interface ConfirmationPolicy {
  dry_run_first: boolean;
  require_confirm_above_mb: number;
  silent_cleanup_below_mb: number;
  show_summary: boolean;
}

const CONFIRMATION_POLICY: ConfirmationPolicy = {
  dry_run_first: true,
  require_confirm_above_mb: 10,
  silent_cleanup_below_mb: 1,
  show_summary: true
};

// ============================================================================
// 主清理函数
// ============================================================================

interface CleanupResult {
  dry_run: boolean;
  files_scanned: number;
  files_protected: number;
  files_to_delete: number;
  files_deleted: number;
  space_to_free: number;
  space_freed: number;
  protected_reasons: Record<string, number>;
  errors: string[];
}

/**
 * 智能清理主函数
 */
export async function smartCleanup(
  options: {
    dry_run?: boolean;
    force?: boolean;
    policies?: Partial<RetentionPolicy>[];
  } = {}
): Promise<CleanupResult> {
  const dry_run = options.dry_run ?? CONFIRMATION_POLICY.dry_run_first;
  const force = options.force ?? false;

  console.log(`🧹 MASEL Smart Cleanup ${dry_run ? '(DRY RUN)' : ''}`);
  console.log('=' .repeat(50));

  const result: CleanupResult = {
    dry_run,
    files_scanned: 0,
    files_protected: 0,
    files_to_delete: 0,
    files_deleted: 0,
    space_to_free: 0,
    space_freed: 0,
    protected_reasons: {},
    errors: []
  };

  // 1. 扫描所有文件
  const allFiles = await scanAllFiles();
  result.files_scanned = allFiles.length;
  console.log(`📁 Scanned ${allFiles.length} files`);

  // 2. 分类文件
  const classified = classifyFiles(allFiles);

  // 3. 智能保护检查
  for (const file of classified.to_check) {
    const protection = await checkSmartProtection(file);
    if (protection.should_keep) {
      classified.protected.push({ file, reason: protection.reason });
      result.protected_reasons[protection.reason] = 
        (result.protected_reasons[protection.reason] || 0) + 1;
    } else {
      classified.to_delete.push(file);
    }
  }

  result.files_protected = classified.protected.length;
  result.files_to_delete = classified.to_delete.length;
  result.space_to_free = classified.to_delete.reduce((sum, f) => sum + f.size, 0);

  // 4. 显示报告
  printCleanupReport(classified, result);

  // 5. 确认或执行
  if (dry_run && !force) {
    console.log('\n⏸️  DRY RUN - No files deleted');
    console.log('   Run with dry_run=false to execute cleanup');
    return result;
  }

  // 6. 执行清理
  if (result.space_to_free > CONFIRMATION_POLICY.require_confirm_above_mb * 1024 * 1024 && !force) {
    console.log(`\n⚠️  Large cleanup detected (${(result.space_to_free / 1024 / 1024).toFixed(1)} MB)`);
    console.log('   Set force=true to proceed without confirmation');
    return result;
  }

  // 执行删除
  for (const file of classified.to_delete) {
    try {
      await deleteFile(file.path);
      result.files_deleted++;
      result.space_freed += file.size;
    } catch (error) {
      result.errors.push(`Failed to delete ${file.path}: ${error}`);
    }
  }

  console.log(`\n✅ Cleanup Complete`);
  console.log(`   Deleted: ${result.files_deleted} files`);
  console.log(`   Freed: ${(result.space_freed / 1024 / 1024).toFixed(2)} MB`);

  return result;
}

// ============================================================================
// 文件扫描
// ============================================================================

interface FileInfo {
  path: string;
  size: number;
  mtime: Date;
  age_days: number;
  policy?: RetentionPolicy;
}

async function scanAllFiles(): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  const now = new Date();

  for (const policy of RETENTION_POLICIES) {
    for (const pattern of policy.paths) {
      try {
        const { stdout } = await exec({
          command: `find ${pattern.replace(/\*/g, '*')} -type f -printf '%s %T@ %p\\n' 2>/dev/null || echo ""`,
          timeout: 30000
        });

        const lines = stdout.trim().split('\n').filter(l => l);
        for (const line of lines) {
          const match = line.match(/^(\d+) (\d+\.\d+) (.+)$/);
          if (match) {
            const size = parseInt(match[1]);
            const mtime = new Date(parseFloat(match[2]) * 1000);
            const path = match[3];
            const age_days = (now.getTime() - mtime.getTime()) / (1000 * 60 * 60 * 24);

            files.push({ path, size, mtime, age_days, policy });
          }
        }
      } catch (error) {
        // 忽略不存在的路径
      }
    }
  }

  return files;
}

// ============================================================================
// 文件分类
// ============================================================================

interface ClassifiedFiles {
  protected: { file: FileInfo; reason: string }[];
  to_check: FileInfo[];
  to_delete: FileInfo[];
}

function classifyFiles(files: FileInfo[]): ClassifiedFiles {
  const result: ClassifiedFiles = {
    protected: [],
    to_check: [],
    to_delete: []
  };

  for (const file of files) {
    const policy = file.policy;
    if (!policy) continue;

    // 关键级别：永不删除
    if (policy.level === 'critical') {
      result.protected.push({ file, reason: 'critical_level' });
      continue;
    }

    // 立即清理级别
    if (policy.level === 'immediate') {
      result.to_delete.push(file);
      continue;
    }

    // 检查是否过期
    const retentionDays = policy.days === 'infinity' ? Infinity : policy.days;
    if (file.age_days > retentionDays) {
      result.to_check.push(file);  // 需要智能检查
    } else {
      result.protected.push({ file, reason: 'not_expired' });
    }
  }

  return result;
}

// ============================================================================
// 智能保护检查
// ============================================================================

interface ProtectionResult {
  should_keep: boolean;
  reason: string;
}

async function checkSmartProtection(file: FileInfo): Promise<ProtectionResult> {
  // 1. 检查用户保留标记
  if (SMART_PROTECTION.allow_user_override) {
    const hasKeepTag = await checkKeepTag(file.path);
    if (hasKeepTag) {
      return { should_keep: true, reason: 'user_keep_tag' };
    }
  }

  // 2. 检查是否被引用
  if (SMART_PROTECTION.keep_if_referenced) {
    const isReferenced = await checkIfReferenced(file.path);
    if (isReferenced) {
      return { should_keep: true, reason: 'referenced_by_other' };
    }
  }

  // 3. 检查是否是唯一模式（错误记录）
  if (SMART_PROTECTION.keep_if_unique && file.path.includes('errors')) {
    const isUnique = await checkIfUniquePattern(file);
    if (isUnique) {
      return { should_keep: true, reason: 'unique_pattern' };
    }
  }

  // 4. 检查高严重错误
  if (SMART_PROTECTION.keep_if_high_severity && file.path.includes('errors')) {
    const isHighSeverity = await checkHighSeverity(file);
    if (isHighSeverity) {
      return { should_keep: true, reason: 'high_severity' };
    }
  }

  return { should_keep: false, reason: 'can_delete' };
}

async function checkKeepTag(filePath: string): Promise<boolean> {
  try {
    const tagPath = `${filePath}.keep`;
    await read({ path: tagPath });
    return true;
  } catch {
    return false;
  }
}

async function checkIfReferenced(filePath: string): Promise<boolean> {
  try {
    // 检查是否有其他文件引用此文件
    const { stdout } = await exec({
      command: `grep -r "${filePath}" memory/ souls/ --include="*.json" --include="*.md" 2>/dev/null | head -1`,
      timeout: 10000
    });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function checkIfUniquePattern(file: FileInfo): Promise<boolean> {
  try {
    const content = await read({ path: file.path });
    const error = JSON.parse(content);
    
    // 检查是否已标记为唯一模式
    if (error.pattern && error.occurrence_count === 1) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

async function checkHighSeverity(file: FileInfo): Promise<boolean> {
  try {
    const content = await read({ path: file.path });
    const error = JSON.parse(content);
    return error.severity === 'high' || error.error_type?.includes('Critical');
  } catch {
    return false;
  }
}

// ============================================================================
// 报告和删除
// ============================================================================

function printCleanupReport(classified: ClassifiedFiles, result: CleanupResult): void {
  console.log('\n📊 Cleanup Report');
  console.log('-'.repeat(50));
  
  console.log(`\n🛡️  Protected: ${result.files_protected} files`);
  for (const [reason, count] of Object.entries(result.protected_reasons)) {
    console.log(`   ${reason}: ${count}`);
  }

  console.log(`\n🗑️  To Delete: ${result.files_to_delete} files`);
  console.log(`   Space to free: ${(result.space_to_free / 1024 / 1024).toFixed(2)} MB`);

  if (classified.to_delete.length > 0 && classified.to_delete.length <= 10) {
    console.log('\n   Files:');
    classified.to_delete.forEach(f => {
      console.log(`     - ${f.path} (${(f.size / 1024).toFixed(1)} KB, ${f.age_days.toFixed(0)} days)`);
    });
  }
}

async function deleteFile(filePath: string): Promise<void> {
  await exec({ command: `rm "${filePath}"`, timeout: 5000 });
}

// ============================================================================
// 用户标记保留
// ============================================================================

/**
 * 用户标记文件保留
 */
export async function markKeep(filePath: string, reason?: string): Promise<void> {
  const tagPath = `${filePath}.keep`;
  await write({
    path: tagPath,
    content: JSON.stringify({
      marked_at: new Date().toISOString(),
      reason: reason || 'User marked keep'
    }, null, 2)
  });
  console.log(`🛡️  Marked keep: ${filePath}`);
}

/**
 * 取消保留标记
 */
export async function unmarkKeep(filePath: string): Promise<void> {
  const tagPath = `${filePath}.keep`;
  try {
    await exec({ command: `rm "${tagPath}"`, timeout: 5000 });
    console.log(`🗑️  Unmarked keep: ${filePath}`);
  } catch {
    // 标记不存在
  }
}

// ============================================================================
// 导出
// ============================================================================

export default {
  smartCleanup,
  markKeep,
  unmarkKeep,
  RETENTION_POLICIES,
  SMART_PROTECTION
};
