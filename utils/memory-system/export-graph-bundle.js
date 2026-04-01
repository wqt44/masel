#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadGraph } = require('./graph-store');

const OUT = path.join(__dirname, '../../memory/graph/sqlite-export-bundle.json');

function main() {
  const graph = loadGraph();
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'graph-schema.json'), 'utf-8'));

  const provenance = [];
  for (const edge of graph.edges || []) {
    if (edge.type === 'derived_from') {
      provenance.push({
        target_node: edge.from,
        source_node: edge.to,
        provenance_type: 'extracted_from',
        confidence: 1.0,
        metadata: { edge_type: edge.type },
        created_at: edge.updated_at
      });
    } else if (edge.type === 'summarizes') {
      provenance.push({
        target_node: edge.from,
        source_node: edge.to,
        provenance_type: 'summarized_from',
        confidence: 1.0,
        metadata: { edge_type: edge.type },
        created_at: edge.updated_at
      });
    }
  }

  const bundle = {
    generated_at: new Date().toISOString(),
    target_db: path.join(__dirname, 'memory.db'),
    schema,
    rows: {
      memory_nodes: graph.nodes || [],
      memory_edges: graph.edges || [],
      memory_provenance: provenance
    },
    counts: {
      nodes: (graph.nodes || []).length,
      edges: (graph.edges || []).length,
      provenance: provenance.length
    }
  };

  ensureDir(path.dirname(OUT));
  fs.writeFileSync(OUT, JSON.stringify(bundle, null, 2));
  console.log(JSON.stringify({ out: OUT, counts: bundle.counts }, null, 2));
}

main();
