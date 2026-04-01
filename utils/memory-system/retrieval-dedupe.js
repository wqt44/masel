const { tokenize } = require('./vector-index-store');

function normalizeText(text) {
  return tokenize(text).join(' ');
}

function textSimilarity(a, b) {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  const union = new Set([...sa, ...sb]);
  if (!union.size) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / union.size;
}

function dedupeResults(results, threshold = 0.88) {
  const kept = [];
  for (const item of results) {
    const norm = normalizeText(item.content || item.summary || '');
    const dup = kept.find(x => {
      const similarity = textSimilarity(normalizeText(x.content || x.summary || ''), norm);
      return similarity >= threshold || x.id === item.id || (x.sourcePath && item.sourcePath && x.sourcePath === item.sourcePath);
    });
    if (!dup) {
      kept.push(item);
    } else if ((item.scores?.final || 0) > (dup.scores?.final || 0)) {
      Object.assign(dup, item);
    }
  }
  return kept;
}

module.exports = { dedupeResults, textSimilarity, normalizeText };
