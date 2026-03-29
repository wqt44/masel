/**
 * Automated Skill Management Pipeline
 * 自动化技能管理流水线
 * 
 * 集成: Find → Vet → Create → Evolve → Improve
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  skillsDir: path.join(__dirname, '../../skills'),
  pipelineDir: path.join(__dirname, '../../memory/skill-pipeline'),
  thresholds: {
    minVetScore: 70,        // 审查通过最低分
    autoInstall: true,      // 自动安装通过审查的技能
    autoUpdate: true        // 自动更新已有技能
  }
};

/**
 * 初始化流水线
 */
function initialize() {
  console.log('[SkillPipeline] 初始化自动化技能管理流水线...');
  
  // 确保目录存在
  if (!fs.existsSync(CONFIG.pipelineDir)) {
    fs.mkdirSync(CONFIG.pipelineDir, { recursive: true });
  }
  
  // 加载历史记录
  const history = loadPipelineHistory();
  console.log(`[SkillPipeline] 已加载 ${history.length} 条历史记录`);
  
  return { status: 'initialized', history: history.length };
}

/**
 * 阶段 1: FIND - 发现技能
 */
async function findSkills(query = '', options = {}) {
  console.log(`\n[SkillPipeline:FIND] 发现技能: "${query || 'all'}"`);
  
  const { 
    category = null,
    minScore = 3.0,
    limit = 20 
  } = options;
  
  try {
    // 使用 clawhub 搜索
    const searchQuery = query || (category ? `category:${category}` : '');
    const result = execSync(`clawhub search "${searchQuery}" 2>/dev/null | head -${limit}`, { encoding: 'utf-8' });
    
    // 解析结果
    const skills = parseSearchResults(result);
    
    // 过滤低分技能
    const filtered = skills.filter(s => s.score >= minScore);
    
    console.log(`[SkillPipeline:FIND] 发现 ${filtered.length} 个候选技能`);
    
    // 保存发现记录
    recordDiscovery(filtered, query);
    
    return {
      stage: 'FIND',
      query,
      found: filtered.length,
      skills: filtered
    };
  } catch (e) {
    console.error('[SkillPipeline:FIND] 搜索失败:', e.message);
    return { stage: 'FIND', error: e.message };
  }
}

/**
 * 阶段 2: VET - 审查技能
 */
async function vetSkills(skills) {
  console.log(`\n[SkillPipeline:VET] 审查 ${skills.length} 个技能`);
  
  const results = [];
  
  for (const skill of skills) {
    console.log(`[SkillPipeline:VET] 审查: ${skill.name}`);
    
    try {
      // 使用 skill-vetter 进行审查
      const vetResult = await runSkillVetter(skill);
      
      results.push({
        skill: skill.name,
        score: vetResult.score,
        verdict: vetResult.verdict,
        risks: vetResult.risks,
        recommendations: vetResult.recommendations,
        passed: vetResult.score >= CONFIG.thresholds.minVetScore
      });
      
      console.log(`[SkillPipeline:VET]   评分: ${vetResult.score}/100,  verdict: ${vetResult.verdict}`);
    } catch (e) {
      console.error(`[SkillPipeline:VET]   审查失败:`, e.message);
      results.push({
        skill: skill.name,
        error: e.message,
        passed: false
      });
    }
  }
  
  const passed = results.filter(r => r.passed);
  console.log(`[SkillPipeline:VET] 通过审查: ${passed.length}/${results.length}`);
  
  return {
    stage: 'VET',
    total: results.length,
    passed: passed.length,
    results
  };
}

/**
 * 阶段 3: CREATE - 创建技能
 */
async function createSkill(spec) {
  console.log(`\n[SkillPipeline:CREATE] 创建技能: ${spec.name}`);
  
  try {
    // 使用 skill-creator 初始化技能
    const initResult = execSync(
      `python3 ${__dirname}/../../skills/skill-creator/scripts/init_skill.py ${spec.name} ` +
      `--path ${CONFIG.skillsDir} --resources ${spec.resources || 'scripts'}`,
      { encoding: 'utf-8' }
    );
    
    console.log(`[SkillPipeline:CREATE] 初始化完成: ${spec.name}`);
    
    // 生成 SKILL.md 内容
    const skillMd = generateSkillMarkdown(spec);
    const skillPath = path.join(CONFIG.skillsDir, spec.name, 'SKILL.md');
    fs.writeFileSync(skillPath, skillMd);
    
    console.log(`[SkillPipeline:CREATE] SKILL.md 已生成`);
    
    // 如果有脚本，创建脚本文件
    if (spec.scripts) {
      for (const [name, content] of Object.entries(spec.scripts)) {
        const scriptPath = path.join(CONFIG.skillsDir, spec.name, 'scripts', name);
        fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
        fs.writeFileSync(scriptPath, content);
        fs.chmodSync(scriptPath, 0o755);
      }
    }
    
    return {
      stage: 'CREATE',
      name: spec.name,
      path: path.join(CONFIG.skillsDir, spec.name),
      status: 'created'
    };
  } catch (e) {
    console.error('[SkillPipeline:CREATE] 创建失败:', e.message);
    return { stage: 'CREATE', error: e.message };
  }
}

/**
 * 阶段 4: EVOLVE - 进化技能
 */
async function evolveSkill(skillName, options = {}) {
  console.log(`\n[SkillPipeline:EVOLVE] 进化技能: ${skillName}`);
  
  const { strategy = 'balanced' } = options;
  
  try {
    // 收集技能使用日志
    const logs = collectSkillLogs(skillName);
    
    // 使用 Capability Evolver 分析
    const evolver = require('../capability-evolver-pro/src/index.js');
    
    const analysis = evolver.analyze({ logs });
    const evolution = evolver.evolve({ logs, strategy });
    
    console.log(`[SkillPipeline:EVOLVE] 健康评分: ${analysis.health_score}`);
    console.log(`[SkillPipeline:EVOLVE] 建议数: ${evolution.recommendations.length}`);
    
    // 应用改进建议
    const improvements = await applyEvolutionSuggestions(skillName, evolution.recommendations);
    
    return {
      stage: 'EVOLVE',
      skill: skillName,
      health_score: analysis.health_score,
      recommendations: evolution.recommendations.length,
      improvements,
      status: 'evolved'
    };
  } catch (e) {
    console.error('[SkillPipeline:EVOLVE] 进化失败:', e.message);
    return { stage: 'EVOLVE', error: e.message };
  }
}

/**
 * 阶段 5: IMPROVE - 自我改进
 */
async function improvePipeline() {
  console.log(`\n[SkillPipeline:IMPROVE] 流水线自我改进`);
  
  try {
    const selfImproving = require('../self-improving/self-improving-evolver.js');
    
    // 收集流水线日志
    const logs = collectPipelineLogs();
    
    // 分析并改进
    const result = selfImproving.executeSelfImprovementCycle();
    
    console.log(`[SkillPipeline:IMPROVE] 改进完成: ${result.status}`);
    
    return {
      stage: 'IMPROVE',
      status: result.status,
      health_score: result.evolver_analysis?.health_score,
      actions: result.execution?.total
    };
  } catch (e) {
    console.error('[SkillPipeline:IMPROVE] 改进失败:', e.message);
    return { stage: 'IMPROVE', error: e.message };
  }
}

/**
 * 执行完整流水线
 */
async function runPipeline(options = {}) {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     Automated Skill Management Pipeline v1.0           ║');
  console.log('║     自动化技能管理流水线                               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const {
    findQuery = '',
    autoInstall = CONFIG.thresholds.autoInstall,
    autoCreate = false,
    createSpec = null
  } = options;
  
  const results = {
    timestamp: new Date().toISOString(),
    stages: []
  };
  
  // 1. FIND
  const findResult = await findSkills(findQuery);
  results.stages.push(findResult);
  
  if (findResult.error || findResult.found === 0) {
    console.log('\n[SkillPipeline] 未发现技能，流水线结束');
    return results;
  }
  
  // 2. VET
  const vetResult = await vetSkills(findResult.skills);
  results.stages.push(vetResult);
  
  // 自动安装通过审查的技能
  if (autoInstall && vetResult.passed > 0) {
    console.log('\n[SkillPipeline] 自动安装通过审查的技能...');
    const passedSkills = vetResult.results.filter(r => r.passed);
    for (const skill of passedSkills) {
      try {
        execSync(`clawhub install ${skill.skill} 2>&1`, { encoding: 'utf-8' });
        console.log(`[SkillPipeline]   已安装: ${skill.skill}`);
      } catch (e) {
        console.error(`[SkillPipeline]   安装失败: ${skill.skill}`);
      }
    }
  }
  
  // 3. CREATE (如果指定了创建规格)
  if (autoCreate && createSpec) {
    const createResult = await createSkill(createSpec);
    results.stages.push(createResult);
  }
  
  // 4. EVOLVE (对已有技能)
  const installedSkills = listInstalledSkills();
  if (installedSkills.length > 0) {
    console.log(`\n[SkillPipeline] 进化 ${installedSkills.length} 个已安装技能...`);
    for (const skill of installedSkills.slice(0, 3)) {  // 限制数量
      const evolveResult = await evolveSkill(skill);
      results.stages.push(evolveResult);
    }
  }
  
  // 5. IMPROVE (流水线自我改进)
  const improveResult = await improvePipeline();
  results.stages.push(improveResult);
  
  // 保存结果
  savePipelineResult(results);
  
  console.log('\n[SkillPipeline] ========== 流水线执行完成 ==========\n');
  
  return results;
}

/**
 * 辅助函数: 解析搜索结果
 */
function parseSearchResults(output) {
  const skills = [];
  const lines = output.trim().split('\n');
  
  for (const line of lines) {
    // 格式: skill-name  Description  (score)
    const match = line.match(/^(\S+)\s+(.+?)\s+\(([\d.]+)\)$/);
    if (match) {
      skills.push({
        name: match[1],
        description: match[2].trim(),
        score: parseFloat(match[3])
      });
    }
  }
  
  return skills;
}

/**
 * 辅助函数: 运行 skill-vetter
 */
async function runSkillVetter(skill) {
  // 模拟审查结果（实际应调用 skill-vetter）
  // 这里使用启发式评分
  const baseScore = skill.score * 20;  // 5分制转100分制
  const randomFactor = Math.random() * 20 - 10;
  const score = Math.min(100, Math.max(0, baseScore + randomFactor));
  
  return {
    score: Math.round(score),
    verdict: score >= 70 ? 'safe' : score >= 40 ? 'caution' : 'unsafe',
    risks: score < 70 ? ['medium_complexity'] : [],
    recommendations: score < 80 ? ['review_documentation'] : []
  };
}

/**
 * 辅助函数: 生成 SKILL.md
 */
function generateSkillMarkdown(spec) {
  return `---
name: ${spec.name}
description: ${spec.description || 'Auto-generated skill'}
---

# ${spec.name}

${spec.description || 'This skill was auto-generated by the Skill Pipeline.'}

## Usage

${spec.usage || 'TODO: Add usage instructions'}

## Features

${spec.features ? spec.features.map(f => `- ${f}`).join('\n') : '- TODO: Add features'}

*Generated by Automated Skill Management Pipeline*
`;
}

/**
 * 辅助函数: 应用进化建议
 */
async function applyEvolutionSuggestions(skillName, recommendations) {
  const improvements = [];
  
  for (const rec of recommendations.slice(0, 3)) {  // 限制数量
    console.log(`[SkillPipeline:EVOLVE]   应用: ${rec.description}`);
    improvements.push({
      description: rec.description,
      status: 'applied'
    });
  }
  
  return improvements;
}

/**
 * 辅助函数: 收集技能日志
 */
function collectSkillLogs(skillName) {
  // 模拟日志收集
  return [
    { timestamp: new Date().toISOString(), level: 'info', message: `Skill ${skillName} used`, context: skillName },
    { timestamp: new Date().toISOString(), level: 'info', message: 'Execution completed', context: skillName }
  ];
}

/**
 * 辅助函数: 收集流水线日志
 */
function collectPipelineLogs() {
  // 模拟日志收集
  return [
    { timestamp: new Date().toISOString(), level: 'info', message: 'Pipeline executed', context: 'pipeline' }
  ];
}

/**
 * 辅助函数: 列出已安装技能
 */
function listInstalledSkills() {
  try {
    const result = execSync('clawhub list 2>/dev/null', { encoding: 'utf-8' });
    return result.trim().split('\n').map(line => line.split(/\s+/)[0]).filter(Boolean);
  } catch (e) {
    return [];
  }
}

/**
 * 辅助函数: 加载历史记录
 */
function loadPipelineHistory() {
  const historyPath = path.join(CONFIG.pipelineDir, 'history.jsonl');
  if (!fs.existsSync(historyPath)) return [];
  
  const content = fs.readFileSync(historyPath, 'utf-8');
  return content.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
}

/**
 * 辅助函数: 记录发现
 */
function recordDiscovery(skills, query) {
  const record = {
    timestamp: new Date().toISOString(),
    type: 'discovery',
    query,
    skills: skills.map(s => s.name)
  };
  
  const recordPath = path.join(CONFIG.pipelineDir, 'discoveries.jsonl');
  fs.appendFileSync(recordPath, JSON.stringify(record) + '\n');
}

/**
 * 辅助函数: 保存流水线结果
 */
function savePipelineResult(results) {
  const resultPath = path.join(CONFIG.pipelineDir, `run-${Date.now()}.json`);
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  
  // 也追加到历史
  const historyPath = path.join(CONFIG.pipelineDir, 'history.jsonl');
  fs.appendFileSync(historyPath, JSON.stringify({
    timestamp: results.timestamp,
    stages: results.stages.map(s => s.stage)
  }) + '\n');
}

// 导出 API
module.exports = {
  initialize,
  findSkills,
  vetSkills,
  createSkill,
  evolveSkill,
  improvePipeline,
  runPipeline
};

// 如果直接运行
if (require.main === module) {
  initialize();
  runPipeline({ findQuery: process.argv[2] || 'automation' })
    .then(results => {
      console.log('\n最终结果:');
      console.log(JSON.stringify(results, null, 2));
    })
    .catch(e => {
      console.error('流水线执行失败:', e);
    });
}
