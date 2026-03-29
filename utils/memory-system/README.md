# Ultimate Memory System v2.0

无损 + 分层 + 智能冲突解决的记忆系统

## 架构

```
L0 原始层: 完整对话记录 → 本地文件 (90天/1万条)
L1 摘要层: 每日摘要 + 关键决策 → JSON (1年)
L2 结构化: 项目/偏好/事实 → 分类存储 (分级保留)
L3 模式层: 长期行为模式 → (未来版本)
```

## 快速开始

```javascript
const memory = require('./utils/memory-system/masel-adapter.js');

// 1. 初始化
memory.initAdapter('session-123');

// 2. 记录对话 (自动 L0 + L2)
memory.recordConversation(
  '我有一个叫 chachacha 的企业级项目',
  '好的，我记住了！'
);

// 3. 搜索记忆
const results = memory.searchMemories('chachacha');
console.log(results.combined);

// 4. 获取会话启动上下文
const context = memory.getSessionContext();
console.log(context.formatted);
```

## 核心功能

### 1. 无损存储 (L0)

所有对话自动保存到 `memory/raw-conversations/YYYY-MM-DD.jsonl`

```javascript
// 格式
{
  "id": "conv-{timestamp}-{random}",
  "session_id": "session-123",
  "timestamp": "2026-03-29T06:00:00.000Z",
  "user_message": "...",
  "ai_response": "...",
  "metadata": { ... }
}
```

### 2. 自动提取 (L2)

自动从对话中提取：
- **项目**: "我有一个叫 X 的项目"
- **偏好**: "我喜欢 Y"
- **事实**: "记住 Z"

存储到 `memory/structured/{type}/{id}.json`

### 3. 冲突检测

当新记忆与现有记忆相似度 > 75% 时：

```javascript
const result = memory.storeStructuredMemory('project', 'chachacha v2');

if (result.status === 'conflict_detected') {
  // 需要用户解决
  console.log('冲突:', result.conflicts);
  
  // 解决方式
  memory.resolveConflict(
    result.memory,
    result.conflicts[0].existing_memory,
    'replace'  // 或 'keep_both', 'discard_new'
  );
}
```

### 4. 分级保留

| 重要性 | 保留时间 | 示例 |
|--------|----------|------|
| critical | 永久 | 关键项目、核心偏好 |
| important | 90天 | 一般项目、临时偏好 |
| temporary | 7天 | 临时上下文 |

### 5. 智能清理

```javascript
// 预览清理
const preview = memory.cleanupExpiredMemories(true);
console.log(`${preview.expired} 条记忆将被归档`);

// 执行清理
const stats = memory.cleanupExpiredMemories(false);
console.log(`${stats.archived} 条记忆已归档`);
```

### 6. 多层搜索

```javascript
const results = memory.searchMemories('chachacha', {
  type: 'project',      // 按类型过滤
  limit: 10,            // 结果数量
  includeInactive: false // 是否包含已归档
});

// 返回结构
{
  structured: [...],  // L2 结构化记忆
  summaries: [...],   // L1 每日摘要
  raw: [...],         // L0 原始对话
  combined: [...]     // 合并排序后的结果
}
```

## 会话启动集成

在 AGENTS.md 规定的启动流程中使用：

```javascript
const memory = require('./utils/memory-system/masel-adapter.js');

// 初始化
memory.initAdapter(sessionId);

// 获取上下文
const context = memory.getSessionContext({
  conversationLimit: 10,  // 最近 10 条对话
  summaryDays: 3,         // 最近 3 天摘要
  memoryLimit: 20         // 最多 20 条活跃记忆
});

// 注入到 AI 上下文
// context.formatted 包含格式化后的记忆文本
```

## 每日维护

```javascript
// 生成昨日摘要 + 清理过期记忆
const result = memory.dailyMaintenance();
```

建议通过 cron 每天执行一次。

## 文件结构

```
memory/
├── raw-conversations/     # L0: 原始对话
│   └── 2026-03-29.jsonl
├── daily-summaries/       # L1: 每日摘要
│   └── 2026-03-29.json
├── structured/            # L2: 结构化记忆
│   ├── project/
│   ├── preference/
│   └── fact/
└── archive/               # 归档的记忆
```

## 与 MASEL 集成

MASEL 的 `autoRecord` 和 `autoRecall` 现在使用此系统：

```javascript
// 旧方式 (文件存储)
autoRecord('message', 'response');

// 新方式 (分层存储)
// - L0: 保存完整对话
// - L2: 自动提取项目/偏好/事实
// - 冲突检测

const results = autoRecall('chachacha');
// 返回 L0 + L1 + L2 的合并结果
```

## 配置

编辑 `ultimate-memory.js` 中的 `CONFIG`：

```javascript
CONFIG: {
  retention: {
    l0_raw: { days: 90, maxRecords: 10000 },
    l2_structured: {
      critical: { days: Infinity },
      important: { days: 90 },
      temporary: { days: 7 }
    }
  },
  conflict: {
    similarityThreshold: 0.75,
    autoResolve: false
  }
}
```

## 未来计划

- [ ] L3 模式层: 行为预测
- [ ] SQLite 后端: 高性能检索
- [ ] Embedding 支持: 语义搜索
- [ ] 可视化界面: 记忆浏览器
