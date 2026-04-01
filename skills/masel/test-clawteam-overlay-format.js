const { formatOverlaySummaryBlock } = require('./src/tools/clawteam-overlay-format');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const text = formatOverlaySummaryBlock({
    teams: 3,
    rawTeams: 5,
    filteredTeams: 2,
    pausedPendingLeader: 2,
    activeOverlay: 1,
    pausedTasks: [
      {
        taskId: 'task-17',
        taskTitle: 'repair auth flow',
        targetRole: 'fixer',
        overlayMeta: { fallbackMode: 'pause_and_report' }
      }
    ]
  });

  assert(/3 teams/.test(text), 'expected team count in text');
  assert(/2 paused_pending_leader/.test(text), 'expected paused count in text');
  assert(/Filtered test teams: 2\/5/.test(text), 'expected filtered team line');
  assert(/task-17/.test(text), 'expected task id in text');
  assert(/repair auth flow/.test(text), 'expected task title in text');

  console.log('✅ clawteam overlay text format');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
