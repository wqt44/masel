/**
 * OpenClaw Automation Core (OAC)
 * OpenClaw 自动化管理核心
 * 
 * 统一协调所有子系统：
 * - 记忆系统 (Ultimate Memory v2.0)
 * - 自我改进 (Self-Improving)
 * - 技能管理 (Skill Pipeline)
 * - 能力进化 (Capability Evolver)
 * - 浏览器自动化 (Agent Browser)
 * 
 * 实现全自动、自管理、自进化的 AI 系统
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 子系统引用 - v1.7.0 使用新的统一记忆系统
const SYSTEMS = {
  memory: require('../memory'),  // 新的统一记忆系统
  selfImproving: require('../self-improving/self-improving-evolver.js'),
  skillPipeline: require('../skill-pipeline/skill-pipeline.js'),
  config: require('../../config'),  // 统一配置
  errorHandler: require('../error-handler'),  // 错误处理
  // capabilityEvolver 通过 selfImproving 间接使用
  // agentBrowser 通过 skillPipeline 间接使用
};

// 配置 - 使用统一配置中心
const config = SYSTEMS.config;
const BASE_PATH = config.paths.workspace || path.join(__dirname, '../..');

const CONFIG = {
  workspace: BASE_PATH,
  stateFile: path.join(BASE_PATH, 'memory/oac/state.json'),
  logFile: path.join(BASE_PATH, 'memory/oac/automation.log'),
  
  // 从统一配置读取
  intervals: config.oac?.intervals || {
    healthCheck: 5 * 60 * 1000,      // 5 分钟健康检查
    memoryMaintenance: 60 * 60 * 1000, // 1 小时记忆维护
    selfImprovement: 4 * 60 * 60 * 1000, // 4 小时自我改进
    skillDiscovery: 24 * 60 * 60 * 1000, // 24 小时技能发现
  },
  
  // 从统一配置读取
  thresholds: config.selfImproving?.thresholds || {
    minHealthScore: 70,
    maxErrorRate: 0.1,
    autoFix: true
  }
};

/**
 * OpenClaw Automation Core 类
 */
class OpenClawAutomation {
  constructor() {
    this.state = this.loadState();
    this.timers = {};
    this.metrics = {
      startTime: Date.now(),
      cycles: 0,
      errors: 0,
      improvements: 0
    };
  }

  /**
   * 初始化所有子系统
   */
  initialize() {
    console.log('[OAC] ╔════════════════════════════════════════════════╗');
    console.log('[OAC] ║  OpenClaw Automation Core v1.0                  ║');
    console.log('[OAC] ║  全自动 AI 系统管理核心                          ║');
    console.log('[OAC] ╚════════════════════════════════════════════════╝\n');
    
    // 确保目录存在
    this.ensureDirectories();
    
    // 初始化各子系统
    console.log('[OAC] 初始化子系统...');
    
    try {
      SYSTEMS.memory.initAdapter('oac-main');
      console.log('[OAC]  ✓ 记忆系统已初始化');
    } catch (e) {
      console.error('[OAC]  ✗ 记忆系统初始化失败:', e.message);
    }
    
    try {
      SYSTEMS.skillPipeline.initialize();
      console.log('[OAC]  ✓ 技能流水线已初始化');
    } catch (e) {
      console.error('[OAC]  ✗ 技能流水线初始化失败:', e.message);
    }
    
    console.log('[OAC] 初始化完成\n');
    
    this.log('initialized', { timestamp: new Date().toISOString() });
    
    return this;
  }

  /**
   * 启动全自动模式
   */
  start() {
    console.log('[OAC] 启动全自动模式...\n');
    
    // 立即执行一次健康检查
    this.runHealthCheck();
    
    // 设置定时任务
    this.timers.health = setInterval(() => this.runHealthCheck(), CONFIG.intervals.healthCheck);
    this.timers.memory = setInterval(() => this.runMemoryMaintenance(), CONFIG.intervals.memoryMaintenance);
    this.timers.improvement = setInterval(() => this.runSelfImprovement(), CONFIG.intervals.selfImprovement);
    this.timers.skills = setInterval(() => this.runSkillDiscovery(), CONFIG.intervals.skillDiscovery);
    
    console.log('[OAC] 定时任务已启动:');
    console.log(`  • 健康检查: 每 ${CONFIG.intervals.healthCheck / 60000} 分钟`);
    console.log(`  • 记忆维护: 每 ${CONFIG.intervals.memoryMaintenance / 3600000} 小时`);
    console.log(`  • 自我改进: 每 ${CONFIG.intervals.selfImprovement / 3600000} 小时`);
    console.log(`  • 技能发现: 每 ${CONFIG.intervals.skillDiscovery / 86400000} 天`);
    console.log('\n[OAC] 按 Ctrl+C 停止\n');
    
    this.log('started', { intervals: CONFIG.intervals });
    
    // 保持运行
    this.keepAlive();
  }

  /**
   * 运行健康检查循环 - 使用错误处理包装
   */
  async runHealthCheck() {
    return SYSTEMS.errorHandler.wrap(async () => {
      this.metrics.cycles++;
      console.log(`\n[OAC] ========== 健康检查 #${this.metrics.cycles} ==========`);
      
      const report = {
        timestamp: new Date().toISOString(),
        cycle: this.metrics.cycles,
        checks: {}
      };
      
      // 1. 检查记忆系统健康
      const memoryHealth = this.checkMemoryHealth();
      report.checks.memory = memoryHealth;
      console.log(`[OAC] 记忆系统: ${memoryHealth.status} (评分: ${memoryHealth.score})`);
    } catch (e) {
      report.checks.memory = { status: 'error', error: e.message };
      console.error('[OAC] 记忆系统检查失败:', e.message);
      this.metrics.errors++;
    }
    
    // 2. 检查技能系统健康
    try {
      const skillHealth = this.checkSkillHealth();
      report.checks.skills = skillHealth;
      console.log(`[OAC] 技能系统: ${skillHealth.status} (技能数: ${skillHealth.count})`);
    } catch (e) {
      report.checks.skills = { status: 'error', error: e.message };
      console.error('[OAC] 技能系统检查失败:', e.message);
      this.metrics.errors++;
    }
    
    // 3. 检查文件系统健康
    try {
      const fileHealth = this.checkFileHealth();
      report.checks.files = fileHealth;
      console.log(`[OAC] 文件系统: ${fileHealth.status} (大小: ${fileHealth.size})`);
    } catch (e) {
      report.checks.files = { status: 'error', error: e.message };
      console.error('[OAC] 文件系统检查失败:', e.message);
    }
    
    // 4. 综合健康评分
    const overallHealth = this.calculateOverallHealth(report.checks);
    report.overall = overallHealth;
    console.log(`[OAC] 综合健康: ${overallHealth.status} (评分: ${overallHealth.score})`);
    
    // 5. 如果健康分低，触发自动修复
    if (overallHealth.score < CONFIG.thresholds.minHealthScore && CONFIG.thresholds.autoFix) {
      console.log('[OAC] ⚠️ 健康分低，触发自动修复...');
      await this.autoFix(report.checks);
    }
    
      // 保存报告
      this.saveHealthReport(report);
      
      console.log('[OAC] ========== 健康检查完成 ==========\n');
      
      this.log('health_check', report);
      
      return report;
    }, { context: 'oac-health-check', retries: 1 });
  }

  /**
   * 运行记忆维护 - 使用错误处理包装
   */
  async runMemoryMaintenance() {
    return SYSTEMS.errorHandler.wrap(async () => {
      console.log('\n[OAC] ========== 记忆维护 ==========');
      
      // 运行新的统一记忆系统的维护
      const result = await SYSTEMS.memory.maintenance();
      
      if (result.success) {
        console.log(`[OAC] 记忆维护完成:`);
        console.log(`  • 状态: ${result.data?.status || 'completed'}`);
        console.log(`  • 层级维护:`, Object.keys(result.data?.layers || {}).join(', '));
      }
      
      this.log('memory_maintenance', { status: 'success' });
      
      console.log('[OAC] ========== 记忆维护完成 ==========\n');
      
      return result;
    }, { context: 'oac-memory-maintenance', retries: 2 });
  }

  /**
   * 运行自我改进 - 使用错误处理包装
   */
  async runSelfImprovement() {
    return SYSTEMS.errorHandler.wrap(async () => {
      console.log('\n[OAC] ========== 自我改进 ==========');
      
      const result = SYSTEMS.selfImproving.executeSelfImprovementCycle();
      
      console.log(`[OAC] 自我改进完成:`);
      console.log(`  • 状态: ${result.status}`);
      console.log(`  • 健康评分: ${result.evolver_analysis?.health_score || 'N/A'}`);
      console.log(`  • 执行动作: ${result.execution?.total || 0} 个`);
      
      if (result.status === 'success') {
        this.metrics.improvements++;
      }
      
      console.log('[OAC] ========== 自我改进完成 ==========\n');
      
      return result;
    }, { context: 'oac-self-improvement', retries: 1 });
  }
      
      this.log('self_improvement', { status: result.status });
    } catch (e) {
      console.error('[OAC] 自我改进失败:', e.message);
      this.log('self_improvement', { status: 'error', error: e.message });
    }
    
    console.log('[OAC] ========== 自我改进完成 ==========\n');
  }

  /**
   * 运行技能发现
   */
  async runSkillDiscovery() {
    console.log('\n[OAC] ========== 技能发现 ==========');
    
    try {
      const result = await SYSTEMS.skillPipeline.runPipeline({
        findQuery: 'automation',
        autoInstall: true
      });
      
      console.log(`[OAC] 技能发现完成:`);
      console.log(`  • 发现: ${result.stages.find(s => s.stage === 'FIND')?.found || 0} 个`);
      console.log(`  • 通过审查: ${result.stages.find(s => s.stage === 'VET')?.passed || 0} 个`);
      
      this.log('skill_discovery', { stages: result.stages.length });
    } catch (e) {
      console.error('[OAC] 技能发现失败:', e.message);
      this.log('skill_discovery', { status: 'error', error: e.message });
    }
    
    console.log('[OAC] ========== 技能发现完成 ==========\n');
  }

  /**
   * 检查记忆系统健康 - 使用新的统一记忆系统
   */
  checkMemoryHealth() {
    // 使用新的统一记忆系统获取统计
    const stats = SYSTEMS.memory.getStats();
    
    // 基于统计计算健康评分
    let score = 100;
    
    // 缓存命中率影响评分
    const hitRate = parseFloat(stats.hitRate) || 0;
    if (hitRate < 50) score -= 10;
    
    // 错误率影响评分
    if (stats.errors > 0) score -= 5 * Math.min(stats.errors, 5);
    
    // 检查存储大小
    const memoryDir = path.join(CONFIG.workspace, 'memory');
    if (fs.existsSync(memoryDir)) {
      const stats = fs.statSync(memoryDir);
      const sizeMB = stats.size / 1024 / 1024;
      if (sizeMB > 100) score -= 10;
      if (sizeMB > 500) score -= 20;
    }
    
    return {
      status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
      score: Math.max(0, score),
      memories: stats.cacheSize || 0,
      hitRate: stats.hitRate,
      layers: stats.layers
    };
  }

  /**
   * 检查技能系统健康
   */
  checkSkillHealth() {
    try {
      const result = execSync('clawhub list 2>/dev/null', { encoding: 'utf-8' });
      const skills = result.trim().split('\n').filter(Boolean);
      
      return {
        status: 'healthy',
        score: Math.min(100, 50 + skills.length * 5),
        count: skills.length
      };
    } catch (e) {
      return {
        status: 'error',
        score: 0,
        count: 0,
        error: e.message
      };
    }
  }

  /**
   * 检查文件系统健康
   */
  checkFileHealth() {
    try {
      const result = execSync(`du -sh ${CONFIG.workspace} 2>/dev/null`, { encoding: 'utf-8' });
      const size = result.split('\t')[0];
      
      return {
        status: 'healthy',
        score: 90,
        size
      };
    } catch (e) {
      return {
        status: 'error',
        score: 50,
        error: e.message
      };
    }
  }

  /**
   * 计算综合健康评分
   */
  calculateOverallHealth(checks) {
    const scores = [];
    
    if (checks.memory?.score) scores.push(checks.memory.score);
    if (checks.skills?.score) scores.push(checks.skills.score);
    if (checks.files?.score) scores.push(checks.files.score);
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    return {
      status: avgScore >= 80 ? 'healthy' : avgScore >= 60 ? 'warning' : 'critical',
      score: Math.round(avgScore)
    };
  }

  /**
   * 自动修复问题
   */
  async autoFix(checks) {
    console.log('[OAC] 执行自动修复...');
    
    const fixes = [];
    
    // 修复记忆系统
    if (checks.memory?.status === 'critical') {
      console.log('[OAC]   修复记忆系统...');
      try {
        SYSTEMS.memory.cleanupExpiredMemories?.(false);
        fixes.push('memory_cleanup');
      } catch (e) {
        console.error('[OAC]   修复失败:', e.message);
      }
    }
    
    // 修复技能系统
    if (checks.skills?.status === 'error') {
      console.log('[OAC]   修复技能系统...');
      // 可以在这里添加技能系统修复逻辑
    }
    
    console.log(`[OAC] 自动修复完成: ${fixes.length} 项`);
    this.log('auto_fix', { fixes });
  }

  /**
   * 辅助方法
   */
  ensureDirectories() {
    const dirs = [
      path.dirname(CONFIG.stateFile),
      path.dirname(CONFIG.logFile),
      path.join(CONFIG.workspace, 'memory/oac/reports')
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  loadState() {
    if (fs.existsSync(CONFIG.stateFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.stateFile, 'utf-8'));
    }
    return { initialized: false };
  }

  saveState() {
    fs.writeFileSync(CONFIG.stateFile, JSON.stringify(this.state, null, 2));
  }

  saveHealthReport(report) {
    const reportPath = path.join(CONFIG.workspace, 'memory/oac/reports', `health-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  log(event, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data
    };
    fs.appendFileSync(CONFIG.logFile, JSON.stringify(logEntry) + '\n');
  }

  keepAlive() {
    setInterval(() => {
      // 保持进程运行
    }, 60000);
  }

  /**
   * 获取状态报告
   */
  getStatus() {
    const uptime = Date.now() - this.metrics.startTime;
    
    return {
      status: 'running',
      uptime: Math.floor(uptime / 1000),
      metrics: this.metrics,
      timers: Object.keys(this.timers),
      state: this.state
    };
  }

  /**
   * 停止自动化
   */
  stop() {
    console.log('[OAC] 停止自动化...');
    
    for (const [name, timer] of Object.entries(this.timers)) {
      clearInterval(timer);
      console.log(`[OAC]  ✓ 停止 ${name}`);
    }
    
    this.saveState();
    this.log('stopped', { timestamp: new Date().toISOString() });
    
    console.log('[OAC] 已停止');
  }
}

// 导出
module.exports = OpenClawAutomation;

// 如果直接运行
if (require.main === module) {
  const oac = new OpenClawAutomation();
  oac.initialize().start();
  
  // 优雅退出
  process.on('SIGINT', () => {
    oac.stop();
    process.exit(0);
  });
}
