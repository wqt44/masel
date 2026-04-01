#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadGraph, saveGraph, upsertNode, upsertEdge, makeNodeId, hashText } = require('./graph-store');

const ROOT = path.join(__dirname, '../../memory');
const RAW_DIR = path.join(ROOT, 'raw-conversations');
const SUMMARY_DIR = path.join(ROOT, 'daily-summaries');
const STRUCTURED_DIR = path.join(ROOT, 'structured');

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

function safeJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

function detectProjects(text = '') {
  const matches = [...String(text).matchAll(/([A-Za-z0-9_-]{2,})\s*(?:项目|project)/gi)];
  return Array.from(new Set(matches.map(m => m[1])));
}

function normalizeText(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

function textContainsAny(text = '', needles = []) {
  const hay = normalizeText(text).toLowerCase();
  return needles.some(n => hay.includes(String(n).toLowerCase()));
}

function detectTopicAnchors(text = '') {
  const lower = normalizeText(text).toLowerCase();
  const topics = [];
  if (/系统状态|system status/.test(lower)) topics.push('topic:system-status');
  if (/记忆系统|记忆回顾|memory/.test(lower)) topics.push('topic:memory');
  if (/下一步|next step/.test(lower)) topics.push('topic:next-step');
  if (/进化行动|evolution/.test(lower)) topics.push('topic:evolution');
  if (/masel/.test(lower)) topics.push('topic:masel');
  if (/设计讨论|设计方案|详细设计/.test(lower)) topics.push('topic:design-discussion');
  return Array.from(new Set(topics));
}

function extractRawUserText(rec) {
  return rec.user_message || rec.data?.userMessage || rec.message || '';
}

function extractRawAiText(rec) {
  return rec.ai_response || rec.data?.aiResponse || rec.response || '';
}

function main() {
  const graph = { nodes: [], edges: [] };
  const rawSourceToId = new Map();

  const rawFiles = listFilesRecursive(RAW_DIR, f => f.endsWith('.jsonl'));
  for (const file of rawFiles) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const rec = JSON.parse(line);
        const rawId = rec.id || hashText(line);
        const userText = extractRawUserText(rec);
        const aiText = extractRawAiText(rec);
        upsertNode(graph, {
          id: makeNodeId('raw', rawId),
          kind: 'raw',
          refId: rawId,
          content: `${userText}\n${aiText}`.trim(),
          timestamp: rec.timestamp,
          sourcePath: file,
          metadata: { session_id: rec.session_id }
        });

        if (userText) rawSourceToId.set(userText, rawId);
        if (rec.id) rawSourceToId.set(rec.id, rawId);

        const dateNodeId = `date:${String(rec.timestamp || '').slice(0, 10)}`;
        if (String(rec.timestamp || '').slice(0, 10)) {
          upsertNode(graph, {
            id: dateNodeId,
            kind: 'date-tag',
            refId: String(rec.timestamp || '').slice(0, 10),
            content: String(rec.timestamp || '').slice(0, 10),
            timestamp: rec.timestamp,
            sourcePath: file,
            metadata: {}
          });
          upsertEdge(graph, { from: makeNodeId('raw', rawId), to: dateNodeId, type: 'on_date' });
        }

        for (const topic of detectTopicAnchors(`${userText} ${aiText}`)) {
          upsertNode(graph, {
            id: topic,
            kind: 'topic-tag',
            refId: topic.replace('topic:', ''),
            content: topic,
            timestamp: rec.timestamp,
            sourcePath: file,
            metadata: {}
          });
          upsertEdge(graph, { from: makeNodeId('raw', rawId), to: topic, type: 'about_topic' });
        }
      } catch {}
    }
  }

  const summaryRefs = [];
  const memoryRefs = [];

  const summaryFiles = listFilesRecursive(SUMMARY_DIR, f => f.endsWith('.json'));
  for (const file of summaryFiles) {
    const rec = safeJson(file);
    if (!rec) continue;
    const summaryId = rec.id || `summary-${rec.date}`;
    const summaryNodeId = makeNodeId('summary', summaryId);
    upsertNode(graph, {
      id: summaryNodeId,
      kind: 'summary',
      refId: summaryId,
      content: rec.summary || '',
      timestamp: rec.created_at || rec.date,
      sourcePath: file,
      metadata: { date: rec.date, projects_mentioned: rec.projects_mentioned || [] }
    });

    summaryRefs.push({
      id: summaryNodeId,
      date: rec.date,
      content: rec.summary || '',
      projects: rec.projects_mentioned || [],
      preferences: rec.preferences_mentioned || []
    });

    if (rec.date) {
      const dateNodeId = `date:${rec.date}`;
      upsertNode(graph, {
        id: dateNodeId,
        kind: 'date-tag',
        refId: rec.date,
        content: rec.date,
        timestamp: rec.created_at || rec.date,
        sourcePath: file,
        metadata: {}
      });
      upsertEdge(graph, { from: summaryNodeId, to: dateNodeId, type: 'on_date' });
    }

    for (const topic of detectTopicAnchors(rec.summary || '')) {
      upsertNode(graph, {
        id: topic,
        kind: 'topic-tag',
        refId: topic.replace('topic:', ''),
        content: topic,
        timestamp: rec.created_at || rec.date,
        sourcePath: file,
        metadata: {}
      });
      upsertEdge(graph, { from: summaryNodeId, to: topic, type: 'about_topic' });
    }

    for (const project of rec.projects_mentioned || []) {
      const projectNodeId = makeNodeId('project-tag', project);
      upsertNode(graph, {
        id: projectNodeId,
        kind: 'project-tag',
        refId: project,
        content: project,
        timestamp: rec.created_at || rec.date,
        sourcePath: file,
        metadata: {}
      });
      upsertEdge(graph, { from: summaryNodeId, to: projectNodeId, type: 'about_project' });
    }
  }

  const structuredFiles = listFilesRecursive(STRUCTURED_DIR, f => f.endsWith('.json'));
  for (const file of structuredFiles) {
    const rec = safeJson(file);
    if (!rec || !rec.id) continue;
    const kind = rec.type || path.basename(path.dirname(file));
    const memNodeId = makeNodeId('memory', rec.id);
    upsertNode(graph, {
      id: memNodeId,
      kind: 'memory',
      refId: rec.id,
      content: rec.content || '',
      timestamp: rec.updated_at || rec.created_at,
      sourcePath: file,
      metadata: { type: kind, source: rec.source, importance: rec.importance }
    });

    memoryRefs.push({
      id: memNodeId,
      type: kind,
      content: rec.content || '',
      source: rec.source || '',
      timestamp: rec.updated_at || rec.created_at,
      projects: detectProjects(rec.content || '')
    });

    const typeNodeId = `type:${kind}`;
    upsertNode(graph, {
      id: typeNodeId,
      kind: 'type-tag',
      refId: kind,
      content: kind,
      timestamp: rec.updated_at || rec.created_at,
      sourcePath: file,
      metadata: {}
    });
    upsertEdge(graph, { from: memNodeId, to: typeNodeId, type: 'has_type' });

    for (const topic of detectTopicAnchors(rec.content || '')) {
      upsertNode(graph, {
        id: topic,
        kind: 'topic-tag',
        refId: topic.replace('topic:', ''),
        content: topic,
        timestamp: rec.updated_at || rec.created_at,
        sourcePath: file,
        metadata: {}
      });
      upsertEdge(graph, { from: memNodeId, to: topic, type: 'about_topic' });
    }

    if (rec.source) {
      const resolvedRawId = rawSourceToId.get(rec.source) || rec.source;
      const rawNodeId = makeNodeId('raw', resolvedRawId);
      upsertEdge(graph, { from: memNodeId, to: rawNodeId, type: 'derived_from' });
    }

    for (const project of detectProjects(rec.content || '')) {
      const projectNodeId = makeNodeId('project-tag', project);
      upsertNode(graph, {
        id: projectNodeId,
        kind: 'project-tag',
        refId: project,
        content: project,
        timestamp: rec.updated_at || rec.created_at,
        sourcePath: file,
        metadata: {}
      });
      upsertEdge(graph, { from: memNodeId, to: projectNodeId, type: 'about_project' });
    }
  }

  // Connect summaries to raw conversations by same date as a lightweight provenance bridge.
  const rawNodes = graph.nodes.filter(n => n.kind === 'raw');
  const summaryNodes = graph.nodes.filter(n => n.kind === 'summary');
  for (const summary of summaryNodes) {
    const date = String(summary.metadata?.date || '').slice(0, 10);
    if (!date) continue;
    for (const raw of rawNodes) {
      const rawDate = String(raw.timestamp || '').slice(0, 10);
      if (rawDate === date) {
        upsertEdge(graph, { from: summary.id, to: raw.id, type: 'summarizes' });
      }
    }
  }

  // Increase graph density: raw/project-tag, summary/memory, and memory/summary links.
  for (const raw of rawNodes) {
    const rawProjects = detectProjects(raw.content || '');
    for (const project of rawProjects) {
      const projectNodeId = makeNodeId('project-tag', project);
      upsertNode(graph, {
        id: projectNodeId,
        kind: 'project-tag',
        refId: project,
        content: project,
        timestamp: raw.timestamp,
        sourcePath: raw.sourcePath,
        metadata: {}
      });
      upsertEdge(graph, { from: raw.id, to: projectNodeId, type: 'about_project' });
    }
  }

  for (const summary of summaryRefs) {
    for (const memory of memoryRefs) {
      const sameDay = String(memory.timestamp || '').slice(0, 10) === String(summary.date || '').slice(0, 10);
      const projectOverlap = memory.projects.some(p => summary.projects.includes(p));
      const preferenceOverlap = memory.type === 'preference' && textContainsAny(summary.content, [memory.content, '喜欢', '偏好', '设计']);

      if (projectOverlap || preferenceOverlap || sameDay) {
        upsertEdge(graph, { from: summary.id, to: memory.id, type: 'references_memory' });
        upsertEdge(graph, { from: memory.id, to: summary.id, type: 'appears_in_summary' });
      }
    }
  }

  saveGraph(graph);
  console.log(JSON.stringify({
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    graphDir: path.join(ROOT, 'graph')
  }, null, 2));
}

main();
