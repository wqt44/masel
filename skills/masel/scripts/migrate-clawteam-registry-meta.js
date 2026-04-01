#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const registry = require(path.join(__dirname, '../src/tools/clawteam-decision-registry.js'));
const summary = require(path.join(__dirname, '../src/tools/clawteam-overlay-summary.js'));

function parseArgs(argv) {
  const args = { apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--apply') args.apply = true;
    if (token === '--dry-run') args.apply = false;
  }
  return args;
}

function classifyTeam(teamId, data) {
  if (data && data.teamMeta && data.teamMeta.source) {
    return { action: 'skip', source: data.teamMeta.source, reason: 'already_set' };
  }

  if (summary.isLikelyTestTeam(teamId, {})) {
    return { action: 'set', source: 'test', reason: 'name_heuristic' };
  }

  return { action: 'set', source: 'runtime', reason: 'default_runtime' };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = registry.REGISTRY_DIR;
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.endsWith('.json')) : [];
  const changes = [];

  files.forEach(name => {
    const teamId = path.basename(name, '.json');
    const data = registry.readRegistry(teamId);
    const plan = classifyTeam(teamId, data);
    changes.push({ teamId, ...plan });

    if (args.apply && plan.action === 'set') {
      registry.setTeamMeta(teamId, { source: plan.source, migration: 'registry-meta-v1' });
    }
  });

  const report = {
    ok: true,
    mode: args.apply ? 'apply' : 'dry-run',
    total: changes.length,
    changed: changes.filter(x => x.action === 'set').length,
    skipped: changes.filter(x => x.action === 'skip').length,
    changes
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
