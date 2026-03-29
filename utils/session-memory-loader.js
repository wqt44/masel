/**
 * Session Memory Loader
 * 在会话启动时加载所有记忆源
 */

const fs = require('fs');
const path = require('path');

const MEMORY_PATHS = {
  // MASEL 自动记忆
  maselAuto: path.join(__dirname, '../skills/masel/memory/auto'),
  // MASEL Viking 模式
  maselViking: path.join(__dirname, '../skills/masel/memory/viking'),
  // 每日笔记
  dailyNotes: path.join(__dirname, '../memory'),
  // 全局记忆
  globalMemory: path.join(process.env.HOME || '/home/tong0121', '.openclaw/memory')
};

/**
 * 加载 MASEL 自动记忆
 */
function loadMaselAutoMemories(limit = 20) {
  const conversationsPath = path.join(MEMORY_PATHS.maselAuto, 'conversations.jsonl');
  
  if (!fs.existsSync(conversationsPath)) {
    return [];
  }
  
  try {
    const content = fs.readFileSync(conversationsPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line);
    
    return lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(item => item !== null)
      .slice(-limit); // 取最近的
  } catch (e) {
    console.error('Error loading MASEL auto memories:', e.message);
    return [];
  }
}

/**
 * 加载 MASEL 用户画像
 */
function loadMaselUserProfile() {
  const profilePath = path.join(MEMORY_PATHS.maselAuto, 'user-profile.json');
  
  if (!fs.existsSync(profilePath)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * 加载 MASEL 全局记忆
 */
function loadMaselGlobalMemories() {
  const globalPath = path.join(MEMORY_PATHS.maselAuto, 'global-memories.json');
  
  if (!fs.existsSync(globalPath)) {
    return [];
  }
  
  try {
    return JSON.parse(fs.readFileSync(globalPath, 'utf-8'));
  } catch (e) {
    return [];
  }
}

/**
 * 加载最近几天的每日笔记
 */
function loadRecentDailyNotes(days = 3) {
  const notes = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const notePath = path.join(MEMORY_PATHS.dailyNotes, `${dateStr}.md`);
    
    if (fs.existsSync(notePath)) {
      try {
        const content = fs.readFileSync(notePath, 'utf-8');
        notes.push({ date: dateStr, content });
      } catch (e) {
        // ignore
      }
    }
  }
  
  return notes;
}

/**
 * 格式化记忆为上下文文本
 */
function formatMemoriesForContext(memories) {
  const sections = [];
  
  // 1. 用户画像
  if (memories.userProfile) {
    sections.push(`## 用户画像\n${JSON.stringify(memories.userProfile, null, 2)}`);
  }
  
  // 2. 全局记忆（项目、偏好等）
  if (memories.globalMemories && memories.globalMemories.length > 0) {
    const memoriesText = memories.globalMemories
      .map(m => `- [${m.type}] ${m.content} (${new Date(m.timestamp).toLocaleDateString()})`)
      .join('\n');
    sections.push(`## 重要记忆\n${memoriesText}`);
  }
  
  // 3. 最近对话
  if (memories.recentConversations && memories.recentConversations.length > 0) {
    const conversationText = memories.recentConversations
      .map(c => `[${new Date(c.timestamp).toLocaleString()}] 用户: ${c.message}\nAI: ${c.response}`)
      .join('\n\n');
    sections.push(`## 最近对话\n${conversationText}`);
  }
  
  // 4. 每日笔记摘要
  if (memories.dailyNotes && memories.dailyNotes.length > 0) {
    const notesText = memories.dailyNotes
      .map(n => `### ${n.date}\n${n.content.substring(0, 500)}...`)
      .join('\n\n');
    sections.push(`## 近期笔记\n${notesText}`);
  }
  
  return sections.join('\n\n---\n\n');
}

/**
 * 主函数：加载所有记忆
 */
function loadAllMemories(options = {}) {
  const {
    conversationLimit = 20,
    dailyNoteDays = 3
  } = options;
  
  const memories = {
    userProfile: loadMaselUserProfile(),
    globalMemories: loadMaselGlobalMemories(),
    recentConversations: loadMaselAutoMemories(conversationLimit),
    dailyNotes: loadRecentDailyNotes(dailyNoteDays),
    timestamp: new Date().toISOString()
  };
  
  return {
    raw: memories,
    formatted: formatMemoriesForContext(memories)
  };
}

/**
 * 快速检查是否有重要记忆需要提醒
 */
function checkImportantMemories() {
  const memories = loadAllMemories({ conversationLimit: 5 });
  const important = [];
  
  // 检查最近是否有重要项目提及
  const recentConversations = memories.raw.recentConversations;
  const projectKeywords = ['项目', 'project', '任务', 'task', '重要', 'urgent'];
  
  for (const conv of recentConversations) {
    const text = `${conv.message} ${conv.response}`.toLowerCase();
    if (projectKeywords.some(kw => text.includes(kw.toLowerCase()))) {
      important.push({
        type: 'conversation',
        timestamp: conv.timestamp,
        summary: conv.message.substring(0, 100)
      });
      break; // 只取最近一条
    }
  }
  
  return important;
}

module.exports = {
  loadAllMemories,
  loadMaselAutoMemories,
  loadMaselUserProfile,
  loadMaselGlobalMemories,
  loadRecentDailyNotes,
  formatMemoriesForContext,
  checkImportantMemories
};

// 如果直接运行，打印记忆摘要
if (require.main === module) {
  const memories = loadAllMemories();
  console.log('=== 记忆加载摘要 ===');
  console.log(`用户画像: ${memories.raw.userProfile ? '✓' : '✗'}`);
  console.log(`全局记忆: ${memories.raw.globalMemories?.length || 0} 条`);
  console.log(`最近对话: ${memories.raw.recentConversations?.length || 0} 条`);
  console.log(`每日笔记: ${memories.raw.dailyNotes?.length || 0} 天`);
  console.log('\n=== 格式化内容预览 ===');
  console.log(memories.formatted.substring(0, 1000) + '...');
}
