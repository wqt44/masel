/**
 * Viking Lite 使用示例
 * 
 * 简单任务使用 MASEL 记忆方法，无需完整 MASEL 流程
 */

import { VikingLite, withMemory, createMemory } from "./viking-lite.js";

// ============================================================================
// 示例 1: 基础使用
// ============================================================================

async function example1_basic() {
  console.log("=== 示例 1: 基础使用 ===\n");

  // 创建记忆实例
  const memory = createMemory("assistant", "文件操作");

  // 开始任务
  memory.startTask("读取配置文件");

  try {
    // 执行任务...
    const result = await performTask();
    
    // 记录成功
    await memory.recordSuccess(result);
  } catch (error) {
    // 记录失败
    await memory.recordFailure(error as Error);
    throw error;
  }
}

// ============================================================================
// 示例 2: 快速记录模式
// ============================================================================

async function example2_quick() {
  console.log("=== 示例 2: 快速记录 ===\n");

  const memory = createMemory("coder");

  // 一行代码记录完整任务
  const result = await memory.quickRecord("解析JSON", async () => {
    const data = '{"name": "test"}';
    return JSON.parse(data);
  });

  console.log("结果:", result);
}

// ============================================================================
// 示例 3: 带记忆提示的任务 (推荐)
// ============================================================================

async function example3_withHints() {
  console.log("=== 示例 3: 带记忆提示 ===\n");

  // 这个任务会自动:
  // 1. 获取历史提示
  // 2. 执行任务
  // 3. 记录结果
  const result = await withMemory(
    "coder",                          // 代理类型
    "获取网页内容",                    // 任务描述
    async () => {
      // 模拟网络请求
      const response = await fetch("https://example.com");
      return response.text();
    },
    {
      showHints: true,                 // 显示历史提示
      onError: (error, hints) => {
        console.log("任务失败，历史提示:", hints);
      }
    }
  );

  console.log("结果长度:", result.length);
}

// ============================================================================
// 示例 4: 获取记忆统计
// ============================================================================

async function example4_stats() {
  console.log("=== 示例 4: 记忆统计 ===\n");

  const memory = createMemory("assistant");
  const stats = await memory.getStats();

  console.log("记忆统计:");
  console.log(`  近期错误: ${stats.recent_errors}`);
  console.log(`  今日错误: ${stats.today_errors}`);
  console.log(`  有可用提示: ${stats.hints_available}`);
}

// ============================================================================
// 示例 5: 实际使用场景 - 文件操作
// ============================================================================

async function example5_realWorld() {
  console.log("=== 示例 5: 实际场景 - 文件操作 ===\n");

  const memory = createMemory("coder", "文件处理");

  // 先获取历史提示
  const hints = await memory.getHints("读取大文件");
  
  if (hints.length > 0) {
    console.log("根据历史经验:");
    hints.forEach(h => console.log(`  - ${h.message}`));
  }

  // 执行任务
  memory.startTask("读取日志文件");

  try {
    // 模拟文件读取
    const content = await readFileSafely("/var/log/app.log");
    
    await memory.recordSuccess(content, {
      file_size: content.length,
      lines: content.split('\n').length
    });
    
    return content;
  } catch (error) {
    await memory.recordFailure(error as Error, {
      file_path: "/var/log/app.log"
    });
    throw error;
  }
}

// ============================================================================
// 辅助函数 (模拟)
// ============================================================================

async function performTask(): Promise<string> {
  return "任务完成";
}

async function readFileSafely(path: string): Promise<string> {
  // 模拟文件读取
  return `Log content from ${path}`;
}

async function fetch(url: string): Promise<{ text: () => Promise<string> }> {
  // 模拟 fetch
  return {
    text: async () => `<html><body>Content from ${url}</body></html>`
  };
}

// ============================================================================
// 运行示例
// ============================================================================

async function main() {
  console.log("🧠 Viking Lite - 轻量级记忆系统示例\n");

  try {
    await example1_basic();
    await example2_quick();
    await example3_withHints();
    await example4_stats();
    await example5_realWorld();
    
    console.log("\n✅ 所有示例完成!");
  } catch (error) {
    console.error("\n❌ 示例失败:", error);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
