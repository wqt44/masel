#!/usr/bin/env node
'use strict';

const path = require('path');
const overlayView = require(path.join(__dirname, '../src/tools/clawteam-overlay-view.js'));

function printHelp() {
  console.log([
    'Usage:',
    '  node skills/masel/scripts/clawteam-overlay-view.js --team <team> --tasks',
    '  node skills/masel/scripts/clawteam-overlay-view.js --team <team> --board',
    '  node skills/masel/scripts/clawteam-overlay-view.js --team <team> --tasks --input <tasks.json>',
    '',
    'Options:',
    '  --team <team>   Team name (required)',
    '  --tasks         Show merged task list',
    '  --board         Show merged board view',
    '  --input <file>  Optional JSON file for mock task/board payload',
    '  --text          Render human-readable text summary',
    '  --pretty        Pretty-print JSON (default on)',
    '  --compact       Compact JSON output',
    '  --help          Show this help'
  ].join('\n'));
}

function parseArgs(argv) {
  const args = { pretty: true };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--team') {
      args.team = argv[i + 1];
      i += 1;
    } else if (token === '--input') {
      args.input = argv[i + 1];
      i += 1;
    } else if (token === '--tasks') {
      args.mode = 'tasks';
    } else if (token === '--board') {
      args.mode = 'board';
    } else if (token === '--text') {
      args.text = true;
    } else if (token === '--compact') {
      args.pretty = false;
    } else if (token === '--pretty') {
      args.pretty = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.team || !args.mode) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  let result;
  if (args.mode === 'tasks') {
    const tasks = args.input
      ? overlayView.mergeTaskListOverlay(args.team, require(path.resolve(args.input)))
      : overlayView.getMergedTaskList(args.team);
    result = {
      team: args.team,
      mode: 'tasks',
      overlaySummary: overlayView.summarizeOverlay(tasks),
      tasks
    };
  } else {
    if (args.input) {
      const board = require(path.resolve(args.input));
      result = JSON.parse(JSON.stringify(board));
      if (Array.isArray(result.tasks)) {
        result.tasks = overlayView.mergeTaskListOverlay(args.team, result.tasks);
      }
      result.overlaySummary = overlayView.summarizeOverlay(result.tasks || []);
    } else {
      result = overlayView.getMergedBoardView(args.team);
    }
    result.team = result.team || args.team;
    result.mode = 'board';
  }

  if (args.text) {
    console.log(renderText(result));
    return;
  }

  console.log(JSON.stringify(result, null, args.pretty ? 2 : 0));
}

function renderText(result) {
  const lines = [];
  const team = result.team || 'unknown-team';
  const mode = result.mode || 'tasks';
  const tasks = Array.isArray(result.tasks) ? result.tasks : [];
  const overlaySummary = result.overlaySummary || {};

  lines.push(`ClawTeam Overlay View · ${team} · ${mode}`);

  if (overlaySummary && overlaySummary.byOverlayState) {
    const parts = [];
    Object.keys(overlaySummary.byOverlayState).sort().forEach(key => {
      parts.push(`${key}: ${overlaySummary.byOverlayState[key]}`);
    });
    if (parts.length) lines.push(`Overlay summary: ${parts.join(' | ')}`);
  }

  if (!tasks.length) {
    lines.push('No tasks found.');
    return lines.join('\n');
  }

  lines.push('');
  tasks.forEach(task => {
    const id = task.id || task.taskId || '?';
    const title = task.subject || task.title || task.name || '(untitled)';
    const status = task.displayStatus || task.status || 'unknown';
    const owner = task.owner || task.assignedRole || 'unassigned';
    const badge = task.statusBadge ? ` · ${task.statusBadge}` : '';
    lines.push(`- [${id}] ${title}`);
    lines.push(`  status: ${status} · owner: ${owner}${badge}`);

    if (task.overlayMeta) {
      const metaParts = [];
      if (task.overlayMeta.targetRole) metaParts.push(`target=${task.overlayMeta.targetRole}`);
      if (task.overlayMeta.fallbackMode) metaParts.push(`fallback=${task.overlayMeta.fallbackMode}`);
      if (Number.isFinite(task.overlayMeta.consecutiveFailures) && task.overlayMeta.consecutiveFailures > 0) {
        metaParts.push(`failures=${task.overlayMeta.consecutiveFailures}`);
      }
      if (Number.isFinite(task.overlayMeta.retryAfterMs) && task.overlayMeta.retryAfterMs > 0) {
        metaParts.push(`retry_in=${Math.ceil(task.overlayMeta.retryAfterMs / 1000)}s`);
      }
      if (metaParts.length) lines.push(`  overlay: ${metaParts.join(' · ')}`);
    }
  });

  return lines.join('\n');
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message
  }, null, 2));
  process.exit(1);
});
