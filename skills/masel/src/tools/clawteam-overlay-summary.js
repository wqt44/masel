'use strict';

const fs = require('fs');
const path = require('path');
const registry = require('./clawteam-decision-registry');

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return null;
  }
}

function inferTeamSource(teamId, data, extra = {}) {
  if (extra.includeTestTeams === true) return 'runtime';
  const explicit = data && data.teamMeta && data.teamMeta.source;
  if (explicit === 'test' || explicit === 'runtime') return explicit;
  return isLikelyTestTeam(teamId, extra) ? 'test' : 'runtime';
}

function isLikelyTestTeam(teamId, extra = {}) {
  if (!teamId) return false;
  if (extra.includeTestTeams === true) return false;
  return /^(overlay-|test-|demo-|tmp-|mock-)/i.test(String(teamId));
}

function dedupePausedTasks(tasks) {
  const seen = new Set();
  const result = [];

  (tasks || []).forEach(task => {
    const key = [
      task.taskId || '?',
      task.taskTitle || '?',
      task.targetRole || '?',
      task.reason || '?'
    ].join('::');

    if (seen.has(key)) return;
    seen.add(key);
    result.push(task);
  });

  return result;
}

function summarizeRegistry(teamId, data) {
  const pending = Array.isArray(data && data.pendingDecisions) ? data.pendingDecisions : [];
  const summary = {
    teamId,
    teamMeta: data && data.teamMeta && typeof data.teamMeta === 'object' ? data.teamMeta : {},
    pendingDecisions: pending.length,
    pausedPendingLeader: 0,
    activeOverlay: 0,
    overlays: {},
    pausedTasks: []
  };

  pending.forEach(item => {
    if (!item || !item.overlayState) return;
    summary.overlays[item.overlayState] = (summary.overlays[item.overlayState] || 0) + 1;
    if (item.overlayState === 'paused_pending_leader') {
      summary.pausedPendingLeader += 1;
      summary.pausedTasks.push({
        taskId: item.taskId,
        taskTitle: item.taskTitle,
        assignedRole: item.assignedRole,
        targetRole: item.targetRole,
        reason: item.reason,
        overlayUpdatedAt: item.overlayUpdatedAt || item.createdAt,
        overlayMeta: item.overlayMeta || null
      });
    }
    if (item.overlayState === 'active') summary.activeOverlay += 1;
  });

  summary.pausedTasks.sort((a, b) => {
    const at = new Date(a.overlayUpdatedAt || 0).getTime();
    const bt = new Date(b.overlayUpdatedAt || 0).getTime();
    return bt - at;
  });

  return summary;
}

function getGlobalOverlaySummary(extra = {}) {
  const dir = registry.REGISTRY_DIR;
  if (!fs.existsSync(dir)) {
    return {
      teams: 0,
      rawTeams: 0,
      filteredTeams: 0,
      pausedPendingLeader: 0,
      activeOverlay: 0,
      pendingDecisions: 0,
      byOverlayState: {},
      pausedTasks: [],
      teamSummaries: []
    };
  }

  const files = fs.readdirSync(dir).filter(name => name.endsWith('.json'));
  const rawTeams = files.length;
  let filteredTeams = 0;

  const teamSummaries = files.map(name => {
    const teamId = path.basename(name, '.json');
    const data = safeReadJson(path.join(dir, name)) || {};
    if (inferTeamSource(teamId, data, extra) === 'test') {
      filteredTeams += 1;
      return null;
    }
    return summarizeRegistry(teamId, data);
  }).filter(Boolean);

  const result = {
    teams: teamSummaries.length,
    rawTeams,
    filteredTeams,
    pausedPendingLeader: 0,
    activeOverlay: 0,
    pendingDecisions: 0,
    byOverlayState: {},
    pausedTasks: [],
    teamSummaries
  };

  teamSummaries.forEach(team => {
    result.pausedPendingLeader += team.pausedPendingLeader;
    result.activeOverlay += team.activeOverlay;
    result.pendingDecisions += team.pendingDecisions;
    Object.keys(team.overlays || {}).forEach(key => {
      result.byOverlayState[key] = (result.byOverlayState[key] || 0) + team.overlays[key];
    });
    result.pausedTasks.push(...team.pausedTasks);
  });

  result.pausedTasks.sort((a, b) => {
    const at = new Date(a.overlayUpdatedAt || 0).getTime();
    const bt = new Date(b.overlayUpdatedAt || 0).getTime();
    return bt - at;
  });

  result.pausedTasks = dedupePausedTasks(result.pausedTasks).slice(0, extra.maxPausedTasks || 10);
  return result;
}

module.exports = {
  inferTeamSource,
  isLikelyTestTeam,
  dedupePausedTasks,
  summarizeRegistry,
  getGlobalOverlaySummary
};
