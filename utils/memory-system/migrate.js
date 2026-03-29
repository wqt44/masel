/**
 * 记忆迁移脚本
 * 将 MASEL 旧版记忆迁移到 Ultimate Memory System v2.0
 */

const fs = require('fs');
const path = require('path');
const memory = require('./masel-adapter.js');

// 路径配置
const OLD_MEMORY_PATHS = {
  conversations: path.join(__dirname, '../../skills/masel/memory/auto/conversations.jsonl'),
  globalMemories: path.join(__dirname, '../../skills/masel/memory/auto/global-memories.json'),
  userProfile: path.join(__dirname, '../../skills/masel/memory/auto/user-profile.json')
};

/**
 * 迁移对话记录到 L0 + 提取 L2
 */
function migrateConversations() {
  console.log('[Migrate] 开始迁移对话记录...');
  
  if (!fs.existsSync(OLD_MEMORY_PATHS.conversations)) {
    console.log('[Migrate] 无对话记录需要迁移');
    return { migrated: 0 };
  }
  
  const content = fs.readFileSync(OLD_MEMORY_PATHS.conversations, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line);
  
  let migrated = 0;
  let errors = 0;
  
  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      
      // 迁移到 L0 (原始层)
      memory.recordConversation(
        record.message,
        record.response,
        {
          timestamp: record.timestamp,
          userId: record.metadata?.userId,
          agentId: record.metadata?.agentId,
          migrated: true
        }
      );
      
      migrated++;
    } catch (e) {
      console.error('[Migrate] 解析失败:', e.message);
      errors++;
    }
  }
  
  console.log(`[Migrate] 对话迁移完成: ${migrated} 成功, ${errors} 失败`);
  return { migrated, errors };
}

/**
 * 迁移全局记忆到 L2
 */
function migrateGlobalMemories() {
  console.log('[Migrate] 开始迁移全局记忆...');
  
  if (!fs.existsSync(OLD_MEMORY_PATHS.globalMemories)) {
    console.log('[Migrate] 无全局记忆需要迁移');
    return { migrated: 0 };
  }
  
  try {
    const memories = JSON.parse(fs.readFileSync(OLD_MEMORY_PATHS.globalMemories, 'utf-8'));
    
    let migrated = 0;
    
    for (const oldMem of memories) {
      // 映射旧类型到新类型
      const typeMap = {
        'project': 'project',
        'preference': 'preference',
        'fact': 'fact'
      };
      
      const type = typeMap[oldMem.type] || 'fact';
      
      // 映射重要性
      const importanceMap = {
        'high': 'critical',
        'medium': 'important',
        'low': 'temporary'
      };
      
      const importance = importanceMap[oldMem.importance] || 'important';
      
      // 存储到新系统
      const result = memory.storeStructuredMemory(
        type,
        oldMem.content,
        {
          importance,
          source: oldMem.source,
          confidence: 0.8,
          checkConflict: false  // 迁移时不检查冲突
        }
      );
      
      if (result.status === 'stored') {
        migrated++;
      }
    }
    
    console.log(`[Migrate] 全局记忆迁移完成: ${migrated} 条`);
    return { migrated };
  } catch (e) {
    console.error('[Migrate] 全局记忆迁移失败:', e.message);
    return { migrated: 0, error: e.message };
  }
}

/**
 * 迁移用户画像
 */
function migrateUserProfile() {
  console.log('[Migrate] 开始迁移用户画像...');
  
  if (!fs.existsSync(OLD_MEMORY_PATHS.userProfile)) {
    console.log('[Migrate] 无用户画像需要迁移');
    return { migrated: false };
  }
  
  try {
    const profile = JSON.parse(fs.readFileSync(OLD_MEMORY_PATHS.userProfile, 'utf-8'));
    
    // 将用户画像转换为结构化记忆
    const memories = [];
    
    if (profile.preferences && Object.keys(profile.preferences).length > 0) {
      memories.push({
        type: 'preference',
        content: `用户偏好: ${JSON.stringify(profile.preferences)}`,
        importance: 'important'
      });
    }
    
    if (profile.importantFacts && profile.importantFacts.length > 0) {
      for (const fact of profile.importantFacts) {
        memories.push({
          type: 'fact',
          content: fact,
          importance: 'critical'
        });
      }
    }
    
    let migrated = 0;
    for (const mem of memories) {
      const result = memory.storeStructuredMemory(
        mem.type,
        mem.content,
        {
          importance: mem.importance,
          checkConflict: false
        }
      );
      
      if (result.status === 'stored') {
        migrated++;
      }
    }
    
    console.log(`[Migrate] 用户画像迁移完成: ${migrated} 条`);
    return { migrated };
  } catch (e) {
    console.error('[Migrate] 用户画像迁移失败:', e.message);
    return { migrated: 0, error: e.message };
  }
}

/**
 * 备份旧记忆
 */
function backupOldMemories() {
  const backupDir = path.join(__dirname, '../../memory/backup', `migration-${Date.now()}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  for (const [name, filePath] of Object.entries(OLD_MEMORY_PATHS)) {
    if (fs.existsSync(filePath)) {
      const backupPath = path.join(backupDir, path.basename(filePath));
      fs.copyFileSync(filePath, backupPath);
      console.log(`[Migrate] 备份 ${name} -> ${backupPath}`);
    }
  }
  
  return backupDir;
}

/**
 * 执行完整迁移
 */
function runMigration() {
  console.log('=== Ultimate Memory System v2.0 迁移 ===\n');
  
  // 1. 备份
  console.log('1. 备份旧记忆...');
  const backupDir = backupOldMemories();
  console.log(`   备份位置: ${backupDir}\n`);
  
  // 2. 初始化新系统
  console.log('2. 初始化新记忆系统...');
  memory.initAdapter('migration-session');
  console.log('   初始化完成\n');
  
  // 3. 迁移用户画像
  console.log('3. 迁移用户画像...');
  const profileResult = migrateUserProfile();
  
  // 4. 迁移全局记忆
  console.log('4. 迁移全局记忆...');
  const globalResult = migrateGlobalMemories();
  
  // 5. 迁移对话记录
  console.log('5. 迁移对话记录...');
  const convResult = migrateConversations();
  
  // 6. 生成摘要
  console.log('\n6. 生成历史摘要...');
  // 为过去7天生成摘要
  for (let i = 7; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const summary = memory.generateDailySummary?.(date);
    if (summary) {
      console.log(`   ${summary.date}: ${summary.summary}`);
    }
  }
  
  // 7. 统计
  console.log('\n=== 迁移完成 ===');
  console.log(`用户画像: ${profileResult.migrated} 条`);
  console.log(`全局记忆: ${globalResult.migrated} 条`);
  console.log(`对话记录: ${convResult.migrated} 条`);
  console.log(`\n备份位置: ${backupDir}`);
  console.log('\n旧记忆文件仍然保留，确认无误后可手动删除。');
  
  return {
    backupDir,
    stats: {
      profile: profileResult,
      global: globalResult,
      conversations: convResult
    }
  };
}

// 如果直接运行
if (require.main === module) {
  runMigration();
}

module.exports = {
  runMigration,
  migrateConversations,
  migrateGlobalMemories,
  migrateUserProfile,
  backupOldMemories
};
