# Self-Improving System

AI 自我改进系统 - 让 AI 能够分析自己的表现、学习错误模式、并自动优化。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                  Self-Improving System                   │
├─────────────────────────────────────────────────────────┤
│  监控层 │  持续收集性能指标和日志                          │
│  分析层 │  健康评分 + 退化检测 + 机会识别                   │
│  学习层 │  Capability Evolver 集成（模式识别 + 进化建议）   │
│  执行层 │  自动修复 + 优化 + 重构                          │
│  验证层 │  效果验证 + 趋势跟踪                             │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 基础版

```javascript
const selfImproving = require('./utils/self-improving/self-improving.js');

// 初始化
selfImproving.initialize();

// 执行一次自我改进循环
const result = selfImproving.selfImprove();

// 启动持续改进
selfImproving.startContinuousImprovement();
```

### 集成 Capability Evolver 版（推荐）

```javascript
const evolverSystem = require('./utils/self-improving/self-improving-evolver.js');

// 执行完整的自我改进循环
const result = evolverSystem.executeSelfImprovementCycle();

// 获取改进历史
const history = evolverSystem.getImprovementHistory();

// 生成趋势报告
const report = evolverSystem.generateTrendReport();
```

## 功能

### 1. 健康评分

系统健康度 0-100 分，基于：
- 错误率
- 内存使用
- 历史趋势

```javascript
const analysis = selfImproving.analyzePerformance();
console.log(`健康评分: ${analysis.health_score}`);
```

### 2. 退化检测

自动检测系统退化：
- 健康分显著下降
- 错误率上升
- 性能下降

```javascript
const regressions = analysis.regressions;
for (const reg of regressions) {
  console.log(`⚠️ ${reg.description}: ${reg.recommendation}`);
}
```

### 3. 改进机会识别

识别优化机会：
- 内存优化
- 响应速度
- 可靠性提升

```javascript
const opportunities = analysis.opportunities;
for (const opp of opportunities) {
  console.log(`💡 ${opp.description}: ${opp.approach}`);
}
```

### 4. 自动改进执行

根据分析结果自动执行改进：

| 动作类型 | 说明 | 示例 |
|----------|------|------|
| `fix` | 修复问题 | 清理缓存、修复配置 |
| `optimize` | 性能优化 | 调整参数、优化算法 |
| `refactor` | 代码重构 | 架构优化、代码清理 |
| `learn` | 学习改进 | 更新模式库、策略优化 |

### 5. 效果验证

验证改进效果：

```javascript
const verification = selfImproving.verifyImprovement(planId);
console.log(`改进幅度: ${verification.improvement} 分`);
console.log(`改进成功: ${verification.success}`);
```

## 配置

```javascript
const CONFIG = {
  // 监控频率（毫秒）
  checkInterval: 60 * 60 * 1000,  // 每小时
  
  // 改进阈值
  thresholds: {
    healthScore: 70,      // 低于此值触发改进
    errorRate: 0.1,       // 超过此值触发改进
    repetitionRate: 0.3   // 重复错误率阈值
  }
};
```

## 集成 Capability Evolver

### 分析日志

```javascript
const logs = [
  { timestamp: '2026-03-29T10:00:00Z', level: 'error', message: 'Timeout', context: 'api.ts' },
  { timestamp: '2026-03-29T10:01:00Z', level: 'error', message: 'Timeout', context: 'api.ts' }
];

const analysis = evolverSystem.analyzeWithEvolver(logs);
console.log(`健康评分: ${analysis.health_score}`);
console.log(`模式: ${analysis.patterns}`);
```

### 生成进化方案

```javascript
const evolution = evolverSystem.evolveWithEvolver(logs, 'balanced');

console.log(`策略: ${evolution.strategy}`);
console.log(`预计改进: ${evolution.estimated_improvement}`);

for (const rec of evolution.recommendations) {
  console.log(`- [${rec.priority}] ${rec.description}`);
}
```

### 策略选择

| 策略 | 适用场景 |
|------|----------|
| `auto` | 自动选择（默认） |
| `balanced` | 平衡改进 |
| `innovate` | 优先新功能 |
| `harden` | 优先可靠性 |
| `repair-only` | 只修关键问题 |

## 趋势报告

```javascript
const report = evolverSystem.generateTrendReport();

console.log(`总改进次数: ${report.total_improvements}`);
console.log(`平均健康分: ${report.average_health_score}`);
console.log(`健康趋势: ${report.health_trend}`);
```

## 文件结构

```
utils/self-improving/
├── self-improving.js           # 核心自我改进系统
├── self-improving-evolver.js   # Capability Evolver 集成版
├── README.md                   # 本文档
└── start.js                    # 启动脚本

memory/self-improving/
├── patterns/                   # 识别的模式
├── improvements/               # 改进方案
├── history/                    # 改进历史
└── metrics/                    # 性能指标
```

## 使用场景

### 场景 1：每日健康检查

```javascript
// 每天执行一次
const result = evolverSystem.executeSelfImprovementCycle();
if (result.status === 'success') {
  console.log('✓ 自我改进完成');
}
```

### 场景 2：故障后自动恢复

```javascript
// 检测到故障时
if (analysis.health_score < 50) {
  console.log('⚠️ 系统健康度低，启动紧急修复');
  const evolution = evolverSystem.evolveWithEvolver(logs, 'repair-only');
  // 执行修复动作
}
```

### 场景 3：持续优化

```javascript
// 启动持续改进
selfImproving.startContinuousImprovement();
// 每小时自动检查并改进
```

## 与 MASEL 集成

```javascript
const { masel } = require('../skills/masel/masel-wrapper.js');
const evolverSystem = require('./self-improving/self-improving-evolver.js');

// MASEL 任务完成后自动分析
async function runMaselTask(task) {
  const result = await masel.complete(task);
  
  // 收集任务日志
  const logs = collectTaskLogs(result);
  
  // 分析并改进
  const analysis = evolverSystem.analyzeWithEvolver(logs);
  if (analysis.health_score < 80) {
    console.log('任务执行有改进空间，生成优化建议...');
    const evolution = evolverSystem.evolveWithEvolver(logs, 'balanced');
    // 应用改进建议
  }
  
  return result;
}
```

## 未来计划

- [ ] A/B 测试框架
- [ ] 自动回滚机制
- [ ] 深度学习模型集成
- [ ] 多智能体协同改进
- [ ] 可视化仪表板
