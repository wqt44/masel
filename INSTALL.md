# MASEL 安装指南

## 方法一：链接到 OpenClaw Skills（推荐开发）

```bash
# 1. 确保 MASEL 在 workspace/skills/masel/
# 已经完成 ✅

# 2. 安装依赖（如果需要）
cd /home/tong0121/.openclaw/workspace/skills/masel
npm install

# 3. 编译 TypeScript
npx tsc

# 4. 重启 OpenClaw Gateway
openclaw gateway restart
```

## 方法二：手动注册工具

在 OpenClaw 会话中手动注册：

```typescript
// 加载 MASEL 工具
import { maselPlan, maselExecute, maselReview, maselLearn, maselStatus, maselSouls } from "./skills/masel/src/tools/index.js";

// 注册到 OpenClaw
openclaw.registerTool("masel_plan", maselPlan);
openclaw.registerTool("masel_execute", maselExecute);
openclaw.registerTool("masel_review", maselReview);
openclaw.registerTool("masel_learn", maselLearn);
openclaw.registerTool("masel_status", maselStatus);
openclaw.registerTool("masel_souls", maselSouls);
```

## 方法三：通过 AGENTS.md 配置

编辑 `AGENTS.md` 添加 MASEL 快捷指令：

```markdown
## MASEL 快捷指令

当你需要完成复杂任务时：

1. 使用 MASEL 规划：
   /masel plan "你的任务描述"

2. 使用 MASEL 执行：
   /masel execute [plan_id]

3. 使用 MASEL 审核：
   /masel review [execution_id]
```
```
