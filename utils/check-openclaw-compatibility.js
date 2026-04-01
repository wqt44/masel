#!/usr/bin/env node
/**
 * OpenClaw v2026.3.28 兼容性检查
 * 
 * 检查所有 Skills 与新版 OpenClaw 的兼容性
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const OPENCLAW_CONFIG = path.join(process.env.HOME, '.openclaw', 'openclaw.json');

console.log('🔍 OpenClaw v2026.3.28 兼容性检查\\n');
console.log('=' .repeat(50));

// 1. 检查 OpenClaw 版本
console.log('\\n📋 1. OpenClaw 配置检查');
try {
  const config = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf8'));
  console.log('   ✅ 配置文件存在');
  console.log(`   版本: ${config.meta?.lastTouchedVersion || 'unknown'}`);
  
  // 检查关键配置
  if (config.skills?.autoApprove) {
    console.log('   ✅ Skills 自动审批已启用');
  } else {
    console.log('   ⚠️  Skills 自动审批未启用（建议启用）');
  }
  
  if (config.tools?.approval?.mode === 'auto') {
    console.log('   ✅ 工具自动审批模式');
  }
} catch (e) {
  console.error('   ❌ 无法读取配置文件:', e.message);
}

// 2. 检查 Skills
console.log('\\n📦 2. Skills 兼容性检查');
const skills = fs.readdirSync(SKILLS_DIR).filter(f => {
  return fs.statSync(path.join(SKILLS_DIR, f)).isDirectory();
});

const compatibilityResults = {
  compatible: [],
  warning: [],
  error: []
};

for (const skill of skills) {
  const skillDir = path.join(SKILLS_DIR, skill);
  const skillFiles = fs.readdirSync(skillDir);
  
  // 检查 SKILL.md
  const hasSkillMd = skillFiles.includes('SKILL.md');
  
  // 检查 package.json 或主入口
  const hasPackageJson = skillFiles.includes('package.json');
  const hasMainJs = skillFiles.some(f => f.endsWith('.js'));
  
  // 检查是否有弃用引用
  const jsFiles = skillFiles.filter(f => f.endsWith('.js'));
  let hasDeprecatedRefs = false;
  let deprecatedRefs = [];
  
  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.join(skillDir, jsFile), 'utf8');
    
    // 检查弃用的引用
    if (content.includes('qwen-portal-auth')) {
      hasDeprecatedRefs = true;
      deprecatedRefs.push('qwen-portal-auth');
    }
    if (content.includes('miniMax') || content.includes('MiniMax')) {
      // MiniMax 仍然支持，只是模型变了
    }
  }
  
  // 评估兼容性
  if (hasDeprecatedRefs) {
    compatibilityResults.error.push({
      name: skill,
      reason: `包含弃用引用: ${deprecatedRefs.join(', ')}`
    });
  } else if (!hasSkillMd) {
    compatibilityResults.warning.push({
      name: skill,
      reason: '缺少 SKILL.md 文档'
    });
  } else {
    compatibilityResults.compatible.push({
      name: skill,
      features: hasPackageJson ? ['npm', 'package.json'] : ['standalone']
    });
  }
}

// 输出结果
console.log(`\\n   完全兼容 (${compatibilityResults.compatible.length}):`);
for (const s of compatibilityResults.compatible) {
  console.log(`   ✅ ${s.name}`);
}

if (compatibilityResults.warning.length > 0) {
  console.log(`\\n   警告 (${compatibilityResults.warning.length}):`);
  for (const s of compatibilityResults.warning) {
    console.log(`   ⚠️  ${s.name}: ${s.reason}`);
  }
}

if (compatibilityResults.error.length > 0) {
  console.log(`\\n   错误 (${compatibilityResults.error.length}):`);
  for (const s of compatibilityResults.error) {
    console.log(`   ❌ ${s.name}: ${s.reason}`);
  }
} else {
  console.log('\\n   无错误 - 所有 Skills 兼容!');
}

// 3. 检查特定功能
console.log('\\n🔧 3. 特定功能检查');

// 检查 MASEL
const maselDir = path.join(SKILLS_DIR, 'masel');
if (fs.existsSync(maselDir)) {
  const maselWrapper = fs.readFileSync(path.join(maselDir, 'masel-wrapper.js'), 'utf8');
  if (maselWrapper.includes('OPENCLAW_CONFIG')) {
    console.log('   ✅ MASEL 已配置 OpenClaw 兼容性');
  }
  if (maselWrapper.includes('autoApprove')) {
    console.log('   ✅ MASEL 已启用自动审批');
  }
}

// 检查 Blender MCP
const blenderMcpDir = path.join(SKILLS_DIR, 'blender-mcp');
if (fs.existsSync(blenderMcpDir)) {
  console.log('   ✅ Blender MCP 存在');
  const blenderMcpJs = fs.readFileSync(path.join(blenderMcpDir, 'blender-mcp.js'), 'utf8');
  if (blenderMcpJs.includes('loadConfig')) {
    console.log('   ✅ Blender MCP 支持配置加载');
  }
}

// 4. 总结
console.log('\\n' + '='.repeat(50));
console.log('📊 兼容性总结');
console.log('='.repeat(50));

const total = skills.length;
const compatible = compatibilityResults.compatible.length;
const warnings = compatibilityResults.warning.length;
const errors = compatibilityResults.error.length;

console.log(`\\n   总 Skills: ${total}`);
console.log(`   完全兼容: ${compatible} (${Math.round(compatible/total*100)}%)`);
console.log(`   警告: ${warnings}`);
console.log(`   错误: ${errors}`);

if (errors === 0) {
  console.log('\\n   🎉 所有 Skills 与 OpenClaw v2026.3.28 兼容！');
  console.log('   可以安全升级。');
} else {
  console.log('\\n   ⚠️  存在兼容性问题，请修复后再升级。');
}

console.log('\\n💡 建议操作：');
console.log('   1. 备份配置: cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup');
console.log('   2. 升级 OpenClaw: npm update -g openclaw');
console.log('   3. 运行检查: openclaw doctor');
console.log('   4. 测试 Skills: openclaw skills list');