#!/usr/bin/env node
const fs = require('fs');
const defaultConfig = require('./retrieval-config');
const { collectCandidates } = require('./retrieval-sources');
const { createEmptyIndex, embedText, saveIndex, sourceHash } = require('./vector-index-store');

function main() {
  const config = defaultConfig;
  const candidates = collectCandidates(config);
  const index = createEmptyIndex(config);
  const layers = { l0: 0, l1: 0, l2: 0, l3: 0 };
  const sourceFiles = { l0: new Set(), l1: new Set(), l2: new Set(), l3: new Set() };
  let emptySkipped = 0;
  let duplicateSkipped = 0;
  const seen = new Set();

  for (const item of candidates) {
    const text = item.content || item.summary || '';
    if (!String(text).trim()) {
      emptySkipped++;
      continue;
    }
    const key = `${item.layer}:${item.id}:${item.sourcePath}`;
    if (seen.has(key)) {
      duplicateSkipped++;
      continue;
    }
    seen.add(key);

    layers[item.layer] = (layers[item.layer] || 0) + 1;
    if (sourceFiles[item.layer]) sourceFiles[item.layer].add(item.sourcePath);
    index.entries.push({
      id: item.id,
      layer: item.layer,
      sourcePath: item.sourcePath,
      sourceHash: sourceHash(text),
      timestamp: item.timestamp,
      importance: item.importance,
      text,
      vector: embedText(text, config.index.dim)
    });
  }

  index.builtAt = new Date().toISOString();
  saveIndex(index, config);

  const summary = {
    status: 'ok',
    builtAt: index.builtAt,
    entries: index.entries.length,
    layers,
    sources: {
      l0: sourceFiles.l0.size,
      l1: sourceFiles.l1.size,
      l2: sourceFiles.l2.size,
      l3: sourceFiles.l3.size
    },
    skipped: {
      empty: emptySkipped,
      duplicate: duplicateSkipped
    },
    indexPath: config.index.path
  };

  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(String(err.stack || err) + '\n');
    process.exit(1);
  }
}
