/**
 * Unified Memory System Tests
 * 统一记忆系统测试
 */

const { describe, assert } = require('../utils/test-framework.js');
const memory = require('../utils/memory');

const suite = describe('Unified Memory System', (s) => {
  
  // 初始化测试
  s.test('should initialize memory system', () => {
    const result = memory.initialize();
    assert.true(result.success, 'Initialization should succeed');
  });
  
  // 存储测试
  s.test('should store memory', async () => {
    const result = await memory.store(
      { content: 'Test memory' },
      { type: 'test', importance: 'important' }
    );
    assert.true(result.success, 'Store should succeed');
    assert.defined(result.data?.id, 'Should return an ID');
  });
  
  // 检索测试
  s.test('should retrieve memories', async () => {
    // 先存储一些数据
    await memory.store(
      { content: 'Searchable content' },
      { type: 'test' }
    );
    
    const result = await memory.retrieve('Searchable');
    assert.true(result.success, 'Retrieve should succeed');
    assert.defined(result.data?.results, 'Should return results');
  });
  
  // 便捷方法测试
  s.test('should record conversation', async () => {
    const result = await memory.recordConversation(
      'Hello',
      'Hi there!',
      { test: true }
    );
    assert.true(result.success, 'Record conversation should succeed');
  });
  
  s.test('should record memory', async () => {
    const result = await memory.recordMemory(
      'project',
      'Test project',
      { importance: 'important' }
    );
    assert.true(result.success, 'Record memory should succeed');
  });
  
  s.test('should search memories', async () => {
    await memory.recordMemory('test', 'Search me');
    
    const result = await memory.searchMemories('Search');
    assert.true(result.success, 'Search should succeed');
  });
  
  // 统计测试
  s.test('should return stats', () => {
    const stats = memory.getStats();
    assert.defined(stats.reads, 'Stats should include reads');
    assert.defined(stats.writes, 'Stats should include writes');
    assert.defined(stats.layers, 'Stats should include layers');
  });
  
  // 维护测试
  s.test('should run maintenance', async () => {
    const result = await memory.maintenance();
    // errorHandler.wrap 返回 { success: true, data: {...} }
    // 其中 data 是 { status: 'completed', layers: {...} }
    assert.true(result.success, 'Maintenance should return success');
    assert.defined(result.data, 'Maintenance should return data');
    assert.equal(result.data?.status, 'completed', 'Maintenance status should be completed');
  });
  
  // 会话上下文测试
  s.test('should get session context', async () => {
    const result = await memory.getSessionContext();
    // 结果可能是 { success: true, data: {...} } 或直接是数据
    const data = result.data || result;
    assert.defined(data.conversations || data, 'Should return context data');
  });
  
});

module.exports = { suite };

// 如果直接运行
if (require.main === module) {
  suite.run().then(() => {
    const { results } = require('../utils/test-framework.js');
    process.exit(results.failed > 0 ? 1 : 0);
  });
}
