const { masel } = require('./masel-wrapper');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const status = await masel.status();
  assert(status && status.clawteam_overlay, 'expected clawteam overlay status block');
  assert(typeof status.clawteam_overlay.teams === 'number', 'expected overlay team count');
  assert(typeof status.clawteam_overlay.rawTeams === 'number', 'expected raw team count');
  assert(typeof status.clawteam_overlay.filteredTeams === 'number', 'expected filtered team count');
  assert(Array.isArray(status.clawteam_overlay.pausedTasks), 'expected pausedTasks array');
  assert(typeof status.clawteam_overlay_text === 'string', 'expected overlay text summary');
  assert(/ClawTeam overlay:/.test(status.clawteam_overlay_text), 'expected overlay text headline');
  console.log('✅ masel status overlay integration');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
