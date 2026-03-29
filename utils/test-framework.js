/**
 * OpenClaw Test Framework
 * 统一测试框架
 */

const fs = require('fs');
const path = require('path');

// 测试结果
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
  startTime: Date.now()
};

/**
 * 测试套件
 */
class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.beforeEach = null;
    this.afterEach = null;
  }

  /**
   * 添加测试
   */
  test(name, fn) {
    this.tests.push({ name, fn, type: 'test' });
  }

  /**
   * 跳过测试
   */
  skip(name, fn) {
    this.tests.push({ name, fn, type: 'skip' });
  }

  /**
   * 设置前置钩子
   */
  beforeEach(fn) {
    this.beforeEach = fn;
  }

  /**
   * 设置后置钩子
   */
  afterEach(fn) {
    this.afterEach = fn;
  }

  /**
   * 运行所有测试
   */
  async run() {
    console.log(`\n  ${this.name}`);
    
    for (const test of this.tests) {
      if (test.type === 'skip') {
        console.log(`    ⚠ ${test.name} (skipped)`);
        results.skipped++;
        continue;
      }
      
      try {
        // 前置钩子
        if (this.beforeEach) await this.beforeEach();
        
        // 运行测试
        await test.fn();
        
        // 后置钩子
        if (this.afterEach) await this.afterEach();
        
        console.log(`    ✓ ${test.name}`);
        results.passed++;
        results.tests.push({ suite: this.name, name: test.name, status: 'passed' });
      } catch (error) {
        console.log(`    ✗ ${test.name}`);
        console.log(`      ${error.message}`);
        results.failed++;
        results.tests.push({ 
          suite: this.name, 
          name: test.name, 
          status: 'failed',
          error: error.message 
        });
      }
    }
  }
}

/**
 * 断言库
 */
const assert = {
  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  },

  notEqual(actual, expected, message) {
    if (actual === expected) {
      throw new Error(message || `Expected not ${expected}`);
    }
  },

  true(value, message) {
    if (value !== true) {
      throw new Error(message || `Expected true, got ${value}`);
    }
  },

  false(value, message) {
    if (value !== false) {
      throw new Error(message || `Expected false, got ${value}`);
    }
  },

  throws(fn, message) {
    let threw = false;
    try {
      fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected function to throw');
    }
  },

  async throwsAsync(fn, message) {
    let threw = false;
    try {
      await fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected async function to throw');
    }
  },

  contains(haystack, needle, message) {
    if (!haystack.includes(needle)) {
      throw new Error(message || `Expected ${haystack} to contain ${needle}`);
    }
  },

  defined(value, message) {
    if (value === undefined) {
      throw new Error(message || 'Expected value to be defined');
    }
  },

  undefined(value, message) {
    if (value !== undefined) {
      throw new Error(message || `Expected undefined, got ${value}`);
    }
  }
};

/**
 * 创建测试套件
 */
function describe(name, fn) {
  const suite = new TestSuite(name);
  fn(suite);
  return suite;
}

/**
 * 运行所有测试
 */
async function runTests(testFiles) {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     OpenClaw Test Framework                            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  const suites = [];
  
  // 加载测试文件
  for (const file of testFiles) {
    try {
      const testModule = require(file);
      if (testModule.suite) {
        suites.push(testModule.suite);
      }
    } catch (e) {
      console.error(`Failed to load test file: ${file}`);
      console.error(e.message);
    }
  }
  
  // 运行测试套件
  for (const suite of suites) {
    await suite.run();
  }
  
  // 输出结果
  const duration = Date.now() - results.startTime;
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`Tests: ${results.passed + results.failed + results.skipped}`);
  console.log(`  ✓ Passed: ${results.passed}`);
  console.log(`  ✗ Failed: ${results.failed}`);
  console.log(`  ⚠ Skipped: ${results.skipped}`);
  console.log(`Duration: ${duration}ms`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 保存结果
  saveResults(duration);
  
  // 返回退出码
  return results.failed === 0 ? 0 : 1;
}

/**
 * 保存测试结果
 */
function saveResults(duration) {
  const resultPath = path.join(__dirname, '../../memory/tests', `result-${Date.now()}.json`);
  
  // 确保目录存在
  const dir = path.dirname(resultPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const output = {
    timestamp: new Date().toISOString(),
    duration,
    ...results
  };
  
  fs.writeFileSync(resultPath, JSON.stringify(output, null, 2));
}

/**
 * 自动发现测试文件
 */
function discoverTests(testDir) {
  const tests = [];
  
  if (!fs.existsSync(testDir)) {
    return tests;
  }
  
  const files = fs.readdirSync(testDir);
  
  for (const file of files) {
    const filePath = path.join(testDir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      tests.push(...discoverTests(filePath));
    } else if (file.endsWith('.test.js') || file.endsWith('.spec.js')) {
      tests.push(filePath);
    }
  }
  
  return tests;
}

// 导出
module.exports = {
  describe,
  assert,
  runTests,
  discoverTests,
  results
};

// 如果直接运行
if (require.main === module) {
  const testDir = path.join(__dirname, '../../tests');
  const tests = discoverTests(testDir);
  
  if (tests.length === 0) {
    console.log('No tests found');
    process.exit(0);
  }
  
  runTests(tests).then(code => process.exit(code));
}
