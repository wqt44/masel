/**
 * Time Decay Memory - 时间衰减记忆系统
 * 
 * 让记忆随时间衰减，最近说的更重要
 * 旧记忆不会消失，只是权重降低
 */

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'memory', 'time-decay');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class TimeDecayMemory {
  constructor(userId, options = {}) {
    this.userId = userId;
    this.userPath = path.join(MEMORY_PATH, 'users', userId);
    ensureDir(this.userPath);
    
    // 衰减配置
    this.config = {
      halfLifeDays: options.halfLifeDays || 30,  // 半衰期30天
      minWeight: options.minWeight || 0.1,       // 最小权重
      maxWeight: options.maxWeight || 1.0,       // 最大权重
      boostRecent: options.boostRecent !== false, // 提升最近记忆
      recentWindowDays: options.recentWindowDays || 7, // 最近窗口7天
      ...options
    };
    
    this.memories = this.loadMemories();
  }

  loadMemories() {
    const file = path.join(this.userPath, 'memories.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return [];
  }

  saveMemories() {
    const file = path.join(this.userPath, 'memories.json');
    fs.writeFileSync(file, JSON.stringify(this.memories, null, 2));
  }

  // 添加记忆
  add(memory) {
    const entry = {
      ...memory,
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      originalWeight: memory.weight || 0.5
    };
    
    this.memories.push(entry);
    this.saveMemories();
    
    console.log(`🕐 [TimeDecay] 添加记忆: ${entry.key} = "${entry.value.substring(0, 30)}..."`);
    return entry;
  }

  // 计算衰减后的权重
  calculateDecayWeight(memory) {
    const now = new Date();
    const created = new Date(memory.createdAt);
    const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
    
    // 指数衰减公式: weight = original * (0.5 ^ (days / halfLife))
    const decayFactor = Math.pow(0.5, daysDiff / this.config.halfLifeDays);
    let weight = memory.originalWeight * decayFactor;
    
    // 确保不低于最小权重
    weight = Math.max(weight, this.config.minWeight);
    
    // 最近记忆提升
    if (this.config.boostRecent && daysDiff <= this.config.recentWindowDays) {
      const boost = 1 + (1 - daysDiff / this.config.recentWindowDays) * 0.3;
      weight = Math.min(weight * boost, this.config.maxWeight);
    }
    
    return {
      currentWeight: weight,
      daysAgo: Math.floor(daysDiff),
      decayFactor: decayFactor,
      isRecent: daysDiff <= this.config.recentWindowDays
    };
  }

  // 获取所有记忆（带衰减权重）
  getAllWithDecay() {
    return this.memories.map(mem => {
      const decay = this.calculateDecayWeight(mem);
      return {
        ...mem,
        currentWeight: decay.currentWeight,
        decay: decay
      };
    });
  }

  // 回忆（考虑时间衰减）
  recall(query, limit = 5) {
    const lowerQuery = query.toLowerCase();
    const memoriesWithDecay = this.getAllWithDecay();
    
    const results = memoriesWithDecay
      .filter(mem => {
        const searchable = `${mem.key} ${mem.value} ${mem.type}`.toLowerCase();
        return searchable.includes(lowerQuery);
      })
      .sort((a, b) => b.currentWeight - a.currentWeight)
      .slice(0, limit);
    
    return results;
  }

  // 获取记忆统计
  getStats() {
    const memoriesWithDecay = this.getAllWithDecay();
    
    const stats = {
      total: this.memories.length,
      recent: memoriesWithDecay.filter(m => m.decay.isRecent).length,
      avgDecayFactor: 0,
      weightDistribution: {
        high: 0,    // > 0.7
        medium: 0,  // 0.3 - 0.7
        low: 0      // < 0.3
      }
    };
    
    if (memoriesWithDecay.length > 0) {
      const totalDecay = memoriesWithDecay.reduce((sum, m) => sum + m.decay.decayFactor, 0);
      stats.avgDecayFactor = totalDecay / memoriesWithDecay.length;
      
      for (const mem of memoriesWithDecay) {
        if (mem.currentWeight > 0.7) stats.weightDistribution.high++;
        else if (mem.currentWeight > 0.3) stats.weightDistribution.medium++;
        else stats.weightDistribution.low++;
      }
    }
    
    return stats;
  }

  // 清理旧记忆（可选）
  cleanup(thresholdDays = 90) {
    const now = new Date();
    const beforeCount = this.memories.length;
    
    this.memories = this.memories.filter(mem => {
      const created = new Date(mem.createdAt);
      const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
      return daysDiff <= thresholdDays;
    });
    
    const afterCount = this.memories.length;
    this.saveMemories();
    
    console.log(`🧹 [TimeDecay] 清理完成: ${beforeCount - afterCount} 条旧记忆已移除`);
    return beforeCount - afterCount;
  }

  // 刷新记忆（重置时间戳，相当于"复习"）
  refresh(memoryId) {
    const mem = this.memories.find(m => m.id === memoryId);
    if (mem) {
      mem.createdAt = new Date().toISOString();
      this.saveMemories();
      console.log(`🔄 [TimeDecay] 刷新记忆: ${mem.key}`);
      return true;
    }
    return false;
  }
}

// 全局实例
let timeDecayMemory = null;

function initTimeDecayMemory(userId, options) {
  timeDecayMemory = new TimeDecayMemory(userId, options);
  console.log(`🕐 [TimeDecay] 初始化: ${userId}`);
  console.log(`   半衰期: ${timeDecayMemory.config.halfLifeDays}天`);
  console.log(`   最近窗口: ${timeDecayMemory.config.recentWindowDays}天`);
  return timeDecayMemory;
}

function addWithDecay(memory) {
  if (!timeDecayMemory) {
    console.warn('[TimeDecay] 请先调用 initTimeDecayMemory()');
    return null;
  }
  return timeDecayMemory.add(memory);
}

function recallWithDecay(query, limit) {
  if (!timeDecayMemory) return [];
  return timeDecayMemory.recall(query, limit);
}

function getDecayStats() {
  if (!timeDecayMemory) return null;
  return timeDecayMemory.getStats();
}

module.exports = {
  TimeDecayMemory,
  initTimeDecayMemory,
  addWithDecay,
  recallWithDecay,
  getDecayStats
};

// 测试
if (require.main === module) {
  console.log('Time Decay Memory System loaded!');
}
