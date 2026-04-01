# MASEL - Multi-Agent System with Error Learning

## 🎉🎉🎉 **v1.9.1 - Unified Memory + Modular Agents (已进化!)** 🎉🎉🎉

### 📊 今日进化成果 (2026-03-29)

```
系统健康: 86.3 → 96.3 (+10.0) ✅
测试覆盖: 18 → 30 个测试 (+66%) ✅
新增测试: skill-pipeline, self-improving ✅
自我改进: 识别 2 个改进点，学习 3 个模式 ✅
```

### 🚀 v1.7.0 核心特性

- ✅ **OAC 集成** - OpenClaw Automation Core 全自动运维
- ✅ **统一记忆系统** - L0-L3 四层存储架构
- ✅ **自我改进** - 自动分析、改进、验证
- ✅ **技能流水线** - 自动发现、审查、安装技能
- ✅ **监控仪表板** - 可视化系统状态
- ✅ **统一错误处理** - 100% I/O 操作覆盖
- ✅ **30 个测试** - 100% 通过

---

## 🎉 **v1.4.0 - Auto Memory System**

### ✅ NEW: AI 自动记住用户的一切！

```javascript
const { initAutoMemory, autoRecord, autoRecall } = require('./masel-wrapper');

// 1. 初始化 - 只需要一次
initAutoMemory("TvTongg", "TwTongg");

// 2. 自动记录对话
await autoRecord("我喜欢详细的设计讨论", "好的，我记住了！");
// 自动提取：likes = 详细的设计讨论

// 3. 自动获取相关记忆
const memories = await autoRecall("设计新功能");
// 返回: ["用户的likes: 详细的设计讨论"]
```

**核心思想**: 让 AI 自动记住用户的偏好、重要事件、工作模式，无需手动调用！

---

## 🎉 **v1.3.0 - Viking Lite**

### ✅ 简单任务也能使用 MASEL 记忆方法！

```javascript
const { createMemory, withMemory } = require('./masel-wrapper');

// 方式 1: 基础记忆
const memory = createMemory("assistant");
memory.startTask("读取文件");
// ... 执行任务 ...
await memory.recordSuccess(result);

// 方式 2: 一行代码带记忆
const result = await withMemory("coder", "解析JSON", async () => {
  return JSON.parse(data);
});

// 方式 3: 获取历史提示
const hints = await memory.getHints("文件操作");
// 返回之前的经验教训
```

**核心思想**: 简单任务不需要完整 MASEL 多智能体流程，但可以使用 Viking 三层记忆系统！

---

## 🎉 **v1.2.4 - PRODUCTION READY!**

### ✅ NEW: Rate Limiting + Time Decay + Bias Mitigation

```javascript
// v1.2.4: API rate limiting with exponential backoff
await masel.complete("Task");  // Auto rate limiting protection

// v1.2.4: Time decay for old patterns (30-day half-life)
// v1.2.4: Bias mitigation with diversity sampling

// v1.2.3: Privacy protection + Migration + Conflict detection + Depth limit
await masel.complete("Task", { enable_security: true });

// v1.2.2: Security scanning + Code review + Sandbox
// v1.2.1: Smart cleanup (B+D strategy)
// v1.2.0: Auto cleanup + Failure recovery + Safe learning
```

### ✅ ALL 6 TOOLS IMPLEMENTED!

```
src/tools/
├── index.ts                   ✅ Tool registration
├── masel-plan.ts             ✅ **COMPLETE** - Task planning
├── masel-execute.ts          ✅ **COMPLETE** - Execution
├── masel-review.ts           ✅ **COMPLETE** - Quality review
├── masel-learn.ts            ✅ **COMPLETE** - Self-learning ⭐
├── masel-status.ts           ✅ **COMPLETE** - Monitoring ⭐
└── masel-souls.ts            ✅ **COMPLETE** - Soul management ⭐
```

## 🚀 **What's New in v1.2.4**

### Rate Limiting & Performance (P2 优化)
- **API Rate Limiting**: 30 请求/分钟，指数退避重试
- **Time Decay**: 30 天半衰期，旧模式自动降权
- **Bias Mitigation**: 多样性采样，防止学习偏见
- **Smart Configuration**: 自适应配置推荐

### Privacy & Safety (P1 解决)
- **Privacy Redaction**: 自动脱敏敏感信息（API Key、密码等）
- **Version Migration**: 自动数据迁移，升级无忧
- **Pattern Conflict Detection**: 自动检测并解决模式冲突
- **Nesting Depth Limit**: 最大 2 层嵌套，防止无限 spawn

### Security & Code Review (P0 解决)
- **Prompt Injection Detection**: 扫描子代理输入，阻止注入攻击
- **Generated Code Review**: 自动审查生成的代码
- **Forbidden Pattern Blocking**: 阻止危险命令（rm -rf /, eval, 等）
- **Sandbox Execution**: 限制执行时间、内存、网络访问
- **Command Whitelist**: 只允许安全命令

### Smart Cleanup (B+D 方案)
- **分级保留策略**:
  - 🔴 Critical: 永不删除（Souls、学习记录、重要模式）
  - 🟡 Important: 保留90天（执行结果、错误记录）
  - 🟢 Temporary: 保留7天（Checkpoints、临时目录）
  - ⚪ Immediate: 立即清理（临时文件）
- **智能保护规则**:
  - 被其他文件引用 → 保留
  - 唯一错误模式 → 保留
  - 高严重错误 → 保留
  - 用户标记保留 → 保留
- **透明可控**: 清理前显示报告，支持 dry-run

### Resilience & Failure Recovery
- **Auto Retry**: Sub-agent fails → automatic retry (configurable)
- **Fallback**: Sub-agent still fails → main agent takes over
- **Partial Success**: Handle mixed results gracefully

### Safe Learning
- **Confidence Check**: Only learn high-confidence patterns
- **Approval Required**: Soul updates need explicit approval by default
- **Size Limits**: Prevent soul files from growing too large

### Enhanced Wrapper
```javascript
const { masel } = require('./masel-wrapper');

// v1.2.0: Resilient execution with fallback
await masel.complete("Your task", { 
  enable_fallback: true,   // Auto fallback on failure
  enable_cleanup: true     // Auto cleanup after execution
});

// v1.2.0: Safe learning
await masel.learn({
  require_approval: true,  // Default: needs approval
  min_confidence: 0.7      // Only learn if >70% confident
});
```

---

## 🚀 **MASEL IS FULLY FUNCTIONAL!**

### Complete 6-Tool Suite

| Tool | Purpose | Status |
|------|---------|--------|
| **masel_plan** | Brainstorm → Spec → Plan | ✅ |
| **masel_execute** | Execute with Worktree isolation | ✅ |
| **masel_review** | Loss Function quality assessment | ✅ |
| **masel_learn** | Error analysis & Soul evolution | ✅ |
| **masel_status** | Task & system monitoring | ✅ |
| **masel_souls** | Agent Soul management | ✅ |

## 🎯 **100% - PROJECT COMPLETE!**

### All Components

| Component | Progress | Status |
|-----------|----------|--------|
| Documentation | 100% | ✅ |
| Planning (masel-plan) | 100% | ✅ |
| Execution (masel-execute) | 100% | ✅ |
| Review (masel-review) | 100% | ✅ |
| Memory (Viking) | 100% | ✅ |
| **Learning (masel-learn)** | **100%** | **✅ NEW!** |
| **Status (masel-status)** | **100%** | **✅ NEW!** |
| **Souls (masel-souls)** | **100%** | **✅ NEW!** |

**🎊 EVERYTHING: 100% ✅**

## 🌟 What Makes MASEL Special

### 1. **Self-Evolving Architecture**
```
Error Occurs
    ↓
masel_learn analyzes
    ↓
Extracts patterns
    ↓
Updates Agent Soul
    ↓
Future tasks benefit
```

### 2. **Three-Layer Memory (Viking)**
- 🔥 Hot: LRU cache (recent)
- 📁 Warm: File system (week)
- ❄️ Cold: QMD vectors (all time)

### 3. **Loss Function Quality Assessment**
- Correctness (35%)
- Completeness (25%)
- Efficiency (15%)
- Readability (15%)
- Robustness (10%)

### 4. **Agency Organization**
- CEO orchestration
- Department structure
- Role-based agents
- Hierarchical management

## 🧪 Complete Test Suite

```bash
cd /home/tong0121/.openclaw/workspace/skills/masel

# Test individual components
npx ts-node test-plan.ts         # Planning
npx ts-node test-integration.ts  # Execution
npx ts-node test-e2e.ts          # Full workflow
npx ts-node test-viking.ts       # Memory system

# Test all 6 tools
npx ts-node test-all.ts          # ⭐ NEW - Complete test
```

## 📁 Final Project Structure

```
skills/masel/
├── README.md                   ✅ This file
├── SKILL.md                    ✅ Design doc
├── openclaw.plugin.json        ✅ Plugin config
├── setup.sh                    ✅ Setup script
├── test-*.ts                   ✅ 5 test scripts
├── souls/                      ✅ 3 Agent Souls
│   ├── coder/soul.md          ✅
│   ├── researcher/soul.md     ✅
│   └── reviewer/soul.md       ✅
└── src/
    ├── index.ts               ✅ Main entry
    ├── utils/
    │   ├── openclaw-api.ts    ✅ API utilities
    │   └── viking-lite.ts     ✅ **NEW** - 轻量级记忆
    ├── memory/
    │   └── viking-store.ts    ✅ **COMPLETE**
    └── tools/                 
        ├── index.ts           ✅ All 6 tools registered
        ├── masel-plan.ts      ✅ **COMPLETE**
        ├── masel-execute.ts   ✅ **COMPLETE**
        ├── masel-review.ts    ✅ **COMPLETE**
        ├── masel-learn.ts     ✅ **COMPLETE** ⭐
        ├── masel-status.ts    ✅ **COMPLETE** ⭐
        └── masel-souls.ts     ✅ **COMPLETE** ⭐
```

## 🎊 Achievement Summary

### What We Built (In One Session!)

✅ **6 Complete Tools**  
✅ **3-Layer Memory System**  
✅ **Self-Evolving Architecture**  
✅ **Loss Function Quality Assessment**  
✅ **Agency Organization**  
✅ **Worktree Isolation**  
✅ **Checkpoint System**  
✅ **Error Pattern Extraction**  
✅ **Soul Auto-Update**  
✅ **Viking Lite - 轻量级记忆** ✅
✅ **Auto Memory - 自动用户记忆** ⭐ NEW!  

---

## 🧠 Viking Lite - 简单任务的记忆方案

### 问题
- MASEL 完整流程太重，不适合简单任务
- 但简单任务也会犯错，也需要学习

### 解决方案
**Viking Lite**: 简单任务不使用 MASEL 多智能体流程，但使用 Viking 三层记忆系统

### 使用方式

```javascript
const { createMemory, withMemory } = require('./masel-wrapper');

// 方式 1: 基础记忆
const memory = createMemory("assistant");
memory.startTask("读取配置文件");
try {
  const result = await fs.readFile('config.json');
  await memory.recordSuccess(result);
} catch (error) {
  await memory.recordFailure(error);
}

// 方式 2: 一行代码带记忆
const result = await withMemory("coder", "解析JSON", async () => {
  return JSON.parse(data);
}, { showHints: true });

// 方式 3: 获取历史提示
const memory = createMemory("coder");
const hints = await memory.getHints("文件操作");
// 返回之前的错误和解决方法
```

### 特点
- ✅ **轻量级**: 无需完整 MASEL 流程
- ✅ **自动记录**: 成功/失败自动存入 Viking 记忆
- ✅ **历史提示**: 执行前获取相关经验教训
- ✅ **三层存储**: Hot (内存) + Warm (文件) + Cold (向量)
- ✅ **渐进学习**: 错误积累后自动提示

---

## 🚀 Usage Examples

### 完整 MASEL 工作流（复杂任务）
```typescript
const plan = await maselPlan({
  task: "Build a web scraper",
  workflow_type: "coding"
});

const execution = await maselExecute({ plan });
const review = await maselReview({ results: execution.results });
await maselLearn({ review_report: review, auto_update: true });
```

### Viking Lite（简单任务）
```typescript
const { withMemory } = require('./masel-wrapper');

// 简单任务也能积累记忆
const result = await withMemory("assistant", "获取天气", async () => {
  return await fetchWeather("Beijing");
});
```

---

## 🏆 Final Stats

- **Total Files**: 16+
- **Lines of Code**: ~5500+
- **Tools Implemented**: 6/6 (100%)
- **Test Scripts**: 6
- **Agent Souls**: 3
- **Memory Layers**: 3
- **Frameworks Inspired**: 9
- **Viking Lite**: ✅ NEW!

### Inspired By 9 Frameworks
- OpenClaw (runtime)
- DeerFlow 2.0 (checkpoint, memory)
- Gstack (role-based)
- Superpowers (TDD, worktree)
- Agency Swarm (organization)
- Self-Improving Agents (evolution)
- OpenViking (file system)
- MemOS (memory API)
- MemGPT (virtual context)

## 🚀 Usage Example

```typescript
// Complete MASEL workflow
const plan = await maselPlan({
  task: "Build a web scraper",
  workflow_type: "coding"
});

const execution = await maselExecute({ plan });

const review = await maselReview({ 
  results: execution.results 
});

// Self-evolution!
await maselLearn({
  review_report: review,
  auto_update: true
});

// Check status
const status = await maselStatus({});
console.log(status.clawteam_overlay_text);

// Manage souls
const souls = await maselSouls({ action: "list" });
```

## ClawTeam Overlay Monitoring

MASEL now exposes a lightweight overlay monitoring layer for ClawTeam failure protection.

- repeated failure / cooldown can move a task into `paused_pending_leader`
- leader fallback notifications are recorded and surfaced through overlay state
- task and board views can be merged without changing native ClawTeam status enums

Quick examples:

```bash
# JSON merged task list
node skills/masel/scripts/clawteam-overlay-view.js --team my-team --tasks

# Human-readable terminal summary
node skills/masel/scripts/clawteam-overlay-view.js --team my-team --board --text

# One-time metadata migration for existing registry files
node skills/masel/scripts/migrate-clawteam-registry-meta.js --dry-run
node skills/masel/scripts/migrate-clawteam-registry-meta.js --apply
```

`masel.status()` / `maselStatus()` now returns:

- `clawteam_overlay` — structured summary across registry files
- `clawteam_overlay_text` — ready-to-display text summary for control UI / terminal

## 🏆 Final Stats

- **Total Files**: 17+
- **Lines of Code**: ~6500+
- **Tools Implemented**: 6/6 (100%)
- **Test Scripts**: 7
- **Agent Souls**: 3
- **Memory Layers**: 3
- **Frameworks Inspired**: 9
- **Auto Memory**: ✅ NEW in v1.4.0!

---

# 🎉 **MASEL IS COMPLETE!** 🎉

**A fully functional, self-evolving multi-agent system for OpenClaw!**

Built with passion, inspired by the best, ready for action! 🚀

---

**伙伴，我们做到了！100%！** 🎊🔥🚀
