const { initUltimateMemory, ultimateRecord, ultimateRecall, ultimateProfile } = require('./utils/ultimate-memory.js');

// 初始化
initUltimateMemory('TvTongg');

console.log('\n=== 模拟对话历史 ===\n');

// 对话1：设计话题
ultimateRecord('我们在讨论设计方案', '好的，设计方案');
ultimateRecord('我觉得应该先理解需求', '明白');
ultimateRecord('关键是用户想要什么', '对，用户很重要');

// 对话2：代码话题  
ultimateRecord('现在来写代码', '好的');
ultimateRecord('我擅长写清晰的代码', '真棒');
ultimateRecord('关键是代码要可读', '同意');

// 对话3：又是设计
ultimateRecord('回到设计话题', '好的');
ultimateRecord('关键是架构要合理', '是的');
ultimateRecord('我觉得应该先画草图', '好主意');

// 对话4：学习新规则（说3次"我觉得应该先"）
ultimateRecord('我觉得应该先规划', '对');
ultimateRecord('我觉得应该先设计', '没错');
ultimateRecord('我觉得应该先讨论', '好的');

console.log('\n=== 测试回忆 ===');

// 在设计话题下回忆
console.log('\n1. 查询 "设计":');
let results = ultimateRecall('设计');
results.forEach((r, i) => {
  console.log(`   ${i + 1}. [${r.source}] ${r.type}: ${r.value.substring(0, 40)}...`);
  if (r.context) {
    console.log(`       情境: ${r.context.topic} | ${r.context.phase}`);
  }
});

// 查询关键
console.log('\n2. 查询 "关键":');
results = ultimateRecall('关键');
results.forEach((r, i) => {
  console.log(`   ${i + 1}. [${r.source}] ${r.type}: ${r.value.substring(0, 40)}...`);
});

console.log('\n=== 完整画像 ===');
const profile = ultimateProfile();
console.log(`用户: ${profile.userId}`);
console.log(`对话数: ${profile.conversationCount}`);
console.log(`规则: ${profile.rules.base} 基础 + ${profile.rules.learned} 学习 = ${profile.rules.total} 总规则`);

if (profile.learnedRules.length > 0) {
  console.log('\n学习到的规则:');
  profile.learnedRules.forEach((r, i) => {
    console.log(`  ${i + 1}. "${r.pattern}" → ${r.key}`);
  });
}

console.log('\n上下文统计:');
console.log(`  话题: ${JSON.stringify(profile.context.topics)}`);
console.log(`  阶段: ${JSON.stringify(profile.context.phases)}`);
console.log(`  情感: ${JSON.stringify(profile.context.emotions)}`);
