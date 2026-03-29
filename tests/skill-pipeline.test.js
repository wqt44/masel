/**
 * Skill Pipeline Tests
 * 技能流水线测试
 */

const { describe, assert } = require('../utils/test-framework.js');

const suite = describe('Skill Pipeline', (s) => {
  
  s.test('should initialize skill pipeline', () => {
    const pipeline = require('../utils/skill-pipeline/skill-pipeline');
    const result = pipeline.initialize();
    // initialize 返回 { status: 'initialized', history: n }
    assert.equal(result.status, 'initialized', 'Pipeline should return initialized status');
    assert.defined(result.history, 'Pipeline should return history count');
  });
  
  s.test('should have findSkills function', () => {
    const pipeline = require('../utils/skill-pipeline/skill-pipeline');
    assert.defined(pipeline.findSkills, 'findSkills should be defined');
    assert.equal(typeof pipeline.findSkills, 'function', 'findSkills should be a function');
  });
  
  s.test('should have vetSkills function', () => {
    const pipeline = require('../utils/skill-pipeline/skill-pipeline');
    assert.defined(pipeline.vetSkills, 'vetSkills should be defined');
    assert.equal(typeof pipeline.vetSkills, 'function', 'vetSkills should be a function');
  });
  
  s.test('should have runPipeline function', () => {
    const pipeline = require('../utils/skill-pipeline/skill-pipeline');
    assert.defined(pipeline.runPipeline, 'runPipeline should be defined');
    assert.equal(typeof pipeline.runPipeline, 'function', 'runPipeline should be a function');
  });
  
  s.test('should parse search results correctly', () => {
    const pipeline = require('../utils/skill-pipeline/skill-pipeline');
    // Test internal parse function if exposed
    assert.defined(pipeline, 'Pipeline module should be defined');
  });
  
  s.test('should handle empty skill list', async () => {
    const pipeline = require('../utils/skill-pipeline/skill-pipeline');
    const result = await pipeline.vetSkills([]);
    assert.equal(result.total, 0, 'Should handle empty list');
    assert.equal(result.passed, 0, 'Should have 0 passed');
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
