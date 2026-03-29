/**
 * Self-Improving System Tests
 * 自我改进系统测试
 */

const { describe, assert } = require('../utils/test-framework.js');

const suite = describe('Self-Improving System', (s) => {
  
  s.test('should have selfImproving module', () => {
    const selfImproving = require('../utils/self-improving/self-improving');
    assert.defined(selfImproving, 'selfImproving should be defined');
  });
  
  s.test('should have initialize function', () => {
    const selfImproving = require('../utils/self-improving/self-improving');
    assert.defined(selfImproving.initialize, 'initialize should be defined');
  });
  
  s.test('should have analyzePerformance function', () => {
    const selfImproving = require('../utils/self-improving/self-improving');
    assert.defined(selfImproving.analyzePerformance, 'analyzePerformance should be defined');
  });
  
  s.test('should have selfImprove function', () => {
    const selfImproving = require('../utils/self-improving/self-improving');
    assert.defined(selfImproving.selfImprove, 'selfImprove should be defined');
  });
  
  s.test('should calculate health score', () => {
    const selfImproving = require('../utils/self-improving/self-improving');
    selfImproving.initialize();
    const analysis = selfImproving.analyzePerformance();
    assert.defined(analysis.health_score, 'Health score should be defined');
    assert.true(analysis.health_score >= 0 && analysis.health_score <= 100, 'Health score should be between 0 and 100');
  });
  
  s.test('should detect no regressions when healthy', () => {
    const selfImproving = require('../utils/self-improving/self-improving');
    selfImproving.initialize();
    const analysis = selfImproving.analyzePerformance();
    assert.defined(analysis.regressions, 'Regressions should be defined');
    assert.true(Array.isArray(analysis.regressions), 'Regressions should be an array');
  });
  
  s.test('should identify opportunities', () => {
    const selfImproving = require('../utils/self-improving/self-improving');
    selfImproving.initialize();
    const analysis = selfImproving.analyzePerformance();
    assert.defined(analysis.opportunities, 'Opportunities should be defined');
    assert.true(Array.isArray(analysis.opportunities), 'Opportunities should be an array');
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
