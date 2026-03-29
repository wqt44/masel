#!/usr/bin/env node
/**
 * 将我们的工作模式存入 MASEL-Viking
 */

const fs = require('fs');
const path = require('path');

// 模拟 Viking 存储
const vikingDir = path.join(__dirname, 'memory', 'viking', 'patterns');

// 确保目录存在
if (!fs.existsSync(vikingDir)) {
  fs.mkdirSync(vikingDir, { recursive: true });
}

// 工作模式记录
const workPatterns = [
  {
    pattern_id: "pattern-dev-workflow-001",
    name: "项目开发流程",
    description: "需求→设计→实现→测试→文档的完整流程",
    trigger_conditions: [
      "用户提出新项目",
      "需要从零开始构建",
      "复杂任务需要规划"
    ],
    workflow: [
      "讨论设计",
      "逐步实现 (MVP→增强→完善)",
      "测试验证",
      "文档完善"
    ],
    success_rate: 1.0,
    usage_count: 1,
    created_at: "2026-03-26",
    effectiveness: "high"
  },
  {
    pattern_id: "pattern-framework-fusion-001",
    name: "多框架融合设计",
    description: "研究多个方案，提取优点，融合创新",
    trigger_conditions: [
      "设计新系统",
      "需要参考现有方案",
      "追求创新"
    ],
    workflow: [
      "研究现有方案（至少3-5个）",
      "对比分析优缺点",
      "融合设计（不是复制）",
      "实现创新"
    ],
    success_rate: 1.0,
    usage_count: 1,
    created_at: "2026-03-26",
    effectiveness: "high"
  },
  {
    pattern_id: "pattern-user-collaboration-001",
    name: "用户协作模式",
    description: "充分沟通，共同决策，透明执行",
    trigger_conditions: [
      "与用户合作",
      "需要理解用户意图",
      "复杂任务"
    ],
    workflow: [
      "充分理解用户意图",
      "主动提出方案",
      "保持沟通",
      "让用户参与决策"
    ],
    success_rate: 1.0,
    usage_count: 1,
    created_at: "2026-03-26",
    effectiveness: "high"
  }
];

// 用户偏好记录
const userPreferences = {
  user_id: "TvTongg",
  preferences: {
    work_style: {
      likes_detailed_discussion: true,
      likes_phased_implementation: true,
      likes_progress_visibility: true,
      likes_innovative_solutions: true,
      likes_complete_documentation: true
    },
    efficiency: "high",
    quality_focus: true,
    collaboration_style: "充分沟通，共同决策"
  },
  successful_patterns: [
    "pattern-dev-workflow-001",
    "pattern-framework-fusion-001",
    "pattern-user-collaboration-001"
  ],
  updated_at: "2026-03-26"
};

// 保存到文件
console.log("🧠 Saving work patterns to MASEL-Viking...\n");

workPatterns.forEach(pattern => {
  const filePath = path.join(vikingDir, `${pattern.pattern_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(pattern, null, 2));
  console.log(`  ✅ Saved: ${pattern.name}`);
});

// 保存用户偏好
const userPrefPath = path.join(vikingDir, 'user-TvTongg-preferences.json');
fs.writeFileSync(userPrefPath, JSON.stringify(userPreferences, null, 2));
console.log(`  ✅ Saved: User preferences for TvTongg`);

console.log("\n📊 Summary:");
console.log(`  Patterns stored: ${workPatterns.length}`);
console.log(`  User preferences: 1`);
console.log(`  Location: ${vikingDir}`);

console.log("\n✨ These patterns will be used for future tasks!");
console.log("   MASEL will automatically apply what we learned today.");
