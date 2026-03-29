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
