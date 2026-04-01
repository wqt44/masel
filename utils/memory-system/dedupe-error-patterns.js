'use strict';

const fs = require('fs');
const path = require('path');
const memory = require('./ultimate-memory.js');

const ERROR_DIR = path.join(__dirname, '../../memory/structured/error_pattern');

function loadEntries() {
  if (!fs.existsSync(ERROR_DIR)) return [];
  return fs.readdirSync(ERROR_DIR)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const file = path.join(ERROR_DIR, name);
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return { file, name, data };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.data.created_at || 0) - new Date(b.data.created_at || 0));
}

function main() {
  memory.initialize();
  const entries = loadEntries();
  const kept = [];
  const removed = [];

  for (const entry of entries) {
    const active = kept.filter(x => x.data.is_active !== false);
    const conflict = active.find(existing => {
      const sim = memory.detectConflicts({
        ...entry.data,
        id: '__candidate__',
        is_active: true
      }).find(c => c.existing_memory && c.existing_memory.id === existing.data.id);
      return !!sim && sim.conflict_type === 'duplicate';
    });

    if (!conflict) {
      kept.push(entry);
      continue;
    }

    const merged = memory.mergeStructuredMemory(conflict.data, entry.data);
    fs.writeFileSync(conflict.file, JSON.stringify(merged, null, 2), 'utf-8');
    conflict.data = merged;

    try {
      fs.unlinkSync(entry.file);
      removed.push({ removed: entry.name, mergedInto: conflict.name });
    } catch {}
  }

  console.log(JSON.stringify({
    scanned: entries.length,
    kept: kept.length,
    removed: removed.length,
    merges: removed
  }, null, 2));
}

if (require.main === module) {
  main();
}
