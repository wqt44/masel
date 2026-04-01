#!/usr/bin/env node
const { loadGraphFromJson, saveGraphToSqlite, loadGraphFromSqlite, DB_PATH } = require('./graph-store');

function main() {
  const graph = loadGraphFromJson();
  const ok = saveGraphToSqlite(graph);
  if (!ok) {
    console.error('SQLite import failed: sqlite support unavailable');
    process.exit(1);
  }

  const loaded = loadGraphFromSqlite() || { nodes: [], edges: [] };
  console.log(JSON.stringify({
    dbPath: DB_PATH,
    importedNodes: graph.nodes.length,
    importedEdges: graph.edges.length,
    sqliteNodes: loaded.nodes.length,
    sqliteEdges: loaded.edges.length
  }, null, 2));
}

main();
