#!/usr/bin/env node
/**
 * OpenClaw Automation Core 启动脚本
 * 
 * 用法:
 *   node start.js              # 启动全自动模式
 *   node start.js --status     # 查看状态
 *   node start.js --once       # 执行一次完整循环
 *   node start.js --daemon     # 后台守护模式
 */

const args = process.argv.slice(2);
const OpenClawAutomation = require('./openclaw-automation.js');

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     OpenClaw Automation Core (OAC) v1.0                ║');
  console.log('║     全自动 AI 系统管理核心                              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const oac = new OpenClawAutomation();
  
  if (args.includes('--status')) {
    // 查看状态
    const status = oac.getStatus();
    console.log('系统状态:');
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  
  if (args.includes('--once')) {
    // 执行一次
    console.log('执行一次完整循环...\n');
    oac.initialize();
    await oac.runHealthCheck();
    await oac.runMemoryMaintenance();
    await oac.runSelfImprovement();
    console.log('\n✓ 执行完成');
    return;
  }
  
  // 默认：启动全自动模式
  oac.initialize().start();
  
  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n');
    oac.stop();
    process.exit(0);
  });
}

main().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
