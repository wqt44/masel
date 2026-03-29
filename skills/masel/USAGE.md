# MASEL 在 OpenClaw 中使用指南

## 🚀 快速开始

### 方法一：使用包装器（推荐）

```javascript
// 在 OpenClaw 会话中
const { masel } = require("./skills/masel/masel-wrapper.js");

// 一键完成完整工作流
const result = await masel.complete("创建一个 Python 脚本");

// 结果包含
console.log(result.plan);      // 执行计划
console.log(result.execution); // 执行结果
console.log(result.review);    // 质量审核
console.log(result.success);   // 是否成功
```

### 方法二：分步调用

```javascript
const { masel } = require("./skills/masel/masel-wrapper.js");

// 1. 规划
const plan = await masel.plan("创建一个 Python 脚本", "coding");

// 2. 执行
const execution = await masel.execute(plan);

// 3. 审核
const review = await masel.review(execution.results, plan);

// 4. 查看状态
const status = await masel.status();

// 5. 管理 Souls
const souls = await masel.souls();
```

### 方法三：自然语言触发

配置后，我可以自动检测并使用 MASEL：

```
你: "帮我写一个复杂的 Python 程序"

我: "这个任务比较复杂，我将使用 MASEL 来完成："
    "1. 规划任务..."
    "2. 执行子任务..."
    "3. 质量审核..."
    "✅ 完成！"
```

## 📋 配置说明

### 1. 已完成的配置

✅ **AGENTS.md** - 已添加 MASEL 快捷指令说明  
✅ **masel-wrapper.js** - 已创建简化接口  
✅ **masel-cli.sh** - 已创建命令行工具  

### 2. 目录结构

```
workspace/skills/masel/
├── masel-wrapper.js      ⭐ 简化接口
├── masel-cli.sh          ⭐ 命令行工具
├── QUICKSTART.md         ⭐ 快速开始指南
├── INSTALL.md            安装指南
├── src/
│   └── tools/            6个核心工具
└── ...
```

## 🎯 使用场景

### 场景 1: 编码任务

```javascript
const result = await masel.complete(
  "创建一个日志分析器，支持 JSON 和 CSV 输出",
  { workflow_type: "coding", verbose: true }
);
```

### 场景 2: 研究任务

```javascript
const result = await masel.complete(
  "研究 2026 年最新的 AI Agent 框架",
  { workflow_type: "research" }
);
```

### 场景 3: 简单任务

```javascript
const result = await masel.complete(
  "读取文件并统计行数",
  { workflow_type: "simple", learn: false }
);
```

## 🔧 高级用法

### 自定义审核权重

```javascript
const review = await masel.tools.maselReview({
  results: execution.results,
  criteria: {
    correctness_weight: 0.40,  // 提高正确性权重
    completeness_weight: 0.30,
    efficiency_weight: 0.10,
    readability_weight: 0.10,
    robustness_weight: 0.10
  }
});
```

### 禁用学习

```javascript
const result = await masel.complete("任务", { learn: false });
```

### 静默模式

```javascript
const result = await masel.complete("任务", { verbose: false });
```

## 📊 查看结果

### 执行结果结构

```javascript
{
  plan: {
    task_id: "masel-xxx",
    subtasks: [...],
    estimated_total_time: 30
  },
  execution: {
    status: "completed",
    results: [...],
    total_execution_time: 25000
  },
  review: {
    overall_score: 85,
    decision: "APPROVE",
    dimensions: [...]
  },
  success: true
}
```

## 🎮 命令行使用

```bash
# 进入 MASEL 目录
cd /home/tong0121/.openclaw/workspace/skills/masel

# 运行演示
node demo-masel.js

# 运行测试
node test-run.js

# 使用包装器
node -e "const { masel } = require('./masel-wrapper'); masel.complete('任务')"
```

## ✅ 检查清单

- [x] MASEL 文件已创建
- [x] AGENTS.md 已更新
- [x] 包装器已创建
- [x] 测试通过
- [ ] 编译 TypeScript（可选）
- [ ] 重启 OpenClaw（如果需要）

## 🎉 完成！

MASEL 现在可以在 OpenClaw 中使用了！

**推荐用法：**
```javascript
const { masel } = require("./skills/masel/masel-wrapper.js");
await masel.complete("你的任务");
```
