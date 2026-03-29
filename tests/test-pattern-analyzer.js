const { initPatternAnalyzer, analyzeMessage, getPatternReport } = require('./utils/pattern-analyzer.js');

// 初始化
initPatternAnalyzer('TvTongg');

console.log('=== 模拟对话历史 ===\n');

// 模拟多次对话
const conversations = [
  ['我觉得我们应该先讨论设计', '好的，让我们讨论'],
  ['能不能帮我分析一下这个方案', '当然可以'],
  ['我喜欢详细的设计文档', '明白'],
  ['你觉得这个技术怎么样', '我认为很好'],
  ['我需要先理解问题', '理解很重要'],
  ['能不能再解释一下', '没问题'],
  ['我认为质量比速度重要', '同意'],
  ['怎么样才能做得更好', '可以改进'],
  ['我想学习新的技术', '很好'],
  ['能不能给我一些建议', '当然可以'],
  ['我觉得用户体验很关键', '是的'],
  ['我需要考虑各种因素', '全面考虑很好'],
  ['能不能帮我看看代码', '可以'],
  ['我想了解系统架构', '好的'],
  ['我觉得这个方案不错', '谢谢'],
];

conversations.forEach(([msg, resp], i) => {
  console.log(`${i + 1}. 用户: ${msg}`);
  analyzeMessage(msg, resp);
});

console.log('\n=== 发现的话语模式 ===');
const report = getPatternReport();
console.log(`总对话数: ${report.totalConversations}`);
console.log(`发现模式数: ${report.discoveredPatterns}`);
console.log('\n洞察:');
report.insights.forEach((insight, i) => {
  console.log(`  ${i + 1}. ${insight}`);
});
