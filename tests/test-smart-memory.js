const { initSmartMemory, smartLearn, smartRecall, smartProfile } = require('./utils/smart-memory.js');

// 初始化
initSmartMemory('TvTongg');

console.log('=== 学习你的偏好 ===\n');

// 学习各种偏好
smartLearn('我喜欢详细的设计讨论', '工作风格');
smartLearn('我擅长编程和系统设计', '技能');
smartLearn('我的目标是成为优秀的架构师', '目标');
smartLearn('我坚持代码质量第一', '原则');
smartLearn('我重视用户体验', '价值观');
smartLearn('请叫我伙伴', '称呼');
smartLearn('我需要先理解问题再动手', '工作方式');

console.log('\n=== 回忆相关记忆 ===');
const memories = smartRecall('设计');
memories.forEach((m, i) => {
  console.log(`${i + 1}. [${m.type}] ${m.key}: ${m.value} (权重: ${m.weight})`);
});

console.log('\n=== 用户画像 ===');
const profile = smartProfile();
console.log(`用户: ${profile.userId}`);
console.log(`总记忆数: ${profile.totalMemories}`);
console.log('分类统计:');
Object.entries(profile.categories).forEach(([type, count]) => {
  console.log(`  - ${type}: ${count}`);
});
console.log('Top 5 偏好:');
profile.topPreferences.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.key}: ${p.value.substring(0, 30)}... (${p.weight})`);
});
