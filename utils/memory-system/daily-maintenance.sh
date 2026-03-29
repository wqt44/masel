#!/bin/bash
# Ultimate Memory System - 每日维护脚本
# 建议通过 cron 每天运行一次

WORKSPACE_DIR="/home/tong0121/.openclaw/workspace"
LOG_FILE="$WORKSPACE_DIR/memory/logs/maintenance-$(date +%Y-%m-%d).log"

# 确保日志目录存在
mkdir -p "$WORKSPACE_DIR/memory/logs"

echo "=== Memory System Daily Maintenance ===" >> "$LOG_FILE"
echo "Started at: $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# 执行维护任务
cd "$WORKSPACE_DIR"
node -e "
const memory = require('./utils/memory-system/masel-adapter.js');

// 初始化
memory.initAdapter('maintenance-' + Date.now());

// 执行每日维护
const result = memory.dailyMaintenance();

console.log('Daily Maintenance Report:');
console.log('========================');

if (result.summary) {
  console.log('Summary Generated:');
  console.log('  Date:', result.summary.date);
  console.log('  Conversations:', result.summary.conversation_count);
  console.log('  Projects:', result.summary.projects_mentioned.join(', ') || 'None');
  console.log('  Key Decisions:', result.summary.key_decisions.length);
} else {
  console.log('No summary generated (no conversations yesterday)');
}

console.log('');
console.log('Cleanup Results:');
console.log('  Checked:', result.cleanup.checked);
console.log('  Expired:', result.cleanup.expired);
console.log('  Archived:', result.cleanup.archived);
console.log('');
// 防遗忘检查
const importanceManager = require('./importance-manager.js');
const alert = importanceManager.generateForgetfulnessAlert();
if (alert) {
  console.log('');
  console.log('⚠️  防遗忘提醒:');
  console.log(alert.message);
} else {
  console.log('');
  console.log('✓ 所有项目都在活跃期');
}
" >> "$LOG_FILE" 2>&1

echo "" >> "$LOG_FILE"
echo "Finished at: $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# 保留最近 30 天的日志
find "$WORKSPACE_DIR/memory/logs" -name "maintenance-*.log" -mtime +30 -delete

echo "Maintenance completed. Log: $LOG_FILE"
