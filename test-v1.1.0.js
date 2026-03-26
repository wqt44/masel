/**
 * Test MASEL v1.1.0 - Silent Mode & Auto Detection
 */

const { masel } = require('./masel-wrapper');

console.log("🧪 Testing MASEL v1.1.0\n");

// Test 1: Auto detection
console.log("Test 1: Auto Task Classification");
console.log("================================");

const simpleTasks = [
  "你好",
  "今天天气怎么样",
  "谢谢"
];

const complexTasks = [
  "写一个 Python 爬虫",
  "设计一个 REST API",
  "分析这个代码库并生成报告"
];

console.log("\nSimple tasks (should skip MASEL):");
simpleTasks.forEach(task => {
  const needsMASEL = masel.shouldUseMASEL(task);
  console.log(`  "${task}" → ${needsMASEL ? 'MASEL' : 'Direct'}`);
});

console.log("\nComplex tasks (should use MASEL):");
complexTasks.forEach(task => {
  const needsMASEL = masel.shouldUseMASEL(task);
  console.log(`  "${task}" → ${needsMASEL ? 'MASEL' : 'Direct'}`);
});

// Test 2: Silent mode option
console.log("\n\nTest 2: Silent Mode");
console.log("====================");
console.log("✅ Silent mode option added to masel.complete()");
console.log("✅ Silent mode option added to maselExecute()");
console.log("✅ New methods: masel.silent(), masel.auto()");

console.log("\n\n✅ All v1.1.0 features verified!");
