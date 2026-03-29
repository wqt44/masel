/**
 * MASEL Memory Adapter
 * MASEL 记忆系统适配器
 * 
 * 兼容旧的 MASEL 记忆 API
 */

const memory = require('../index');

/**
 * 初始化 MASEL 记忆
 */
function initMaselMemory(userId, agentId) {
  memory.initialize();
  
  return {
    userId,
    agentId,
    initialized: true
  };
}

/**
 * 记录自动记忆 (兼容旧 API)
 */
async function autoRecord(message, response, metadata = {}) {
  return memory.recordConversation(message, response, metadata);
}

/**
 * 回忆自动记忆 (兼容旧 API)
 */
async function autoRecall(query, options = {}) {
  const result = await memory.searchMemories(query, options);
  
  return result.data?.results?.map(r => ({
    content: r.data?.content || r.data,
    timestamp: r.timestamp,
    type: r.type,
    relevance: r.relevance
  })) || [];
}

/**
 * 创建记忆 (兼容旧 API)
 */
async function createMemory(agentType) {
  return {
    startTask: async (taskName) => {
      return memory.recordMemory('task', taskName, { 
        agentType,
        status: 'started'
      });
    },
    
    recordSuccess: async (result) => {
      return memory.recordMemory('task_result', result, {
        agentType,
        status: 'success'
      });
    },
    
    recordFailure: async (error) => {
      return memory.recordMemory('task_error', error, {
        agentType,
        status: 'failed'
      });
    }
  };
}

/**
 * 使用记忆包装器 (兼容旧 API)
 */
async function withMemory(agentType, taskName, asyncFn) {
  const mem = await createMemory(agentType);
  await mem.startTask(taskName);
  
  try {
    const result = await asyncFn();
    await mem.recordSuccess(result);
    return result;
  } catch (error) {
    await mem.recordFailure(error.message);
    throw error;
  }
}

/**
 * 获取会话上下文 (兼容旧 API)
 */
async function getMaselContext(options = {}) {
  return memory.getSessionContext(options);
}

// 导出兼容 API
module.exports = {
  // 初始化
  initMaselMemory,
  
  // 核心功能
  autoRecord,
  autoRecall,
  createMemory,
  withMemory,
  
  // 上下文
  getMaselContext,
  
  // 透传新 API
  ...memory
};
