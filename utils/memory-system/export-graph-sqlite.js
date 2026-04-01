#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadGraph } = require('./graph-store');
const ultimateMemory = require('./ultimate-memory');

const DB_PATH = ultimateMemory.CONFIG.dbPath;
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function sqlite3Available() {
  try {
    execFileSync('sqlite3', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonQuote(obj) {
  if (obj === null || obj === undefined) return 'NULL';
  return shellQuote(JSON.stringify(obj));
}

function applySchema() {
  execFileSync('sqlite3', [DB_PATH, `.read ${SCHEMA_PATH}`], { shell: true, stdio: 'inherit' });
}

function buildSql(graph) {
  const lines = [];
  lines.push('BEGIN;');
  lines.push('DELETE FROM memory_provenance;');
  lines.push('DELETE FROM memory_edges;');
  lines.push('DELETE FROM memory_nodes;');

  for (const node of graph.nodes || []) {
    lines.push(
      `INSERT INTO memory_nodes (id, kind, ref_id, content, timestamp, source_path, metadata, created_at, updated_at) VALUES (` +
      `${shellQuote(node.id)}, ${shellQuote(node.kind)}, ${shellQuote(node.refId)}, ${shellQuote(node.content)}, ${shellQuote(node.timestamp)}, ${shellQuote(node.sourcePath)}, ${jsonQuote(node.metadata || {})}, ${shellQuote(node.updated_at)}, ${shellQuote(node.updated_at)});`
    );
  }

  for (const edge of graph.edges || []) {
    lines.push(
      `INSERT OR IGNORE INTO memory_edges (from_node, to_node, edge_type, weight, metadata, created_at, updated_at) VALUES (` +
      `${shellQuote(edge.from)}, ${shellQuote(edge.to)}, ${shellQuote(edge.type)}, 1.0, ${jsonQuote({})}, ${shellQuote(edge.updated_at)}, ${shellQuote(edge.updated_at)});`
    );

    if (edge.type === 'derived_from') {
      lines.push(
        `INSERT OR IGNORE INTO memory_provenance (target_node, source_node, provenance_type, confidence, metadata, created_at) VALUES (` +
        `${shellQuote(edge.from)}, ${shellQuote(edge.to)}, 'extracted_from', 1.0, ${jsonQuote({ edge_type: edge.type })}, ${shellQuote(edge.updated_at)});`
      );
    } else if (edge.type === 'summarizes') {
      lines.push(
        `INSERT OR IGNORE INTO memory_provenance (target_node, source_node, provenance_type, confidence, metadata, created_at) VALUES (` +
        `${shellQuote(edge.from)}, ${shellQuote(edge.to)}, 'summarized_from', 1.0, ${jsonQuote({ edge_type: edge.type })}, ${shellQuote(edge.updated_at)});`
      );
    }
  }

  lines.push('COMMIT;');
  return lines.join('\n');
}

function main() {
  if (!sqlite3Available()) {
    console.error('sqlite3 CLI not found');
    process.exit(1);
  }

  const graph = loadGraph();
  applySchema();

  const sql = buildSql(graph);
  const tmpPath = path.join('/tmp', `memory-graph-import-${Date.now()}.sql`);
  fs.writeFileSync(tmpPath, sql);
  execFileSync('sqlite3', [DB_PATH, `.read ${tmpPath}`], { shell: true, stdio: 'inherit' });

  console.log(JSON.stringify({
    dbPath: DB_PATH,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    imported: true
  }, null, 2));
}

main();
