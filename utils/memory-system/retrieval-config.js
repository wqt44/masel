const path = require('path');

module.exports = {
  enabledLayers: ['l0', 'l1', 'l2', 'l3'],

  limits: {
    perLayerCandidateLimit: 40,
    finalTopK: 12,
    maxPerLayerInFinal: {
      l0: 3,
      l1: 3,
      l2: 6,
      l3: 2
    },
    lookbackDays: {
      l0: 30,
      l1: 90,
      l2: 3650,
      l3: 3650
    }
  },

  weights: {
    keyword: 0.40,
    semantic: 0.25,
    recency: 0.08,
    importance: 0.15,
    layerPrior: 0.12
  },

  layerPrior: {
    l0: 0.55,
    l1: 0.70,
    l2: 0.90,
    l3: 0.95
  },

  importanceWeight: {
    critical: 1.0,
    important: 0.8,
    high: 0.8,
    normal: 0.55,
    medium: 0.55,
    temporary: 0.35,
    low: 0.35,
    error_pattern: 0.95   // 错误模式权重，仅次于 critical
  },

  // v1.0.1: 错误模式专用加成
  errorPatternBoost: 0.18,  // error_pattern 类型在编码/执行任务中的额外加成

  dedupe: {
    enabled: true,
    similarityThreshold: 0.88,
    keepBestPerCluster: true
  },

  explain: {
    enabled: true,
    includeRawScores: true
  },

  index: {
    version: 1,
    embeddingModel: 'local-token-hash-v1',
    chunkVersion: 1,
    dim: 256,
    path: path.join(__dirname, '../../memory/.memory-index/vector-index.json')
  },

  graph: {
    enabled: true,
    seedTopK: 3,
    neighborLimit: 12,
    edgeTypeBoosts: {
      derived_from: 0.06,
      summarizes: 0.05,
      about_project: 0.04,
      about_topic: 0.05,
      on_date: 0.03,
      has_type: 0.03,
      references_memory: 0.05,
      appears_in_summary: 0.05,
      supports: 0.03
    },
    sharedAnchorBoosts: {
      projectTag: 0.08,
      date: 0.03,
      type: 0.02,
      topic: 0.06
    },
    explicitNonSeedBoost: 0.04,
    maxBoost: 0.14
  }
};
