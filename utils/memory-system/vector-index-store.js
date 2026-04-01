const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const defaultConfig = require('./retrieval-config');

function ensureDir(filePath) {
  ensureDir(path.dirname(filePath));
}

function tokenize(text) {
  const input = String(text || '').toLowerCase();
  const normalized = input.replace(/[^\p{L}\p{N}\s]+/gu, ' ');
  const wordTokens = normalized.split(/\s+/).filter(Boolean);

  const cjkChars = [...input.replace(/\s+/g, '')].filter(ch => /[\u3400-\u9fff]/.test(ch));
  const grams = [];
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i <= cjkChars.length - n; i++) {
      grams.push(cjkChars.slice(i, i + n).join(''));
    }
  }

  return Array.from(new Set([...wordTokens, ...grams]));
}

function stableHash(text) {
  const hex = crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 8);
  return parseInt(hex, 16);
}

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vec.map(x => x / norm);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, (dot + 1) / 2));
}

function embedText(text, dim = defaultConfig.index.dim) {
  const vec = new Array(dim).fill(0);
  for (const token of tokenize(text)) {
    const h = stableHash(token);
    vec[h % dim] += 1;
  }
  return normalize(vec);
}

function sourceHash(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function createEmptyIndex(config = defaultConfig) {
  return {
    version: config.index.version,
    embeddingModel: config.index.embeddingModel,
    chunkVersion: config.index.chunkVersion,
    dim: config.index.dim,
    builtAt: null,
    entries: []
  };
}

function loadIndex(config = defaultConfig) {
  const indexPath = config.index.path;
  if (!fs.existsSync(indexPath)) return createEmptyIndex(config);
  const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  if (
    parsed.version !== config.index.version ||
    parsed.embeddingModel !== config.index.embeddingModel ||
    parsed.chunkVersion !== config.index.chunkVersion ||
    parsed.dim !== config.index.dim
  ) {
    const err = new Error('Memory index version mismatch; rebuild required');
    err.code = 'MEMORY_INDEX_REBUILD_REQUIRED';
    throw err;
  }
  return parsed;
}

function saveIndex(index, config = defaultConfig) {
  ensureDir(config.index.path);
  fs.writeFileSync(config.index.path, JSON.stringify(index, null, 2));
}

module.exports = {
  tokenize,
  stableHash,
  normalize,
  cosineSimilarity,
  embedText,
  sourceHash,
  createEmptyIndex,
  loadIndex,
  saveIndex
};
