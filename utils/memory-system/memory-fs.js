/**
 * Shared file utilities for memory-system
 * 避免 saveStructuredMemory 重复定义
 */

const fs = require('fs');
const path = require('path');

const STRUCTURED_DIR = path.join(__dirname, '../../memory/structured');
const ARCHIVE_DIR = path.join(__dirname, '../../memory/archive');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function saveStructuredMemory(memory) {
  const typePath = path.join(STRUCTURED_DIR, memory.type || 'unknown');
  ensureDir(typePath);
  fs.writeFileSync(
    path.join(typePath, `${memory.id}.json`),
    JSON.stringify(memory, null, 2)
  );
}

function archiveStructuredMemory(memory) {
  ensureDir(ARCHIVE_DIR);
  fs.writeFileSync(
    path.join(ARCHIVE_DIR, `${memory.id}.json`),
    JSON.stringify(memory, null, 2)
  );

  // 从原位删除
  const originalPath = path.join(STRUCTURED_DIR, memory.type || 'unknown', `${memory.id}.json`);
  if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
}

function loadStructuredMemories(typeFilter = null) {
  const memories = [];
  if (!fs.existsSync(STRUCTURED_DIR)) return memories;

  const walkDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walkDir(full); continue; }
      if (!entry.name.endsWith('.json')) continue;
      try {
        const m = JSON.parse(fs.readFileSync(full, 'utf-8'));
        if (!typeFilter || m.type === typeFilter) memories.push(m);
      } catch {}
    }
  };
  walkDir(STRUCTURED_DIR);
  return memories;
}

module.exports = {
  STRUCTURED_DIR,
  ARCHIVE_DIR,
  ensureDir,
  saveStructuredMemory,
  archiveStructuredMemory,
  loadStructuredMemories
};
