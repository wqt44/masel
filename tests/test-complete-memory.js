const { 
  initUltimateMemory, 
  ultimateRecord, 
  ultimateRecall, 
  ultimateProfile,
  ultimateGetPending,
  ultimatePredict
} = require('./utils/ultimate-memory.js');

// 初始化
initUltimateMemory('TvTongg');

console.log('\n=== 模拟对话历史 ===\n');

// 对话1-3：学习"关键是..."
ultimateRecord('关键是我们要先理解需求', '好的');
ultimateRecord('关键是设计要合理', '明白');
ultimateRecord('关键是代码质量', '同意');

// 对话4-6：学习"我觉得应该先..."
ultimateRecord('我觉得应该先规划', '对');
ultimateRecord('我觉得应该先设计', '没错');
ultimateRecord('我觉得应该先讨论', '好的');

// 对话7-9：建立序列模式
ultimateRecord('我们先讨论设计', '好的');
ultimateRecord('然后写代码', '明白');

ultimateRecord('我们先讨论设计', '好的');
ultimateRecord('然后写代码', '明白');

console.log('\n=== 检查待确认 ===');
const pending = ultimateGetPending();
console.log(`待确认规则: ${pending.length} 个`);
pending.forEach((p, i) => {
  console.log(`\n${i + 1}. 模式: "${p.pattern}"`);
  console.log(`   消息: ${p.message}`);
});

console.log('\n=== 测试预测 ===');
// 再次说"我们先讨论设计"，看能否预测"然后写代码"
ultimateRecord('我们先讨论设计', '好的');
const prediction = ultimatePredict();
if (prediction) {
  console.log(`预测下一步:`);
  console.log(`  可能话题: ${prediction.predictedTopics?.join(', ')}`);
  console.log(`  可能意图: ${prediction.predictedIntents?.join(', ')}`);
  console.log(`  概率: ${(prediction.probability * 100).toFixed(1)}%`);
  console.log(`  建议: ${prediction.suggestion}`);
} else {
  console.log('还没有足够数据预测');
}

console.log('\n=== 完整画像 ===');
const profile = ultimateProfile();
console.log(`用户: ${profile.userId}`);
console.log(`对话数: ${profile.conversationCount}`);
console.log(`规则: ${profile.rules.base} 基础 + ${profile.rules.learned} 学习`);
console.log(`待确认: ${profile.pendingConfirmations}`);
console.log(`预测模式: ${profile.predictions?.sequencePatterns || 0}`);
console.log(`时间衰减记忆: ${profile.timeDecay?.total || 0}`);

console.log('\n✅ 终极记忆系统完整运行！');
