#!/usr/bin/env node
/**
 * Skill Pipeline 启动脚本
 * 
 * 用法:
 *   node start.js                    # 运行基础流水线
 *   node start.js --browser          # 使用 Agent Browser 增强版
 *   node start.js --query "memory"   # 搜索特定技能
 *   node start.js --full             # 完整流程（发现+审查+安装+测试+进化）
 */

const args = process.argv.slice(2);

const useBrowser = args.includes('--browser');
const fullMode = args.includes('--full');
const queryIndex = args.indexOf('--query');
const query = queryIndex !== -1 && args[queryIndex + 1] && !args[queryIndex + 1].startsWith('--') ? args[queryIndex + 1] : '';

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Automated Skill Management Pipeline                ║');
  console.log('║     自动化技能管理流水线                               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  // 初始化
  const skillPipeline = require('./skill-pipeline.js');
  skillPipeline.initialize();
  
  const options = {
    findQuery: query || 'automation',
    useBrowser: useBrowser,
    autoTest: fullMode
  };
  
  try {
    let results;
    
    if (useBrowser) {
      console.log('🌐 使用 Agent Browser 增强版\n');
      const enhanced = require('./skill-pipeline-browser.js');
      results = await enhanced.runEnhancedPipeline(options);
    } else {
      console.log('⚡ 使用基础版（CLI）\n');
      results = await skillPipeline.runPipeline(options);
    }
    
    // 输出摘要
    console.log('\n📊 执行摘要');
    console.log('═══════════');
    
    for (const stage of results.stages) {
      const stageName = stage.stage || 'UNKNOWN';
      const status = stage.error ? '❌' : '✓';
      
      if (stage.found !== undefined) {
        console.log(`${status} FIND: 发现 ${stage.found} 个技能`);
      } else if (stage.passed !== undefined) {
        console.log(`${status} VET: 通过 ${stage.passed}/${stage.total} 个审查`);
      } else if (stage.status === 'installed') {
        console.log(`${status} INSTALL: 已安装 ${stage.skill}`);
      } else if (stage.status === 'tested') {
        console.log(`${status} TEST: ${stage.skill} 成功率 ${(stage.success_rate * 100).toFixed(0)}%`);
      } else if (stage.health_score !== undefined) {
        console.log(`${status} EVOLVE: ${stage.skill} 健康分 ${stage.health_score}`);
      } else if (stage.stage === 'IMPROVE') {
        console.log(`${status} IMPROVE: 流水线自我改进完成`);
      }
    }
    
    console.log('\n✓ 流水线执行完成');
    
  } catch (e) {
    console.error('\n❌ 流水线执行失败:', e.message);
    process.exit(1);
  }
}

main();
