const { execSync } = require('child_process');
const registry = require('./src/tools/clawteam-decision-registry');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const testTeam = 'overlay-migration-test-' + Date.now();
  const runtimeTeam = 'real-migration-team-' + Date.now();

  registry.registerDecision(testTeam, {
    taskId: 't1',
    title: 'test task',
    assignedRole: 'backend'
  }, {
    fingerprint: 't1::backend::reassign::fixer::repeated_failure',
    action: 'reassign',
    targetRole: 'fixer',
    reason: 'repeated_failure'
  });

  registry.registerDecision(runtimeTeam, {
    taskId: 'r1',
    title: 'runtime task',
    assignedRole: 'backend'
  }, {
    fingerprint: 'r1::backend::assign_reviewer::tester::low_confidence',
    action: 'assign_reviewer',
    targetRole: 'tester',
    reason: 'low_confidence'
  });

  const dryRun = JSON.parse(execSync('node skills/masel/scripts/migrate-clawteam-registry-meta.js --dry-run', {
    cwd: process.cwd(),
    encoding: 'utf-8'
  }));

  assert(dryRun.total >= 2, 'expected migration dry-run to inspect files');

  JSON.parse(execSync('node skills/masel/scripts/migrate-clawteam-registry-meta.js --apply', {
    cwd: process.cwd(),
    encoding: 'utf-8'
  }));

  const testMeta = registry.readRegistry(testTeam).teamMeta;
  const runtimeMeta = registry.readRegistry(runtimeTeam).teamMeta;

  assert(testMeta.source === 'test', 'expected test team source metadata');
  assert(runtimeMeta.source === 'runtime', 'expected runtime team source metadata');

  console.log('✅ clawteam registry meta migration');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
