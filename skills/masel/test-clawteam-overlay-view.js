const registry = require('./src/tools/clawteam-decision-registry');
const overlayView = require('./src/tools/clawteam-overlay-view');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const teamId = 'overlay-view-team-' + Date.now();

  registry.registerDecision(teamId, {
    taskId: 'task-1',
    title: 'repair auth flow',
    type: 'coding',
    status: 'blocked',
    assignedRole: 'backend'
  }, {
    fingerprint: 'task-1::backend::reassign::fixer::repeated_failure',
    action: 'reassign',
    targetRole: 'fixer',
    reason: 'repeated_failure'
  });

  registry.updateTaskOverlayState(teamId, 'task-1', 'paused_pending_leader', {
    meta: {
      fallbackMode: 'pause_and_report',
      reported: true,
      retryAfterMs: 45000
    }
  });

  const merged = overlayView.mergeTaskOverlay(teamId, {
    id: 'task-1',
    subject: 'repair auth flow',
    status: 'blocked',
    owner: 'backend'
  });

  assert(merged.overlayState === 'paused_pending_leader', 'expected overlay state merged');
  assert(merged.displayStatus === 'blocked (paused_pending_leader)', 'expected display status merged');
  assert(/pause_and_report/.test(merged.statusBadge), 'expected status badge to include fallback mode');

  const summary = overlayView.summarizeOverlay([merged]);
  assert(summary.pausedPendingLeader === 1, 'expected paused_pending_leader count');

  console.log('✅ clawteam overlay view merge flow');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
