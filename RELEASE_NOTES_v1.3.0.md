# MASEL v1.3.0 Release Notes

## 🎉 Viking Lite - 简单任务也能使用 MASEL 记忆方法！

### What's New

**Viking Lite** - 轻量级记忆系统，让简单任务也能享受 MASEL 的三层记忆能力！

```javascript
const { createMemory, withMemory } = require('./masel-wrapper');

// 方式 1: 基础记忆
const memory = createMemory("assistant");
memory.startTask("读取文件");
await memory.recordSuccess(result);

// 方式 2: 一行代码带记忆
const result = await withMemory("coder", "解析JSON", async () => {
  return JSON.parse(data);
});

// 方式 3: 获取历史提示
const hints = await memory.getHints("文件操作");
```

### Why Viking Lite?

**问题**: MASEL 完整流程太重，不适合简单任务，但简单任务也会犯错，也需要学习。

**解决方案**: Viking Lite 让简单任务不使用 MASEL 多智能体流程，但使用 Viking 三层记忆系统：
- 🔥 **Hot Memory** - 内存 LRU 缓存（最近10条）
- 📁 **Warm Memory** - 文件系统（按日期/代理类型组织）
- ❄️ **Cold Memory** - QMD 向量数据库（语义搜索）

### Features

- ✅ **轻量级** - 无需完整 MASEL 流程
- ✅ **自动记录** - 成功/失败自动存入 Viking 记忆
- ✅ **历史提示** - 执行前获取相关经验教训
- ✅ **三层存储** - Hot + Warm + Cold
- ✅ **渐进学习** - 错误积累后自动提示

### Complete Feature List (v1.3.0)

**6 Tools**
- `masel-plan` - Task planning
- `masel-execute` - Execution with Worktree isolation
- `masel-review` - Quality review with Loss Function
- `masel-learn` - Self-learning and evolution
- `masel-status` - Status monitoring
- `masel-souls` - Agent Soul management

**9 Safety/Optimization Modules**
- Rate Limiting - API protection
- Time Decay - 30-day half-life for old patterns
- Bias Mitigation - Diversity sampling
- Privacy Protection - Automatic redaction
- Conflict Detection - Pattern conflict resolution
- Depth Limiter - Max 2-level nesting
- Security Scan - Prompt injection detection
- Smart Cleanup - Tiered retention + intelligent protection
- Resilience - Auto retry and fallback

**3 Agent Souls**
- Coder
- Researcher
- Reviewer

### Installation

```bash
# Clone or download
cd MASEL-Release-v1.3.0
./setup.sh
```

### Quick Start

**Complex Tasks (Full MASEL)**:
```javascript
const { masel } = require('./masel-wrapper');
await masel.complete("Build a web scraper");
```

**Simple Tasks (Viking Lite)**:
```javascript
const { withMemory } = require('./masel-wrapper');
await withMemory("coder", "Parse JSON", async () => {
  return JSON.parse(data);
});
```

### Files

- `MASEL-v1.3.0-Release.tar.gz` - Full release package (82KB)
- `MASEL_SUMMARY_v1.3.0.txt` - Detailed summary

### Version History

- **v1.3.0** (2026-03-27) - Viking Lite release
- **v1.2.4** (2026-03-26) - Rate limiting + Bias mitigation
- **v1.2.3** (2026-03-26) - Privacy + Migration
- **v1.2.2** (2026-03-26) - Security scanning
- **v1.2.1** (2026-03-26) - Smart cleanup
- **v1.2.0** (2026-03-26) - Resilience + Safe learning
- **v1.1.0** (2026-03-26) - Silent mode + Auto detection
- **v1.0.0** (2026-03-26) - Initial release

### Stats

- **Total Files**: 30+
- **Lines of Code**: ~5,500
- **Test Scripts**: 6
- **Documentation**: 12 files

---

Built with passion. Shared with love. ❤️

MASEL - Multi-Agent System with Error Learning
