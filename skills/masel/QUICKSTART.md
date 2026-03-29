/**
 * MASEL Quick Start - Use in current OpenClaw session
 * 
 * 在当前会话中快速使用 MASEL
 */

// 模拟 MASEL 使用示例
console.log("🚀 MASEL 使用示例\n");
console.log("=".repeat(60));

// 示例 1: 简单任务
console.log("\n📋 示例 1: 规划一个简单任务");
console.log("-".repeat(60));
console.log(`
// 用户输入:
"帮我写一个 Python 函数来计算斐波那契数列"

// MASEL 会自动:
1. masel_plan({
     task: "写一个 Python 函数来计算斐波那契数列",
     workflow_type: "coding"
   })
   
   输出:
   - Brainstorm: 选择最佳实现方案
   - Spec: 定义输入输出、边界条件
   - Plan: 拆分为子任务
     * 分析需求
     * 编写测试
     * 实现代码
     * 代码审核

2. masel_execute({ plan })
   
   输出:
   - 每个子任务的执行结果
   - Worktree 隔离的执行环境
   - 自动保存 Checkpoint

3. masel_review({ results })
   
   输出:
   - Overall Score: 85/100
   - Dimensions:
     * Correctness: 90/100
     * Completeness: 80/100
     * Efficiency: 85/100
     * Readability: 90/100
     * Robustness: 80/100
   - Decision: APPROVE

4. masel_learn({ review_report })
   
   输出:
   - 分析成功模式
   - 更新 Coder Soul
   - 记录最佳实践
`);

// 示例 2: 研究任务
console.log("\n🔬 示例 2: 研究任务");
console.log("-".repeat(60));
console.log(`
// 用户输入:
"研究 2026 年最新的 AI Agent 框架"

// MASEL 工作流:
masel_plan({
  task: "研究 2026 年最新的 AI Agent 框架",
  workflow_type: "research"
})
  ↓
masel_execute({ plan })
  ↓
masel_review({ results })
  ↓
生成研究报告
`);

// 示例 3: 查看状态
console.log("\n📊 示例 3: 查看系统状态");
console.log("-".repeat(60));
console.log(`
// 查看所有任务状态
masel_status({})

输出:
{
  version: "1.0.0",
  active_tasks: 2,
  completed_tasks: 15,
  failed_tasks: 1,
  memory_stats: {
    hot_errors: 3,
    warm_errors_today: 8,
    total_errors: 25
  },
  agent_stats: {
    coder: { tasks_completed: 10, success_rate: 0.9 },
    researcher: { tasks_completed: 5, success_rate: 0.95 }
  }
}
`);

// 示例 4: 管理 Souls
console.log("\n👥 示例 4: 管理 Agent Souls");
console.log("-".repeat(60));
console.log(`
// 列出所有 Souls
masel_souls({ action: "list" })

// 获取特定 Soul
masel_souls({ 
  action: "get", 
  agent_type: "coder" 
})

// 更新 Soul
masel_souls({
  action: "update",
  agent_type: "coder",
  section: "knowledge",
  content: "新的最佳实践..."
})
`);

console.log("\n" + "=".repeat(60));
console.log("\n✨ 在 OpenClaw 中使用 MASEL:");
console.log("");
console.log("方法 1: 直接调用工具");
console.log("  await masel_plan({ task: '...' })");
console.log("  await masel_execute({ plan })");
console.log("  await masel_review({ results })");
console.log("");
console.log("方法 2: 通过自然语言");
console.log("  '用 MASEL 帮我完成这个任务: ...'");
console.log("");
console.log("方法 3: 快捷指令");
console.log("  /masel plan '任务描述'");
console.log("  /masel execute");
console.log("  /masel review");
console.log("\n" + "=".repeat(60) + "\n");
