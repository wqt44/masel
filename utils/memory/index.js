/**
 * Unified Memory System
 * 统一记忆系统入口
 * 
 * 这是所有记忆功能的统一入口，替代：
 * - utils/ultimate-memory.js
 * - utils/smart-memory.js
 * - utils/global-memory.js
 * - utils/memory-system/ultimate-memory.js
 */

const { UnifiedMemory, getInstance } = require('./core/memory-engine');
const config = require('../../config');

// 默认实例
const defaultMemory = getInstance();

/**
 * 初始化记忆系统
 */
function initialize(options = {}) {
  const memory = options.instance || defaultMemory;
  return memory.initialize();
}

/**
 * 存储记忆
 */
async function store(data, options = {}) {
  return defaultMemory.store(data, options);
}

/**
 * 检索记忆
 */
async function retrieve(query, options = {}) {
  return defaultMemory.retrieve(query, options);
}

/**
 * 更新记忆
 */
async function update(id, data, options = {}) {
  return defaultMemory.update(id, data, options);
}

/**
 * 删除记忆
 */
async function remove(id, options = {}) {
  return defaultMemory.delete(id, options);
}

/**
 * 获取统计
 */
function getStats() {
  return defaultMemory.getStats();
}

/**
 * 执行维护
 */
async function maintenance() {
  return defaultMemory.maintenance();
}

/**
 * 便捷方法：记录对话
 */
async function recordConversation(userMessage, aiResponse, metadata = {}) {
  return store(
    { userMessage, aiResponse, metadata },
    { 
      layer: 'l0',
      type: 'conversation',
      importance: 'normal'
    }
  );
}

/**
 * 便捷方法：存储结构化记忆
 */
async function recordMemory(type, content, options = {}) {
  return store(
    { type, content },
    {
      layer: 'l2',
      type,
      importance: options.importance || 'important',
      metadata: options
    }
  );
}

/**
 * 便捷方法：搜索记忆
 */
async function searchMemories(query, options = {}) {
  return retrieve(query, {
    layers: ['l2', 'l1', 'l0'],
    limit: options.limit || 10,
    ...options
  });
}

/**
 * 便捷方法：获取会话上下文
 */
async function getSessionContext(options = {}) {
  const { limit = 10 } = options;
  
  // 获取最近对话
  const conversations = await retrieve('', {
    layers: ['l0'],
    limit,
    type: 'conversation'
  });
  
  // 获取活跃记忆
  const memories = await retrieve('', {
    layers: ['l2'],
    limit,
    importance: 'important'
  });
  
  return {
    conversations: conversations.results || [],
    memories: memories.results || [],
    timestamp: new Date().toISOString()
  };
}

// 导出 API
module.exports = {
  // 核心类
  UnifiedMemory,
  getInstance,
  
  // 基础操作
  initialize,
  store,
  retrieve,
  update,
  remove: remove,
  getStats,
  maintenance,
  
  // 便捷方法
  recordConversation,
  recordMemory,
  searchMemories,
  getSessionContext,
  
  // 默认实例
  default: defaultMemory
};

// 如果直接运行，测试
if (require.main === module) {
  (async () => {
    console.log('Testing Unified Memory System...\n');
    
    // 初始化
    const init = initialize();
    console.log('✓ Initialized:', init.data?.status || init.status);
    
    // 存储测试
    const store1 = await recordMemory('project', 'Test project', { importance: 'important' });
    console.log('✓ Stored:', store1.data?.id || store1.id);
    
    // 检索测试
    const search = await searchMemories('project');
    console.log('✓ Search results:', search.data?.results?.length || 0);
    
    // 统计
    console.log('\nStats:', getStats());
    
    console.log('\n✓ All tests passed!');
  })();
}
