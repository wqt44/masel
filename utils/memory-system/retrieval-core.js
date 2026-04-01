const defaultConfig = require('./retrieval-config');
const { collectCandidates } = require('./retrieval-sources');
const { loadIndex, embedText } = require('./vector-index-store');
const { scoreKeyword, scoreSemantic, scoreRecency, scoreImportance, scoreLayerPrior, fuseScores } = require('./retrieval-fusion');
const { dedupeResults } = require('./retrieval-dedupe');
const { loadGraph, findNeighbors, makeNodeId } = require('./graph-store');

function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] !== null && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function summarizeConfig(config) {
  return {
    enabledLayers: config.enabledLayers,
    finalTopK: config.limits.finalTopK,
    perLayerCandidateLimit: config.limits.perLayerCandidateLimit,
    maxPerLayerInFinal: config.limits.maxPerLayerInFinal,
    weights: config.weights
  };
}

function applyLayerBalancing(results, config) {
  const maxPerLayer = config.limits.maxPerLayerInFinal || {};
  const kept = [];
  const counts = {};
  for (const item of results) {
    const max = maxPerLayer[item.layer] ?? config.limits.finalTopK;
    counts[item.layer] = counts[item.layer] || 0;
    if (counts[item.layer] >= max) continue;
    kept.push(item);
    counts[item.layer] += 1;
    if (kept.length >= config.limits.finalTopK) break;
  }
  return kept;
}

function detectQueryIntent(query) {
  const q = String(query || '').toLowerCase();
  return {
    preference: /偏好|喜欢|习惯|风格|设计讨论|用户偏好|工作风格/.test(q),
    project: /项目|project|进展|里程碑|待办|todo/.test(q),
    memory: /记忆|记住|回忆|总结|总结一下|回顾/.test(q),
    fact: /事实|重要|关键|关键信息|结论/.test(q),
    decision: /决定|决策|确定|选型|方案/.test(q),
    masel: /masel/.test(q),
    // v1.0.1: 编码/执行类意图，用于激活 error_pattern 加成
    coding: /编码|代码|code|函数|实现|开发|脚本|script|debug|修复|bug|错误|error|执行|exec|运行|run/.test(q)
  };
}

function computeTypeBoost(candidate, intent) {
  const type = String(candidate.metadata?.type || candidate.metadata?.fileType || '').toLowerCase();
  const content = String(candidate.content || '').toLowerCase();
  const sourceType = String(candidate.sourceType || '').toLowerCase();
  const section = String(candidate.metadata?.section || '').toLowerCase();
  const defaultConfig = require('./retrieval-config');
  let boost = 0;
  if (intent.preference && type.includes('preference')) boost += 0.14;
  if (intent.project && type.includes('project')) boost += 0.14;
  if (intent.fact && type.includes('fact')) boost += 0.12;
  if (intent.decision && (type.includes('decision') || candidate.layer === 'l1')) boost += 0.10;
  if (intent.memory && ['l1', 'l2', 'l3'].includes(candidate.layer)) boost += 0.10;
  if (intent.memory && sourceType.includes('daily_check_section')) boost += 0.06;
  if (intent.memory && /状态|问题|下一步|进化行动/.test(section)) boost += 0.05;
  if (intent.masel && content.includes('masel')) boost += 0.12;
  // v1.0.1: error_pattern 加成 — 编码/执行类查询时大幅提权
  if (type.includes('error_pattern')) {
    if (intent.coding) {
      boost += (defaultConfig.errorPatternBoost || 0.18);
    } else {
      // 非编码查询也给基础加成，错误模式始终有参考价值
      boost += 0.06;
    }
  }
  return Math.min(boost, 0.35);
}

function computeMismatchPenalty(candidate, intent, keyword, semantic) {
  const type = String(candidate.metadata?.type || candidate.metadata?.fileType || '').toLowerCase();
  let penalty = 0;

  const weakSignal = keyword < 0.08 && semantic < 0.58;
  if (!weakSignal) return 0;

  if (intent.preference && !type.includes('preference')) penalty += 0.10;
  if (intent.project && !type.includes('project') && candidate.layer !== 'l0') penalty += 0.04;
  if (intent.fact && !type.includes('fact')) penalty += 0.04;
  if (intent.decision && !(type.includes('decision') || candidate.layer === 'l1')) penalty += 0.04;
  if (intent.memory && candidate.layer === 'l0' && keyword < 0.12) penalty += 0.03;
  if (intent.memory && candidate.layer === 'l2' && type.includes('project') && keyword < 0.12) penalty += 0.04;
  if (intent.masel && !String(candidate.content || '').toLowerCase().includes('masel')) penalty += 0.06;

  return Math.min(penalty, 0.18);
}

function detectProjectsFromCandidate(candidate) {
  const text = `${candidate.summary || ''} ${candidate.content || ''}`;
  const matches = [...String(text).matchAll(/([A-Za-z0-9_-]{2,})\s*(?:项目|project)/gi)];
  return Array.from(new Set(matches.map(m => m[1])));
}

function detectTopicAnchors(candidate) {
  const text = `${candidate.summary || ''} ${candidate.content || ''}`.toLowerCase();
  const anchors = [];

  if (/系统状态|system status/.test(text)) anchors.push('topic:system-status');
  if (/记忆系统|记忆回顾|memory/.test(text)) anchors.push('topic:memory');
  if (/下一步|next step/.test(text)) anchors.push('topic:next-step');
  if (/进化行动|evolution/.test(text)) anchors.push('topic:evolution');
  if (/masel/.test(text)) anchors.push('topic:masel');
  if (/设计讨论|设计方案|详细设计/.test(text)) anchors.push('topic:design-discussion');

  return Array.from(new Set(anchors));
}

function candidateToGraphAnchors(candidate) {
  const anchors = new Set();

  if (candidate.layer === 'l0') {
    anchors.add(makeNodeId('raw', candidate.id));
  }

  if (candidate.layer === 'l1') {
    anchors.add(makeNodeId('summary', candidate.id));
    const date = String(candidate.metadata?.date || '').slice(0, 10);
    if (date) anchors.add(`date:${date}`);
  }

  if (candidate.layer === 'l2') {
    anchors.add(makeNodeId('memory', candidate.id));
  }

  for (const project of detectProjectsFromCandidate(candidate)) {
    anchors.add(makeNodeId('project-tag', project));
  }

  for (const topic of detectTopicAnchors(candidate)) {
    anchors.add(topic);
  }

  const type = String(candidate.metadata?.type || candidate.metadata?.fileType || '').toLowerCase();
  if (type) anchors.add(`type:${type}`);

  return Array.from(anchors);
}

function candidateToGraphNodeId(candidate) {
  return candidateToGraphAnchors(candidate)[0] || null;
}

function buildGraphExpansion(results, config) {
  if (!config.graph?.enabled) return [];

  let graph;
  try {
    graph = loadGraph();
  } catch {
    return [];
  }

  const seedNodeIds = results
    .slice(0, config.graph.seedTopK || 3)
    .flatMap(candidateToGraphAnchors)
    .filter(Boolean);

  if (!seedNodeIds.length) return [];

  const edges = findNeighbors(graph, seedNodeIds, {
    direction: 'both',
    limit: config.graph.neighborLimit || 12
  });

  return edges.map(edge => ({
    from: edge.from,
    to: edge.to,
    type: edge.type,
    updated_at: edge.updated_at
  }));
}

function classifyAnchor(anchor) {
  if (anchor.startsWith('project-tag:')) return 'projectTag';
  if (anchor.startsWith('date:')) return 'date';
  if (anchor.startsWith('type:')) return 'type';
  if (anchor.startsWith('topic:')) return 'topic';
  return 'node';
}

function applyGraphBoost(results, graphExpansion, config) {
  if (!config.graph?.enabled) return results;

  const boosts = config.graph.edgeTypeBoosts || {};
  const sharedBoosts = config.graph.sharedAnchorBoosts || {};
  const maxBoost = config.graph.maxBoost || 0.12;
  const seedCandidates = results.slice(0, config.graph.seedTopK || 3);
  const seedIds = new Set(seedCandidates.flatMap(candidateToGraphAnchors).filter(Boolean));
  const seedAnchors = new Set(seedCandidates.flatMap(candidateToGraphAnchors).filter(Boolean));

  const neighborBoosts = new Map();
  for (const edge of graphExpansion || []) {
    const edgeBoost = boosts[edge.type] || 0;
    if (!edgeBoost) continue;

    const fromIsSeed = seedIds.has(edge.from);
    const toIsSeed = seedIds.has(edge.to);

    if (fromIsSeed && !toIsSeed) {
      neighborBoosts.set(edge.to, (neighborBoosts.get(edge.to) || 0) + edgeBoost);
    }
    if (toIsSeed && !fromIsSeed) {
      neighborBoosts.set(edge.from, (neighborBoosts.get(edge.from) || 0) + edgeBoost);
    }

    if (!fromIsSeed && !toIsSeed) {
      neighborBoosts.set(edge.from, (neighborBoosts.get(edge.from) || 0) + edgeBoost * 0.5);
      neighborBoosts.set(edge.to, (neighborBoosts.get(edge.to) || 0) + edgeBoost * 0.5);
    }
  }

  return results.map(item => {
    const anchors = candidateToGraphAnchors(item);
    if (!anchors.length) return item;
    if (anchors.some(a => seedIds.has(a))) return item;

    let boost = 0;
    const sharedReasons = [];

    for (const anchor of anchors) {
      const neighborBoost = neighborBoosts.get(anchor) || 0;
      if (neighborBoost) {
        boost += neighborBoost;
        sharedReasons.push(`neighbor:${anchor}`);
      }

      if (seedAnchors.has(anchor)) {
        const kind = classifyAnchor(anchor);
        const shared = sharedBoosts[kind] || 0;
        if (shared) {
          boost += shared;
          sharedReasons.push(`shared:${anchor}`);
        }
      }
    }

    for (const edge of graphExpansion || []) {
      const edgeBoost = boosts[edge.type] || 0;
      if (!edgeBoost) continue;
      if (anchors.includes(edge.from) || anchors.includes(edge.to)) {
        boost += edgeBoost;
        sharedReasons.push(`edge:${edge.type}`);
      }
    }

    if (sharedReasons.length > 0) {
      boost += config.graph.explicitNonSeedBoost || 0;
      sharedReasons.push('explicit:non-seed-shared-anchor');
    }

    if (!boost) return item;

    const graphBoost = Math.min(maxBoost, boost);
    return {
      ...item,
      scores: {
        ...item.scores,
        graphBoost,
        final: Math.max(0, Math.min(1, item.scores.final + graphBoost))
      },
      explain: item.explain ? { ...item.explain, graphBoost, graphReasons: sharedReasons } : item.explain
    };
  }).sort((a, b) => b.scores.final - a.scores.final);
}

function scoreCandidate(candidate, query, queryVector, indexMap, config) {
  const candidateVector = indexMap.get(candidate.id)?.vector || embedText(candidate.content || candidate.summary || '', config.index.dim);
  const keyword = scoreKeyword(query, candidate);
  const semantic = scoreSemantic(queryVector, candidateVector);
  const recency = scoreRecency(candidate.timestamp, candidate.layer, candidate.importance);
  const importance = scoreImportance(candidate.importance, config);
  const layerPrior = scoreLayerPrior(candidate.layer, config);
  const intent = detectQueryIntent(query);
  const typeBoost = computeTypeBoost(candidate, intent);
  const mismatchPenalty = computeMismatchPenalty(candidate, intent, keyword, semantic);

  // Phase 2: 上下文感知 boost
  let contextBoost = 0;
  try {
    const { computeContextBoost } = require('./retrieval-context');
    contextBoost = computeContextBoost(candidate, query);
  } catch {}

  const baseFinal = fuseScores({ keyword, semantic, recency, importance, layerPrior, duplicatePenalty: 0 }, config);
  const final = Math.max(0, Math.min(1, baseFinal + typeBoost - mismatchPenalty + contextBoost));

  return {
    ...candidate,
    scores: { keyword, semantic, recency, importance, layerPrior, typeBoost, mismatchPenalty, contextBoost, final },
    explain: config.explain.enabled ? {
      matchedTerms: require('./vector-index-store').tokenize(query).filter(t => (candidate.content || '').toLowerCase().includes(t)),
      ageDays: candidate.timestamp ? (Date.now() - new Date(candidate.timestamp).getTime()) / 86400000 : null,
      importanceBucket: candidate.importance || 'normal',
      layerReason: `${candidate.layer} priority ${layerPrior}`,
      typeBoost,
      mismatchPenalty,
      contextBoost
    } : undefined
  };
}

function rerankWithGraphClusters(results, config, query) {
  if (!config.graph?.enabled) return results;

  const intent = detectQueryIntent(query);
  const seedCandidates = results.slice(0, config.graph.seedTopK || 3);
  const seedAnchors = new Set(seedCandidates.flatMap(candidateToGraphAnchors).filter(Boolean));

  return results.map((item, index) => {
    if (index < (config.graph.seedTopK || 3)) return item;

    const anchors = candidateToGraphAnchors(item);
    const shared = anchors.filter(a => seedAnchors.has(a));
    if (!shared.length) return item;

    let clusterBoost = 0;
    const clusterReasons = [];

    for (const anchor of shared) {
      const kind = classifyAnchor(anchor);
      let base = config.graph.sharedAnchorBoosts?.[kind] || 0;

      // Query-aware gating so graph boost doesn't over-promote loosely related items.
      if (kind === 'topic') {
        if (intent.preference && anchor !== 'topic:design-discussion') base *= 0.5;
        if (intent.memory && !['topic:memory', 'topic:system-status', 'topic:next-step', 'topic:masel'].includes(anchor)) base *= 0.6;
      }
      if (kind === 'type' && !(intent.project || intent.preference || intent.fact || intent.decision)) {
        base *= 0.5;
      }
      if (kind === 'date' && !(intent.memory || intent.decision)) {
        base *= 0.5;
      }

      if (base > 0) {
        clusterBoost += base;
        clusterReasons.push(anchor);
      }
    }

    // Suppress graph overreach when lexical/semantic support is weak.
    if ((item.scores.keyword || 0) < 0.08 && (item.scores.semantic || 0) < 0.58) {
      clusterBoost *= 0.65;
      clusterReasons.push('penalty:weak-query-match');
    }

    const applied = Math.min(config.graph.maxBoost || 0.14, clusterBoost + (clusterReasons.length ? (config.graph.explicitNonSeedBoost || 0) : 0));
    if (!applied) return item;

    return {
      ...item,
      scores: {
        ...item.scores,
        graphBoost: (item.scores.graphBoost || 0) + applied,
        final: Math.max(0, Math.min(1, item.scores.final + applied))
      },
      explain: item.explain ? {
        ...item.explain,
        graphBoost: (item.explain.graphBoost || 0) + applied,
        graphClusterReasons: clusterReasons
      } : item.explain
    };
  }).sort((a, b) => b.scores.final - a.scores.final);
}

async function retrieve(query, options = {}) {
  const config = deepMerge(defaultConfig, options.config || {});
  const candidates = collectCandidates(config);
  let index;
  try { index = loadIndex(config); } catch { index = { entries: [] }; }
  const indexMap = new Map((index.entries || []).map(e => [e.id, e]));
  const queryVector = embedText(query, config.index.dim);

  let scored = candidates.map(c => scoreCandidate(c, query, queryVector, indexMap, config));
  if (config.dedupe.enabled) scored = dedupeResults(scored, config.dedupe.similarityThreshold);
  scored.sort((a, b) => b.scores.final - a.scores.final);
  let top = applyLayerBalancing(scored, config);

  const graphExpansion = buildGraphExpansion(top, config);
  top = applyGraphBoost(top, graphExpansion, config);
  top = rerankWithGraphClusters(top, config, query);
  top = applyLayerBalancing(top, config);

  // Phase 2: 异步记录召回频率
  try {
    const { recordBatchRecalls } = require('./retrieval-context');
    setImmediate(() => recordBatchRecalls(top.map(r => r.id)));
  } catch {}

  return {
    query,
    totalCandidates: candidates.length,
    totalResults: top.length,
    configUsed: summarizeConfig(config),
    graphExpansion,
    results: top
  };
}

module.exports = {
  retrieve,
  scoreCandidate,
  summarizeConfig,
  deepMerge,
  applyLayerBalancing,
  detectQueryIntent,
  computeTypeBoost,
  computeMismatchPenalty,
  candidateToGraphAnchors,
  detectProjectsFromCandidate,
  detectTopicAnchors,
  rerankWithGraphClusters
};
