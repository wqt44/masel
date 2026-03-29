/**
 * Viking Lite 测试
 * 
 * 测试简单任务使用 MASEL 记忆方法
 */

const { createMemory, withMemory } = require('./masel-wrapper.js');

async function testBasicMemory() {
  console.log("\n=== 测试 1: 基础记忆 ===");
  
  const memory = createMemory("assistant", "测试任务");
  
  // 开始任务
  const taskId = memory.startTask("测试简单计算");
  console.log(`任务ID: ${taskId}`);
  
  try {
    // 模拟任务
    const result = 2 + 2;
    
    // 记录成功
    await memory.recordSuccess(`结果是 ${result}`, {
      operation: "addition",
      operands: [2, 2]
    });
    
    console.log("✅ 成功记录");
  } catch (error) {
    await memory.recordFailure(error);
    console.log("❌ 失败记录");
  }
}

async function testWithMemory() {
  console.log("\n=== 测试 2: withMemory 包装器 ===");
  
  try {
    const result = await withMemory(
      "coder",
      "测试字符串操作",
      async () => {
        const text = "Hello World";
        return text.toUpperCase();
      },
      {
        showHints: true
      }
    );
    
    console.log(`结果: ${result}`);
    console.log("✅ withMemory 成功");
  } catch (error) {
    console.log(`❌ withMemory 失败: ${error.message}`);
  }
}

async function testErrorRecording() {
  console.log("\n=== 测试 3: 错误记录 ===");
  
  const memory = createMemory("coder");
  memory.startTask("测试错误处理");
  
  try {
    // 故意抛出错误
    throw new Error("测试错误: 文件不存在");
  } catch (error) {
    await memory.recordFailure(error, {
      file_path: "/test/file.txt",
      expected: "文件存在"
    });
    console.log("✅ 错误已记录到 Viking 记忆系统");
  }
}

async function testHints() {
  console.log("\n=== 测试 4: 获取历史提示 ===");
  
  const memory = createMemory("coder");
  
  // 获取关于文件操作的提示
  const hints = await memory.getHints("读取配置文件");
  
  console.log(`找到 ${hints.length} 个提示`);
  hints.forEach((hint, i) => {
    console.log(`  ${i + 1}. [${hint.type}] ${hint.message}`);
  });
}

async function testStats() {
  console.log("\n=== 测试 5: 记忆统计 ===");
  
  const memory = createMemory("assistant");
  const stats = await memory.getStats();
  
  console.log("记忆统计:");
  console.log(`  近期错误: ${stats.recent_errors}`);
  console.log(`  今日错误: ${stats.today_errors}`);
  console.log(`  有可用提示: ${stats.hints_available}`);
}

async function main() {
  console.log("🧠 Viking Lite 测试开始\n");
  console.log("=".repeat(50));
  
  try {
    await testBasicMemory();
    await testWithMemory();
    await testErrorRecording();
    await testHints();
    await testStats();
    
    console.log("\n" + "=".repeat(50));
    console.log("✅ 所有测试完成!");
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  }
}

main();
