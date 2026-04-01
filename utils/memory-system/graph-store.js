const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDB } = require('./db');
const ultimateMemory = require('./ultimate-memory');

const GRAPH_DIR = path.join(__dirname, '../../memory/graph');
const NODES_PATH = path.join(GRAPH_DIR, 'nodes.json');
const EDGES_PATH = path.join(GRAPH_DIR, 'edges.json');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const DB_PATH = ultimateMemory.CONFIG.dbPath;

function ensureGraphDir() {
  ensureDir(GRAPH_DIR);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureGraphDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function hasSqliteSupport() {
  try {
    return !!Database;
  } catch {
    return false;
  }
}

function getDb() {
  if (!hasSqliteSupport()) return null;
  const db = getDB();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  return db;
}

function loadGraphFromJson() {
  return {
    nodes: readJson(NODES_PATH, []),
    edges: readJson(EDGES_PATH, [])
  };
}

function loadGraphFromSqlite() {
  const db = getDb();
  if (!db) return null;
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_nodes'").get();
    if (!tableExists) return null;

    const nodes = db.prepare(`
      SELECT id, kind, ref_id as refId, content, timestamp, source_path as sourcePath, metadata, created_at, updated_at
      FROM memory_nodes
      ORDER BY updated_at DESC
    `).all().map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));

    const edges = db.prepare(`
      SELECT from_node as "from", to_node as "to", edge_type as type, weight, metadata, created_at, updated_at
      FROM memory_edges
      ORDER BY updated_at DESC
    `).all().map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    }));

    if (!nodes.length && !edges.length) return null;
    return { nodes, edges };
  } finally {
    // db shared, do not close
  }
}

function loadGraph() {
  return loadGraphFromSqlite() || loadGraphFromJson();
}

function saveGraphToJson(graph) {
  writeJson(NODES_PATH, graph.nodes || []);
  writeJson(EDGES_PATH, graph.edges || []);
}

function normalizeGraph(graph) {
  const nodes = [...(graph.nodes || [])];
  const edges = [];
  const nodeIds = new Set(nodes.map(n => n.id));

  for (const edge of graph.edges || []) {
    if (!nodeIds.has(edge.from)) {
      nodes.push({
        id: edge.from,
        kind: 'placeholder',
        refId: edge.from,
        content: '',
        timestamp: null,
        sourcePath: null,
        metadata: { placeholder: true },
        updated_at: edge.updated_at || new Date().toISOString()
      });
      nodeIds.add(edge.from);
    }

    if (!nodeIds.has(edge.to)) {
      nodes.push({
        id: edge.to,
        kind: 'placeholder',
        refId: edge.to,
        content: '',
        timestamp: null,
        sourcePath: null,
        metadata: { placeholder: true },
        updated_at: edge.updated_at || new Date().toISOString()
      });
      nodeIds.add(edge.to);
    }

    edges.push(edge);
  }

  return { nodes, edges };
}

function saveGraphToSqlite(graph) {
  const db = getDb();
  if (!db) return false;
  const normalized = normalizeGraph(graph);
  try {
    const insertNode = db.prepare(`
      INSERT INTO memory_nodes (id, kind, ref_id, content, timestamp, source_path, metadata, created_at, updated_at)
      VALUES (@id, @kind, @refId, @content, @timestamp, @sourcePath, @metadata, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        kind=excluded.kind,
        ref_id=excluded.ref_id,
        content=excluded.content,
        timestamp=excluded.timestamp,
        source_path=excluded.source_path,
        metadata=excluded.metadata,
        updated_at=excluded.updated_at
    `);

    const insertEdge = db.prepare(`
      INSERT INTO memory_edges (from_node, to_node, edge_type, weight, metadata, created_at, updated_at)
      VALUES (@from, @to, @type, @weight, @metadata, @created_at, @updated_at)
      ON CONFLICT(from_node, to_node, edge_type) DO UPDATE SET
        weight=excluded.weight,
        metadata=excluded.metadata,
        updated_at=excluded.updated_at
    `);

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM memory_provenance').run();
      db.prepare('DELETE FROM memory_edges').run();
      db.prepare('DELETE FROM memory_nodes').run();

      for (const node of normalized.nodes || []) {
        insertNode.run({
          ...node,
          metadata: JSON.stringify(node.metadata || {}),
          created_at: node.created_at || node.updated_at || new Date().toISOString(),
          updated_at: node.updated_at || new Date().toISOString()
        });
      }

      for (const edge of normalized.edges || []) {
        insertEdge.run({
          ...edge,
          weight: edge.weight || 1.0,
          metadata: JSON.stringify(edge.metadata || {}),
          created_at: edge.created_at || edge.updated_at || new Date().toISOString(),
          updated_at: edge.updated_at || new Date().toISOString()
        });

        if (edge.type === 'derived_from' || edge.type === 'summarizes') {
          db.prepare(`
            INSERT OR IGNORE INTO memory_provenance (target_node, source_node, provenance_type, confidence, metadata, created_at)
            VALUES (?, ?, ?, 1.0, ?, ?)
          `).run(
            edge.from,
            edge.to,
            edge.type === 'derived_from' ? 'extracted_from' : 'summarized_from',
            JSON.stringify({ edge_type: edge.type }),
            edge.updated_at || new Date().toISOString()
          );
        }
      }
    });

    tx();
    return true;
  } finally {
    // db shared, do not close
  }
}

function saveGraph(graph) {
  saveGraphToJson(graph);
  saveGraphToSqlite(graph);
}

function makeNodeId(kind, sourceId) {
  return `${kind}:${sourceId}`;
}

function hashText(text = '') {
  return crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 12);
}

function upsertNode(graph, node) {
  const idx = (graph.nodes || []).findIndex(n => n.id === node.id);
  if (idx >= 0) {
    graph.nodes[idx] = { ...graph.nodes[idx], ...node, updated_at: new Date().toISOString() };
    return graph.nodes[idx];
  }
  const created = { ...node, updated_at: new Date().toISOString() };
  graph.nodes.push(created);
  return created;
}

function edgeKey(edge) {
  return `${edge.from}::${edge.type}::${edge.to}`;
}

function upsertEdge(graph, edge) {
  const idx = (graph.edges || []).findIndex(e => edgeKey(e) === edgeKey(edge));
  if (idx >= 0) {
    graph.edges[idx] = { ...graph.edges[idx], ...edge, updated_at: new Date().toISOString() };
    return graph.edges[idx];
  }
  const created = { ...edge, updated_at: new Date().toISOString() };
  graph.edges.push(created);
  return created;
}

function findNeighbors(graph, nodeIds = [], options = {}) {
  const {
    edgeTypes = null,
    direction = 'both',
    limit = 20
  } = options;

  const nodeSet = new Set(nodeIds);
  const neighbors = [];

  for (const edge of graph.edges || []) {
    const typeOk = !edgeTypes || edgeTypes.includes(edge.type);
    if (!typeOk) continue;

    const fromHit = nodeSet.has(edge.from);
    const toHit = nodeSet.has(edge.to);

    if (direction === 'out' && fromHit) neighbors.push(edge);
    else if (direction === 'in' && toHit) neighbors.push(edge);
    else if (direction === 'both' && (fromHit || toHit)) neighbors.push(edge);

    if (neighbors.length >= limit) break;
  }

  return neighbors;
}

module.exports = {
  GRAPH_DIR,
  NODES_PATH,
  EDGES_PATH,
  DB_PATH,
  hasSqliteSupport,
  getDb,
  loadGraphFromJson,
  loadGraphFromSqlite,
  loadGraph,
  saveGraphToJson,
  saveGraphToSqlite,
  saveGraph,
  normalizeGraph,
  upsertNode,
  upsertEdge,
  makeNodeId,
  hashText,
  findNeighbors
};
