const fs = require('fs');
const path = require('path');
const bridge = require('./src/tools/clawteam-bridge');
const registry = require('./src/tools/clawteam-decision-registry');
const actionAudit = require('./src/tools/clawteam-action-audit');

const registryFile = path.join(registry.REGISTRY_DIR, 'demo-team.json');
const auditFile = path.join(actionAudit.AUDIT_DIR, 'demo-team.jsonl');

async function runCase(name, fn) {
  try {
    cleanupRegistry();
    cleanupAudit();
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanupRegistry() {
  if (fs.existsSync(registryFile)) fs.unlinkSync(registryFile);
}

function cleanupAudit() {
  if (fs.existsSync(auditFile)) fs.unlinkSync(auditFile);
}

async function main() {
  await runCase('低置信度报告触发 dry-run reviewer', async () => {
    const result = bridge.processWorkerReport(
      'demo-team',
      'backend',
      [
        'Completed tasks:',
        '- Task: auth middleware',
        '- Result: partial',
        '- Confidence: [confidence: 0.45]',
        '- Suggestions: check token refresh'
      ].join('\n'),
      {
        taskId: 'task-101',
        taskType: 'coding',
        attempts: 1,
        logger: { log() {} }
      }
    );

    const schedulerResult = await Promise.resolve(result.schedulerResult);
    const ctx = registry.getSchedulerContext('demo-team');

    assert(result.schedulerDecision, 'missing schedulerDecision');
    assert(result.schedulerDecision.action === 'assign_reviewer', 'expected assign_reviewer');
    assert(result.schedulerDecision.targetRole === 'tester', 'expected tester reviewer');
    assert(schedulerResult && schedulerResult.dryRun === true, 'expected dry-run scheduler result');
    assert(schedulerResult.type === 'spawn_agent', 'expected spawn_agent suggestion');
    assert(schedulerResult.audit && schedulerResult.audit.type === 'spawn_agent', 'expected reviewer audit record');
    assert(ctx.pendingDecisions.length >= 1, 'expected registry to persist pending decision');
  });

  await runCase('半自动模式会真实发送 reviewer 请求', async () => {
    const result = bridge.processWorkerReport(
      'demo-team',
      'backend',
      [
        'Completed tasks:',
        '- Task: auth middleware',
        '- Result: partial',
        '- Confidence: [confidence: 0.45]'
      ].join('\n'),
      {
        taskId: 'task-101b',
        taskType: 'coding',
        attempts: 1,
        executionMode: 'semi-auto',
        logger: { log() {} }
      }
    );

    const schedulerResult = await Promise.resolve(result.schedulerResult);
    const audits = actionAudit.readAudit('demo-team');

    assert(result.schedulerDecision.action === 'assign_reviewer', 'expected assign_reviewer');
    assert(schedulerResult.type === 'spawn_agent', 'expected spawn_agent result');
    assert(typeof schedulerResult.ok === 'boolean', 'expected ok flag');
    assert(schedulerResult.dryRun === false, 'expected attempted real reviewer request');
    assert(audits.length >= 1, 'expected persisted audit records');
    assert(audits[audits.length - 1].type === 'spawn_agent', 'expected spawn_agent audit entry');
  });

  await runCase('补充信息请求默认 dry-run', async () => {
    const result = bridge.processWorkerReport(
      'demo-team',
      'backend',
      [
        'Completed tasks:',
        '- Task: fix token bug',
        '- Result: success',
        '- Confidence: [confidence: 0.91]'
      ].join('\n'),
      {
        taskId: 'task-101c',
        taskType: 'bugfix',
        errorPatternHits: [{ id: 'err-1' }],
        logger: { log() {} }
      }
    );

    const schedulerResult = await Promise.resolve(result.schedulerResult);

    assert(result.schedulerDecision.action === 'request_more_info', 'expected request_more_info');
    assert(schedulerResult.type === 'request_clarification', 'expected clarification result');
    assert(schedulerResult.dryRun === true, 'expected dry-run clarification by default');
    assert(schedulerResult.audit && schedulerResult.audit.type === 'request_clarification', 'expected clarification audit record');
  });

  await runCase('半自动模式下真实执行 clarification 请求', async () => {
    const result = bridge.processWorkerReport(
      'demo-team',
      'backend',
      [
        'Completed tasks:',
        '- Task: fix token bug',
        '- Result: success',
        '- Confidence: [confidence: 0.91]'
      ].join('\n'),
      {
        taskId: 'task-101d',
        taskType: 'bugfix',
        errorPatternHits: [{ id: 'err-1' }],
        executionMode: 'semi-auto',
        logger: { log() {} }
      }
    );

    const schedulerResult = await Promise.resolve(result.schedulerResult);
    const audits = actionAudit.readAudit('demo-team');

    assert(result.schedulerDecision.action === 'request_more_info', 'expected request_more_info');
    assert(schedulerResult.type === 'request_clarification', 'expected clarification result');
    assert(typeof schedulerResult.ok === 'boolean', 'expected ok flag');
    assert(schedulerResult.dryRun === false, 'expected attempted real clarification in semi-auto');
    assert(audits.length >= 1, 'expected audit records');
    assert(audits[audits.length - 1].type === 'request_clarification', 'expected clarification audit entry');
  });

  await runCase('跨模块风险优先升级 architect reviewer', async () => {
    const result = bridge.processWorkerReport(
      'demo-team',
      'backend',
      [
        'Completed tasks:',
        '- Task: shared auth/session refactor',
        '- Result: success',
        '- Confidence: [confidence: 0.88]'
      ].join('\n'),
      {
        taskId: 'task-102',
        taskType: 'coding',
        crossModuleImpact: true,
        logger: { log() {} }
      }
    );

    const schedulerResult = await Promise.resolve(result.schedulerResult);

    assert(result.schedulerDecision.action === 'assign_reviewer', 'expected assign_reviewer');
    assert(result.schedulerDecision.targetRole === 'architect', 'expected architect reviewer');
    assert(schedulerResult.type === 'spawn_agent', 'expected spawn_agent suggestion');
  });

  await runCase('已完成 research 任务直接 finalize 并清理 task 决策', async () => {
    const first = bridge.processWorkerReport(
      'demo-team',
      'backend',
      [
        'Completed tasks:',
        '- Task: competitor scan prep',
        '- Result: partial',
        '- Confidence: [confidence: 0.45]'
      ].join('\n'),
      {
        taskId: 'task-103',
        taskType: 'coding',
        attempts: 1,
        logger: { log() {} }
      }
    );

    await Promise.resolve(first.schedulerResult);

    const before = registry.getSchedulerContext('demo-team');
    assert(before.pendingDecisions.some(item => item.taskId === 'task-103'), 'expected pending decision before finalize');

    const result = bridge.processWorkerReport(
      'demo-team',
      'analyst',
      [
        'Completed tasks:',
        '- Task: competitor scan',
        '- Result: success',
        '- Confidence: [confidence: 0.91]'
      ].join('\n'),
      {
        taskId: 'task-103',
        taskType: 'research',
        taskStatus: 'done',
        logger: { log() {} }
      }
    );

    const schedulerResult = await Promise.resolve(result.schedulerResult);
    const ctx = registry.getSchedulerContext('demo-team');

    assert(result.schedulerDecision.action === 'finalize', 'expected finalize');
    assert(result.schedulerDecision.targetRole === 'analyst', 'expected analyst finalize');
    assert(schedulerResult.type === 'finalize_task', 'expected finalize_task dry-run');
    assert(schedulerResult.dryRun === true, 'expected dry-run finalize');
    assert(Array.isArray(result.resolvedDecisions), 'expected resolvedDecisions array');
    assert(ctx.pendingDecisions.every(item => item.taskId !== 'task-103'), 'expected no remaining pending decisions for task');
  });

  await runCase('重复 reviewer 决策会被 registry 自动抑制', async () => {
    const first = bridge.processWorkerReport(
      'demo-team',
      'backend',
      [
        'Completed tasks:',
        '- Task: auth middleware',
        '- Result: partial',
        '- Confidence: [confidence: 0.45]'
      ].join('\n'),
      {
        taskId: 'task-104',
        taskType: 'coding',
        attempts: 1,
        logger: { log() {} }
      }
    );

    await Promise.resolve(first.schedulerResult);

    const second = bridge.processWorkerReport(
      'demo-team',
      'backend',
      [
        'Completed tasks:',
        '- Task: auth middleware',
        '- Result: partial',
        '- Confidence: [confidence: 0.45]'
      ].join('\n'),
      {
        taskId: 'task-104',
        taskType: 'coding',
        attempts: 1,
        logger: { log() {} }
      }
    );

    const schedulerResult = await Promise.resolve(second.schedulerResult);

    assert(second.schedulerDecision.suppressed === true, 'expected suppressed decision');
    assert(
      ['duplicate_decision', 'reviewer_already_assigned'].includes(second.schedulerDecision.suppressionReason),
      'expected duplicate or reviewer suppression'
    );
    assert(schedulerResult.type === 'suppressed', 'expected suppressed action result');
    assert(schedulerResult.skipped === true, 'expected skipped result');
  });

  await runCase('reviewer 完成后自动 resolve reviewer decision', async () => {
    const first = bridge.processWorkerReport(
      'demo-team',
      'backend',
      [
        'Completed tasks:',
        '- Task: integration test',
        '- Result: partial',
        '- Confidence: [confidence: 0.45]'
      ].join('\n'),
      {
        taskId: 'task-105',
        taskType: 'coding',
        attempts: 1,
        logger: { log() {} }
      }
    );

    await Promise.resolve(first.schedulerResult);

    const before = registry.getSchedulerContext('demo-team');
    assert(before.activeReviewers.some(item => item.taskId === 'task-105' && item.role === 'tester'), 'expected active tester reviewer before resolve');

    const reviewerDone = bridge.processWorkerReport(
      'demo-team',
      'tester',
      [
        'Completed tasks:',
        '- Task: integration test review',
        '- Result: success',
        '- Confidence: [confidence: 0.92]'
      ].join('\n'),
      {
        taskId: 'task-105',
        taskType: 'review',
        taskStatus: 'done',
        reviewCompleted: true,
        logger: { log() {} }
      }
    );

    await Promise.resolve(reviewerDone.schedulerResult);
    const ctx = registry.getSchedulerContext('demo-team');

    assert(Array.isArray(reviewerDone.resolvedDecisions), 'expected resolved decisions array');
    assert(ctx.activeReviewers.every(item => item.taskId !== 'task-105'), 'expected reviewer removed from registry');
    assert(ctx.pendingDecisions.every(item => !(item.taskId === 'task-105' && item.targetRole === 'tester')), 'expected tester review decision removed');
  });

  cleanupRegistry();
  cleanupAudit();
}

main().catch((error) => {
  cleanupRegistry();
  cleanupAudit();
  console.error(error);
  process.exit(1);
});
