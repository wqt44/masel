# OpenClaw Automation Core (OAC)

全自动 AI 系统管理核心 - 统一协调所有子系统，实现自管理、自进化的 AI。

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                 OpenClaw Automation Core (OAC)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│   │   Health    │  │   Memory    │  │   Skills    │             │
│   │   Check     │  │ Maintenance │  │  Discovery  │             │
│   │  (5 min)    │  │  (1 hour)   │  │  (24 hour)  │             │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│          │                │                │                     │
│          └────────────────┼────────────────┘                     │
│                           │                                      │
│                    ┌──────┴──────┐                              │
│                    │  Self-      │                              │
│                    │  Improving  │                              │
│                    │  (4 hour)   │                              │
│                    └─────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 功能

### 1. 健康检查 (每 5 分钟)

自动检查：
- 记忆系统健康
- 技能系统健康
- 文件系统健康
- 综合健康评分

如果健康分低于阈值，自动触发修复。

### 2. 记忆维护 (每小时)

自动执行：
- 生成每日摘要
- 清理过期记忆
- 归档旧数据
- 优化存储

### 3. 自我改进 (每 4 小时)

自动执行：
- 分析系统表现
- 识别退化问题
- 生成改进方案
- 执行改进动作
- 验证改进效果

### 4. 技能发现 (每天)

自动执行：
- 搜索 ClawHub 新技能
- 安全审查
- 自动安装安全技能
- 测试技能功能
- 进化已有技能

## 快速开始

```bash
cd utils/oac

# 启动全自动模式
node start.js

# 执行一次完整循环
node start.js --once

# 查看系统状态
node start.js --status
```

## API

```javascript
const OpenClawAutomation = require('./openclaw-automation.js');

// 创建实例
const oac = new OpenClawAutomation();

// 初始化
oac.initialize();

// 启动全自动模式
oac.start();

// 手动执行特定任务
await oac.runHealthCheck();
await oac.runMemoryMaintenance();
await oac.runSelfImprovement();
await oac.runSkillDiscovery();

// 获取状态
const status = oac.getStatus();

// 停止
oac.stop();
```

## 配置

```javascript
const CONFIG = {
  intervals: {
    healthCheck: 5 * 60 * 1000,      // 5 分钟
    memoryMaintenance: 60 * 60 * 1000, // 1 小时
    selfImprovement: 4 * 60 * 60 * 1000, // 4 小时
    skillDiscovery: 24 * 60 * 60 * 1000, // 24 小时
  },
  thresholds: {
    minHealthScore: 70,    // 最低健康分
    maxErrorRate: 0.1,     // 最大错误率
    autoFix: true          // 自动修复
  }
};
```

## 监控

### 健康报告

保存在 `memory/oac/reports/health-{timestamp}.json`

```json
{
  "timestamp": "2026-03-29T06:30:00Z",
  "cycle": 42,
  "checks": {
    "memory": { "status": "healthy", "score": 95 },
    "skills": { "status": "healthy", "score": 90, "count": 7 },
    "files": { "status": "healthy", "score": 90, "size": "3.4M" }
  },
  "overall": { "status": "healthy", "score": 92 }
}
```

### 日志

保存在 `memory/oac/automation.log`

```json
{"timestamp": "2026-03-29T06:30:00Z", "event": "health_check", "data": {...}}
{"timestamp": "2026-03-29T06:30:00Z", "event": "memory_maintenance", "data": {...}}
```

## 定时任务建议

```bash
# 添加到 crontab，确保 OAC 持续运行
@reboot cd /path/to/workspace && node utils/oac/start.js --daemon
```

## 集成

### 与现有系统集成

OAC 自动集成：
- ✅ Ultimate Memory System v2.0
- ✅ Self-Improving System
- ✅ Skill Pipeline
- ✅ Capability Evolver
- ✅ Agent Browser

### 扩展

可以添加自定义检查：

```javascript
class MyAutomation extends OpenClawAutomation {
  checkCustomHealth() {
    // 自定义健康检查
    return { status: 'healthy', score: 100 };
  }
  
  async runCustomTask() {
    // 自定义定时任务
  }
}
```

## 状态

```
运行中
├── 启动时间: 2026-03-29 06:00:00
├── 运行时间: 2 小时 30 分钟
├── 检查周期: 42
├── 错误次数: 0
├── 改进次数: 3
├── 已安装技能: 7
└── 健康评分: 92/100
```
