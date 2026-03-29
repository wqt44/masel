/**
 * 智能重要性管理
 * 防止重要项目因时间而被遗忘
 */

const fs = require('fs');
const path = require('path');
const { storeStructuredMemory, searchMemories, loadAllStructuredMemories } = require('./ultimate-memory.js');

// 配置
const IMPORTANCE_CONFIG = {
  // 活跃期：项目被发现后的前 30 天
  activePeriod: 30,
  
  // 休眠期：30-90 天，需要提醒
  dormantPeriod: 60,
  
  // 归档前警告期
  warningPeriod: 7,
  
  // 提及刷新阈值：相似度超过此值视为提及
  mentionThreshold: 0.6
};

/**
 * 检测对话中是否提及已知项目
 */
function detectProjectMentions(conversationText) {
  const mentions = [];
  const allMemories = loadAllStructuredMemories();
  
  // 筛选项目类型的记忆
  const projects = allMemories.filter(m => 
    m.type === 'project' && m.is_active !== false
  );
  
  for (const project of projects) {
    // 从项目内容中提取项目名称
    const projectName = extractProjectName(project.content);
    if (!projectName) continue;
    
    // 检查是否提及
    const isMentioned = checkMention(conversationText, projectName, project.content);
    
    if (isMentioned) {
      mentions.push({
        projectId: project.id,
        projectName: projectName,
        lastMentioned: new Date().toISOString()
      });
    }
  }
  
  return mentions;
}

/**
 * 从项目内容提取项目名称
 */
function extractProjectName(content) {
  // 匹配 "用户有一个叫 X 的项目" 格式
  const match = content.match(/叫\s+(\w+)\s+的项目/i);
  if (match) return match[1];
  
  // 匹配 "X 项目"
  const match2 = content.match(/(\w+)\s*项目/i);
  if (match2) return match2[1];
  
  return null;
}

/**
 * 检查文本是否提及项目
 */
function checkMention(text, projectName, projectContent) {
  const textLower = text.toLowerCase();
  const nameLower = projectName.toLowerCase();
  
  // 直接匹配项目名称
  if (textLower.includes(nameLower)) {
    return true;
  }
  
  // 语义相似度检查（简化版）
  const words1 = new Set(textLower.split(/\s+/));
  const words2 = new Set(projectContent.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  const similarity = intersection.size / union.size;
  
  return similarity > IMPORTANCE_CONFIG.mentionThreshold;
}

/**
 * 刷新项目重要性
 */
function refreshProjectImportance(projectId) {
  const memoriesPath = path.join(__dirname, '../../memory/structured/project');
  const files = fs.readdirSync(memoriesPath).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const filePath = path.join(memoriesPath, file);
    const memory = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (memory.id === projectId) {
      // 更新最后提及时间
      memory.last_mentioned = new Date().toISOString();
      memory.mention_count = (memory.mention_count || 0) + 1;
      
      // 如果即将被归档，重置创建时间（延长生命周期）
      const age = (new Date() - new Date(memory.created_at)) / (1000 * 60 * 60 * 24);
      if (age > IMPORTANCE_CONFIG.activePeriod) {
        memory.extended = true;
        memory.extension_count = (memory.extension_count || 0) + 1;
        console.log(`[ImportanceManager] 项目 ${extractProjectName(memory.content)} 重要性已刷新`);
      }
      
      fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
      return true;
    }
  }
  
  return false;
}

/**
 * 获取即将被遗忘的项目
 */
function getForgottenProjects() {
  const allMemories = loadAllStructuredMemories();
  const projects = allMemories.filter(m => m.type === 'project' && m.is_active !== false);
  
  const now = new Date();
  const forgotten = [];
  
  for (const project of projects) {
    const created = new Date(project.created_at);
    const lastMentioned = project.last_mentioned ? new Date(project.last_mentioned) : created;
    
    const age = (now - created) / (1000 * 60 * 60 * 24);
    const sinceLastMention = (now - lastMentioned) / (1000 * 60 * 60 * 24);
    
    // 活跃期后未被提及
    if (age > IMPORTANCE_CONFIG.activePeriod && sinceLastMention > IMPORTANCE_CONFIG.activePeriod) {
      const daysUntilArchive = 90 - age;
      
      forgotten.push({
        id: project.id,
        name: extractProjectName(project.content),
        content: project.content,
        age: Math.floor(age),
        daysSinceLastMention: Math.floor(sinceLastMention),
        daysUntilArchive: Math.floor(daysUntilArchive),
        urgency: daysUntilArchive < IMPORTANCE_CONFIG.warningPeriod ? 'high' : 'medium'
      });
    }
  }
  
  // 按紧迫性排序
  forgotten.sort((a, b) => a.daysUntilArchive - b.daysUntilArchive);
  
  return forgotten;
}

/**
 * 生成防遗忘提醒
 */
function generateForgetfulnessAlert() {
  const forgotten = getForgottenProjects();
  
  if (forgotten.length === 0) {
    return null;
  }
  
  const alerts = forgotten.map(p => {
    if (p.urgency === 'high') {
      return `⚠️ **${p.name}** 项目还有 ${p.daysUntilArchive} 天将被归档（已 ${p.daysSinceLastMention} 天未提及）`;
    } else {
      return `💤 **${p.name}** 项目已休眠 ${p.daysSinceLastMention} 天`;
    }
  });
  
  return {
    title: '🧠 记忆提醒',
    message: alerts.join('\n'),
    projects: forgotten,
    action: '用户可回复"继续跟踪 XX 项目"来刷新重要性'
  };
}

/**
 * 处理用户显式刷新请求
 */
function handleRefreshRequest(projectName) {
  const allMemories = loadAllStructuredMemories();
  const project = allMemories.find(m => 
    m.type === 'project' && 
    m.content.toLowerCase().includes(projectName.toLowerCase())
  );
  
  if (project) {
    refreshProjectImportance(project.id);
    return {
      success: true,
      message: `已刷新 ${projectName} 项目的重要性，将继续跟踪 90 天`
    };
  }
  
  return {
    success: false,
    message: `未找到 ${projectName} 项目`
  };
}

/**
 * 对话后处理：检测提及并刷新
 */
function afterConversation(userMessage, aiResponse) {
  const fullText = `${userMessage} ${aiResponse}`;
  const mentions = detectProjectMentions(fullText);
  
  const refreshed = [];
  for (const mention of mentions) {
    if (refreshProjectImportance(mention.projectId)) {
      refreshed.push(mention.projectName);
    }
  }
  
  // 检查是否有即将被遗忘的项目
  const alert = generateForgetfulnessAlert();
  
  return {
    mentionsDetected: mentions.length,
    refreshedProjects: refreshed,
    forgetfulnessAlert: alert
  };
}

/**
 * 获取项目状态报告
 */
function getProjectStatusReport() {
  const allMemories = loadAllStructuredMemories();
  const projects = allMemories.filter(m => m.type === 'project');
  
  const now = new Date();
  const report = {
    total: projects.length,
    active: 0,
    dormant: 0,
    atRisk: 0,
    details: []
  };
  
  for (const project of projects) {
    const created = new Date(project.created_at);
    const lastMentioned = project.last_mentioned ? new Date(project.last_mentioned) : created;
    
    const age = (now - created) / (1000 * 60 * 60 * 24);
    const sinceLastMention = (now - lastMentioned) / (1000 * 60 * 60 * 24);
    
    let status = 'active';
    if (age > 90) {
      status = 'archived';
    } else if (sinceLastMention > IMPORTANCE_CONFIG.activePeriod) {
      status = 'dormant';
      report.dormant++;
      if (90 - age < IMPORTANCE_CONFIG.warningPeriod) {
        report.atRisk++;
      }
    } else {
      report.active++;
    }
    
    report.details.push({
      name: extractProjectName(project.content),
      status,
      age: Math.floor(age),
      lastMentioned: project.last_mentioned ? Math.floor(sinceLastMention) : '从未',
      mentionCount: project.mention_count || 0
    });
  }
  
  return report;
}

module.exports = {
  detectProjectMentions,
  refreshProjectImportance,
  getForgottenProjects,
  generateForgetfulnessAlert,
  handleRefreshRequest,
  afterConversation,
  getProjectStatusReport,
  IMPORTANCE_CONFIG
};

// 测试
if (require.main === module) {
  console.log('=== 项目状态报告 ===');
  const report = getProjectStatusReport();
  console.log(JSON.stringify(report, null, 2));
  
  console.log('\n=== 防遗忘检查 ===');
  const alert = generateForgetfulnessAlert();
  if (alert) {
    console.log(alert.message);
  } else {
    console.log('所有项目都在活跃期');
  }
}
