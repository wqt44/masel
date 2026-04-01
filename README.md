<div align="center">

# 🧠 MASEL v2.0.0

### Multi-Agent System with Error Learning

**记忆系统进化版 — Memory System Evolution**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/tvtongg/MASEL)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Code](https://img.shields.io/badge/code-~10%2C800%20lines-orange.svg)]()

*自进化多智能体系统 · 四层记忆架构 · 智能检索 · 主动记忆引擎*

</div>

---

## 📖 目录

- [项目概述](#-项目概述)
- [MASEL 会做什么](#-masel-会做什么)
- [MASEL 能做什么](#-masel-能做什么)
- [MASEL 怎么做](#-masel-怎么做)
- [架构全景](#-架构全景)
- [记忆系统 v2.0](#-记忆系统-v20)
- [核心模块详解](#-核心模块详解)
- [快速开始](#-快速开始)
- [API 参考](#-api-参考)
- [版本历史](#-版本历史)
- [项目结构](#-项目结构)
- [合作者](#-合作者)

---

## 🌟 项目概述

MASEL 是一个**自进化多智能体系统**，核心理念是让 AI 代理能够从错误中学习、记忆用户偏好、适应工作模式。

### v2.0.0 亮点

| 特性 | 描述 |
|:-----|:-----|
| 🧠 **四层记忆架构** | L0 原始 → L1 摘要 → L2 结构化 → L3 模式 |
| 🔍 **智能检索 2.0** | 非线性衰减 + 上下文感知 + 召回频率追踪 |
| 🤖 **主动记忆引擎** | 智能记录判断 + 生命周期管理 + 主动提醒 |
| 🔗 **去重合并** | TF-IDF 余弦相似度 + 多策略自动合并 |
| 📊 **知识图谱** | 实体-关系图谱 + SQLite 持久化 |
| 🎯 **多代理协调** | ClawTeam 集成 + 团队模板 + 知识共享 |

---

## ❓ MASEL 是什么

MASEL（**M**ulti-**A**gent **S**ystem with **E**rror **L**earning）是一个**自进化多智能体系统**。

简单说，它让 AI 拥有了**记忆**和**学习能力**：

- 🧠 **记忆** — 记住你说过什么、喜欢什么、做过什么决定
- 📈 **学习** — 从错误中总结经验，下次遇到同样问题不再犯错
- 🤖 **多代理协作** — 复杂任务自动拆分，多个专业代理协同完成
- 🔄 **自进化** — 越用越懂你，自动适应用户的工作风格和偏好

### 一句话总结

> MASEL 让 AI 从"每次对话都从零开始"变成"越用越懂你的长期伙伴"。

---

## 🎯 MASEL 能做什么

### 1. 智能记忆管理

```
你: "我喜欢先讨论再动手"
MASEL: ✅ 记住偏好 (preference, confidence: 0.85)

你: "修复了一个类型转换的 bug"
MASEL: ✅ 记住错误模式 (error_pattern, 永久保留)

你: "决定用方案A"
MASEL: ✅ 记住决策 (decision, confidence: 0.80)

你: "你好"
MASEL: ⏭️ 跳过 (闲聊，不浪费存储)
```

| 能力 | 说明 | 示例 |
|:-----|:-----|:-----|
| **偏好记忆** | 记住你喜欢什么、讨厌什么 | "用户偏好详细设计讨论" |
| **错误学习** | 记录 bug 原因和正确做法，永久保留 | "WHITE-IMAGE-FILL → 用 0xFF 替代 0x00" |
| **决策记录** | 记住关键决策节点 | "v2.0.0 选择非线性衰减曲线" |
| **项目追踪** | 跟踪项目进展和里程碑 | "MASEL v2.0.0 Phase 1 完成" |
| **行为模式** | 自动发现用户的行为规律 | "用户活跃时段 6:00-11:00" |
| **周期模式** | 识别重复出现的规律 | "'记忆系统' 在 5 天中被讨论 23 次" |

### 2. 智能检索

当你问问题时，MASEL 会从**所有记忆层**中检索相关信息：

```
你: "上次讨论的 MASEL 架构是什么来着？"

MASEL 检索过程:
  ├─ L0: 找到 3 天前的对话记录     (相似度 0.82)
  ├─ L1: 找到当天的摘要           (相似度 0.75)
  ├─ L2: 找到项目记忆 + 错误模式  (相似度 0.91) ← error_pattern boost +0.08
  └─ L3: 找到用户偏好"喜欢详细讨论" (context boost +0.06)
  
  → 综合 Top 5 结果返回
```

**评分维度（7 维融合）：**

| 维度 | 权重 | 说明 |
|:-----|-----:|:-----|
| 关键词匹配 | 30% | 精确词频匹配 |
| 语义相似度 | 25% | TF-IDF 向量余弦 |
| 时间新鲜度 | 20% | 非线性衰减（7天缓/30天中/90天快） |
| 重要性 | 15% | critical > important > temporary |
| 层级优先级 | 10% | L2 > L1 > L0 > L3 |
| 类型加成 | +8% | error_pattern / preference 等 |
| 上下文加成 | +25% | 与当前对话意图对齐 |

### 3. 主动记忆

MASEL 不只是被动记录，还会**主动提醒**你：

```
场景 1 — 周期模式触发:
  MASEL: "根据你的习惯，这个时段适合处理核心任务"

场景 2 — 未完成上下文:
  MASEL: "有个待办需要跟进：上次讨论到 X 没结论，要继续吗？"

场景 3 — 相关经验:
  MASEL: "这个 bug 上周也遇到过，要不要看之前的解决方案？"
```

### 4. 智能遗忘

记忆不是越多越好。MASEL 会自动管理记忆生命周期：

```
记忆生命周期:

  写入 ──→ 活跃 ──→ 冷却 ──→ 归档 ──→ 删除
   │        │        │        │
   │        │        │        └─ 90天无召回 + 非critical
   │        │        └─ 30天无访问
   │        └─ 7天内被召回 ≥ 2次
   │
   例外规则:
   ✦ critical      → 永久保留，永不衰减
   ✦ error_pattern → 永久保留，直到被更好的方案替代
   ✦ temporary     → 7天后自动过期
```

### 5. 去重合并

同样的信息被记录多次？MASEL 自动检测并合并：

```
记忆 A: "用户喜欢详细的设计讨论"  (confidence: 0.70)
记忆 B: "偏好：详细设计讨论"      (confidence: 0.85)
                                    TF-IDF 相似度: 0.92

→ 自动合并 (策略: keep_higher_confidence)
→ 保留 B，归档 A
→ 合并日志记录到 merge-log.jsonl
```

### 6. 多代理协作（ClawTeam 集成）

复杂任务自动拆分给专业代理：

```
任务: "做一个产品渲染海报并导出提案 PDF"

MASEL 路由:
  ├─ 智能路由 → local-creative-mcp-suite
  ├─ 工作流类型 → multi-app
  └─ 应用链:
       Step 1: Blender → 渲染产品 3D 图
       Step 2: GIMP   → 加文字/修图
       Step 3: Office → 导出最终 PDF 提案
```

### 7. 质量保障

代码相关的任务自动进入质量检查流程：

```
代码任务 → MASEL 工作流:
  1. 规划 (Planner)     → 拆分任务
  2. 执行 (Executor)    → 编写代码
  3. 质量检查 (QC)      → 自动代码检查 + 测试
  4. 审核 (Reviewer)    → 质量评分
  5. 学习 (Learner)     → 记录经验教训
```

---

## ⚙️ MASEL 怎么做

### 核心原理：四层记忆 + 自进化循环

MASEL 的工作方式可以用一个循环来概括：

```
                    ┌─────────────────────────────┐
                    │                             │
                    ▼                             │
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │  观 察    │→│  记 录    │→│  检 索    │→│  进 化    │
  │ Observe  │  │ Record   │  │ Retrieve │  │ Evolve   │
  └──────────┘  └──────────┘  └──────────┘  └──────────┘
       │              │              │              │
       │              │              │              │
  分析用户行为    四层记忆存储    7维评分融合    模式提取+
  检测信号类型    智能分类归档    上下文感知     错误学习+
  过滤噪音        去重合并        非线性衰减     生命周期管理
```

#### 第一步：观察（Observe）

每条用户消息进来时，`shouldRecord()` 自动判断：

```javascript
// active-memory.js 的判断逻辑
function shouldRecord(userMessage, aiResponse) {
  // 1. 纯闲聊？ → 跳过
  if (isCasual("你好")) return { shouldRecord: false };
  
  // 2. 偏好信号？ → 记录为 preference
  if (/喜欢|偏好|习惯/.test(msg))
    return { shouldRecord: true, type: 'preference' };
  
  // 3. 错误信号？ → 记录为 error_pattern（永久保留）
  if (/错误|bug|踩坑/.test(msg))
    return { shouldRecord: true, type: 'error_pattern' };
  
  // 4. 显式要求？ → 强制记录
  if (/记住|记下/.test(msg))
    return { shouldRecord: true, type: 'explicit' };
  
  // 5. 无信号？ → 跳过
  return { shouldRecord: false };
}
```

#### 第二步：记录（Record）

通过四层架构存储，每层有不同用途：

```
L0 原始层:  存完整对话 → 用作模式提取的数据源
              │
              ▼ (每天自动生成)
L1 摘要层:  提取当天关键决策和事件 → 快速回顾
              │
              ▼ (结构化存储)
L2 结构化层: 按 preference/project/fact/error_pattern 分类
              │             带重要性分级 (critical/important/temporary)
              │             自动去重合并
              ▼ (定期提取)
L3 模式层:  从历史数据中发现行为规律
              行为模式 / 决策模式 / 沟通模式 / 周期模式
              带置信度和频率追踪
```

#### 第三步：检索（Retrieve）

检索不是简单的关键词搜索，而是**7 维评分融合**：

```javascript
// retrieval-core.js 的评分流程
function scoreCandidate(candidate, query) {
  const scores = {
    keyword:   scoreKeyword(query, candidate),      // 关键词匹配
    semantic:  scoreSemantic(queryVector, candVec),  // 语义相似度
    recency:   scoreRecency(timestamp, layer),       // 非线性时间衰减
    importance: scoreImportance(importance),          // 重要性权重
    layerPrior: scoreLayerPrior(layer),               // 层级优先级
    typeBoost: computeTypeBoost(intent),              // 类型加成
    contextBoost: computeContextBoost(candidate, ctx) // 上下文感知 ← v2.0
  };
  
  return fuseScores(scores);  // 加权融合 → 最终分数
}
```

**上下文感知是怎么工作的：**

```
当前对话: "帮我改一下 MASEL 的记忆系统 bug"

buildQueryContext() 自动提取:
  ├─ 意图: coding (检测到 "改"/"bug")
  ├─ 实体: projects=["MASEL"], tools=["memory-system"]
  ├─ 活跃话题: ["记忆", "bug"]
  └─ 时间: hour=22, isWeekend=false

computeContextBoost() 计算:
  ├─ 实体匹配: +0.06 (内容包含 "MASEL")
  ├─ 工具匹配: +0.05 (内容包含 "memory-system")
  ├─ 意图对齐: +0.08 (coding + error_pattern)
  └─ 召回频率: +0.04 (这个记忆之前被召回过 3 次)
  
  总 boost: +0.23
```

#### 第四步：进化（Evolve）

系统通过三个机制持续进化：

**1. 模式提取（Pattern Extraction）**

```
extractAll() 定期运行:
  输入: 最近 15 天的对话 + 结构化记忆
    │
    ├─ extractTimeActivity()     → "用户活跃时段集中在 6:00-11:00"
    ├─ extractTaskStyle()        → "用户偏好先充分讨论再动手执行"
    ├─ extractPreferenceSignals()→ "偏好：详细设计讨论"
    ├─ extractCommunicationStyle()→ "用户倾向于发送较长消息"
    └─ extractRecurringTopics()  → "'记忆系统' 在 5 天中被讨论 23 次"
    
  增量机制: MD5 hash 比较文件，未修改的自动跳过
  置信度: 每次新证据增加 0.08~0.15，上限 0.95
```

**2. 错误学习（Error Learning）**

```
场景: 遇到一个 bug

第一次:
  用户: "GIMP 白色填充报错"
  MASEL: 记录 error_pattern:
    { scenario: "GIMP白色填充",
      error: "用 WHITE-IMAGE-FILL (0x00)",
      correct: "应该用 0xFF",
      importance: "critical" }  ← 永久保留
  
以后每次涉及 GIMP 图像处理:
  MASEL 自动检索到这个 error_pattern
  在执行前主动提醒: "注意：白色填充用 0xFF 而不是 0x00"
```

**3. 生命周期管理（Lifecycle Management）**

```
定期运行 runForgetting():
  扫描所有记忆 → 评估生命周期状态
    │
    ├─ critical/error_pattern → permanent (永不删除)
    ├─ active + 最近被召回   → keep
    ├─ 30天无更新           → cooling (monitor)
    ├─ 90天无更新 + 非critical → cold (consider_archive)
    └─ temporary + 7天过期  → expired (delete)
    
  输出报告: { scanned: 25, archived: 2, deleted: 1, kept: 22 }
```

### 技术实现细节

#### 数据流全景

```
用户输入
  │
  ├─→ shouldRecord() ─── 判断是否记录
  │     │
  │     ├ YES → storeStructuredMemory() ──→ memory/structured/{type}/{id}.json
  │     │                                      │
  │     │                                      ├─→ 索引更新 (vector-index-store)
  │     │                                      └─→ 图谱更新 (graph-store)
  │     │
  │     └ NO  → 跳过
  │
  ├─→ retrieve() ─────── 检索相关记忆
  │     │
  │     ├─ collectCandidates() ── 四层并行收集
  │     │     ├─ L0: raw-conversations/*.jsonl
  │     │     ├─ L1: daily-summaries/ + daily-checks/
  │     │     ├─ L2: structured/**/*.json
  │     │     └─ L3: patterns/*.json
  │     │
  │     ├─ scoreCandidate() ──── 7维评分融合
  │     │     ├─ keyword + semantic + recency + importance
  │     │     ├─ layerPrior + typeBoost + contextBoost
  │     │     └─ fuseScores() → 最终分数
  │     │
  │     └─ applyLayerBalancing() → 每层限制数量 → Top-K 结果
  │
  ├─→ extractAll() ────── 定期模式提取
  │     ├─ MD5 hash 增量检测
  │     ├─ 5 个独立提取器
  │     └─ mergePatternUpdates() → 增量更新已有模式
  │
  └─→ runDeduplication() ── 定期去重
        ├─ TF-IDF 余弦相似度扫描
        ├─ 阈值 0.85 以上标记为重复
        └─ 3 种合并策略自动执行
```

#### 存储架构

```
┌─────────────────────────────────────────────────┐
│                  存储层                           │
│                                                   │
│  ┌─────────────────┐  ┌─────────────────────┐   │
│  │  文件系统         │  │  SQLite (WAL 模式)    │   │
│  │                  │  │                       │   │
│  │  memory/         │  │  memory.db            │   │
│  │  ├── structured/ │  │  ├── memory 表        │   │
│  │  │   ├── preference/ │  ├── patterns 表     │   │
│  │  │   ├── project/    │  ├── graph_nodes 表  │   │
│  │  │   ├── fact/       │  ├── graph_edges 表  │   │
│  │  │   └── error_pattern/ │  └── memory_merges │  │
│  │  ├── patterns/   │  │                       │   │
│  │  ├── raw-conversations/ │  共享连接 (db.js) │   │
│  │  ├── archive/    │  │  getDB() → 单例      │   │
│  │  └── graph/      │  │                       │   │
│  └─────────────────┘  └─────────────────────┘   │
│                                                   │
│  ┌─────────────────┐  ┌─────────────────────┐   │
│  │  向量索引         │  │  缓存层               │   │
│  │                  │  │                       │   │
│  │  .memory-index/  │  │  文件读缓存 (60s TTL) │   │
│  │  vector-index.json│  │  mtime 检测自动失效   │   │
│  │  TF-IDF 轻量向量  │  │  上限 500 条          │   │
│  └─────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MASEL v2.0.0 Architecture                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  OpenClaw     │  │  CLI / API   │  │  ClawTeam Multi-Agent    │  │
│  │  Integration  │  │  Interface   │  │  Coordination Layer      │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘  │
│         │                 │                      │                  │
│         └────────┬────────┘──────────────────────┘                  │
│                  ▼                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    MASEL Router & Agents                      │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐  │  │
│  │  │ Planner │ │ Executor │ │ Reviewer  │ │ Quality Checker│  │  │
│  │  └─────────┘ └──────────┘ └───────────┘ └────────────────┘  │  │
│  └────────────────────────────┬─────────────────────────────────┘  │
│                               │                                      │
│                               ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Ultimate Memory System v2.0                  │  │
│  │                                                                │  │
│  │  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │  │
│  │  │ L0 Raw  │  │ L1 Summ  │  │ L2 Struct │  │ L3 Pattern   │  │  │
│  │  │ 90 days │  │ 365 days │  │ Graded    │  │ Behavioral   │  │  │
│  │  └─────────┘  └──────────┘  └───────────┘  └──────────────┘  │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌───────────────┐  ┌───────────────────┐  │  │
│  │  │ Smart        │  │ Context-Aware │  │ Active Memory     │  │  │
│  │  │ Retrieval    │  │ Scoring       │  │ Engine            │  │  │
│  │  └──────────────┘  └───────────────┘  └───────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ SQLite Store │  │ File System  │  │ Knowledge Graph          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 记忆系统 v2.0

### 四层记忆架构

```
         记忆层级                    保留策略              内容类型
    ┌──────────────┐
    │    L3 模式层   │ ← NEW!         持久化               行为模式
    │  Pattern      │                (confidence-based)   决策偏好
    │  Extractor    │                                     沟通风格
    └──────────────┘                                     周期规律
           ▲
    ┌──────────────┐
    │  L2 结构化层   │                分级保留              项目记忆
    │  Structured   │                critical: 永久       用户偏好
    │  Memory       │                important: 90天      事实知识
    └──────────────┘                temporary: 7天       错误模式
           ▲
    ┌──────────────┐
    │  L1 摘要层     │                365 天               每日摘要
    │  Daily        │                                     关键决策
    │  Summaries    │                                     项目进展
    └──────────────┘
           ▲
    ┌──────────────┐
    │  L0 原始层     │                90 天 / 1万条        完整对话
    │  Raw          │                                     交互记录
    │  Conversations│
    └──────────────┘
```

### 检索评分流程

```
查询输入
  │
  ▼
┌─────────────────────┐
│  1. 上下文构建        │  实体提取 + 意图检测 + 活跃话题
│  buildQueryContext   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  2. 候选收集          │  L0/L1/L2/L3 四层并行收集
│  collectCandidates   │  (带 60s 文件缓存)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  3. 多维评分          │
│  scoreCandidate      │
│  ├─ 关键词匹配  (w=0.30)  │
│  ├─ 语义相似度  (w=0.25)  │
│  ├─ 新鲜度衰减  (w=0.20)  │  ← 非线性 3 段式
│  ├─ 重要性权重  (w=0.15)  │
│  ├─ 层级优先级  (w=0.10)  │
│  ├─ 类型加成   (+0.08)    │
│  └─ 上下文加成  (+0.25)    │  ← NEW!
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  4. 层级平衡 + 去重   │  每层最多 N 条，跨层去重
│  applyLayerBalancing │
└─────────┬───────────┘
          │
          ▼
      排序结果 Top-K
```

### 非线性衰减曲线

```
分数 1.0 ████████████████████████████████████████ critical/error_pattern
     │
 0.9 ████████████████████████████
     │                           ╲
 0.8 ████████████████████████      ╲
     │                               ╲
 0.7 ████████████████████████          ╲
     │                                    ╲
 0.6 ████████████████████████               ╲
     │                                        ╲
 0.5 ████████████████████████                    ╲
     │                                              ╲
 0.3 ████████████████████████                         ╲
     │                                                   ╲
 0.0 ─────────────────────────────────────────────────────╲──
     0    7天    14天    30天    60天    90天    180天    365天

     ├─ 段1: 缓衰减 (0.01/天) ─┤
                               ├─ 段2: 中速 (0.015/天) ──────┤
                                                              ├─ 段3: 快速 (0.025/天) ──────┤
```

### 主动记忆引擎

```
用户消息 → AI 回复
     │
     ▼
┌──────────────────────────────────┐
│        shouldRecord()?           │
│                                  │
│  ❌ 闲聊 / 短消息 / 系统命令      │──── 跳过
│  ✅ 偏好 / 决策 / 错误 / 项目    │──── 记录
│  ✅ 显式要求 "记住这个"          │──── 强制记录
│  ⚠️  长消息 (>50字)              │──── 低优先级记录
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│         记忆生命周期              │
│                                  │
│  写入 → 活跃 → 冷却 → 归档 → 删除 │
│                                  │
│  temporary:  7 天过期            │
│  important:  90 天无更新考虑降级  │
│  critical:   永久保留            │
│  error_pattern: 永久保留         │
└──────────────────────────────────┘
```

---

## 🔧 核心模块详解

### 记忆系统模块

| 模块 | 行数 | 职责 |
|:-----|-----:|:-----|
| `ultimate-memory.js` | 640 | 主入口，L0-L3 统一 API |
| `pattern-extractor.js` | 606 | L3 模式提取 (行为/决策/沟通/周期) |
| `retrieval-core.js` | 429 | 检索核心 (候选收集→评分→排序) |
| `active-memory.js` | 444 | 主动记忆引擎 (记录/遗忘/提醒) |
| `retrieval-sources.js` | 266 | 四层数据源收集 (带文件缓存) |
| `retrieval-context.js` | 233 | 上下文感知 (实体/意图/频率) |
| `memory-dedup.js` | 342 | 去重合并 (TF-IDF + 多策略) |
| `graph-store.js` | 291 | 知识图谱 (实体-关系) |
| `retrieval-fusion.js` | 113 | 评分融合 + 非线性衰减 |
| `vector-index-store.js` | 99 | 轻量向量索引 |
| `db.js` | 42 | 共享 SQLite 连接 (WAL 单例) |
| `memory-fs.js` | 56 | 共享文件操作 (ensureDir) |

### MASEL 核心模块

| 模块 | 行数 | 职责 |
|:-----|-----:|:-----|
| `masel-wrapper.js` | ~500 | 统一 API 入口 |
| `src/core/router.js` | ~200 | 任务路由 (自动判断工作流) |
| `src/core/agents.js` | ~150 | 代理管理 (规划/执行/审核) |
| `src/core/workflows.js` | ~300 | 工作流引擎 |
| `src/tools/cli-anything.js` | ~400 | CLI-Anything 桌面应用驱动 |
| `src/tools/quality-checker.ts` | ~300 | 质量保障 (代码检查/测试) |
| `src/tools/clawteam-bridge.js` | ~350 | ClawTeam 多代理协调桥接 |

---

## 🚀 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/tvtongg/MASEL.git
cd MASEL/masel_v2.0.0

# 安装依赖
npm install
```

### 基础使用

```javascript
const { masel, initAutoMemory, autoRecord, autoRecall } = require('./skills/masel/masel-wrapper');

// 1. MASEL 完整工作流（复杂任务）
await masel.complete('构建 Web 爬虫');

// 2. 静默执行
await masel.silent('分析代码库');

// 3. 自动判断是否需要 MASEL
await masel.auto('写个 Python 脚本');
```

### 记忆系统使用

```javascript
const memory = require('./utils/memory-system/ultimate-memory');

// 初始化
memory.initialize();

// ─── 基础操作 ───

// 记录对话
memory.storeRawConversation('session-1', '用户消息', 'AI回复');

// 存储结构化记忆
memory.storeStructuredMemory('preference', '用户喜欢详细的设计讨论', {
  importance: 'important'
});

// 搜索记忆
const results = await memory.searchMemories('设计讨论');

// ─── v2.0 新功能 ───

// L3 模式提取
const patterns = memory.runPatternExtraction();
console.log(patterns);
// { new: 3, updated: 2, total: 10, patterns: [...] }

// 获取活跃模式
const active = memory.getPatterns({ type: 'behavioral', minConfidence: 0.5 });

// 去重扫描
const dedup = memory.runDeduplication({ dryRun: true, threshold: 0.85 });
console.log(dedup);
// { duplicatesFound: 5, pairs: [...] }

// 执行去重
memory.runDeduplication({ dryRun: false, autoMerge: true });

// 智能遗忘
const report = memory.runForgetting({ dryRun: true });
console.log(report);
// { scanned: 25, archived: 2, deleted: 1, kept: 22 }

// 主动提醒
const reminders = memory.getProactiveReminders({ currentTopic: 'MASEL' });

// 智能记录判断
const decision = memory.checkShouldRecord('我喜欢详细的设计讨论', '好的！');
console.log(decision);
// { shouldRecord: true, type: 'preference', confidence: 0.85 }
```

### ClawTeam 多代理协调

```javascript
const { routeToLocalCreativeSuite } = require('./skills/masel/masel-wrapper');

// 智能路由
const route = await routeToLocalCreativeSuite('做一个产品渲染海报并导出提案 PDF');
console.log(route);
// { suite: 'local-creative-mcp-suite', workflowType: 'multi-app', 
//   apps: ['gimp', 'blender', 'libreoffice'] }

// 团队模板
// fullstack-web / data-analysis / code-review
```

---

## 📚 API 参考

### Ultimate Memory API

| 方法 | 层级 | 描述 |
|:-----|:-----|:-----|
| `storeRawConversation(session, user, ai)` | L0 | 存储原始对话 |
| `generateDailySummary()` | L1 | 生成每日摘要 |
| `storeStructuredMemory(type, content, opts)` | L2 | 存储结构化记忆 |
| `loadAllStructuredMemories()` | L2 | 加载所有结构化记忆 |
| `searchMemories(query)` | 全层 | 搜索记忆 |
| `runPatternExtraction()` | L3 | 提取行为模式 |
| `getPatterns(options)` | L3 | 获取活跃模式 |
| `runDeduplication(options)` | L2 | 执行去重合并 |
| `checkShouldRecord(user, ai)` | 引擎 | 判断是否记录 |
| `runForgetting(options)` | 引擎 | 智能遗忘 |
| `getProactiveReminders(ctx)` | 引擎 | 获取主动提醒 |
| `recordErrorPattern(info)` | L2 | 记录错误模式 |

### 模式类型

| 类型 | 提取器 | 最小证据 | 置信度增长 |
|:-----|:-------|:---------|:-----------|
| `behavioral` | timeActivity, taskStyle, toolUsage | 2 | +0.15 |
| `decision` | preferenceSignals, tradeoffPatterns | 2 | +0.12 |
| `communication` | responseLength, topicDepth | 3 | +0.10 |
| `cyclical` | weeklyRhythm, dailyPeaks, recurringTopics | 3 | +0.08 |

### 去重合并策略

| 策略 | 触发条件 | 行为 |
|:-----|:---------|:-----|
| `keep_higher_confidence` | 置信度差 > 0.3 | 保留高置信度 |
| `keep_newer` | 时间差 > 7 天 | 保留较新的 |
| `merge_content` | 默认 | 合并不重复内容 |

---

## 📊 性能优化

### 文件级读缓存

```
                    缓存前                          缓存后 (60s TTL)
            ┌───────────────┐                ┌───────────────┐
retrieve()  │ fs.readFileSync│  ×5 files      │ cachedReadFile │
    │       │ fs.statSync    │  ×3 files      │ mtime 检测     │
    │       │ 每次都读磁盘    │                │ 命中 → 内存    │
    └───────└───────────────┘                └───────────────┘
```

### 增量模式提取

```
                    全量 (v1.x)                    增量 (v2.0)
            ┌───────────────┐                ┌───────────────┐
extract()   │ 读全部 30 天    │                │ MD5 hash 比较  │
    │       │ 逐行解析       │                │ 未修改 → 跳过   │
    │       │ ~200ms         │                │ ~5ms (3文件未改)│
    └───────└───────────────┘                └───────────────┘
```

### 共享 DB 连接

```
    Before (3 connections)           After (1 singleton)
    ┌──────────┐                     ┌──────────┐
    │ graph    │── new Database()    │          │
    │ store    │                     │  db.js   │── getDB()
    ├──────────┤                     │ (WAL)    │
    │ pattern  │── new Database()    │          │
    │ extractor│                     │  单例连接  │
    ├──────────┤                     │  自动复用  │
    │ sqlite   │── new Database()    │          │
    │ adapter  │                     └──────────┘
    └──────────┘
```

---

## 📂 项目结构

```
masel_v2.0.0/
├── README.md                          ← 你正在读的这个文件
├── package.json
│
├── skills/
│   └── masel/                         # MASEL 核心
│       ├── SKILL.md                   # OpenClaw 技能定义
│       ├── masel-wrapper.js           # 统一 API 入口
│       ├── masel-cli.sh              # CLI 脚本
│       ├── setup.sh                  # 安装脚本
│       ├── openclaw.plugin.json      # OpenClaw 插件配置
│       │
│       ├── src/
│       │   ├── core/                 # 核心引擎
│       │   │   ├── router.js         #   任务路由
│       │   │   ├── agents.js         #   代理管理
│       │   │   └── workflows.js      #   工作流引擎
│       │   │
│       │   └── tools/                # 工具集
│       │       ├── cli-anything.js   #   桌面应用驱动
│       │       ├── quality-checker.ts#   质量保障
│       │       ├── clawteam-bridge.js#   多代理桥接
│       │       └── ...               #   其他 ClawTeam 工具
│       │
│       ├── souls/                    # 代理灵魂
│       │   ├── coder/soul.md
│       │   ├── researcher/soul.md
│       │   └── reviewer/soul.md
│       │
│       ├── memory/viking/patterns/   # Viking 记忆模式
│       ├── scripts/                  # 辅助脚本
│       └── test-*.js                 # 测试文件
│
├── utils/
│   ├── memory-system/                # 记忆系统 v2.0
│   │   ├── ultimate-memory.js        #   主入口 (22 个 API)
│   │   ├── pattern-extractor.js      #   L3 模式提取器
│   │   ├── active-memory.js          #   主动记忆引擎
│   │   ├── retrieval-core.js         #   检索核心
│   │   ├── retrieval-context.js      #   上下文感知
│   │   ├── retrieval-fusion.js       #   评分融合 + 衰减
│   │   ├── retrieval-sources.js      #   数据源 (带缓存)
│   │   ├── retrieval-config.js       #   检索配置
│   │   ├── retrieval-dedupe.js       #   检索去重
│   │   ├── memory-dedup.js           #   记忆去重合并
│   │   ├── memory-fs.js              #   共享文件操作
│   │   ├── db.js                     #   共享 DB 连接
│   │   ├── graph-store.js            #   知识图谱
│   │   ├── vector-index-store.js     #   向量索引
│   │   ├── masel-adapter.js          #   MASEL 适配器
│   │   ├── importance-manager.js     #   重要性管理
│   │   ├── schema.sql                #   DB Schema
│   │   └── migrate.js                #   迁移工具
│   │
│   ├── ultimate-memory.js            # 兼容入口
│   ├── sqlite-adapter.js             # SQLite 工具
│   ├── error-handler.js              # 错误处理
│   └── test-framework.js             # 测试框架
│
├── bin/
│   └── openclaw.js                   # CLI 入口
│
├── config/
│   └── index.js                      # 配置管理
│
└── docs/                             # 文档
```

---

## 🗓 版本历史

```
v2.0.0 ─── 2026-04-01 ─ Memory System Evolution
│  ├── Phase 1: L3 模式提取 + 去重合并
│  ├── Phase 2: 非线性衰减 + 上下文感知检索
│  ├── Phase 3: 主动记忆引擎 (记录/遗忘/提醒)
│  └── 代码质量: 共享 DB + ensureDir + 缓存
│
v1.9.1 ─── 2026-03-31 ─ Unified Memory + Modular Agents
│  ├── SQLite 统一记忆
│  ├── router/agents/workflows 模块化拆分
│  └── ClawTeam 多代理集成
│
v1.6.0 ─── 2026-03-30 ─ Quality Assurance
│  ├── 质量保障工作流
│  └── 自动代码检查 + 测试 + 验证
│
v1.5.0 ─── 2026-03-29 ─ CLI-Anything
│  ├── GIMP / Blender / LibreOffice 驱动
│  └── 智能路由
│
v1.4.0 ─── 2026-03-28 ─ Auto Memory
│  ├── AI 自动记住用户偏好
│  └── 自适应学习
│
v1.3.0 ─── 2026-03-28 ─ Viking Lite
│  └── 简单任务也能使用记忆系统
│
v1.2.0 ─── 2026-03-27 ─ Smart Cleanup
│  ├── 自动清理 + 失败恢复
│  └── 分级保留策略
│
v1.0.0 ─── 2026-03-24 ─ Initial Release
   ├── 6 个核心工具
   ├── Viking 三层记忆
   └── 9 个框架融合
```

---

## 📈 统计数据

```
代码量          ~10,800 行 JavaScript/TypeScript
记忆系统模块    24 个 .js 文件
MASEL 模块      53 个文件
API 方法        22 个导出函数
测试文件        12 个
模式提取器      5 个独立提取器
检索维度        7 个评分维度
```

---

## 👥 合作者

| 角色 | 名字 | 职责 |
|:-----|:-----|:-----|
| 🧑‍💻 用户 & 架构设计 | **TvTongg** | 需求定义、架构评审、质量把关 |
| 🤖 AI 开发伙伴 | **TwTongg** | 代码实现、文档编写、测试验证 |

---

## 📄 许可证

MIT License

---

<div align="center">

**MASEL v2.0.0 — 让 AI 从错误中学习，在记忆中成长** 🧠

*Built with ❤️ by TvTongg & TwTongg*

</div>
