const registry = require('./src/tools/clawteam-decision-registry');
const summary = require('./src/tools/clawteam-overlay-summary');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const teamId = 'overlay-summary-team-' + Date.now();

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
    teamMeta: { source: 'test' },
    meta: {
      fallbackMode: 'pause_and_report',
      reported: true,
      retryAfterMs: 12000
    }
  });

  const runtimeTeamId = 'real-team-' + Date.now();
  registry.registerDecision(runtimeTeamId, {
    taskId: 'runtime-task-1',
    title: 'real runtime issue',
    type: 'coding',
    status: 'blocked',
    assignedRole: 'backend'
  }, {
    fingerprint: 'runtime-task-1::backend::reassign::fixer::repeated_failure',
    action: 'reassign',
    targetRole: 'fixer',
    reason: 'repeated_failure'
  }, {
    teamMeta: { source: 'runtime' }
  });
  registry.updateTaskOverlayState(runtimeTeamId, 'runtime-task-1', 'paused_pending_leader', {
    teamMeta: { source: 'runtime' },
    meta: {
      fallbackMode: 'pause_and_report',
      reported: true,
      retryAfterMs: 8000
    }
  });

  const result = summary.getGlobalOverlaySummary({ maxPausedTasks: 5 });
  const full = summary.getGlobalOverlaySummary({ maxPausedTasks: 5, includeTestTeams: true });
  assert(result.teams >= 1, 'expected runtime teams in filtered summary');
  assert(result.pausedPendingLeader >= 1, 'expected runtime paused task in filtered summary');
  assert(full.teams >= result.teams, 'expected unfiltered teams >= filtered teams');
  assert(summary.isLikelyTestTeam(teamId) === true, 'expected generated test team to be recognized');
  assert(summary.inferTeamSource(runtimeTeamId, { teamMeta: { source: 'runtime' } }) === 'runtime', 'expected metadata source to win');
  assert(Array.isArray(full.pausedTasks) && full.pausedTasks.length >= 1, 'expected paused tasks in unfiltered summary');
  assert(Array.isArray(full.pausedTasks), 'expected pausedTasks array');

  console.log('✅ clawteam overlay global summary');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
