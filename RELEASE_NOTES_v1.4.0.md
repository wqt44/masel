# MASEL v1.4.0 - Auto Memory System

> 🎉 **AI 自动记住用户的一切！**

---

## ✨ What's New

### Auto Memory System - 自动记忆系统

让 AI 自动记住用户的偏好、重要事件、工作模式，无需手动调用！

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

### 自动提取的内容

| 你说的话 | 自动提取 | 重要性 |
|---------|---------|--------|
| "我喜欢..." | likes | 0.8 |
| "我讨厌..." | dislikes | 0.8 |
| "我希望..." | wishes | 0.7 |
| "请叫我..." | preferred_name | 0.9 |
| "我的名字是..." | name | 1.0 |
| "我是..." | identity | 0.8 |
| "完成..." | achievement | 0.7 |
| "发布..." | release | 0.8 |

### 三层记忆架构

- 🔥 **Hot Memory** - 内存缓存 (快速访问用户偏好)
- 📁 **Warm Memory** - 文件系统 (持久保存对话、事件)
- ❄️ **Cold Memory** - 索引搜索 (长期记忆检索)

---

## 📦 完整功能清单

### 6 个核心工具
- `masel-plan` - 任务规划
- `masel-execute` - 执行 (Worktree 隔离)
- `masel-review` - 审核 (Loss Function)
- `masel-learn` - 学习 (自进化)
- `masel-status` - 状态监控
- `masel-souls` - Soul 管理

### 9 个安全/优化模块
- Rate Limiting - API 限流保护
- Time Decay - 时间衰减
- Bias Mitigation - 偏见消除
- Privacy Protection - 隐私脱敏
- Conflict Detection - 模式冲突检测
- Depth Limiter - 嵌套深度限制
- Security Scan - 安全扫描
- Smart Cleanup - 智能清理
- Resilience - 失败恢复

### 3 个 API 层级

| 层级 | 适用场景 | API |
|------|---------|-----|
| **完整 MASEL** | 复杂任务 | `masel.complete()` |
| **Viking Lite** | 简单任务 | `withMemory()` |
| **Auto Memory** | 用户记忆 | `autoRecord()`, `autoRecall()` |

---

## 💻 使用示例

### 示例 1: 初始化自动记忆

```javascript
const { initAutoMemory } = require('./masel-wrapper');

// 只需要初始化一次
initMemory('TvTongg');
```

### 示例 2: 自动记录对话

```javascript
const { recordChat } = require('./masel-wrapper');

// 每次对话后自动记录
recordChat('我喜欢详细的设计讨论', '好的，我记住了！');
// 自动提取偏好：likes = 详细的设计讨论
```

### 示例 3: 自动获取记忆

```javascript
const { recall } = require('./masel-wrapper');

// 回复前获取相关记忆
const memories = recall('帮我设计功能');
console.log(memories);
// ["用户的likes: 详细的设计讨论", "用户的work_style: 先讨论再执行"]
```

### 示例 4: 完整对话流程

```javascript
const { initMemory, recordChat, recall } = require('./masel-wrapper');

initMemory('TvTongg');

async function chat(userMessage) {
  // 1. 获取相关记忆
  const memories = recall(userMessage);
  
  // 2. 基于记忆生成回复
  let response;
  if (memories.length > 0) {
    response = `我记得${memories[0]}，关于"${userMessage}"...`;
  } else {
    response = `关于"${userMessage}"...`;
  }
  
  // 3. 记录对话
  recordChat(userMessage, response);
  
  return response;
}

// 使用
await chat('我喜欢创新的方案');
await chat('帮我设计一个功能');  // 会记住之前的偏好
```

---

## 📊 统计数据

- **Total Files**: 17+
- **Lines of Code**: ~6500+
- **Tools Implemented**: 6/6 (100%)
- **Test Scripts**: 7
- **Agent Souls**: 3
- **Memory Layers**: 3
- **Frameworks Inspired**: 9

---

## 📝 版本历史

### v1.4.0 (2026-03-27) - Auto Memory System ⭐ NEW!
- ✅ 新增: Auto Memory System - 自动用户记忆
- ✅ 新增: `initAutoMemory()` API
- ✅ 新增: `autoRecord()` API
- ✅ 新增: `autoRecall()` API
- ✅ 新增: 自动偏好提取
- ✅ 新增: 全局记忆系统

### v1.3.0 (2026-03-27) - Viking Lite
- ✅ 新增: Viking Lite - 轻量级记忆系统
- ✅ 新增: `createMemory()` API
- ✅ 新增: `withMemory()` API

### v1.2.4 (2026-03-26) - Rate Limiting
- ✅ 新增: API 限流保护
- ✅ 新增: 时间衰减
- ✅ 新增: 偏见消除

### v1.2.3 (2026-03-26) - Privacy
- ✅ 新增: 隐私脱敏
- ✅ 新增: 版本迁移
- ✅ 新增: 模式冲突检测
- ✅ 新增: 嵌套深度限制

### v1.2.2 (2026-03-26) - Security
- ✅ 新增: 安全扫描
- ✅ 新增: 代码审查
- ✅ 新增: 沙箱执行

### v1.2.1 (2026-03-26) - Smart Cleanup
- ✅ 新增: 智能清理 (B+D 方案)
- ✅ 新增: 分级保留策略
- ✅ 新增: 智能保护规则

### v1.2.0 (2026-03-26) - Resilience
- ✅ 新增: 自动清理
- ✅ 新增: 失败恢复
- ✅ 新增: 安全学习

### v1.1.0 (2026-03-26) - Silent Mode
- ✅ 新增: 静默模式
- ✅ 新增: 自动任务检测

### v1.0.0 (2026-03-26) - Initial Release
- ✅ 6 个完整工具
- ✅ 3 层记忆系统
- ✅ 3 个 Agent Souls

---

Built with passion. Shared with love. ❤️

MASEL - Multi-Agent System with Error Learning
