/**
 * Global Memory System - 使用示例
 * 
 * 让 AI 自动记住你的一切！
 */

const { initMemory, remember, rememberEvent, recordChat, recall, getProfile } = require('./global-memory.js');

// ============================================================================
// 示例 1: 初始化
// ============================================================================

console.log('=== 示例 1: 初始化记忆系统 ===\n');

initMemory('TvTongg');
console.log('✅ 已为用户 TvTongg 初始化记忆系统\n');

// ============================================================================
// 示例 2: 自动记住偏好
// ============================================================================

console.log('=== 示例 2: 记住偏好 ===\n');

// 模拟对话 - 自动提取偏好
console.log('用户: 我喜欢详细的设计讨论');
recordChat('我喜欢详细的设计讨论', '好的，我记住了！');

console.log('用户: 请叫我伙伴');
recordChat('请叫我伙伴', '好的，伙伴！');

console.log('用户: 我讨厌等待');
recordChat('我讨厌等待', '明白，我会尽快响应');

console.log('\n✅ 偏好已自动提取并保存\n');

// ============================================================================
// 示例 3: 记住重要事件
// ============================================================================

console.log('=== 示例 3: 记住重要事件 ===\n');

rememberEvent('release', '完成 MASEL v1.3.0 发布', 0.9);
rememberEvent('achievement', '开发了 Viking Lite 功能', 0.8);

console.log('✅ 重要事件已记录\n');

// ============================================================================
// 示例 4: 回忆相关记忆
// ============================================================================

console.log('=== 示例 4: 回忆记忆 ===\n');

const context = '帮我设计一个新功能';
console.log(`当前上下文: "${context}"`);
console.log('正在回忆相关记忆...\n');

const memories = recall(context);

console.log(`找到 ${memories.length} 条相关记忆:\n`);
memories.forEach((mem, i) => {
  console.log(`  ${i + 1}. ${mem}`);
});

console.log('\n💡 AI 会基于这些记忆来回复你\n');

// ============================================================================
// 示例 5: 获取用户画像
// ============================================================================

console.log('=== 示例 5: 用户画像 ===\n');

const profile = getProfile();
console.log('用户画像:');
console.log(`  用户ID: ${profile.userId}`);
console.log(`  今日对话: ${profile.todayConversations} 条`);
console.log('  偏好:');

Object.entries(profile.preferences).forEach(([key, data]) => {
  console.log(`    • ${key}: ${data.value} (重要性: ${data.importance})`);
});

// ============================================================================
// 示例 6: 完整对话流程
// ============================================================================

console.log('\n=== 示例 6: 完整对话流程 ===\n');

function simulateChat(userMessage) {
  console.log(`用户: ${userMessage}`);
  
  // 1. 回忆相关记忆
  const relevantMemories = recall(userMessage);
  
  // 2. 生成回复（基于记忆）
  let response;
  if (relevantMemories.length > 0) {
    response = `我记得${relevantMemories[0]}，关于"${userMessage}"，我会...`;
  } else {
    response = `关于"${userMessage}"，我的想法是...`;
  }
  
  console.log(`AI: ${response}`);
  
  // 3. 记录对话
  recordChat(userMessage, response);
  
  console.log('');
}

simulateChat('帮我设计一个功能');
simulateChat('我喜欢创新的方案');
simulateChat('帮我设计另一个功能');  // 这次会记住之前的偏好

// ============================================================================
// 总结
// ============================================================================

console.log('='.repeat(50));
console.log('\n✅ 全局记忆系统演示完成！\n');
console.log('特点:');
console.log('  • 🔥 Hot Memory - 内存缓存 (快速访问)');
console.log('  • 📁 Warm Memory - 文件存储 (持久保存)');
console.log('  • ❄️ Cold Memory - 索引搜索 (长期记忆)');
console.log('\n使用方式:');
console.log('  1. initMemory("用户ID") - 初始化');
console.log('  2. recordChat(消息, 回复) - 自动记录对话');
console.log('  3. recall(上下文) - 自动获取相关记忆');
console.log('\n🎯 只需要 initMemory 一次，之后全部自动！');
