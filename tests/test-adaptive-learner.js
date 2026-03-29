const { initAdaptiveLearner, adaptiveLearn, getAdaptiveStats } = require('./utils/adaptive-learner.js');

// 初始化
initAdaptiveLearner('TvTongg');

console.log('=== 模拟多次对话，学习新规则 ===\n');

// 第1次：关键是...
console.log('第1次说 "关键是..."');
adaptiveLearn('关键是我们要先理解需求');

// 第2次：关键是...
console.log('第2次说 "关键是..."');
adaptiveLearn('关键是设计要合理');

// 第3次：关键是... (达到阈值，学习规则！)
console.log('第3次说 "关键是..."');
adaptiveLearn('关键是代码质量');

console.log('\n---');

// 第1次：首先是...
console.log('第1次说 "首先是..."');
adaptiveLearn('首先是需求分析');

// 第2次：首先是...
console.log('第2次说 "首先是..."');
adaptiveLearn('首先是讨论方案');

// 第3次：首先是... (达到阈值，学习规则！)
console.log('第3次说 "首先是..."');
adaptiveLearn('首先是理解问题');

console.log('\n---');

// 第1次：我觉得应该先...
console.log('第1次说 "我觉得应该先..."');
adaptiveLearn('我觉得应该先规划');

// 第2次：我觉得应该先...
console.log('第2次说 "我觉得应该先..."');
adaptiveLearn('我觉得应该先设计');

// 第3次：我觉得应该先... (达到阈值，学习规则！)
console.log('第3次说 "我觉得应该先..."');
adaptiveLearn('我觉得应该先讨论');

console.log('\n=== 使用学习到的规则提取 ===');
const results = adaptiveLearn('关键是用户体验很重要');
console.log('提取结果:');
results.forEach((r, i) => {
  console.log(`  ${i + 1}. [${r.source}] ${r.key}: ${r.value} (${r.type})`);
});

console.log('\n=== 学习统计 ===');
const stats = getAdaptiveStats();
console.log(`基础规则: ${stats.baseRules}`);
console.log(`学习规则: ${stats.learnedRules}`);
console.log(`总规则数: ${stats.totalRules}`);
console.log(`话语模式: ${stats.phrasePatterns}`);

if (stats.learnedRulesDetail.length > 0) {
  console.log('\n学习到的规则:');
  stats.learnedRulesDetail.forEach((r, i) => {
    console.log(`  ${i + 1}. "${r.pattern}" → ${r.key} (来自${r.frequency}次"${r.learnedFrom}")`);
  });
}
