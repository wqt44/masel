# Automated Skill Management Pipeline

自动化技能管理流水线 - 集成 Find → Vet → Create → Evolve → Improve

## 架构

```
┌─────────────────────────────────────────────────────────┐
│              Automated Skill Management Pipeline         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. FIND      →  发现技能（ClawHub 搜索 / Agent Browser） │
│  2. VET       →  安全审查（Skill Vetter）                 │
│  3. CREATE    →  创建技能（Skill Creator）                │
│  4. EVOLVE    →  持续进化（Capability Evolver）           │
│  5. IMPROVE   →  自我改进（Self-Improving）               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 基础版

```bash
cd utils/skill-pipeline

# 运行基础流水线
node start.js

# 搜索特定技能
node start.js --query "memory"

# 完整流程
node start.js --full
```

### Agent Browser 增强版

```bash
# 使用浏览器自动化
node start.js --browser

# 搜索 + 浏览器自动化
node start.js --browser --query "workflow"

# 完整流程 + 浏览器
node start.js --browser --full
```

## 功能详解

### 1. FIND - 发现技能

**CLI 方式：**
```javascript
const result = await skillPipeline.findSkills('memory', {
  minScore: 3.0,
  limit: 20
});
```

**Agent Browser 方式：**
```javascript
const result = await browserPipeline.browseClawHubForSkills('memory');
// 自动浏览 clawhub.ai，获取技能列表
```

### 2. VET - 审查技能

```javascript
const vetResult = await skillPipeline.vetSkills(skills);
// 返回: { passed: 5, total: 10, results: [...] }
```

审查维度：
- 安装风险
- 运行时风险
- 信任依赖
- 安全评分 (0-100)

### 3. CREATE - 创建技能

```javascript
const spec = {
  name: 'my-skill',
  description: 'My custom skill',
  resources: 'scripts,references',
  scripts: {
    'my-script.js': 'console.log("Hello")'
  }
};

const result = await skillPipeline.createSkill(spec);
```

### 4. EVOLVE - 进化技能

```javascript
const result = await skillPipeline.evolveSkill('my-skill', {
  strategy: 'balanced'  // balanced | innovate | harden | repair-only
});
```

策略：
- `balanced` - 平衡改进
- `innovate` - 优先新功能
- `harden` - 优先可靠性
- `repair-only` - 只修关键问题

### 5. IMPROVE - 自我改进

```javascript
const result = await skillPipeline.improvePipeline();
// 流水线自我分析、发现问题、生成改进方案
```

## API 使用

```javascript
const skillPipeline = require('./skill-pipeline.js');
const browserPipeline = require('./skill-pipeline-browser.js');

// 初始化
skillPipeline.initialize();

// 运行完整流水线
const results = await skillPipeline.runPipeline({
  findQuery: 'automation',
  autoInstall: true
});

// 运行浏览器增强版
const results = await browserPipeline.runEnhancedPipeline({
  query: 'memory',
  useBrowser: true,
  autoTest: true
});
```

## 配置

```javascript
const CONFIG = {
  skillsDir: 'workspace/skills',
  pipelineDir: 'memory/skill-pipeline',
  thresholds: {
    minVetScore: 70,    // 审查通过最低分
    autoInstall: true,  // 自动安装
    autoUpdate: true    // 自动更新
  }
};
```

## 定时任务

建议设置 cron 任务定期运行：

```bash
# 每天凌晨 4 点运行流水线
0 4 * * * cd /path/to/workspace && node utils/skill-pipeline/start.js --full
```

## 文件结构

```
utils/skill-pipeline/
├── skill-pipeline.js           # 核心流水线
├── skill-pipeline-browser.js   # Agent Browser 增强版
├── start.js                    # 启动脚本
└── README.md                   # 本文档

memory/skill-pipeline/
├── history.jsonl               # 执行历史
├── discoveries.jsonl           # 技能发现记录
└── run-*.json                  # 每次运行的详细结果
```

## 集成其他系统

### 与 MASEL 集成

```javascript
const { masel } = require('../skills/masel/masel-wrapper.js');
const skillPipeline = require('./skill-pipeline.js');

// MASEL 任务完成后自动发现相关技能
async function runTask(task) {
  const result = await masel.complete(task);
  
  // 根据任务类型发现技能
  const skills = await skillPipeline.findSkills(task.type);
  
  // 审查并推荐
  const vetted = await skillPipeline.vetSkills(skills.slice(0, 5));
  
  return { result, recommendedSkills: vetted };
}
```

### 与 Self-Improving 集成

```javascript
const selfImproving = require('../self-improving/self-improving-evolver.js');

// 流水线自我改进
async function selfImprovePipeline() {
  const logs = collectPipelineLogs();
  const result = selfImproving.executeSelfImprovementCycle();
  return result;
}
```

## 使用场景

### 场景 1: 自动技能发现

每天自动搜索 ClawHub，发现新技能并审查：

```bash
node start.js --query "new" --full
```

### 场景 2: 技能安全审计

定期审查已安装技能的安全性：

```javascript
const installed = listInstalledSkills();
const vetResult = await skillPipeline.vetSkills(installed);
```

### 场景 3: 技能持续进化

自动分析技能使用情况并生成改进建议：

```javascript
for (const skill of installedSkills) {
  await skillPipeline.evolveSkill(skill, 'balanced');
}
```

### 场景 4: 完整自动化

从发现到安装到测试的全自动化：

```bash
node start.js --browser --full --query "automation"
```

## 未来计划

- [ ] Web UI 仪表板
- [ ] 技能依赖图可视化
- [ ] 自动冲突解决
- [ ] 技能评分系统
- [ ] 社区技能推荐
