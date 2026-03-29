/**
 * Proactive Confirm - 主动确认系统
 * 
 * 在学习新规则前，先向用户确认
 * 确保学习的准确性
 */

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'memory', 'confirm');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

class ProactiveConfirm {
  constructor(userId) {
    this.userId = userId;
    this.userPath = path.join(MEMORY_PATH, 'users', userId);
    ensureDir(this.userPath);
    
    // 待确认的规则
    this.pendingConfirmations = this.loadPending();
    
    // 已确认的规则
    this.confirmedRules = this.loadConfirmed();
    
    // 被拒绝的规则
    this.rejectedRules = this.loadRejected();
  }

  loadPending() {
    const file = path.join(this.userPath, 'pending.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return [];
  }

  savePending() {
    const file = path.join(this.userPath, 'pending.json');
    fs.writeFileSync(file, JSON.stringify(this.pendingConfirmations, null, 2));
  }

  loadConfirmed() {
    const file = path.join(this.userPath, 'confirmed.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return [];
  }

  saveConfirmed() {
    const file = path.join(this.userPath, 'confirmed.json');
    fs.writeFileSync(file, JSON.stringify(this.confirmedRules, null, 2));
  }

  loadRejected() {
    const file = path.join(this.userPath, 'rejected.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return [];
  }

  saveRejected() {
    const file = path.join(this.userPath, 'rejected.json');
    fs.writeFileSync(file, JSON.stringify(this.rejectedRules, null, 2));
  }

  // 请求确认
  requestConfirmation(pattern, data) {
    const confirmation = {
      id: `confirm-${Date.now()}`,
      pattern: pattern,
      proposedKey: data.key,
      proposedType: data.type,
      examples: data.examples,
      frequency: data.frequency,
      requestedAt: new Date().toISOString(),
      status: 'pending'
    };
    
    this.pendingConfirmations.push(confirmation);
    this.savePending();
    
    // 生成确认消息
    const message = this.generateConfirmMessage(confirmation);
    console.log(`❓ [ProactiveConfirm] 请求确认:\n${message}`);
    
    return {
      confirmationId: confirmation.id,
      message: message,
      pattern: pattern
    };
  }

  // 生成确认消息
  generateConfirmMessage(confirmation) {
    const examples = confirmation.examples.slice(0, 3);
    
    return `
我发现你经常说 "${confirmation.pattern}" (${confirmation.frequency}次)

示例:
${examples.map((ex, i) => `  ${i + 1}. "${ex.substring(0, 60)}..."`).join('\n')}

我想学习这个模式，提取为: ${confirmation.proposedKey} (${confirmation.proposedType})

你觉得这是你的重要偏好吗？
回复: "确认" 或 "忽略"
    `.trim();
  }

  // 确认规则
  confirm(confirmationId) {
    const index = this.pendingConfirmations.findIndex(c => c.id === confirmationId);
    if (index === -1) return null;
    
    const confirmation = this.pendingConfirmations[index];
    confirmation.status = 'confirmed';
    confirmation.confirmedAt = new Date().toISOString();
    
    // 移到已确认
    this.confirmedRules.push(confirmation);
    this.pendingConfirmations.splice(index, 1);
    
    this.savePending();
    this.saveConfirmed();
    
    console.log(`✅ [ProactiveConfirm] 已确认: ${confirmation.pattern}`);
    
    return confirmation;
  }

  // 拒绝规则
  reject(confirmationId, reason = '') {
    const index = this.pendingConfirmations.findIndex(c => c.id === confirmationId);
    if (index === -1) return null;
    
    const confirmation = this.pendingConfirmations[index];
    confirmation.status = 'rejected';
    confirmation.rejectedAt = new Date().toISOString();
    confirmation.rejectReason = reason;
    
    // 移到已拒绝
    this.rejectedRules.push(confirmation);
    this.pendingConfirmations.splice(index, 1);
    
    this.savePending();
    this.saveRejected();
    
    console.log(`❌ [ProactiveConfirm] 已拒绝: ${confirmation.pattern}`);
    
    return confirmation;
  }

  // 获取待确认列表
  getPending() {
    return this.pendingConfirmations;
  }

  // 获取统计
  getStats() {
    return {
      pending: this.pendingConfirmations.length,
      confirmed: this.confirmedRules.length,
      rejected: this.rejectedRules.length,
      total: this.pendingConfirmations.length + this.confirmedRules.length + this.rejectedRules.length
    };
  }

  // 检查是否应该请求确认
  shouldRequestConfirm(pattern, frequency) {
    // 已经确认过的，不再询问
    if (this.confirmedRules.some(r => r.pattern === pattern)) {
      return false;
    }
    
    // 已经拒绝过的，不再询问
    if (this.rejectedRules.some(r => r.pattern === pattern)) {
      return false;
    }
    
    // 已经在等待确认的，不再询问
    if (this.pendingConfirmations.some(r => r.pattern === pattern)) {
      return false;
    }
    
    // 频率达到阈值才询问
    return frequency >= 3;
  }
}

// 全局实例
let proactiveConfirm = null;

function initProactiveConfirm(userId) {
  proactiveConfirm = new ProactiveConfirm(userId);
  console.log(`❓ [ProactiveConfirm] 初始化: ${userId}`);
  return proactiveConfirm;
}

function requestConfirm(pattern, data) {
  if (!proactiveConfirm) {
    console.warn('[ProactiveConfirm] 请先调用 initProactiveConfirm()');
    return null;
  }
  return proactiveConfirm.requestConfirmation(pattern, data);
}

function confirmRule(confirmationId) {
  if (!proactiveConfirm) return null;
  return proactiveConfirm.confirm(confirmationId);
}

function rejectRule(confirmationId, reason) {
  if (!proactiveConfirm) return null;
  return proactiveConfirm.reject(confirmationId, reason);
}

function shouldConfirm(pattern, frequency) {
  if (!proactiveConfirm) return false;
  return proactiveConfirm.shouldRequestConfirm(pattern, frequency);
}

module.exports = {
  ProactiveConfirm,
  initProactiveConfirm,
  requestConfirm,
  confirmRule,
  rejectRule,
  shouldConfirm
};

// 测试
if (require.main === module) {
  console.log('Proactive Confirm System loaded!');
}
