# MASEL v1.3.0 - Viking Lite Release

> 🎉 **简单任务也能使用 MASEL 记忆方法！**

---

## 📋 目录

1. [快速开始](#-快速开始)
2. [What's New](#-whats-new-in-v130)
3. [完整功能](#-完整功能清单)
4. [安装指南](#-安装指南)
5. [使用示例](#-使用示例)
6. [架构设计](#-架构设计)
7. [版本历史](#-版本历史)
8. [贡献指南](#-贡献指南)

---

## 🚀 快速开始

### 安装

```bash
# 下载发布包
wget https://github.com/yourusername/MASEL/releases/download/v1.3.0/MASEL-v1.3.0-Release.tar.gz

# 解压
tar -xzf MASEL-v1.3.0-Release.tar.gz
cd MASEL-Release-v1.3.0

# 安装依赖
./setup.sh
```

### 一行代码开始使用

```javascript
const { masel, withMemory } = require('./masel-wrapper');

// 复杂任务 - 完整 MASEL 工作流
await masel.complete("构建一个 Web 爬虫");

// 简单任务 - Viking Lite 轻量级记忆
await withMemory("coder", "解析 JSON", async () => {
  return JSON.parse(data);
});
```

---

## ✨ What's New in v1.3.0

### 🧠 Viking Lite - 轻量级记忆系统

**问题**: MASEL 完整流程太重，不适合简单任务，但简单任务也会犯错，也需要学习。

**解决方案**: Viking Lite 让简单任务不使用 MASEL 多智能体流程，但使用 Viking 三层记忆系统。

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

### Viking Lite 特点

| 特性 | 说明 |
|------|------|
| 🔥 **轻量级** | 无需完整 MASEL 流程 |
| 📝 **自动记录** | 成功/失败自动存入 Viking 记忆 |
| 💡 **历史提示** | 执行前获取相关经验教训 |
| 🗄️ **三层存储** | Hot + Warm + Cold |
| 📈 **渐进学习** | 错误积累后自动提示 |

---

## 📦 完整功能清单

### 6 个核心工具

| 工具 | 功能 | 状态 |
|------|------|------|
| `masel-plan` | 任务规划 (Brainstorm → Spec → Plan) | ✅ |
| `masel-execute` | 执行 (Worktree 隔离) | ✅ |
| `masel-review` | 审核 (Loss Function 质量评估) | ✅ |
| `masel-learn` | 学习 (自进化) | ✅ |
| `masel-status` | 状态监控 | ✅ |
| `masel-souls` | Agent Soul 管理 | ✅ |

### 9 个安全/优化模块

| 模块 | 功能 | 版本 |
|------|------|------|
| Rate Limiting | API 限流保护 (30请求/分钟) | v1.2.4 |
| Time Decay | 时间衰减 (30天半衰期) | v1.2.4 |
| Bias Mitigation | 偏见消除 (多样性采样) | v1.2.4 |
| Privacy Protection | 隐私脱敏 (API Key/密码) | v1.2.3 |
| Conflict Detection | 模式冲突检测 | v1.2.3 |
| Depth Limiter | 嵌套深度限制 (最大2层) | v1.2.3 |
| Security Scan | 安全扫描 (Prompt注入检测) | v1.2.2 |
| Smart Cleanup | 智能清理 (分级保留) | v1.2.1 |
| Resilience | 失败恢复 (自动降级) | v1.2.0 |

### 3 层记忆系统 (Viking)

```
┌─────────────────────────────────────────┐
│           Viking 记忆架构               │
├─────────────────────────────────────────┤
│  🔥 Hot Memory                          │
│     - LRU 缓存                          │
│     - 最近 10 条错误                    │
│     - 毫秒级访问                        │
├─────────────────────────────────────────┤
│  📁 Warm Memory                         │
│     - 文件系统                          │
│     - 按日期/代理类型组织               │
│     - 人类可读                          │
├─────────────────────────────────────────┤
│  ❄️ Cold Memory                         │
│     - QMD 向量数据库                    │
│     - 语义搜索                          │
│     - 所有历史错误                      │
└─────────────────────────────────────────┘
```

### 3 个 Agent Souls

- **Coder** - 编码专家
- **Researcher** - 研究专家
- **Reviewer** - 审核专家

---

## 📖 安装指南

### 系统要求

- Node.js >= 16.0.0
- TypeScript >= 4.5.0
- OpenClaw >= 1.0.0 (可选)

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/MASEL.git
cd MASEL

# 2. 安装依赖
npm install

# 3. 编译 TypeScript
npx tsc

# 4. 运行测试
npm test
```

### OpenClaw 插件安装

```bash
# 复制到 OpenClaw skills 目录
cp -r MASEL-Release-v1.3.0 ~/.openclaw/workspace/skills/masel

# 重启 OpenClaw
openclaw gateway restart
```

---

## 💻 使用示例

### 示例 1: 完整 MASEL 工作流 (复杂任务)

```javascript
const { masel } = require('./masel-wrapper');

async function complexTask() {
  // 自动完成: Plan → Execute → Review → Learn
  const result = await masel.complete("构建一个 Web 爬虫", {
    workflow_type: "coding",
    enable_cleanup: true,    // 自动清理
    enable_fallback: true    // 失败降级
  });

  console.log(`结果: ${result.review.decision}`);
  console.log(`分数: ${result.review.overall_score}/100`);
}
```

### 示例 2: Viking Lite (简单任务)

```javascript
const { withMemory } = require('./masel-wrapper');

async function simpleTask() {
  // 简单任务也能积累记忆
  const result = await withMemory(
    "coder",                          // 代理类型
    "解析配置文件",                    // 任务描述
    async () => {
      const fs = require('fs');
      const data = fs.readFileSync('config.json', 'utf8');
      return JSON.parse(data);
    },
    {
      showHints: true,                 // 显示历史提示
      onError: (error, hints) => {
        console.log("出错了，历史提示:", hints);
      }
    }
  );

  console.log("配置:", result);
}
```

### 示例 3: 手动使用 Viking Lite

```javascript
const { createMemory } = require('./masel-wrapper');

async function manualMemory() {
  const memory = createMemory("assistant", "文件操作");

  // 1. 获取历史提示
  const hints = await memory.getHints("读取大文件");
  if (hints.length > 0) {
    console.log("历史提示:");
    hints.forEach(h => console.log(`  [${h.type}] ${h.message}`));
  }

  // 2. 开始任务
  memory.startTask("读取日志文件");

  try {
    // 3. 执行任务
    const content = await readFile("/var/log/app.log");

    // 4. 记录成功
    await memory.recordSuccess(content, {
      file_size: content.length,
      lines: content.split('\n').length
    });

    return content;
  } catch (error) {
    // 5. 记录失败
    await memory.recordFailure(error, {
      file_path: "/var/log/app.log"
    });
    throw error;
  }
}
```

### 示例 4: 静默模式

```javascript
const { masel } = require('./masel-wrapper');

// 静默执行 - 无中间输出
const result = await masel.silent("分析代码库", {
  enable_cleanup: true
});

// 只返回最终结果
console.log(result.execution.summary);
```

### 示例 5: 自动模式

```javascript
const { masel } = require('./masel-wrapper');

// 自动判断是否需要 MASEL
const result = await masel.auto("写个 Python 脚本");

if (result.auto_skipped) {
  // 简单任务，直接处理
  console.log("简单任务，跳过 MASEL");
} else {
  // 复杂任务，已用 MASEL 处理
  console.log("复杂任务，MASEL 处理完成");
}
```

---

## 🏗️ 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        MASEL v1.3.0                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 5: Meta-Learning                                     │
│  └── 优化进化策略                                           │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Evolution                                         │
│  ├── 自动优化 Prompts                                       │
│  ├── 更新 Agent Souls                                       │
│  └── 维护 Skill Library                                     │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Evaluation                                        │
│  ├── 轨迹记录                                               │
│  ├── Loss Function 评估                                     │
│  └── 反向传播归因                                           │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Execution                                         │
│  ├── Brainstorm → Spec → Plan                               │
│  ├── 并行执行 (Worktree 隔离)                               │
│  ├── 集成 & 测试                                            │
│  └── 代码审查                                               │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Infrastructure                                    │
│  ├── OpenClaw Runtime                                       │
│  ├── MASEL-Viking Memory                                    │
│  └── Skill Library                                          │
├─────────────────────────────────────────────────────────────┤
│  Viking Lite (轻量级记忆)                                    │
│  ├── createMemory()                                         │
│  ├── withMemory()                                           │
│  └── getHints()                                             │
└─────────────────────────────────────────────────────────────┘
```

### Loss Function 质量评估

| 维度 | 权重 | 说明 |
|------|------|------|
| Correctness | 35% | 正确性 |
| Completeness | 25% | 完整性 |
| Efficiency | 15% | 效率 |
| Readability | 15% | 可读性 |
| Robustness | 10% | 健壮性 |

### Agency 组织架构

```
CEO
├── DevManager
│   ├── Coder (×N)
│   └── Tester (×N)
├── ResearchManager
│   └── Researcher (×N)
└── Reviewer
```

---

## 📝 版本历史

### v1.3.0 (2026-03-27) - Viking Lite
- ✅ 新增: Viking Lite 轻量级记忆系统
- ✅ 新增: `createMemory()` API
- ✅ 新增: `withMemory()` API
- ✅ 优化: 简单任务也能使用 MASEL 记忆方法

### v1.2.4 (2026-03-26) - Rate Limiting
- ✅ 新增: API 限流保护 (30请求/分钟)
- ✅ 新增: 指数退避重试
- ✅ 新增: 时间衰减 (30天半衰期)
- ✅ 新增: 偏见消除 (多样性采样)

### v1.2.3 (2026-03-26) - Privacy
- ✅ 新增: 隐私脱敏 (API Key、密码等)
- ✅ 新增: 版本迁移
- ✅ 新增: 模式冲突检测
- ✅ 新增: 嵌套深度限制 (最大2层)

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

## 🤝 贡献指南

### 如何贡献

1. **Fork** 仓库
2. **创建分支** (`git checkout -b feature/amazing-feature`)
3. **提交更改** (`git commit -m 'Add amazing feature'`)
4. **推送分支** (`git push origin feature/amazing-feature`)
5. **创建 Pull Request**

### 开发环境

```bash
# 安装开发依赖
npm install

# 编译 TypeScript
npx tsc

# 运行测试
npm test

# 代码检查
npm run lint
```

### 提交规范

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `style:` 格式
- `refactor:` 重构
- `test:` 测试
- `chore:` 构建/工具

---

## 📊 统计数据

- **代码行数**: ~5,500 行
- **文件数量**: 30+
- **工具数量**: 6 个
- **安全模块**: 9 个
- **测试脚本**: 6 个
- **文档文件**: 12 个
- **框架融合**: 9 个

---

## 🙏 致谢

MASEL 融合了以下优秀框架的思想：

- **OpenClaw** - Runtime
- **DeerFlow 2.0** - Checkpoint, Memory
- **Gstack** - Role-based Design
- **Superpowers** - TDD, Worktree
- **Agency Swarm** - Organization
- **Self-Improving Agents** - Evolution
- **OpenViking** - File System
- **MemOS** - Memory API
- **MemGPT** - Virtual Context

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 📞 联系方式

- **GitHub**: https://github.com/yourusername/MASEL
- **Issues**: https://github.com/yourusername/MASEL/issues
- **Discussions**: https://github.com/yourusername/MASEL/discussions

---

<p align="center">
  <b>Built with passion. Shared with love. ❤️</b>
</p>

<p align="center">
  <b>MASEL - Multi-Agent System with Error Learning</b>
</p>
