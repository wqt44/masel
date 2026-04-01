'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_DIR = path.join(__dirname, '../../../../memory/clawteam-state');
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function ensureRegistryDir() {
  fs.mkdirSync(REGISTRY_DIR, { recursive: true });
}

function getRegistryPath(teamId) {
  const safe = String(teamId || 'unknown-team').replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(REGISTRY_DIR, safe + '.json');
}

function nowIso() {
  return new Date().toISOString();
}

function readRegistry(teamId) {
  ensureRegistryDir();
  const file = getRegistryPath(teamId);
  if (!fs.existsSync(file)) {
    return { teamId, updatedAt: nowIso(), teamMeta: {}, pendingDecisions: [], activeReviewers: [], history: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      teamId,
      updatedAt: parsed.updatedAt || nowIso(),
      teamMeta: parsed.teamMeta && typeof parsed.teamMeta === 'object' ? parsed.teamMeta : {},
      pendingDecisions: Array.isArray(parsed.pendingDecisions) ? parsed.pendingDecisions : [],
      activeReviewers: Array.isArray(parsed.activeReviewers) ? parsed.activeReviewers : [],
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch (error) {
    return { teamId, updatedAt: nowIso(), teamMeta: {}, pendingDecisions: [], activeReviewers: [], history: [], error: error.message };
  }
}

function writeRegistry(teamId, data) {
  ensureRegistryDir();
  const file = getRegistryPath(teamId);
  const payload = {
    teamId,
    updatedAt: nowIso(),
    teamMeta: data.teamMeta && typeof data.teamMeta === 'object' ? data.teamMeta : {},
    pendingDecisions: Array.isArray(data.pendingDecisions) ? data.pendingDecisions : [],
    activeReviewers: Array.isArray(data.activeReviewers) ? data.activeReviewers : [],
    history: Array.isArray(data.history) ? data.history.slice(-200) : []
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return payload;
}

function pruneExpiredEntries(entries, ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now();
  return (entries || []).filter(entry => {
    if (!entry || !entry.createdAt) return false;
    const ts = new Date(entry.createdAt).getTime();
    if (!Number.isFinite(ts)) return false;
    return now - ts <= ttlMs;
  });
}

function registerDecision(teamId, taskState = {}, decision = {}, extra = {}) {
  if (!decision || !decision.fingerprint) return null;

  const registry = readRegistry(teamId);
  if (extra.teamMeta && typeof extra.teamMeta === 'object') {
    registry.teamMeta = { ...registry.teamMeta, ...extra.teamMeta };
  }
  registry.pendingDecisions = pruneExpiredEntries(registry.pendingDecisions, extra.ttlMs || DEFAULT_TTL_MS);
  registry.activeReviewers = pruneExpiredEntries(registry.activeReviewers, extra.ttlMs || DEFAULT_TTL_MS);

  const entry = {
    fingerprint: decision.fingerprint,
    taskId: taskState.taskId || taskState.title || 'unknown-task',
    taskTitle: taskState.title || taskState.taskId || 'unknown-task',
    taskType: taskState.type || 'unknown',
    status: taskState.status || 'unknown',
    assignedRole: taskState.assignedRole || 'unknown-role',
    action: decision.action,
    targetRole: decision.targetRole,
    reason: decision.reason,
    createdAt: nowIso(),
    overlayState: null,
    overlayUpdatedAt: null,
    overlayMeta: null
  };

  if (!registry.pendingDecisions.some(item => item.fingerprint === entry.fingerprint)) {
    registry.pendingDecisions.push(entry);
  }

  if (decision.action === 'assign_reviewer' && decision.targetRole) {
    const reviewerKey = String(decision.targetRole);
    const existing = registry.activeReviewers.find(item => item.role === reviewerKey && item.taskId === entry.taskId);
    if (!existing) {
      registry.activeReviewers.push({
        role: reviewerKey,
        taskId: entry.taskId,
        fingerprint: entry.fingerprint,
        createdAt: entry.createdAt
      });
    }
  }

  registry.history.push({
    type: 'register_decision',
    fingerprint: entry.fingerprint,
    action: entry.action,
    targetRole: entry.targetRole,
    createdAt: entry.createdAt
  });

  writeRegistry(teamId, registry);
  return entry;
}

function updateTaskOverlayState(teamId, taskId, overlayState, extra = {}) {
  if (!taskId || !overlayState) return null;

  const registry = readRegistry(teamId);
  if (extra.teamMeta && typeof extra.teamMeta === 'object') {
    registry.teamMeta = { ...registry.teamMeta, ...extra.teamMeta };
  }
  const ttlMs = extra.ttlMs || DEFAULT_TTL_MS;
  registry.pendingDecisions = pruneExpiredEntries(registry.pendingDecisions, ttlMs);
  registry.activeReviewers = pruneExpiredEntries(registry.activeReviewers, ttlMs);

  const now = nowIso();
  let updated = 0;

  registry.pendingDecisions = registry.pendingDecisions.map(entry => {
    if (entry.taskId !== taskId) return entry;
    updated += 1;
    return {
      ...entry,
      overlayState,
      overlayUpdatedAt: now,
      overlayMeta: extra.meta || null
    };
  });

  registry.history.push({
    type: 'update_task_overlay_state',
    taskId,
    overlayState,
    meta: extra.meta || null,
    updated,
    createdAt: now
  });

  writeRegistry(teamId, registry);
  return { taskId, overlayState, updated, updatedAt: now, meta: extra.meta || null };
}

function getTaskOverlayState(teamId, taskId, extra = {}) {
  if (!taskId) return null;
  const registry = readRegistry(teamId);
  const ttlMs = extra.ttlMs || DEFAULT_TTL_MS;
  const pending = pruneExpiredEntries(registry.pendingDecisions, ttlMs);
  const matches = pending.filter(entry => entry.taskId === taskId && entry.overlayState);
  if (!matches.length) return null;

  matches.sort((a, b) => {
    const at = new Date(a.overlayUpdatedAt || a.createdAt || 0).getTime();
    const bt = new Date(b.overlayUpdatedAt || b.createdAt || 0).getTime();
    return bt - at;
  });

  const latest = matches[0];
  return {
    taskId,
    overlayState: latest.overlayState,
    overlayUpdatedAt: latest.overlayUpdatedAt || latest.createdAt,
    meta: latest.overlayMeta || null
  };
}

function resolveDecision(teamId, fingerprint, extra = {}) {
  if (!fingerprint) return null;

  const registry = readRegistry(teamId);
  registry.pendingDecisions = pruneExpiredEntries(registry.pendingDecisions, extra.ttlMs || DEFAULT_TTL_MS)
    .filter(item => item.fingerprint !== fingerprint);
  registry.activeReviewers = pruneExpiredEntries(registry.activeReviewers, extra.ttlMs || DEFAULT_TTL_MS)
    .filter(item => item.fingerprint !== fingerprint);
  registry.history.push({
    type: 'resolve_decision',
    fingerprint,
    createdAt: nowIso()
  });

  writeRegistry(teamId, registry);
  return true;
}

function resolveTaskDecisions(teamId, taskId, extra = {}) {
  if (!taskId) return null;

  const registry = readRegistry(teamId);
  const ttlMs = extra.ttlMs || DEFAULT_TTL_MS;
  const pending = pruneExpiredEntries(registry.pendingDecisions, ttlMs);
  const active = pruneExpiredEntries(registry.activeReviewers, ttlMs);
  const removed = pending.filter(item => item.taskId === taskId);

  registry.pendingDecisions = pending.filter(item => item.taskId !== taskId);
  registry.activeReviewers = active.filter(item => item.taskId !== taskId);

  if (removed.length) {
    registry.history.push({
      type: 'resolve_task_decisions',
      taskId,
      fingerprints: removed.map(item => item.fingerprint),
      createdAt: nowIso()
    });
    writeRegistry(teamId, registry);
  }

  return removed;
}

function resolveReviewerDecision(teamId, taskId, reviewerRole, extra = {}) {
  if (!taskId || !reviewerRole) return null;

  const registry = readRegistry(teamId);
  const ttlMs = extra.ttlMs || DEFAULT_TTL_MS;
  const pending = pruneExpiredEntries(registry.pendingDecisions, ttlMs);
  const active = pruneExpiredEntries(registry.activeReviewers, ttlMs);

  const resolvedReviewers = active.filter(item => item.taskId === taskId && item.role === reviewerRole);
  const resolvedFingerprints = resolvedReviewers.map(item => item.fingerprint);

  registry.activeReviewers = active.filter(item => !(item.taskId === taskId && item.role === reviewerRole));
  registry.pendingDecisions = pending.filter(item => !resolvedFingerprints.includes(item.fingerprint));

  if (resolvedFingerprints.length) {
    registry.history.push({
      type: 'resolve_reviewer_decision',
      taskId,
      reviewerRole,
      fingerprints: resolvedFingerprints,
      createdAt: nowIso()
    });
    writeRegistry(teamId, registry);
  }

  return resolvedFingerprints;
}

function getSchedulerContext(teamId, extra = {}) {
  const registry = readRegistry(teamId);
  const ttlMs = extra.ttlMs || DEFAULT_TTL_MS;
  const pendingDecisions = pruneExpiredEntries(registry.pendingDecisions, ttlMs);
  const activeReviewers = pruneExpiredEntries(registry.activeReviewers, ttlMs);

  if (pendingDecisions.length !== registry.pendingDecisions.length || activeReviewers.length !== registry.activeReviewers.length) {
    writeRegistry(teamId, {
      ...registry,
      pendingDecisions,
      activeReviewers
    });
  }

  return {
    teamMeta: registry.teamMeta || {},
    pendingDecisions,
    activeReviewers,
    history: registry.history || []
  };
}

function setTeamMeta(teamId, patch = {}) {
  if (!teamId || !patch || typeof patch !== 'object') return null;
  const registry = readRegistry(teamId);
  registry.teamMeta = { ...(registry.teamMeta || {}), ...patch };
  writeRegistry(teamId, registry);
  return registry.teamMeta;
}

module.exports = {
  REGISTRY_DIR,
  DEFAULT_TTL_MS,
  readRegistry,
  writeRegistry,
  pruneExpiredEntries,
  registerDecision,
  updateTaskOverlayState,
  getTaskOverlayState,
  setTeamMeta,
  resolveDecision,
  resolveTaskDecisions,
  resolveReviewerDecision,
  getSchedulerContext
};
