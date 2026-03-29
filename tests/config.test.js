/**
 * Config Module Tests
 * 配置模块测试
 */

const { describe, assert } = require('../utils/test-framework.js');
const config = require('../config');

const suite = describe('Config Module', (s) => {
  
  s.test('should load default configuration', () => {
    const defaultConfig = config.default;
    assert.defined(defaultConfig, 'Default config should be defined');
    assert.defined(defaultConfig.system, 'System config should be defined');
    assert.defined(defaultConfig.paths, 'Paths config should be defined');
  });
  
  s.test('should get nested configuration', () => {
    const memoryConfig = config.get('memory');
    assert.defined(memoryConfig, 'Memory config should be defined');
    assert.defined(memoryConfig.layers, 'Memory layers should be defined');
  });
  
  s.test('should return undefined for invalid path', () => {
    const invalid = config.get('invalid.path.that.does.not.exist');
    assert.undefined(invalid, 'Invalid path should return undefined');
  });
  
  s.test('should have valid paths configuration', () => {
    const paths = config.paths;
    assert.defined(paths.skills, 'Skills path should be defined');
    assert.defined(paths.utils, 'Utils path should be defined');
    assert.defined(paths.memory, 'Memory path should be defined');
  });
  
  s.test('should have memory layer configuration', () => {
    const memory = config.memory;
    assert.defined(memory.layers.l0, 'L0 layer should be defined');
    assert.defined(memory.layers.l1, 'L1 layer should be defined');
    assert.defined(memory.layers.l2, 'L2 layer should be defined');
    assert.defined(memory.layers.l3, 'L3 layer should be defined');
  });
  
  s.test('should have valid retention periods', () => {
    const l0 = config.get('memory.layers.l0');
    assert.defined(l0.retention, 'L0 retention should be defined');
    assert.true(l0.retention.days > 0, 'L0 retention days should be positive');
  });
  
  s.test('should validate configuration', () => {
    const validation = config.validate();
    assert.true(validation.valid, 'Configuration should be valid');
    assert.equal(validation.errors.length, 0, 'Should have no errors');
  });
  
  s.test('should have self-improving configuration', () => {
    const improving = config.selfImproving;
    assert.defined(improving.intervals, 'Intervals should be defined');
    assert.defined(improving.thresholds, 'Thresholds should be defined');
    assert.true(improving.thresholds.minHealthScore >= 0, 'Min health score should be >= 0');
    assert.true(improving.thresholds.minHealthScore <= 100, 'Min health score should be <= 100');
  });
  
  s.test('should have security configuration', () => {
    const security = config.security;
    assert.defined(security, 'Security config should be defined');
    assert.true(security.inputValidation, 'Input validation should be enabled');
    assert.true(security.pathTraversalProtection, 'Path traversal protection should be enabled');
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
