const fs = require('fs');
const path = require('path');
const registry = require('./src/tools/clawteam-decision-registry');

const teamId = 'demo-registry-team';
const registryFile = path.join(registry.REGISTRY_DIR, teamId + '.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanup() {
  if (fs.existsSync(registryFile)) fs.unlinkSync(registryFile);
}

async function main() {
  cleanup();

  const decision = {
    fingerprint: 'task-1::backend::assign_reviewer::tester::low_confidence',
    action: 'assign_reviewer',
    targetRole: 'tester',
    reason: 'low_confidence'
  };

  const taskState = {
    taskId: 'task-1',
    assignedRole: 'backend'
  };

  registry.registerDecision(teamId, taskState, decision);
  registry.setTeamMeta(teamId, { source: 'test' });

  const ctx0 = registry.getSchedulerContext(teamId);
  assert(ctx0.teamMeta && ctx0.teamMeta.source === 'test', 'expected team meta source');

  const overlay = registry.updateTaskOverlayState(teamId, 'task-1', 'paused_pending_leader', {
    meta: { fallbackMode: 'pause_and_report', reported: true }
  });
  assert(overlay && overlay.overlayState === 'paused_pending_leader', 'expected overlay state update result');

  const overlayRead = registry.getTaskOverlayState(teamId, 'task-1');
  assert(overlayRead && overlayRead.overlayState === 'paused_pending_leader', 'expected overlay state to be readable');

  const ctx1 = registry.getSchedulerContext(teamId);
  assert(ctx1.pendingDecisions.length === 1, 'expected one pending decision');
  assert(ctx1.activeReviewers.length === 1, 'expected one active reviewer');
  assert(ctx1.activeReviewers[0].role === 'tester', 'expected tester reviewer');

  const resolvedReviewer = registry.resolveReviewerDecision(teamId, 'task-1', 'tester');
  assert(Array.isArray(resolvedReviewer) && resolvedReviewer.length === 1, 'expected reviewer decision resolved');

  const ctx2 = registry.getSchedulerContext(teamId);
  assert(ctx2.pendingDecisions.length === 0, 'expected pending decision resolved after reviewer completion');
  assert(ctx2.activeReviewers.length === 0, 'expected active reviewer removed after reviewer completion');

  registry.registerDecision(teamId, taskState, decision);
  const resolvedTask = registry.resolveTaskDecisions(teamId, 'task-1');
  assert(Array.isArray(resolvedTask) && resolvedTask.length === 1, 'expected task decisions resolved');

  const ctx3 = registry.getSchedulerContext(teamId);
  assert(ctx3.pendingDecisions.length === 0, 'expected no pending decisions after task resolve');
  assert(ctx3.activeReviewers.length === 0, 'expected no active reviewers after task resolve');

  cleanup();
  console.log('✅ decision registry register/resolve flow');
}

main().catch((error) => {
  cleanup();
  console.error(error);
  process.exit(1);
});
