#!/usr/bin/env node
/**
 * Self-Improving System 启动脚本
 * 
 * 用法:
 *   node start.js              # 执行一次自我改进
 *   node start.js --continuous # 启动持续改进模式
 *   node start.js --report     # 生成趋势报告
 *   node start.js --evolver    # 使用 Capability Evolver 版
 */

const args = process.argv.slice(2);

// 检查是否有 Capability Evolver
let useEvolver = args.includes('--evolver');
let continuous = args.includes('--continuous');
let report = args.includes('--report');

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║          Self-Improving System v1.0                    ║');
  console.log('║     AI 自我改进系统 - 持续学习，自动优化                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  if (report) {
    // 生成趋势报告
    console.log('📊 生成趋势报告...\n');
    
    try {
      const evolverSystem = require('./self-improving-evolver.js');
      const trendReport = evolverSystem.generateTrendReport();
      
      console.log('趋势报告:');
      console.log('═════════');
      console.log(`总改进次数: ${trendReport.total_improvements}`);
      console.log(`平均健康分: ${trendReport.average_health_score}`);
      console.log(`健康趋势: ${trendReport.health_trend}`);
      console.log(`趋势值: ${trendReport.trend_value}`);
      console.log(`最后改进: ${trendReport.last_improvement}`);
      console.log('\n建议:');
      trendReport.recommendations.forEach(r => console.log(`  • ${r}`));
    } catch (e) {
      console.error('生成报告失败:', e.message);
    }
    
    return;
  }
  
  if (useEvolver) {
    // 使用 Capability Evolver 版
    console.log('🚀 使用 Capability Evolver 集成版\n');
    
    try {
      const evolverSystem = require('./self-improving-evolver.js');
      
      if (continuous) {
        console.log('启动持续改进模式...');
        console.log('按 Ctrl+C 停止\n');
        
        // 立即执行一次
        await evolverSystem.executeSelfImprovementCycle();
        
        // 每小时执行一次
        setInterval(async () => {
          await evolverSystem.executeSelfImprovementCycle();
        }, 60 * 60 * 1000);
        
        // 保持运行
        await new Promise(() => {});
      } else {
        // 执行一次
        const result = await evolverSystem.executeSelfImprovementCycle();
        
        console.log('\n✓ 自我改进循环完成');
        console.log(`状态: ${result.status}`);
        console.log(`健康评分: ${result.evolver_analysis?.health_score || 'N/A'}`);
        console.log(`执行动作: ${result.execution?.total || 0} 个`);
        console.log(`成功: ${result.execution?.success || 0} 个`);
      }
    } catch (e) {
      console.error('执行失败:', e.message);
      console.log('\n尝试使用基础版...\n');
      useEvolver = false;
    }
  }
  
  if (!useEvolver) {
    // 使用基础版
    console.log('🚀 使用基础版\n');
    
    const selfImproving = require('./self-improving.js');
    
    // 初始化
    selfImproving.initialize();
    
    if (continuous) {
      console.log('启动持续改进模式...');
      console.log('按 Ctrl+C 停止\n');
      selfImproving.startContinuousImprovement();
      
      // 保持运行
      await new Promise(() => {});
    } else {
      // 执行一次
      const result = await selfImproving.selfImprove();
      
      console.log('\n✓ 自我改进完成');
      console.log(`状态: ${result.status}`);
      if (result.health_score) {
        console.log(`健康评分: ${result.health_score}`);
      }
    }
  }
}

main().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
