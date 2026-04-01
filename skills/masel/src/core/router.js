/**
 * MASEL Router - 智能任务路由 v1.9.1
 * 
 * 判断任务是否需要多 Agent，走哪条工作流
 */

class MaselRouter {
  /**
   * 简单规则判断（快速路径，不调 LLM）
   */
  shouldUseMASEL(task) {
    const t = task.toLowerCase().trim();

    // 明确的简单任务 → 跳过
    const simplePatterns = [
      /^你好$/, /^hi$/, /^hello$/, /^hey$/,
      /^谢谢$/, /^thanks$/, /^thx$/,
      /^再见$/, /^bye$/,
      /^(今天)?天气/, /^(现在)?时间/, /^(今天)?日期/,
      /^帮助$/, /^help$/,
      /^\/\w+/,           // slash commands
      /^ok$/i, /^好的$/, /^嗯$/, /^行$/
    ];
    if (simplePatterns.some(p => p.test(t))) return false;

    // 明确的复杂关键词 → 需要
    const complexKeywords = [
      // 中文
      '写', '编写', '开发', '实现', '创建', '做', '制作', '构建',
      '分析', '研究', '调查', '设计', '架构', '规划', '方案',
      '测试', '调试', '验证', '优化', '重构', '改进', '完善', '修复',
      '项目', '系统', '程序', '应用', '工具', '脚本', '服务',
      '代码', '函数', '类', '模块', '库', '框架', '组件',
      '网站', '网页', '接口', 'api', '数据库', '服务器',
      '爬虫', '自动化', '工作流', '流程', '流水线',
      '部署', '运维', '监控',
      // English
      'create', 'develop', 'build', 'write', 'implement', 'make',
      'analyze', 'research', 'design', 'architect', 'plan',
      'test', 'debug', 'optimize', 'refactor', 'improve', 'fix',
      'project', 'system', 'program', 'app', 'tool', 'script', 'service',
      'code', 'function', 'module', 'framework', 'component',
      'website', 'api', 'database', 'server',
      'scraper', 'automation', 'workflow', 'pipeline',
      'deploy', 'monitor'
    ];
    if (complexKeywords.some(kw => t.includes(kw.toLowerCase()))) return true;

    // 长任务描述、包含复合句 → 需要
    if (task.length > 50) return true;
    const sentenceCount = (task.match(/[。！？.!?\n]/g) || []).length;
    if (sentenceCount >= 2) return true;

    // 默认：不需要
    return false;
  }

  /**
   * 路由到工作流类型
   * 返回: 'simple' | 'coding' | 'creative' | 'research' | 'multi-step'
   */
  route(task, creativeRoute) {
    // 有创作套件路由 → creative
    if (creativeRoute?.handlerAvailable) {
      if (creativeRoute.workflowType === 'multi-app' || (creativeRoute.apps?.length || 0) > 1) {
        return 'creative';
      }
      return 'creative'; // single-app 也是 creative
    }

    const t = task.toLowerCase();

    // 研究类
    const researchKeywords = ['分析', '研究', '调查', '调研', 'analyze', 'research', 'investigate'];
    if (researchKeywords.some(kw => t.includes(kw))) return 'research';

    // 编码类
    const codingKeywords = ['写', '编写', '开发', '代码', '函数', '脚本', 'code', 'develop', 'write', 'implement', 'build', 'function', 'script'];
    if (codingKeywords.some(kw => t.includes(kw))) return 'coding';

    // 多步骤类
    const multiKeywords = ['然后', '接着', '再', '流程', '工作流', 'then', 'after', 'workflow', 'pipeline'];
    if (multiKeywords.some(kw => t.includes(kw))) return 'multi-step';

    return 'simple';
  }
}

module.exports = { MaselRouter };
