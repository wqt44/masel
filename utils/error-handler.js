/**
 * OpenClaw Error Handler
 * 统一错误处理模块
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

// 错误日志路径
const ERROR_LOG_PATH = path.join(config.paths.memory, 'logs/errors.jsonl');

/**
 * 错误处理器类
 */
class ErrorHandler {
  constructor(context) {
    this.context = context || 'openclaw';
    this.errors = [];
    this.recoveryStrategies = new Map();
    
    // 注册默认恢复策略
    this.registerDefaultStrategies();
  }

  /**
   * 注册默认恢复策略
   */
  registerDefaultStrategies() {
    // 文件不存在错误
    this.registerStrategy('ENOENT', async (error, context) => {
      console.log(`[ErrorHandler] Attempting to create missing directory: ${context}`);
      try {
        fs.mkdirSync(path.dirname(context), { recursive: true });
        return { success: true, action: 'created_directory' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    
    // 权限错误
    this.registerStrategy('EACCES', async (error, context) => {
      console.log(`[ErrorHandler] Permission denied: ${context}`);
      return { success: false, action: 'permission_denied', requiresManualFix: true };
    });
    
    // 超时错误
    this.registerStrategy('ETIMEDOUT', async (error, context) => {
      console.log(`[ErrorHandler] Timeout, retrying: ${context}`);
      return { success: false, action: 'timeout', shouldRetry: true };
    });
    
    // 网络错误
    this.registerStrategy('NETWORK_ERROR', async (error, context) => {
      console.log(`[ErrorHandler] Network error: ${context}`);
      return { success: false, action: 'network_error', shouldRetry: true };
    });
  }

  /**
   * 注册恢复策略
   */
  registerStrategy(errorCode, strategyFn) {
    this.recoveryStrategies.set(errorCode, strategyFn);
  }

  /**
   * 包装异步函数
   */
  async wrap(asyncFn, options = {}) {
    const {
      context = this.context,
      retries = 0,
      retryDelay = 1000,
      fallback = null
    } = options;
    
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await asyncFn();
        return { success: true, data: result, attempts: attempt + 1 };
      } catch (error) {
        lastError = error;
        
        // 记录错误
        this.logError(error, context, attempt);
        
        // 尝试恢复
        const recovery = await this.attemptRecovery(error, context);
        
        if (recovery.success) {
          console.log(`[ErrorHandler] Recovered from error: ${error.message}`);
          continue;  // 重试
        }
        
        // 如果需要重试且还有次数
        if (recovery.shouldRetry && attempt < retries) {
          console.log(`[ErrorHandler] Retrying in ${retryDelay}ms...`);
          await this.sleep(retryDelay);
          continue;
        }
        
        // 无法恢复，使用 fallback
        if (fallback) {
          console.log(`[ErrorHandler] Using fallback for: ${context}`);
          try {
            const fallbackResult = await fallback(error);
            return { success: true, data: fallbackResult, fromFallback: true };
          } catch (fallbackError) {
            // fallback 也失败了
          }
        }
        
        // 所有尝试都失败
        break;
      }
    }
    
    // 返回错误结果
    return {
      success: false,
      error: lastError,
      message: lastError.message,
      context,
      attempts: retries + 1
    };
  }

  /**
   * 包装同步函数
   */
  wrapSync(syncFn, options = {}) {
    const { context = this.context, fallback = null } = options;
    
    try {
      const result = syncFn();
      return { success: true, data: result };
    } catch (error) {
      this.logError(error, context);
      
      // 尝试同步恢复
      const recovery = this.attemptSyncRecovery(error, context);
      
      if (recovery.success) {
        // 恢复后重试一次
        try {
          const result = syncFn();
          return { success: true, data: result, recovered: true };
        } catch (retryError) {
          // 重试失败
        }
      }
      
      // 使用 fallback
      if (fallback) {
        try {
          const fallbackResult = fallback(error);
          return { success: true, data: fallbackResult, fromFallback: true };
        } catch (fallbackError) {
          // fallback 也失败了
        }
      }
      
      return {
        success: false,
        error,
        message: error.message,
        context
      };
    }
  }

  /**
   * 尝试恢复 (异步)
   */
  async attemptRecovery(error, context) {
    const strategy = this.recoveryStrategies.get(error.code);
    
    if (strategy) {
      try {
        return await strategy(error, context);
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    
    // 通用恢复策略
    if (error.message && error.message.includes('network')) {
      return { success: false, shouldRetry: true };
    }
    
    return { success: false };
  }

  /**
   * 尝试恢复 (同步)
   */
  attemptSyncRecovery(error, context) {
    // 文件不存在
    if (error.code === 'ENOENT') {
      try {
        fs.mkdirSync(path.dirname(context), { recursive: true });
        return { success: true };
      } catch (e) {
        return { success: false };
      }
    }
    
    return { success: false };
  }

  /**
   * 记录错误
   */
  logError(error, context, attempt = 0) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      context,
      attempt,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    };
    
    // 确保目录存在
    const logDir = path.dirname(ERROR_LOG_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // 追加到日志文件
    fs.appendFileSync(ERROR_LOG_PATH, JSON.stringify(errorRecord) + '\n');
    
    // 也输出到控制台
    if (config.logging.level === 'debug') {
      console.error(`[ErrorHandler] ${context}:`, error.message);
    }
  }

  /**
   * 获取错误统计
   */
  getErrorStats(timeRange = 24 * 60 * 60 * 1000) {
    if (!fs.existsSync(ERROR_LOG_PATH)) {
      return { total: 0, byContext: {}, byType: {} };
    }
    
    const content = fs.readFileSync(ERROR_LOG_PATH, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l);
    
    const cutoff = Date.now() - timeRange;
    const stats = {
      total: 0,
      byContext: {},
      byType: {},
      recent: []
    };
    
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        const recordTime = new Date(record.timestamp).getTime();
        
        if (recordTime >= cutoff) {
          stats.total++;
          
          // 按上下文统计
          stats.byContext[record.context] = (stats.byContext[record.context] || 0) + 1;
          
          // 按类型统计
          const type = record.error.name || 'Unknown';
          stats.byType[type] = (stats.byType[type] || 0) + 1;
          
          // 最近错误
          stats.recent.push(record);
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    // 只保留最近 10 条
    stats.recent = stats.recent.slice(-10);
    
    return stats;
  }

  /**
   * 清理旧错误日志
   */
  cleanupOldErrors(maxAge = 30 * 24 * 60 * 60 * 1000) {
    if (!fs.existsSync(ERROR_LOG_PATH)) return;
    
    const content = fs.readFileSync(ERROR_LOG_PATH, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l);
    
    const cutoff = Date.now() - maxAge;
    const recentLines = [];
    
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        const recordTime = new Date(record.timestamp).getTime();
        
        if (recordTime >= cutoff) {
          recentLines.push(line);
        }
      } catch (e) {
        // 保留无法解析的行
        recentLines.push(line);
      }
    }
    
    fs.writeFileSync(ERROR_LOG_PATH, recentLines.join('\n') + '\n');
    
    return {
      before: lines.length,
      after: recentLines.length,
      removed: lines.length - recentLines.length
    };
  }

  /**
   * 辅助方法
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 创建默认实例
const defaultHandler = new ErrorHandler();

// 导出
module.exports = {
  ErrorHandler,
  default: defaultHandler,
  
  // 便捷方法
  wrap: (fn, opts) => defaultHandler.wrap(fn, opts),
  wrapSync: (fn, opts) => defaultHandler.wrapSync(fn, opts),
  getStats: (range) => defaultHandler.getErrorStats(range),
  cleanup: (maxAge) => defaultHandler.cleanupOldErrors(maxAge)
};

// 如果直接运行，显示错误统计
if (require.main === module) {
  const stats = defaultHandler.getErrorStats();
  console.log('Error Statistics (last 24h):');
  console.log(JSON.stringify(stats, null, 2));
}
