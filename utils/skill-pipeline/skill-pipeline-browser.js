/**
 * Skill Pipeline with Agent Browser Integration
 * 集成 Agent Browser 的高级技能流水线
 * 
 * 使用 Agent Browser 自动化网页交互，实现：
 * 1. 自动浏览 ClawHub 发现技能
 * 2. 自动下载和安装技能
 * 3. 自动测试技能功能
 */

const skillPipeline = require('./skill-pipeline.js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 使用 Agent Browser 浏览 ClawHub 网站发现技能
 */
async function browseClawHubForSkills(query = '') {
  console.log(`\n[SkillPipeline+Browser] 使用 Agent Browser 浏览 ClawHub: "${query}"`);
  
  try {
    // 启动浏览器会话
    const sessionName = `clawhub-search-${Date.now()}`;
    
    // 1. 打开 ClawHub
    execSync(`agent-browser --session ${sessionName} open https://clawhub.ai 2>&1`, { encoding: 'utf-8' });
    
    // 2. 等待页面加载
    execSync(`agent-browser --session ${sessionName} wait --load networkidle 2>&1`, { encoding: 'utf-8' });
    
    // 3. 获取页面快照
    const snapshot = execSync(`agent-browser --session ${sessionName} snapshot -i --json 2>&1`, { encoding: 'utf-8' });
    const pageData = JSON.parse(snapshot);
    
    console.log(`[SkillPipeline+Browser] 页面已加载，发现 ${Object.keys(pageData.data.refs).length} 个元素`);
    
    // 4. 查找搜索框
    const searchRef = findRefByRole(pageData.data.refs, 'searchbox') || 
                      findRefByRole(pageData.data.refs, 'textbox');
    
    if (searchRef && query) {
      // 5. 输入搜索词
      execSync(`agent-browser --session ${sessionName} fill ${searchRef} "${query}" 2>&1`, { encoding: 'utf-8' });
      execSync(`agent-browser --session ${sessionName} press Enter 2>&1`, { encoding: 'utf-8' });
      
      // 6. 等待结果
      execSync(`agent-browser --session ${sessionName} wait --load networkidle 2>&1`, { encoding: 'utf-8' });
      
      // 7. 获取搜索结果
      const resultSnapshot = execSync(`agent-browser --session ${sessionName} snapshot -i --json 2>&1`, { encoding: 'utf-8' });
      const resultData = JSON.parse(resultSnapshot);
      
      // 8. 解析技能列表
      const skills = parseSkillsFromSnapshot(resultData.data);
      
      console.log(`[SkillPipeline+Browser] 发现 ${skills.length} 个技能`);
      
      // 9. 关闭浏览器
      execSync(`agent-browser --session ${sessionName} close 2>&1`, { encoding: 'utf-8' });
      
      return {
        method: 'browser',
        skills: skills,
        session: sessionName
      };
    }
    
    // 关闭浏览器
    execSync(`agent-browser --session ${sessionName} close 2>&1`, { encoding: 'utf-8' });
    
    return { method: 'browser', skills: [], error: 'Search not available' };
  } catch (e) {
    console.error('[SkillPipeline+Browser] 浏览器操作失败:', e.message);
    // 回退到 CLI 方式
    console.log('[SkillPipeline+Browser] 回退到 CLI 方式...');
    return null;
  }
}

/**
 * 使用 Agent Browser 自动安装技能
 */
async function autoInstallSkillWithBrowser(skillName) {
  console.log(`\n[SkillPipeline+Browser] 自动安装技能: ${skillName}`);
  
  try {
    const sessionName = `install-${skillName}-${Date.now()}`;
    
    // 1. 打开技能页面
    execSync(`agent-browser --session ${sessionName} open https://clawhub.ai/skills/${skillName} 2>&1`, { encoding: 'utf-8' });
    execSync(`agent-browser --session ${sessionName} wait --load networkidle 2>&1`, { encoding: 'utf-8' });
    
    // 2. 获取快照
    const snapshot = execSync(`agent-browser --session ${sessionName} snapshot -i --json 2>&1`, { encoding: 'utf-8' });
    const pageData = JSON.parse(snapshot);
    
    // 3. 查找安装按钮
    const installRef = findRefByName(pageData.data.refs, 'install') ||
                       findRefByName(pageData.data.refs, 'get');
    
    if (installRef) {
      // 4. 点击安装
      execSync(`agent-browser --session ${sessionName} click ${installRef} 2>&1`, { encoding: 'utf-8' });
      
      // 5. 等待安装完成
      execSync(`agent-browser --session ${sessionName} wait 2000 2>&1`, { encoding: 'utf-8' });
      
      console.log(`[SkillPipeline+Browser] 技能 ${skillName} 安装完成`);
      
      // 6. 关闭浏览器
      execSync(`agent-browser --session ${sessionName} close 2>&1`, { encoding: 'utf-8' });
      
      return { status: 'installed', skill: skillName };
    }
    
    execSync(`agent-browser --session ${sessionName} close 2>&1`, { encoding: 'utf-8' });
    return { status: 'failed', reason: 'install_button_not_found' };
  } catch (e) {
    console.error('[SkillPipeline+Browser] 安装失败:', e.message);
    return { status: 'failed', error: e.message };
  }
}

/**
 * 使用 Agent Browser 测试技能
 */
async function testSkillWithBrowser(skillName) {
  console.log(`\n[SkillPipeline+Browser] 测试技能: ${skillName}`);
  
  try {
    // 读取技能的 SKILL.md
    const skillPath = path.join(__dirname, '../../skills', skillName, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      return { status: 'skipped', reason: 'skill_not_installed' };
    }
    
    const skillDoc = fs.readFileSync(skillPath, 'utf-8');
    
    // 提取示例命令
    const examples = extractExamplesFromSkill(skillDoc);
    
    if (examples.length === 0) {
      return { status: 'skipped', reason: 'no_examples_found' };
    }
    
    console.log(`[SkillPipeline+Browser] 找到 ${examples.length} 个示例`);
    
    // 执行示例命令
    const results = [];
    for (const example of examples.slice(0, 2)) {  // 限制测试数量
      try {
        console.log(`[SkillPipeline+Browser]   测试: ${example.description}`);
        const result = execSync(example.command, { encoding: 'utf-8', timeout: 30000 });
        results.push({
          example: example.description,
          status: 'success',
          output: result.substring(0, 200)
        });
      } catch (e) {
        results.push({
          example: example.description,
          status: 'failed',
          error: e.message
        });
      }
    }
    
    const successRate = results.filter(r => r.status === 'success').length / results.length;
    
    return {
      status: 'tested',
      skill: skillName,
      success_rate: successRate,
      results
    };
  } catch (e) {
    console.error('[SkillPipeline+Browser] 测试失败:', e.message);
    return { status: 'error', error: e.message };
  }
}

/**
 * 执行完整的浏览器增强流水线
 */
async function runEnhancedPipeline(options = {}) {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Enhanced Skill Pipeline with Agent Browser v1.0       ║');
  console.log('║  集成 Agent Browser 的高级技能流水线                    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const { 
    query = '',
    useBrowser = true,
    autoTest = true
  } = options;
  
  const results = {
    timestamp: new Date().toISOString(),
    stages: []
  };
  
  // 1. FIND (使用 Browser 或 CLI)
  let findResult;
  if (useBrowser) {
    const browserResult = await browseClawHubForSkills(query);
    if (browserResult) {
      findResult = { stage: 'FIND_BROWSER', ...browserResult };
    } else {
      // 回退到 CLI
      findResult = await skillPipeline.findSkills(query);
    }
  } else {
    findResult = await skillPipeline.findSkills(query);
  }
  results.stages.push(findResult);
  
  // 2. VET
  const skillsToVet = findResult.skills || [];
  if (skillsToVet.length > 0) {
    const vetResult = await skillPipeline.vetSkills(skillsToVet);
    results.stages.push(vetResult);
    
    // 3. INSTALL (使用 Browser 或 CLI)
    const passedSkills = vetResult.results?.filter(r => r.passed) || [];
    console.log(`\n[EnhancedPipeline] 安装 ${passedSkills.length} 个通过审查的技能...`);
    
    for (const skill of passedSkills.slice(0, 3)) {  // 限制数量
      let installResult;
      if (useBrowser) {
        installResult = await autoInstallSkillWithBrowser(skill.skill);
        if (installResult.status !== 'installed') {
          // 回退到 CLI
          try {
            execSync(`clawhub install ${skill.skill} 2>&1`, { encoding: 'utf-8' });
            installResult = { status: 'installed', skill: skill.skill, method: 'cli' };
          } catch (e) {
            installResult = { status: 'failed', skill: skill.skill, error: e.message };
          }
        }
      } else {
        try {
          execSync(`clawhub install ${skill.skill} 2>&1`, { encoding: 'utf-8' });
          installResult = { status: 'installed', skill: skill.skill, method: 'cli' };
        } catch (e) {
          installResult = { status: 'failed', skill: skill.skill, error: e.message };
        }
      }
      results.stages.push({ stage: 'INSTALL', ...installResult });
    }
    
    // 4. TEST (使用 Browser 自动化测试)
    if (autoTest) {
      console.log(`\n[EnhancedPipeline] 测试已安装技能...`);
      const installedSkills = listInstalledSkills();
      for (const skill of installedSkills.slice(-3)) {  // 测试最近安装的
        const testResult = await testSkillWithBrowser(skill);
        results.stages.push({ stage: 'TEST', ...testResult });
      }
    }
  }
  
  // 5. EVOLVE
  const installedSkills = listInstalledSkills();
  if (installedSkills.length > 0) {
    console.log(`\n[EnhancedPipeline] 进化技能...`);
    for (const skill of installedSkills.slice(0, 2)) {
      const evolveResult = await skillPipeline.evolveSkill(skill);
      results.stages.push(evolveResult);
    }
  }
  
  // 6. IMPROVE
  const improveResult = await skillPipeline.improvePipeline();
  results.stages.push(improveResult);
  
  console.log('\n[EnhancedPipeline] ========== 流水线执行完成 ==========\n');
  
  return results;
}

/**
 * 辅助函数: 从 snapshot 中查找 ref
 */
function findRefByRole(refs, role) {
  for (const [ref, data] of Object.entries(refs)) {
    if (data.role === role) {
      return `@${ref}`;
    }
  }
  return null;
}

function findRefByName(refs, name) {
  const nameLower = name.toLowerCase();
  for (const [ref, data] of Object.entries(refs)) {
    if (data.name && data.name.toLowerCase().includes(nameLower)) {
      return `@${ref}`;
    }
  }
  return null;
}

/**
 * 辅助函数: 从 snapshot 解析技能列表
 */
function parseSkillsFromSnapshot(data) {
  // 简化实现，实际应根据 ClawHub 页面结构解析
  const skills = [];
  
  for (const [ref, info] of Object.entries(data.refs || {})) {
    if (info.role === 'link' && info.name) {
      skills.push({
        name: info.name.toLowerCase().replace(/\s+/g, '-'),
        description: info.name,
        score: 3.5
      });
    }
  }
  
  return skills.slice(0, 10);  // 限制数量
}

/**
 * 辅助函数: 从 SKILL.md 提取示例
 */
function extractExamplesFromSkill(skillDoc) {
  const examples = [];
  
  // 匹配代码块中的命令
  const codeBlockRegex = /```(?:bash|shell)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = codeBlockRegex.exec(skillDoc)) !== null) {
    const code = match[1].trim();
    const lines = code.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    
    for (const line of lines.slice(0, 2)) {
      if (line.includes('agent-browser') || line.includes('clawhub')) {
        examples.push({
          description: line.substring(0, 50),
          command: line
        });
      }
    }
  }
  
  return examples;
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

// 导出 API
module.exports = {
  browseClawHubForSkills,
  autoInstallSkillWithBrowser,
  testSkillWithBrowser,
  runEnhancedPipeline
};

// 如果直接运行
if (require.main === module) {
  skillPipeline.initialize();
  runEnhancedPipeline({ query: process.argv[2] || 'automation' })
    .then(results => {
      console.log('\n最终结果:');
      console.log(JSON.stringify(results, null, 2));
    })
    .catch(e => {
      console.error('流水线执行失败:', e);
    });
}
