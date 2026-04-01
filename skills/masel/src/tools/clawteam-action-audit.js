'use strict';

const fs = require('fs');
const path = require('path');

const AUDIT_DIR = path.join(__dirname, '../../../../memory/clawteam-audit');

function ensureAuditDir() {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function getAuditPath(teamId) {
  const safe = String(teamId || 'unknown-team').replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(AUDIT_DIR, safe + '.jsonl');
}

function appendAudit(teamId, record) {
  ensureAuditDir();
  const payload = {
    timestamp: nowIso(),
    teamId,
    ...record
  };
  fs.appendFileSync(getAuditPath(teamId), JSON.stringify(payload) + '\n');
  return payload;
}

function readAudit(teamId, limit = 50) {
  ensureAuditDir();
  const file = getAuditPath(teamId);
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split('\n').filter(Boolean);
  return lines.slice(-limit).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function summarizeRecentFailures(teamId, fingerprint, limit = 20) {
  const items = readAudit(teamId, limit).filter(item => item && item.fingerprint === fingerprint);
  let consecutiveFailures = 0;
  let lastFailureAt = null;

  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item.ok === false) {
      consecutiveFailures += 1;
      if (!lastFailureAt) lastFailureAt = item.timestamp;
    } else if (item.ok === true) {
      break;
    }
  }

  return {
    count: items.length,
    consecutiveFailures,
    lastFailureAt
  };
}

module.exports = {
  AUDIT_DIR,
  appendAudit,
  readAudit,
  summarizeRecentFailures
};
