/**
 * MASEL Migration Service
 * 版本升级时自动迁移旧数据
 */

import { read, write, exec } from "../utils/openclaw-api.js";

// ============================================================================
// 版本定义
// ============================================================================

interface Version {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(version: string): Version {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

function compareVersions(v1: Version, v2: Version): number {
  if (v1.major !== v2.major) return v1.major - v2.major;
  if (v1.minor !== v2.minor) return v1.minor - v2.minor;
  return v1.patch - v2.patch;
}

// ============================================================================
// 迁移记录
// ============================================================================

interface MigrationRecord {
  version: string;
  applied_at: string;
  success: boolean;
  changes: string[];
  errors: string[];
}

const MIGRATION_LOG_PATH = 'memory/migrations/log.json';

// ============================================================================
// 迁移定义
// ============================================================================

type MigrationFunction = () => Promise<{ success: boolean; changes: string[]; errors: string[] }>;

interface Migration {
  version: string;
  description: string;
  migrate: MigrationFunction;
}

// ============================================================================
// 具体迁移实现
// ============================================================================

const MIGRATIONS: Migration[] = [
  // v1.1.0: 添加静默模式支持，无需数据迁移
  {
    version: '1.1.0',
    description: 'Add silent mode support',
    migrate: async () => ({
      success: true,
      changes: ['Silent mode configuration added'],
      errors: []
    })
  },
  
  // v1.2.0: 添加清理、恢复、学习配置
  {
    version: '1.2.0',
    description: 'Add cleanup, resilience, and safe learning',
    migrate: async () => {
      const changes: string[] = [];
      const errors: string[] = [];
      
      try {
        // 创建新的目录结构
        await exec({
          command: 'mkdir -p memory/viking/errors memory/executions memory/checkpoints memory/learning memory/migrations',
          timeout: 10000
        });
        changes.push('Created new directory structure');
        
        // 迁移旧错误记录到新格式
        const migrateResult = await migrateErrorRecords();
        changes.push(...migrateResult.changes);
        errors.push(...migrateResult.errors);
        
      } catch (error) {
        errors.push(`Migration failed: ${error}`);
      }
      
      return { success: errors.length === 0, changes, errors };
    }
  },
  
  // v1.2.1: Smart Cleanup 升级
  {
    version: '1.2.1',
    description: 'Upgrade to Smart Cleanup with B+D strategy',
    migrate: async () => {
      const changes: string[] = [];
      const errors: string[] = [];
      
      try {
        // 标记关键文件保留
        await markCriticalFiles();
        changes.push('Marked critical files for retention');
        
        // 归档旧格式文件
        await archiveOldFormatFiles();
        changes.push('Archived old format files');
        
      } catch (error) {
        errors.push(`Migration failed: ${error}`);
      }
      
      return { success: errors.length === 0, changes, errors };
    }
  },
  
  // v1.2.2: 安全模块
  {
    version: '1.2.2',
    description: 'Add security scanning and sandbox',
    migrate: async () => {
      const changes: string[] = [];
      const errors: string[] = [];
      
      try {
        // 创建安全配置
        await createSecurityConfig();
        changes.push('Created security configuration');
        
        // 审查现有 Souls 的安全性
        const reviewResult = await reviewExistingSouls();
        changes.push(...reviewResult.changes);
        errors.push(...reviewResult.errors);
        
      } catch (error) {
        errors.push(`Migration failed: ${error}`);
      }
      
      return { success: errors.length === 0, changes, errors };
    }
  }
];

// ============================================================================
// 迁移辅助函数
// ============================================================================

async function migrateErrorRecords(): Promise<{ changes: string[]; errors: string[] }> {
  const changes: string[] = [];
  const errors: string[] = [];
  
  try {
    // 查找旧格式错误记录
    const { stdout } = await exec({
      command: 'find memory -name "*.json" -type f 2>/dev/null | head -100',
      timeout: 10000
    });
    
    const files = stdout.trim().split('\n').filter(f => f);
    
    for (const file of files) {
      try {
        const content = await read({ path: file });
        const data = JSON.parse(content);
        
        // 检查是否需要迁移（旧格式检测）
        if (isOldErrorFormat(data)) {
          const migrated = convertToNewErrorFormat(data);
          await write({
            path: file,
            content: JSON.stringify(migrated, null, 2)
          });
          changes.push(`Migrated: ${file}`);
        }
      } catch (error) {
        errors.push(`Failed to migrate ${file}: ${error}`);
      }
    }
  } catch (error) {
    errors.push(`Error record migration failed: ${error}`);
  }
  
  return { changes, errors };
}

function isOldErrorFormat(data: any): boolean {
  // 检测旧格式特征
  return data && !data._format_version;
}

function convertToNewErrorFormat(oldData: any): any {
  return {
    ...oldData,
    _format_version: '1.2.0',
    _migrated_at: new Date().toISOString(),
    // 添加新字段默认值
    severity: oldData.severity || 'medium',
    pattern: oldData.pattern || 'unknown',
    context: {
      ...oldData.context,
      _sanitized: false
    }
  };
}

async function markCriticalFiles(): Promise<void> {
  // 标记 Souls 文件为保留
  const { exec } = require('../utils/openclaw-api.js');
  await exec({
    command: 'find souls -name "*.md" -exec touch {}.keep \; 2>/dev/null || true',
    timeout: 10000
  });
}

async function archiveOldFormatFiles(): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];
  await exec({
    command: `mkdir -p memory/archive/${timestamp} && find memory -name "*.json" -mtime +30 -exec mv {} memory/archive/${timestamp}/ \; 2>/dev/null || true`,
    timeout: 30000
  });
}

async function createSecurityConfig(): Promise<void> {
  const config = {
    version: '1.2.2',
    created_at: new Date().toISOString(),
    forbidden_patterns: [
      'rm -rf /',
      'eval(',
      'exec(',
      'nc -e',
      'bash -i'
    ],
    allowed_commands: [
      'ls', 'cat', 'grep', 'find',
      'git', 'npm', 'node', 'python'
    ]
  };
  
  await write({
    path: 'memory/security/config.json',
    content: JSON.stringify(config, null, 2)
  });
}

async function reviewExistingSouls(): Promise<{ changes: string[]; errors: string[] }> {
  const changes: string[] = [];
  const errors: string[] = [];
  
  try {
    const { stdout } = await exec({
      command: 'find souls -name "*.md" 2>/dev/null',
      timeout: 10000
    });
    
    const souls = stdout.trim().split('\n').filter(s => s);
    
    for (const soul of souls) {
      try {
        const content = await read({ path: soul });
        
        // 检查是否包含危险模式
        const dangerousPatterns = ['eval(', 'exec(', 'rm -rf /'];
        const hasDangerous = dangerousPatterns.some(p => content.includes(p));
        
        if (hasDangerous) {
          // 标记需要审查
          await write({
            path: `${soul}.security_review`,
            content: `Security review required: ${new Date().toISOString()}`
          });
          changes.push(`Flagged for security review: ${soul}`);
        }
      } catch (error) {
        errors.push(`Failed to review ${soul}: ${error}`);
      }
    }
  } catch (error) {
    errors.push(`Soul review failed: ${error}`);
  }
  
  return { changes, errors };
}

// ============================================================================
// 主迁移函数
// ============================================================================

interface MigrationResult {
  current_version: string;
  target_version: string;
  migrations_applied: number;
  migrations_failed: number;
  details: MigrationRecord[];
}

/**
 * 执行迁移
 */
export async function migrate(
  targetVersion: string = '1.2.2'
): Promise<MigrationResult> {
  console.log(`🔄 MASEL Migration: Starting migration to ${targetVersion}`);
  
  const currentVersion = await getCurrentVersion();
  console.log(`   Current version: ${currentVersion}`);
  
  const result: MigrationResult = {
    current_version: currentVersion,
    target_version: targetVersion,
    migrations_applied: 0,
    migrations_failed: 0,
    details: []
  };
  
  const current = parseVersion(currentVersion);
  const target = parseVersion(targetVersion);
  
  // 检查是否需要迁移
  if (compareVersions(current, target) >= 0) {
    console.log('   Already up to date');
    return result;
  }
  
  // 执行需要的迁移
  for (const migration of MIGRATIONS) {
    const migrationVersion = parseVersion(migration.version);
    
    // 只执行当前版本之后的迁移
    if (compareVersions(migrationVersion, current) > 0 && 
        compareVersions(migrationVersion, target) <= 0) {
      
      console.log(`\n📦 Migrating to ${migration.version}: ${migration.description}`);
      
      const migrationResult = await migration.migrate();
      
      const record: MigrationRecord = {
        version: migration.version,
        applied_at: new Date().toISOString(),
        success: migrationResult.success,
        changes: migrationResult.changes,
        errors: migrationResult.errors
      };
      
      result.details.push(record);
      
      if (migrationResult.success) {
        result.migrations_applied++;
        console.log(`   ✅ Success: ${migrationResult.changes.length} changes`);
      } else {
        result.migrations_failed++;
        console.log(`   ❌ Failed: ${migrationResult.errors.length} errors`);
      }
    }
  }
  
  // 更新版本记录
  if (result.migrations_applied > 0) {
    await updateVersion(targetVersion);
    await logMigration(result);
  }
  
  console.log(`\n✅ Migration complete:`);
  console.log(`   Applied: ${result.migrations_applied}`);
  console.log(`   Failed: ${result.migrations_failed}`);
  
  return result;
}

/**
 * 获取当前版本
 */
async function getCurrentVersion(): Promise<string> {
  try {
    const content = await read({ path: 'memory/version.json' });
    const data = JSON.parse(content);
    return data.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * 更新版本记录
 */
async function updateVersion(version: string): Promise<void> {
  await write({
    path: 'memory/version.json',
    content: JSON.stringify({
      version,
      updated_at: new Date().toISOString()
    }, null, 2)
  });
}

/**
 * 记录迁移日志
 */
async function logMigration(result: MigrationResult): Promise<void> {
  try {
    let logs: MigrationRecord[] = [];
    try {
      const content = await read({ path: MIGRATION_LOG_PATH });
      logs = JSON.parse(content);
    } catch {
      // 文件不存在
    }
    
    logs.push(...result.details);
    
    await write({
      path: MIGRATION_LOG_PATH,
      content: JSON.stringify(logs, null, 2)
    });
  } catch (error) {
    console.warn('Failed to log migration:', error);
  }
}

/**
 * 检查是否需要迁移
 */
export async function checkMigrationNeeded(): Promise<{
  needed: boolean;
  current: string;
  target: string;
}> {
  const current = await getCurrentVersion();
  const target = '1.2.2'; // 最新版本
  
  return {
    needed: compareVersions(parseVersion(current), parseVersion(target)) < 0,
    current,
    target
  };
}

// ============================================================================
// 导出
// ============================================================================

export default {
  migrate,
  checkMigrationNeeded,
  parseVersion,
  compareVersions
};
