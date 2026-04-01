const fs = require('fs');
const path = require('path');
const defaultConfig = require('./retrieval-config');

// ─── 文件级缓存（避免每次 retrieve() 都重读磁盘）──────────
const CACHE_TTL_MS = 60_000; // 60秒缓存
const _fileCache = new Map(); // filePath → { content, mtime, ts }

function cachedReadFile(filePath) {
  const now = Date.now();
  try {
    const stat = fs.statSync(filePath);
    const cached = _fileCache.get(filePath);
    // 缓存命中且文件未修改且未过期
    if (cached && cached.mtime === stat.mtimeMs && (now - cached.ts) < CACHE_TTL_MS) {
      return cached.content;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    _fileCache.set(filePath, { content, mtime: stat.mtimeMs, ts: now });
    return content;
  } catch {
    return null;
  }
}

// 缓存条目数限制（防止内存泄漏）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (_fileCache.size > 500) {
      const oldest = [..._fileCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
      for (let i = 0; i < oldest.length - 300; i++) _fileCache.delete(oldest[i][0]);
    }
  }, 300_000).unref?.();
}

function safeReadJson(filePath) {
  const text = cachedReadFile(filePath);
  if (text === null) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function listFilesRecursive(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function daysAgo(ts) {
  return (Date.now() - new Date(ts).getTime()) / 86400000;
}

function pickBestStructuredText(item) {
  if (!item || typeof item !== 'object') return '';
  if (typeof item.content === 'string' && item.content.trim()) return item.content.trim();
  if (typeof item.summary === 'string' && item.summary.trim()) return item.summary.trim();
  if (typeof item.data?.content === 'string' && item.data.content.trim()) return item.data.content.trim();
  if (typeof item.data?.summary === 'string' && item.data.summary.trim()) return item.data.summary.trim();
  if (typeof item.description === 'string' && item.description.trim()) return item.description.trim();
  return JSON.stringify(item);
}

function normalizeCandidate(candidate) {
  return {
    importance: 'normal',
    metadata: {},
    ...candidate,
    summary: candidate.summary || candidate.content || ''
  };
}

function isBrokenStructuredText(candidate) {
  const content = String(candidate.content || '').trim();
  const summary = String(candidate.summary || '').trim();
  const combined = `${summary} ${content}`.trim();
  const type = String(candidate.metadata?.type || candidate.metadata?.fileType || '').toLowerCase();

  if (!combined) return true;

  if (['project', 'preference', 'fact'].includes(type)) {
    if (content.length < 6) return true;
    if (/^[了呢啊呀哦吧吗嘛！!，,。\.\s]/.test(content)) return true;
    if (/^(收到|好的|嗯|是的|ok|okay)\b/i.test(content)) return true;
    if (type === 'project' && !/项目|project/.test(content)) return true;
    if (type === 'preference' && !/喜欢|偏好|习惯|风格/.test(content)) return true;
    if (type === 'fact' && content.length < 10) return true;
  }

  return false;
}

function isNoiseCandidate(candidate) {
  const text = `${candidate.summary || ''} ${candidate.content || ''}`.toLowerCase();
  const sourcePath = String(candidate.sourcePath || '').toLowerCase();
  const fileType = String(candidate.metadata?.fileType || candidate.metadata?.type || '').toLowerCase();

  if (!text.trim()) return true;
  if (sourcePath.includes('/structured/test/') || fileType === 'test') return true;
  if (text === 'test' || text === 'project') return true;
  if (text.includes('search me') || text.includes('test memory') || text.includes('test project')) return true;
  if (sourcePath.includes('/structured/') && isBrokenStructuredText(candidate)) return true;
  return false;
}

function collectL0(config = defaultConfig) {
  const dir = path.join(__dirname, '../../memory/raw-conversations');
  const files = listFilesRecursive(dir, f => f.endsWith('.jsonl')).sort().reverse();
  const out = [];
  for (const file of files) {
    const lines = (cachedReadFile(file) || '').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        if (daysAgo(rec.timestamp) > config.limits.lookbackDays.l0) continue;
        const candidate = normalizeCandidate({
          id: rec.id,
          layer: 'l0',
          sourceType: 'raw_conversation',
          sourcePath: file,
          timestamp: rec.timestamp,
          content: `${rec.user_message || ''}\n${rec.ai_response || ''}`.trim(),
          summary: rec.user_message || '',
          importance: rec.metadata?.importance || 'normal',
          metadata: rec.metadata || {}
        });
        if (!isNoiseCandidate(candidate)) out.push(candidate);
      } catch {}
    }
    if (out.length >= config.limits.perLayerCandidateLimit) break;
  }
  return out.slice(0, config.limits.perLayerCandidateLimit);
}

function chunkMarkdownSections(text) {
  const lines = String(text || '').split('\n');
  const chunks = [];
  let currentTitle = null;
  let currentLines = [];

  function flush() {
    const content = currentLines.join('\n').trim();
    if (!content) return;
    chunks.push({
      title: currentTitle || 'section',
      content
    });
  }

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line.trim())) {
      flush();
      currentTitle = line.trim().replace(/^#{1,3}\s+/, '');
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  if (chunks.length === 0 && text.trim()) {
    chunks.push({ title: 'document', content: text.trim() });
  }

  return chunks;
}

function collectL1(config = defaultConfig) {
  const out = [];

  const summaryDir = path.join(__dirname, '../../memory/daily-summaries');
  const summaryFiles = listFilesRecursive(summaryDir, f => f.endsWith('.json')).sort().reverse();
  for (const file of summaryFiles) {
    const rec = safeReadJson(file);
    if (!rec) continue;
    const ts = rec.created_at || rec.date;
    if (daysAgo(ts) > config.limits.lookbackDays.l1) continue;
    const candidate = normalizeCandidate({
      id: rec.id || `summary-${rec.date}`,
      layer: 'l1',
      sourceType: 'daily_summary',
      sourcePath: file,
      timestamp: ts,
      content: JSON.stringify(rec),
      summary: rec.summary || rec.date || 'daily summary',
      importance: 'important',
      metadata: { date: rec.date, projects: rec.projects_mentioned || [] }
    });
    if (!isNoiseCandidate(candidate)) out.push(candidate);
    if (out.length >= config.limits.perLayerCandidateLimit) return out;
  }

  const checkDir = path.join(__dirname, '../../memory/daily-checks');
  const checkFiles = listFilesRecursive(checkDir, f => f.endsWith('.md')).sort().reverse();
  for (const file of checkFiles) {
    const text = cachedReadFile(file);
    if (!text) continue;
    // 用缓存的 mtime 避免额外 stat
    const cached = _fileCache.get(file);
    const ts = cached ? new Date(cached.mtime).toISOString() : new Date().toISOString();
    if (daysAgo(ts) > config.limits.lookbackDays.l1) continue;

    const sections = chunkMarkdownSections(text);
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const candidate = normalizeCandidate({
        id: `daily-check-${path.basename(file, path.extname(file))}-${i}`,
        layer: 'l1',
        sourceType: 'daily_check_section',
        sourcePath: file,
        timestamp: ts,
        content: section.content,
        summary: `${path.basename(file)} :: ${section.title}`,
        importance: 'important',
        metadata: { kind: 'daily-check', section: section.title }
      });
      if (!isNoiseCandidate(candidate)) out.push(candidate);
      if (out.length >= config.limits.perLayerCandidateLimit) return out;
    }
  }

  return out;
}

function collectL2(config = defaultConfig) {
  const dir = path.join(__dirname, '../../memory/structured');
  const files = listFilesRecursive(dir, f => f.endsWith('.json'));
  const out = [];
  for (const file of files) {
    const rec = safeReadJson(file);
    if (!rec) continue;
    const items = Array.isArray(rec) ? rec : [rec];
    for (const item of items) {
      const ts = item.updated_at || item.created_at || item.timestamp || new Date().toISOString();
      if (daysAgo(ts) > config.limits.lookbackDays.l2) continue;
      const bestText = pickBestStructuredText(item);
      const candidate = normalizeCandidate({
        id: item.id || `${path.basename(file)}-${out.length}`,
        layer: 'l2',
        sourceType: 'structured_memory',
        sourcePath: file,
        timestamp: ts,
        content: bestText,
        summary: item.summary || bestText || item.type || 'structured memory',
        importance: item.importance || 'important',
        metadata: { ...item, fileType: path.basename(path.dirname(file)) }
      });
      if (!isNoiseCandidate(candidate)) out.push(candidate);
      if (out.length >= config.limits.perLayerCandidateLimit) return out;
    }
  }
  return out;
}

function collectL3(config = defaultConfig) {
  const possibleDirs = [
    path.join(__dirname, '../../memory/patterns'),
    path.join(__dirname, '../../memory/self-improving/patterns')
  ];
  const out = [];
  for (const dir of possibleDirs) {
    const files = listFilesRecursive(dir, f => f.endsWith('.json') || f.endsWith('.jsonl') || f.endsWith('.md'));
    for (const file of files) {
      const text = cachedReadFile(file);
      if (!text) continue;
      const candidate = normalizeCandidate({
        id: `l3-${path.basename(file)}-${out.length}`,
        layer: 'l3',
        sourceType: 'pattern_memory',
        sourcePath: file,
        timestamp: new Date().toISOString(),
        content: text,
        summary: text.slice(0, 200),
        importance: 'important',
        metadata: {}
      });
      if (!isNoiseCandidate(candidate)) out.push(candidate);
      if (out.length >= config.limits.perLayerCandidateLimit) return out;
    }
  }
  return out;
}

function collectCandidates(config = defaultConfig) {
  const results = [];
  if (config.enabledLayers.includes('l0')) results.push(...collectL0(config));
  if (config.enabledLayers.includes('l1')) results.push(...collectL1(config));
  if (config.enabledLayers.includes('l2')) results.push(...collectL2(config));
  if (config.enabledLayers.includes('l3')) results.push(...collectL3(config));
  return results;
}

module.exports = {
  collectCandidates,
  collectL0,
  collectL1,
  collectL2,
  collectL3,
  isNoiseCandidate
};
