const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const registry = require('./src/tools/clawteam-decision-registry');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const teamId = 'overlay-cli-team-' + Date.now();
  const tmpPath = path.join(process.cwd(), 'memory', 'tmp-overlay-cli-' + Date.now() + '.json');

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
      retryAfterMs: 20000
    }
  });

  fs.writeFileSync(tmpPath, JSON.stringify([
    {
      id: 'task-1',
      subject: 'repair auth flow',
      status: 'blocked',
      owner: 'backend'
    }
  ], null, 2));

  const out = execSync('node skills/masel/scripts/clawteam-overlay-view.js --team ' + teamId + ' --tasks --input ' + JSON.stringify(tmpPath), {
    cwd: process.cwd(),
    encoding: 'utf-8'
  });

  const textOut = execSync('node skills/masel/scripts/clawteam-overlay-view.js --team ' + teamId + ' --tasks --input ' + JSON.stringify(tmpPath) + ' --text', {
    cwd: process.cwd(),
    encoding: 'utf-8'
  });

  fs.unlinkSync(tmpPath);

  const parsed = JSON.parse(out);
  assert(parsed.overlaySummary.pausedPendingLeader === 1, 'expected pausedPendingLeader summary');
  assert(parsed.tasks[0].displayStatus === 'blocked (paused_pending_leader)', 'expected merged display status');
  assert(/paused_pending_leader/.test(textOut), 'expected text output to include overlay status');
  assert(/fallback=pause_and_report/.test(textOut), 'expected text output to include fallback detail');

  console.log('✅ clawteam overlay CLI wrapper');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
