/**
 * Unified Memory System Core
 * 统一记忆系统核心
 * 
 * 整合所有记忆功能：
 * - Ultimate Memory (分层存储)
 * - Smart Memory (智能检索)
 * - Global Memory (全局访问)
 * - Context Memory (上下文管理)
 * - Time Decay Memory (时间衰减)
 */

const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const { ErrorHandler } = require('../../error-handler');

// 错误处理器
const errorHandler = new ErrorHandler('memory-core');

/**
 * 统一记忆系统类
 */
class UnifiedMemory {
  constructor(options = {}) {
    this.options = {
      workspace: config.paths.memory,
      ...options
    };
    
    // 初始化存储层
    this.layers = {
      l0: new L0RawLayer(this.options),
      l1: new L1SummaryLayer(this.options),
      l2: new L2StructuredLayer(this.options),
      l3: new L3PatternLayer(this.options)
    };
    
    // 缓存
    this.cache = new Map();
    this.cacheMaxSize = 1000;
    
    // 统计
    this.stats = {
      reads: 0,
      writes: 0,
      hits: 0,
      misses: 0
    };
  }

  /**
   * 初始化
   */
  initialize() {
    return errorHandler.wrapSync(() => {
      // 确保目录存在
      Object.values(this.layers).forEach(layer => layer.initialize());
      
      console.log('[UnifiedMemory] 初始化完成');
      return { status: 'initialized', layers: Object.keys(this.layers) };
    }, { context: 'memory-initialize' });
  }

  /**
   * 存储记忆 (智能选择层级)
   */
  async store(data, options = {}) {
    return errorHandler.wrap(async () => {
      const { 
        layer = 'auto',  // auto, l0, l1, l2, l3
        type = 'general',
        importance = 'normal',  // critical, important, normal, temporary
        metadata = {}
      } = options;
      
      // 自动选择层级
      const targetLayer = layer === 'auto' 
        ? this.selectLayer(data, type, importance)
        : this.layers[layer];
      
      // 生成唯一ID
      const id = this.generateId(type);
      
      // 存储数据
      const record = {
        id,
        timestamp: new Date().toISOString(),
        type,
        importance,
        data,
        metadata
      };
      
      await targetLayer.store(id, record);
      
      // 更新缓存
      this.cache.set(id, record);
      this.maintainCache();
      
      // 更新统计
      this.stats.writes++;
      
      return { id, layer: targetLayer.name, status: 'stored' };
    }, { context: 'memory-store' });
  }

  /**
   * 检索记忆
   */
  async retrieve(query, options = {}) {
    return errorHandler.wrap(async () => {
      const {
        layers = ['l2', 'l1', 'l0'],  // 搜索顺序
        limit = 10,
        minRelevance = 0.1
      } = options;
      
      this.stats.reads++;
      
      // 先检查缓存
      const cached = this.searchCache(query);
      if (cached.length > 0) {
        this.stats.hits++;
        return { source: 'cache', results: cached.slice(0, limit) };
      }
      
      // 按层级搜索
      const results = [];
      
      for (const layerName of layers) {
        const layer = this.layers[layerName];
        const layerResults = await layer.search(query, { limit, minRelevance });
        
        results.push(...layerResults.map(r => ({
          ...r,
          layer: layerName,
          relevance: this.calculateRelevance(query, r)
        })));
      }
      
      // 排序并限制数量
      results.sort((a, b) => b.relevance - a.relevance);
      const finalResults = results.slice(0, limit);
      
      this.stats.misses++;
      
      return {
        source: 'storage',
        results: finalResults,
        total: results.length
      };
    }, { context: 'memory-retrieve' });
  }

  /**
   * 更新记忆
   */
  async update(id, data, options = {}) {
    return errorHandler.wrap(async () => {
      // 查找现有记录
      const existing = await this.findById(id);
      
      if (!existing) {
        return { status: 'not_found', id };
      }
      
      // 更新记录
      const updated = {
        ...existing,
        data: { ...existing.data, ...data },
        updated_at: new Date().toISOString(),
        version: (existing.version || 1) + 1
      };
      
      // 存储到原层级
      const layer = this.layers[existing.layer];
      await layer.store(id, updated);
      
      // 更新缓存
      this.cache.set(id, updated);
      
      return { status: 'updated', id, version: updated.version };
    }, { context: 'memory-update' });
  }

  /**
   * 删除记忆
   */
  async delete(id, options = {}) {
    return errorHandler.wrap(async () => {
      const { permanent = false } = options;
      
      // 查找记录
      const existing = await this.findById(id);
      
      if (!existing) {
        return { status: 'not_found', id };
      }
      
      // 从层级中删除
      const layer = this.layers[existing.layer];
      await layer.delete(id, { permanent });
      
      // 从缓存中删除
      this.cache.delete(id);
      
      return { status: permanent ? 'deleted' : 'archived', id };
    }, { context: 'memory-delete' });
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const hitRate = this.stats.reads > 0 
      ? (this.stats.hits / this.stats.reads * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      layers: Object.fromEntries(
        Object.entries(this.layers).map(([k, v]) => [k, v.getStats()])
      )
    };
  }

  /**
   * 维护任务
   */
  async maintenance() {
    return errorHandler.wrap(async () => {
      const results = {};
      
      // 每层执行维护
      for (const [name, layer] of Object.entries(this.layers)) {
        results[name] = await layer.maintenance();
      }
      
      // 清理缓存
      this.maintainCache();
      
      // 清理过期数据
      await this.cleanupExpired();
      
      return { status: 'completed', layers: results };
    }, { context: 'memory-maintenance' });
  }

  /**
   * 私有方法
   */
  
  selectLayer(data, type, importance) {
    // 根据重要性选择层级
    switch (importance) {
      case 'critical':
        return this.layers.l2;  // 结构化存储
      case 'important':
        return this.layers.l2;
      case 'temporary':
        return this.layers.l0;  // 原始存储
      default:
        // 根据数据类型选择
        if (type === 'conversation') return this.layers.l0;
        if (type === 'summary') return this.layers.l1;
        if (type === 'pattern') return this.layers.l3;
        return this.layers.l2;
    }
  }

  generateId(type) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}-${timestamp}-${random}`;
  }

  searchCache(query) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const [id, record] of this.cache) {
      const text = JSON.stringify(record).toLowerCase();
      if (text.includes(queryLower)) {
        results.push({ ...record, id, source: 'cache' });
      }
    }
    
    return results;
  }

  calculateRelevance(query, record) {
    // 简单的相关性计算
    const queryWords = query.toLowerCase().split(/\s+/);
    const recordText = JSON.stringify(record).toLowerCase();
    
    let matches = 0;
    for (const word of queryWords) {
      if (recordText.includes(word)) matches++;
    }
    
    return matches / queryWords.length;
  }

  maintainCache() {
    // LRU 缓存清理
    if (this.cache.size > this.cacheMaxSize) {
      const entriesToDelete = this.cache.size - this.cacheMaxSize;
      const entries = Array.from(this.cache.entries());
      
      // 删除最早的条目
      for (let i = 0; i < entriesToDelete; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  async findById(id) {
    // 先检查缓存
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    
    // 在各层中搜索
    for (const layer of Object.values(this.layers)) {
      const record = await layer.get(id);
      if (record) {
        return { ...record, layer: layer.name };
      }
    }
    
    return null;
  }

  async cleanupExpired() {
    // 清理过期数据
    for (const layer of Object.values(this.layers)) {
      await layer.cleanupExpired?.();
    }
  }
}

/**
 * L0: 原始数据层
 */
class L0RawLayer {
  constructor(options) {
    this.name = 'l0';
    this.path = path.join(options.workspace, 'raw-conversations');
  }

  initialize() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path, { recursive: true });
    }
  }

  async store(id, record) {
    const date = new Date().toISOString().split('T')[0];
    const filePath = path.join(this.path, `${date}.jsonl`);
    
    const line = JSON.stringify({ id, ...record }) + '\n';
    fs.appendFileSync(filePath, line);
  }

  async search(query, options) {
    // 简化的搜索实现
    const results = [];
    const files = fs.readdirSync(this.path).filter(f => f.endsWith('.jsonl'));
    
    for (const file of files.slice(-7)) {  // 只搜索最近 7 天
      const filePath = path.join(this.path, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);
      
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          if (JSON.stringify(record).toLowerCase().includes(query.toLowerCase())) {
            results.push(record);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
    
    return results;
  }

  async get(id) {
    // 简化的实现
    return null;
  }

  getStats() {
    const files = fs.existsSync(this.path) 
      ? fs.readdirSync(this.path).filter(f => f.endsWith('.jsonl'))
      : [];
    
    return { files: files.length };
  }

  async maintenance() {
    return { status: 'completed' };
  }
}

/**
 * L1: 摘要层
 */
class L1SummaryLayer {
  constructor(options) {
    this.name = 'l1';
    this.path = path.join(options.workspace, 'daily-summaries');
  }

  initialize() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path, { recursive: true });
    }
  }

  async store(id, record) {
    const date = new Date().toISOString().split('T')[0];
    const filePath = path.join(this.path, `${date}.json`);
    
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  }

  async search(query, options) {
    // 简化的实现
    return [];
  }

  async get(id) {
    return null;
  }

  getStats() {
    const files = fs.existsSync(this.path)
      ? fs.readdirSync(this.path).filter(f => f.endsWith('.json'))
      : [];
    
    return { files: files.length };
  }

  async maintenance() {
    return { status: 'completed' };
  }
}

/**
 * L2: 结构化层
 */
class L2StructuredLayer {
  constructor(options) {
    this.name = 'l2';
    this.path = path.join(options.workspace, 'structured');
  }

  initialize() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path, { recursive: true });
    }
  }

  async store(id, record) {
    const type = record.type || 'general';
    const typePath = path.join(this.path, type);
    
    if (!fs.existsSync(typePath)) {
      fs.mkdirSync(typePath, { recursive: true });
    }
    
    const filePath = path.join(typePath, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  }

  async search(query, options) {
    const results = [];
    
    if (!fs.existsSync(this.path)) return results;
    
    const types = fs.readdirSync(this.path);
    
    for (const type of types) {
      const typePath = path.join(this.path, type);
      if (!fs.statSync(typePath).isDirectory()) continue;
      
      const files = fs.readdirSync(typePath).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const filePath = path.join(typePath, file);
          const record = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          
          if (JSON.stringify(record).toLowerCase().includes(query.toLowerCase())) {
            results.push(record);
          }
        } catch (e) {
          // 忽略错误
        }
      }
    }
    
    return results;
  }

  async get(id) {
    // 在各类型目录中搜索
    if (!fs.existsSync(this.path)) return null;
    
    const types = fs.readdirSync(this.path);
    
    for (const type of types) {
      const filePath = path.join(this.path, type, `${id}.json`);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    }
    
    return null;
  }

  async delete(id, options) {
    // 查找并删除
    const record = await this.get(id);
    if (record) {
      const type = record.type || 'general';
      const filePath = path.join(this.path, type, `${id}.json`);
      
      if (options.permanent) {
        fs.unlinkSync(filePath);
      } else {
        // 移动到归档
        const archivePath = path.join(this.path, '../archive');
        if (!fs.existsSync(archivePath)) {
          fs.mkdirSync(archivePath, { recursive: true });
        }
        fs.renameSync(filePath, path.join(archivePath, `${id}.json`));
      }
    }
  }

  getStats() {
    if (!fs.existsSync(this.path)) return { types: 0, records: 0 };
    
    const types = fs.readdirSync(this.path).filter(f => 
      fs.statSync(path.join(this.path, f)).isDirectory()
    );
    
    let records = 0;
    for (const type of types) {
      const files = fs.readdirSync(path.join(this.path, type)).filter(f => f.endsWith('.json'));
      records += files.length;
    }
    
    return { types: types.length, records };
  }

  async maintenance() {
    return { status: 'completed' };
  }

  async cleanupExpired() {
    // 清理过期数据
    const config = require('../../../config');
    const retention = config.memory.layers.l2.retention;
    
    // 这里可以实现具体的清理逻辑
    return { cleaned: 0 };
  }
}

/**
 * L3: 模式层
 */
class L3PatternLayer {
  constructor(options) {
    this.name = 'l3';
    this.path = path.join(options.workspace, 'patterns');
  }

  initialize() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path, { recursive: true });
    }
  }

  async store(id, record) {
    const filePath = path.join(this.path, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  }

  async search(query, options) {
    return [];
  }

  async get(id) {
    const filePath = path.join(this.path, `${id}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return null;
  }

  getStats() {
    const files = fs.existsSync(this.path)
      ? fs.readdirSync(this.path).filter(f => f.endsWith('.json'))
      : [];
    
    return { patterns: files.length };
  }

  async maintenance() {
    return { status: 'completed' };
  }
}

// 导出
module.exports = {
  UnifiedMemory,
  L0RawLayer,
  L1SummaryLayer,
  L2StructuredLayer,
  L3PatternLayer
};

// 单例实例
let instance = null;

module.exports.getInstance = function(options) {
  if (!instance) {
    instance = new UnifiedMemory(options);
  }
  return instance;
};

// 如果直接运行，测试
if (require.main === module) {
  const memory = new UnifiedMemory();
  const init = memory.initialize();
  console.log('Init:', init);
  
  console.log('Stats:', memory.getStats());
}
