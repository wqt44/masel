-- SQLite schema for L0 raw conversation storage
-- 无损存储所有对话，支持高效检索

-- 对话会话表
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    metadata JSON,  -- 渠道、模型、token数等
    embedding BLOB  -- 语义向量，用于相似度搜索
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);

-- 每日摘要表 (L1)
CREATE TABLE IF NOT EXISTS daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    summary TEXT NOT NULL,
    key_decisions JSON,  -- 关键决策列表
    projects_mentioned JSON,  -- 提到的项目
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 结构化记忆表 (L2)
CREATE TABLE IF NOT EXISTS structured_memories (
    id TEXT PRIMARY KEY,  -- mem-{timestamp}-{hash}
    type TEXT NOT NULL,  -- project, preference, fact, task
    content TEXT NOT NULL,
    source TEXT,  -- 来源对话ID
    confidence REAL DEFAULT 1.0,  -- 置信度 0-1
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,  -- 过期时间
    is_active BOOLEAN DEFAULT 1,
    version INTEGER DEFAULT 1,
    replaces_id TEXT,  -- 替换的旧记忆ID
    FOREIGN KEY (replaces_id) REFERENCES structured_memories(id)
);

CREATE INDEX IF NOT EXISTS idx_memories_type ON structured_memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_active ON structured_memories(is_active);
CREATE INDEX IF NOT EXISTS idx_memories_created ON structured_memories(created_at);

-- 冲突检测表
CREATE TABLE IF NOT EXISTS memory_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id_1 TEXT NOT NULL,
    memory_id_2 TEXT NOT NULL,
    conflict_type TEXT,  -- contradiction, duplicate, outdated
    similarity_score REAL,  -- 相似度 0-1
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT 0,
    resolution TEXT,  -- user_choice, auto_merge, auto_discard
    FOREIGN KEY (memory_id_1) REFERENCES structured_memories(id),
    FOREIGN KEY (memory_id_2) REFERENCES structured_memories(id)
);

-- 存储统计表
CREATE TABLE IF NOT EXISTS storage_stats (
    date DATE PRIMARY KEY,
    raw_conversations_count INTEGER,
    raw_storage_bytes INTEGER,
    summaries_count INTEGER,
    structured_memories_count INTEGER,
    cleaned_count INTEGER  -- 当日清理的数量
);

-- DAG / provenance 节点表
CREATE TABLE IF NOT EXISTS memory_nodes (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,              -- raw, summary, memory, project-tag, decision, pattern
    ref_id TEXT,                     -- 对应原始对象ID（conversation id / summary id / memory id）
    content TEXT,
    timestamp DATETIME,
    source_path TEXT,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_nodes_kind ON memory_nodes(kind);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_ref_id ON memory_nodes(ref_id);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_timestamp ON memory_nodes(timestamp);

-- DAG / provenance 边表
CREATE TABLE IF NOT EXISTS memory_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_node TEXT NOT NULL,
    to_node TEXT NOT NULL,
    edge_type TEXT NOT NULL,         -- derived_from, summarizes, about_project, supports, contradicts, supersedes
    weight REAL DEFAULT 1.0,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_node, to_node, edge_type),
    FOREIGN KEY (from_node) REFERENCES memory_nodes(id),
    FOREIGN KEY (to_node) REFERENCES memory_nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_edges_from ON memory_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_memory_edges_to ON memory_edges(to_node);
CREATE INDEX IF NOT EXISTS idx_memory_edges_type ON memory_edges(edge_type);

-- 记忆溯源表（面向摘要/L2 记忆的显式来源追踪）
CREATE TABLE IF NOT EXISTS memory_provenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_node TEXT NOT NULL,
    source_node TEXT NOT NULL,
    provenance_type TEXT NOT NULL,   -- extracted_from, summarized_from, inferred_from
    confidence REAL DEFAULT 1.0,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(target_node, source_node, provenance_type),
    FOREIGN KEY (target_node) REFERENCES memory_nodes(id),
    FOREIGN KEY (source_node) REFERENCES memory_nodes(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_provenance_target ON memory_provenance(target_node);
CREATE INDEX IF NOT EXISTS idx_memory_provenance_source ON memory_provenance(source_node);

-- L3 模式层表 (Phase 1 新增)
CREATE TABLE IF NOT EXISTS patterns (
    id TEXT PRIMARY KEY,           -- pat-{timestamp}-{hash}
    pattern_type TEXT NOT NULL,    -- behavioral | decision | communication | cyclical
    category TEXT,                 -- 子分类 (如 work_habits, tech_preference, social_style, time_rhythm)
    content TEXT NOT NULL,         -- 模式描述
    evidence JSON,                 -- 支撑证据 [{ source, text, timestamp }]
    confidence REAL DEFAULT 0.5,   -- 置信度 0-1，随观察次数增长
    frequency INTEGER DEFAULT 1,   -- 观察到该模式的次数
    first_seen DATETIME,           -- 首次观察到
    last_seen DATETIME,            -- 最近一次观察到
    is_active BOOLEAN DEFAULT 1,
    supersedes_id TEXT,            -- 替代的旧模式ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata JSON
);

CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_category ON patterns(category);
CREATE INDEX IF NOT EXISTS idx_patterns_active ON patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON patterns(confidence);

-- 去重合并记录表 (Phase 1 新增)
CREATE TABLE IF NOT EXISTS memory_merges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survivor_id TEXT NOT NULL,       -- 保留的记忆ID
    absorbed_id TEXT NOT NULL,       -- 被合并的记忆ID
    similarity_score REAL,           -- 合并时的相似度
    merge_strategy TEXT,             -- keep_newer | merge_content | keep_higher_confidence
    merged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata JSON
);

CREATE INDEX IF NOT EXISTS idx_merges_survivor ON memory_merges(survivor_id);
CREATE INDEX IF NOT EXISTS idx_merges_absorbed ON memory_merges(absorbed_id);
