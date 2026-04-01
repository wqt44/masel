#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ensureDir } = require('./memory-fs');

const STRUCTURED_DIR = path.join(__dirname, '../../memory/structured');
const ARCHIVE_DIR = path.join(__dirname, '../../memory/archive/structured-cleanup');

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.isFile() && full.endsWith('.json')) out.push(full);
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

// ensureDir imported from memory-fs.js

function normalizeText(text = '') {
  return String(text)
    .replace(/[“”"']/g, '')
    .replace(/\b(?:收到|好的|好呀|明白了|记住了|ok|okay)\b/gi, '')
    .replace(/[，,、；;:\-\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isBroken(memory) {
  const type = String(memory?.type || '').toLowerCase();
  const content = String(memory?.content || '').trim();
  if (!content) return true;
  if (/^[了呢啊呀哦吧吗嘛！!，,。\.\s]/.test(content)) return true;
  if (type === 'project' && !/项目|project/.test(content)) return true;
  if (type === 'preference' && !/喜欢|偏好|习惯|风格/.test(content)) return true;
  if (type === 'fact' && content.length < 6) return true;
  return false;
}

function canonicalize(memory) {
  const cloned = { ...memory };
  const type = String(cloned.type || '').toLowerCase();
  const content = normalizeText(cloned.content || '');

  if (type === 'preference') {
    let cleaned = content;
    cleaned = cleaned.replace(/^用户喜欢\s*:?\s*/i, '');
    cleaned = normalizeText(cleaned);
    cloned.content = cleaned ? `用户喜欢: ${cleaned}` : '';
  } else {
    cloned.content = content;
  }

  cloned.updated_at = new Date().toISOString();
  return cloned;
}

function makeFingerprint(memory) {
  return `${memory.type}::${normalizeText(memory.content).toLowerCase()}`;
}

function archiveFile(file, dryRun) {
  const rel = path.relative(STRUCTURED_DIR, file);
  const target = path.join(ARCHIVE_DIR, rel);
  if (dryRun) return target;
  ensureDir(path.dirname(target));
  fs.renameSync(file, target);
  return target;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const files = listJsonFiles(STRUCTURED_DIR);
  const seen = new Map();
  const actions = [];

  for (const file of files) {
    const memory = readJson(file);
    if (!memory || typeof memory !== 'object') {
      actions.push({ action: 'skip-invalid', file });
      continue;
    }

    if (String(path.dirname(file)).includes(`${path.sep}test`)) {
      actions.push({ action: 'archive-test', file, reason: 'test memory' });
      archiveFile(file, dryRun);
      continue;
    }

    if (isBroken(memory)) {
      actions.push({ action: 'archive-broken', file, id: memory.id, content: memory.content || '', reason: 'broken content' });
      archiveFile(file, dryRun);
      continue;
    }

    const cleaned = canonicalize(memory);
    if (isBroken(cleaned)) {
      actions.push({ action: 'archive-broken', file, id: memory.id, content: memory.content || '', reason: 'broken after canonicalize' });
      archiveFile(file, dryRun);
      continue;
    }

    const fingerprint = makeFingerprint(cleaned);
    if (seen.has(fingerprint)) {
      const keeper = seen.get(fingerprint);
      actions.push({ action: 'archive-duplicate', file, id: memory.id, duplicateOf: keeper.id, content: cleaned.content });
      archiveFile(file, dryRun);
      continue;
    }

    seen.set(fingerprint, { id: cleaned.id, file, content: cleaned.content });

    const original = JSON.stringify(memory);
    const updated = JSON.stringify(cleaned);
    if (original !== updated) {
      actions.push({ action: 'normalize', file, id: memory.id, before: memory.content || '', after: cleaned.content || '' });
      if (!dryRun) {
        fs.writeFileSync(file, JSON.stringify(cleaned, null, 2));
      }
    } else {
      actions.push({ action: 'keep', file, id: memory.id, content: memory.content || '' });
    }
  }

  const summary = actions.reduce((acc, item) => {
    acc[item.action] = (acc[item.action] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({ dryRun, totalFiles: files.length, summary, actions }, null, 2));
}

main();
