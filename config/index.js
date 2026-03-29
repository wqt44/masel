/**
 * OpenClaw Unified Configuration
 * 统一配置中心
 */

const path = require('path');

// 基础路径
const BASE_PATH = path.join(__dirname, '..');

// 默认配置
const defaultConfig = {
  // 系统信息
  system: {
    name: 'OpenClaw',
    version: '1.0.0',
    workspace: BASE_PATH,
    nodeVersion: process.version,
    platform: process.platform
  },
  
  // 路径配置
  paths: {
    skills: path.join(BASE_PATH, 'skills'),
    utils: path.join(BASE_PATH, 'utils'),
    memory: path.join(BASE_PATH, 'memory'),
    tests: path.join(BASE_PATH, 'tests'),
    config: path.join(BASE_PATH, 'config'),
    logs: path.join(BASE_PATH, 'memory/logs')
  },
  
  // 记忆系统配置
  memory: {
    // 分层存储配置
    layers: {
      l0: {
        name: 'raw',
        retention: { days: 90, maxRecords: 10000 },
        path: path.join(BASE_PATH, 'memory/raw-conversations')
      },
      l1: {
        name: 'summary',
        retention: { days: 365 },
        path: path.join(BASE_PATH, 'memory/daily-summaries')
      },
      l2: {
        name: 'structured',
        retention: {
          critical: { days: Infinity },
          important: { days: 90 },
          temporary: { days: 7 }
        },
        path: path.join(BASE_PATH, 'memory/structured')
      },
      l3: {
        name: 'patterns',
        retention: { days: Infinity },
        path: path.join(BASE_PATH, 'memory/patterns')
      }
    },
    
    // 防遗忘配置
    forgetfulness: {
      activePeriod: 30,      // 活跃期 (天)
      dormantPeriod: 60,     // 休眠期 (天)
      warningPeriod: 7,      // 警告期 (天)
      mentionThreshold: 0.6  // 提及相似度阈值
    }
  },
  
  // 自我改进配置
  selfImproving: {
    intervals: {
      healthCheck: 5 * 60 * 1000,        // 5 分钟
      memoryMaintenance: 60 * 60 * 1000,  // 1 小时
      selfImprovement: 4 * 60 * 60 * 1000, // 4 小时
      skillDiscovery: 24 * 60 * 60 * 1000  // 24 小时
    },
    thresholds: {
      minHealthScore: 70,
      maxErrorRate: 0.1,
      autoFix: true
    },
    strategies: ['balanced', 'innovate', 'harden', 'repair-only']
  },
  
  // 技能流水线配置
  skillPipeline: {
    thresholds: {
      minVetScore: 70,
      autoInstall: true,
      autoUpdate: true
    },
    sources: ['clawhub', 'github', 'local'],
    categories: ['memory', 'automation', 'browser', 'analysis']
  },
  
  // OAC 配置
  oac: {
    enabled: true,
    autoStart: false,
    stateFile: path.join(BASE_PATH, 'memory/oac/state.json'),
    logFile: path.join(BASE_PATH, 'memory/oac/automation.log'),
    reportDir: path.join(BASE_PATH, 'memory/oac/reports')
  },
  
  // 日志配置
  logging: {
    level: 'info',  // debug, info, warn, error
    format: 'json',
    rotation: {
      enabled: true,
      maxFiles: 30,
      maxSize: '10m'
    }
  },
  
  // 安全配置
  security: {
    inputValidation: true,
    pathTraversalProtection: true,
    maxInputLength: 10000,
    allowedCommands: ['clawhub', 'agent-browser', 'node', 'npm']
  }
};

// 用户配置 (可以覆盖默认配置)
let userConfig = {};

// 尝试加载用户配置
try {
  const userConfigPath = path.join(__dirname, 'user.js');
  if (require.resolve(userConfigPath)) {
    userConfig = require(userConfigPath);
  }
} catch (e) {
  // 用户配置不存在，使用默认配置
}

/**
 * 深度合并配置
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * 获取配置
 */
function getConfig(path) {
  const merged = deepMerge(defaultConfig, userConfig);
  
  if (!path) return merged;
  
  const keys = path.split('.');
  let value = merged;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * 设置用户配置
 */
function setUserConfig(path, value) {
  const keys = path.split('.');
  let current = userConfig;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
  
  // 保存到文件
  saveUserConfig();
}

/**
 * 保存用户配置
 */
function saveUserConfig() {
  const fs = require('fs');
  const userConfigPath = path.join(__dirname, 'user.js');
  
  const content = `// User configuration - auto-generated
module.exports = ${JSON.stringify(userConfig, null, 2)};
`;
  
  fs.writeFileSync(userConfigPath, content);
}

/**
 * 验证配置
 */
function validateConfig() {
  const errors = [];
  const config = getConfig();
  
  // 验证路径
  for (const [key, value] of Object.entries(config.paths)) {
    if (typeof value !== 'string') {
      errors.push(`paths.${key} must be a string`);
    }
  }
  
  // 验证阈值
  if (config.selfImproving.thresholds.minHealthScore < 0 || 
      config.selfImproving.thresholds.minHealthScore > 100) {
    errors.push('selfImproving.thresholds.minHealthScore must be between 0 and 100');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 导出
module.exports = {
  default: defaultConfig,
  user: userConfig,
  get: getConfig,
  set: setUserConfig,
  validate: validateConfig,
  
  // 便捷访问
  get paths() { return getConfig('paths'); },
  get memory() { return getConfig('memory'); },
  get selfImproving() { return getConfig('selfImproving'); },
  get skillPipeline() { return getConfig('skillPipeline'); },
  get oac() { return getConfig('oac'); },
  get logging() { return getConfig('logging'); },
  get security() { return getConfig('security'); }
};

// 如果直接运行，验证配置
if (require.main === module) {
  const validation = validateConfig();
  
  if (validation.valid) {
    console.log('✓ Configuration is valid');
    console.log('\nCurrent configuration:');
    console.log(JSON.stringify(getConfig(), null, 2));
  } else {
    console.error('✗ Configuration errors:');
    validation.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}
