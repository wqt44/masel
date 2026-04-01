'use strict';

const { execSync } = require('child_process');
const decisionRegistry = require('./clawteam-decision-registry');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildOverlayBadge(overlayState, meta) {
  if (!overlayState) return null;
  if (overlayState === 'paused_pending_leader') {
    const parts = ['paused_pending_leader'];
    if (meta && meta.fallbackMode) parts.push(meta.fallbackMode);
    if (meta && meta.reported) parts.push('reported');
    if (meta && Number.isFinite(meta.retryAfterMs) && meta.retryAfterMs > 0) {
      parts.push('retry_in_' + Math.ceil(meta.retryAfterMs / 1000) + 's');
    }
    return parts.join(' | ');
  }
  if (overlayState === 'active') return 'active';
  return overlayState;
}

function mergeTaskOverlay(teamId, task, extra = {}) {
  if (!task) return task;

  const merged = clone(task);
  const taskId = merged.id || merged.taskId;
  if (!taskId) return merged;

  const overlay = decisionRegistry.getTaskOverlayState(teamId, taskId, {
    ttlMs: extra.ttlMs
  });

  if (!overlay) return merged;

  merged.overlayState = overlay.overlayState;
  merged.overlayUpdatedAt = overlay.overlayUpdatedAt;
  merged.overlayMeta = overlay.meta || null;
  merged.displayStatus = merged.status;

  if (merged.status === 'blocked' && overlay.overlayState === 'paused_pending_leader') {
    merged.displayStatus = 'blocked (paused_pending_leader)';
  }

  merged.statusBadge = buildOverlayBadge(overlay.overlayState, overlay.meta);
  return merged;
}

function mergeTaskListOverlay(teamId, tasks, extra = {}) {
  return (tasks || []).map(task => mergeTaskOverlay(teamId, task, extra));
}

function summarizeOverlay(tasks) {
  const summary = {
    pausedPendingLeader: 0,
    activeOverlay: 0,
    byOverlayState: {}
  };

  (tasks || []).forEach(task => {
    const key = task && task.overlayState;
    if (!key) return;
    summary.byOverlayState[key] = (summary.byOverlayState[key] || 0) + 1;
    if (key === 'paused_pending_leader') summary.pausedPendingLeader += 1;
    if (key === 'active') summary.activeOverlay += 1;
  });

  return summary;
}

function getMergedTaskList(teamId, extra = {}) {
  const out = execSync('clawteam --json task list ' + teamId, {
    encoding: 'utf-8',
    timeout: extra.timeoutMs || 5000
  });
  const tasks = JSON.parse(out);
  return mergeTaskListOverlay(teamId, tasks, extra);
}

function getMergedBoardView(teamId, extra = {}) {
  const out = execSync('clawteam --json board show ' + teamId, {
    encoding: 'utf-8',
    timeout: extra.timeoutMs || 5000
  });
  const board = JSON.parse(out);
  const merged = clone(board);

  if (Array.isArray(merged.tasks)) {
    merged.tasks = mergeTaskListOverlay(teamId, merged.tasks, extra);
  }

  merged.overlaySummary = summarizeOverlay(merged.tasks || []);
  return merged;
}

module.exports = {
  buildOverlayBadge,
  mergeTaskOverlay,
  mergeTaskListOverlay,
  summarizeOverlay,
  getMergedTaskList,
  getMergedBoardView
};
