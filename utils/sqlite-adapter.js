/**
 * SQLite Adapter for MASEL Memory System v1.8.0
 * 
 * 整合到 OpenClaw 的 main.sqlite，统一管理 L2/L3 长期记忆。
 * 表名加前缀 masel_ 避免冲突，不碰原有表。
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DB_PATH = path.join(os.homedir(), '.openclaw', 'memory', 'main.sqlite');

class MaselSQLiteAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath || DB_PATH;
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._initSchema();
  }

  // ========== Schema ==========

  _initSchema() {
    this.db.exec(`
      -- L2 结构化记忆
      CREATE TABLE IF NOT EXISTS masel_memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,           -- preference/fact/decision/lesson/project/ability
        tier TEXT NOT NULL DEFAULT 'important',  -- critical/important/temporary
        key TEXT NOT NULL,                -- likes, skills, goals, etc.
        value TEXT NOT NULL,
        type TEXT,                        -- preference/identity/ability/future/value/...
        weight REAL NOT NULL DEFAULT 0.5,
        context TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',           -- JSON array
        source TEXT DEFAULT '',           -- 来源日期或描述
        source_path TEXT DEFAULT '',      -- 关联文件路径
        created_at INTEGER NOT NULL,
        last_accessed INTEGER,
        access_count INTEGER DEFAULT 0,
        decay_score REAL DEFAULT 1.0
      );

      -- L3 行为模式
      CREATE TABLE IF NOT EXISTS masel_patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL,       -- workflow/preference/habit/insight/emotion/decision
        description TEXT NOT NULL,
        data TEXT DEFAULT '{}',           -- JSON 详细数据
        evidence TEXT DEFAULT '[]',       -- JSON 支撑证据
        confidence REAL DEFAULT 0.5,
        created_at INTEGER NOT NULL,
        last_seen INTEGER,
        occurrence_count INTEGER DEFAULT 1
      );

      -- 记忆关联
      CREATE TABLE IF NOT EXISTS masel_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT NOT NULL,           -- related/derived-from/supercedes/supported-by
        strength REAL DEFAULT 1.0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (from_id) REFERENCES masel_memories(id) ON DELETE CASCADE,
        FOREIGN KEY (to_id) REFERENCES masel_memories(id) ON DELETE CASCADE,
        UNIQUE(from_id, to_id, relation)
      );

      -- 衰减审计日志
      CREATE TABLE IF NOT EXISTS masel_decay_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,             -- preserved/pruned/boosted/created
        memory_id TEXT,
        old_tier TEXT,
        new_tier TEXT,
        old_decay REAL,
        new_decay REAL,
        reason TEXT DEFAULT '',
        timestamp INTEGER NOT NULL
      );

      -- 索引
      CREATE INDEX IF NOT EXISTS idx_masel_mem_category ON masel_memories(category);
      CREATE INDEX IF NOT EXISTS idx_masel_mem_tier ON masel_memories(tier);
      CREATE INDEX IF NOT EXISTS idx_masel_mem_key ON masel_memories(key);
      CREATE INDEX IF NOT EXISTS idx_masel_mem_decay ON masel_memories(decay_score);
      CREATE INDEX IF NOT EXISTS idx_masel_mem_created ON masel_memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_masel_pat_type ON masel_patterns(pattern_type);
      CREATE INDEX IF NOT EXISTS idx_masel_link_from ON masel_links(from_id);
      CREATE INDEX IF NOT EXISTS idx_masel_link_to ON masel_links(to_id);

      -- FTS5 全文搜索（记忆内容）
      CREATE VIRTUAL TABLE IF NOT EXISTS masel_memories_fts USING fts5(
        value, context, tags,
        content='masel_memories',
        content_rowid='rowid'
      );

      -- FTS 同步触发器
      CREATE TRIGGER IF NOT EXISTS masel_mem_ai AFTER INSERT ON masel_memories BEGIN
        INSERT INTO masel_memories_fts(rowid, value, context, tags)
        VALUES (new.rowid, new.value, new.context, new.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS masel_mem_ad AFTER DELETE ON masel_memories BEGIN
        INSERT INTO masel_memories_fts(masel_memories_fts, rowid, value, context, tags)
        VALUES ('delete', old.rowid, old.value, old.context, old.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS masel_mem_au AFTER UPDATE ON masel_memories BEGIN
        INSERT INTO masel_memories_fts(masel_memories_fts, rowid, value, context, tags)
        VALUES ('delete', old.rowid, old.value, old.context, old.tags);
        INSERT INTO masel_memories_fts(rowid, value, context, tags)
        VALUES (new.rowid, new.value, new.context, new.tags);
      END;
    `);
  }

  // ========== 记忆 CRUD ==========

  _genId() {
    return `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  store({ category, tier = 'important', key, value, type = 'fact', weight = 0.5, context = '', tags = [], source = '', sourcePath = '' }) {
    const id = this._genId();
    const now = Date.now();
    const tagsJson = JSON.stringify(tags);

    this.db.prepare(`
      INSERT OR REPLACE INTO masel_memories
        (id, category, tier, key, value, type, weight, context, tags, source, source_path, created_at, last_accessed, access_count, decay_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1.0)
    `).run(id, category, tier, key, value, type, weight, context, tagsJson, source, sourcePath, now, now);

    this._logDecay('created', id, null, tier, null, 1.0, 'new memory');
    return id;
  }

  get(id) {
    const row = this.db.prepare('SELECT * FROM masel_memories WHERE id = ?').get(id);
    if (row) {
      this._touch(id);
      row.tags = JSON.parse(row.tags || '[]');
    }
    return row;
  }

  update(id, changes) {
    const fields = [];
    const values = [];
    for (const [k, v] of Object.entries(changes)) {
      if (k === 'tags') {
        fields.push('tags = ?');
        values.push(JSON.stringify(v));
      } else if (k === 'id') {
        continue; // 不允许改 id
      } else {
        fields.push(`${k} = ?`);
        values.push(v);
      }
    }
    if (fields.length === 0) return false;
    values.push(id);
    const result = this.db.prepare(`UPDATE masel_memories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return result.changes > 0;
  }

  delete(id) {
    return this.db.prepare('DELETE FROM masel_memories WHERE id = ?').run(id).changes > 0;
  }

  // ========== 查询 ==========

  recall(query, { category, tier, key, limit = 10, minDecay = 0, offset = 0 } = {}) {
    let sql = 'SELECT * FROM masel_memories WHERE 1=1';
    const params = [];

    if (query) {
      sql += ' AND (value LIKE ? OR context LIKE ? OR tags LIKE ?)';
      const pattern = `%${query}%`;
      params.push(pattern, pattern, pattern);
    }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (tier) { sql += ' AND tier = ?'; params.push(tier); }
    if (key) { sql += ' AND key = ?'; params.push(key); }
    if (minDecay > 0) { sql += ' AND decay_score >= ?'; params.push(minDecay); }

    sql += ' ORDER BY decay_score DESC, weight DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(r => { r.tags = JSON.parse(r.tags || '[]'); return r; });
  }

  /**
   * FTS 全文搜索（trigram，中文 ≥3 字符精确匹配）
   * 短查询自动 fallback 到 LIKE
   */
  search(text, { limit = 10 } = {}) {
    // 统计 Unicode 字符数（非 ASCII 按1字符算）
    const charLen = [...text].length;
    if (charLen < 3) {
      return this.recall(text, { limit });
    }
    try {
      const rows = this.db.prepare(`
        SELECT m.* FROM masel_memories_fts f
        JOIN masel_memories m ON m.rowid = f.rowid
        WHERE masel_memories_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(text, limit);
      return rows.map(r => { r.tags = JSON.parse(r.tags || '[]'); return r; });
    } catch (e) {
      return this.recall(text, { limit });
    }
  }

  /**
   * 按 key 查询（兼容旧 smart-memory 接口）
   */
  getByKey(key) {
    return this.db.prepare('SELECT * FROM masel_memories WHERE key = ? ORDER BY weight DESC')
      .all(key)
      .map(r => { r.tags = JSON.parse(r.tags || '[]'); return r; });
  }

  /**
   * 获取用户画像（兼容旧接口）
   */
  getProfile() {
    const stats = this.db.prepare(`
      SELECT category, COUNT(*) as count, AVG(weight) as avg_weight
      FROM masel_memories
      GROUP BY category
      ORDER BY count DESC
    `).all();

    const total = stats.reduce((s, r) => s + r.count, 0);

    const topPreferences = this.db.prepare(`
      SELECT * FROM masel_memories ORDER BY weight DESC, decay_score DESC LIMIT 5
    `).all().map(r => { r.tags = JSON.parse(r.tags || '[]'); return r; });

    return { totalMemories: total, categories: stats, topPreferences };
  }

  // ========== 模式 CRUD ==========

  storePattern({ patternType, description, data = {}, evidence = [], confidence = 0.5 }) {
    const id = `pat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    // 检查是否已有类似模式 → 更新而非重复插入
    const existing = this.db.prepare(
      'SELECT * FROM masel_patterns WHERE pattern_type = ? AND description = ?'
    ).get(patternType, description);

    if (existing) {
      this.db.prepare(`
        UPDATE masel_patterns SET
          occurrence_count = occurrence_count + 1,
          last_seen = ?,
          confidence = MIN(1.0, confidence + 0.05),
          data = ?
        WHERE id = ?
      `).run(now, JSON.stringify(data), existing.id);
      return existing.id;
    }

    this.db.prepare(`
      INSERT INTO masel_patterns (id, pattern_type, description, data, evidence, confidence, created_at, last_seen, occurrence_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, patternType, description, JSON.stringify(data), JSON.stringify(evidence), confidence, now, now);

    return id;
  }

  getPatterns({ patternType, minConfidence = 0, limit = 20 } = {}) {
    let sql = 'SELECT * FROM masel_patterns WHERE confidence >= ?';
    const params = [minConfidence];
    if (patternType) { sql += ' AND pattern_type = ?'; params.push(patternType); }
    sql += ' ORDER BY confidence DESC, last_seen DESC LIMIT ?';
    params.push(limit);
    const rows = this.db.prepare(sql).all(...params);
    return rows.map(r => {
      r.data = JSON.parse(r.data || '{}');
      r.evidence = JSON.parse(r.evidence || '[]');
      return r;
    });
  }

  // ========== 关联 ==========

  link(fromId, toId, relation = 'related', strength = 1.0) {
    const now = Date.now();
    this.db.prepare(`
      INSERT OR REPLACE INTO masel_links (from_id, to_id, relation, strength, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(fromId, toId, relation, strength, now);
  }

  getRelated(id, { relation, limit = 10 } = {}) {
    let sql = `SELECT m.*, l.relation, l.strength as link_strength
      FROM masel_links l
      JOIN masel_memories m ON m.id = CASE WHEN l.from_id = ? THEN l.to_id ELSE l.from_id END
      WHERE (l.from_id = ? OR l.to_id = ?)`;
    const params = [id, id, id];
    if (relation) { sql += ' AND l.relation = ?'; params.push(relation); }
    sql += ' ORDER BY l.strength DESC LIMIT ?';
    params.push(limit);
    return this.db.prepare(sql).all(...params).map(r => {
      r.tags = JSON.parse(r.tags || '[]');
      return r;
    });
  }

  // ========== 衰减引擎 ==========

  /**
   * 执行时间衰减计算
   * critical: 永不衰减 (score = 1.0)
   * important: ~90天半衰
   * temporary: ~7天半衰
   */
  runDecay() {
    const now = Date.now();
    const DAY_MS = 86400000;

    const updated = this.db.prepare(`
      UPDATE masel_memories SET
        decay_score = CASE tier
          WHEN 'critical' THEN 1.0
          WHEN 'important' THEN MIN(1.0, MAX(0.05, EXP(-0.008 * ((? - last_accessed) / ?))))
          WHEN 'temporary' THEN MIN(1.0, MAX(0.05, EXP(-0.1 * ((? - last_accessed) / ?))))
        END
      WHERE tier != 'critical'
    `).run(now, DAY_MS, now, DAY_MS);

    return updated.changes;
  }

  /**
   * 清理过期记忆
   */
  prune({ dryRun = false, tier = 'temporary', minDecay = 0.05 } = {}) {
    if (dryRun) {
      return this.db.prepare(
        'SELECT * FROM masel_memories WHERE tier = ? AND decay_score < ?'
      ).all(tier, minDecay);
    }

    const toPrune = this.db.prepare(
      'SELECT id, tier, decay_score FROM masel_memories WHERE tier = ? AND decay_score < ?'
    ).all(tier, minDecay);

    const now = Date.now();
    const insertLog = this.db.prepare(`
      INSERT INTO masel_decay_log (action, memory_id, old_tier, new_tier, old_decay, new_decay, reason, timestamp)
      VALUES ('pruned', ?, ?, 'deleted', ?, 0, 'decay below threshold', ?)
    `);

    const deleteMem = this.db.prepare('DELETE FROM masel_memories WHERE id = ?');

    const pruneAll = this.db.transaction(() => {
      for (const mem of toPrune) {
        insertLog.run(mem.id, mem.tier, mem.decay_score, now);
        deleteMem.run(mem.id);
      }
    });

    pruneAll();
    return toPrune.length;
  }

  /**
   * 访问时提升衰减分数
   */
  _touch(id) {
    const now = Date.now();
    this.db.prepare(`
      UPDATE masel_memories SET
        last_accessed = ?,
        access_count = access_count + 1,
        decay_score = MIN(1.0, decay_score + 0.1)
      WHERE id = ?
    `).run(now, id);
  }

  /**
   * 手动提升记忆重要性
   */
  boost(id, { newTier, reason = 'manual boost' } = {}) {
    const mem = this.get(id);
    if (!mem) return false;

    const now = Date.now();
    const oldTier = mem.tier;
    const oldDecay = mem.decay_score;

    if (newTier) {
      this.db.prepare('UPDATE masel_memories SET tier = ?, decay_score = 1.0, last_accessed = ? WHERE id = ?')
        .run(newTier, now, id);
    } else {
      this.db.prepare('UPDATE masel_memories SET decay_score = MIN(1.0, decay_score + 0.3), last_accessed = ? WHERE id = ?')
        .run(now, id);
    }

    this._logDecay('boosted', id, oldTier, newTier || oldTier, oldDecay, 1.0, reason);
    return true;
  }

  // ========== 迁移工具 ==========

  /**
   * 从 smart-memory JSON 导入
   */
  migrateFromSmartJSON(userId) {
    const smartPath = path.join(os.homedir(), '.openclaw', 'memory', 'smart', 'users', userId, 'memories.json');
    if (!fs.existsSync(smartPath)) return { migrated: 0, skipped: 0 };

    const data = JSON.parse(fs.readFileSync(smartPath, 'utf8'));
    let migrated = 0, skipped = 0;

    // 先跑一遍，收集已有 value 去重
    const existingValues = new Set(
      this.db.prepare('SELECT value FROM masel_memories').all().map(r => r.value)
    );

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO masel_memories
        (id, category, tier, key, value, type, weight, context, tags, source, created_at, last_accessed, decay_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, 1.0)
    `);

    const tx = this.db.transaction(() => {
      for (const [key, items] of Object.entries(data)) {
        for (const item of items) {
          if (existingValues.has(item.value)) { skipped++; continue; }

          // 从 type 推断 category
          const category = this._inferCategory(item.type || key);
          const tier = item.weight >= 0.9 ? 'critical' : item.weight >= 0.7 ? 'important' : 'temporary';
          const ts = item.timestamp ? new Date(item.timestamp).getTime() : Date.now();

          const id = this._genId();
          insert.run(id, category, tier, key, item.value, item.type || 'fact', item.weight || 0.5, item.context || '', item.timestamp || '', ts, ts);
          existingValues.add(item.value);
          migrated++;
        }
      }
    });

    tx();
    return { migrated, skipped };
  }

  /**
   * 从 pattern-analyzer JSON 导入
   */
  migrateFromPatternsJSON(userId) {
    const patternsPath = path.join(os.homedir(), '.openclaw', 'memory', 'patterns', 'users', userId, 'discovered-patterns.json');
    if (!fs.existsSync(patternsPath)) return { migrated: 0, skipped: 0 };

    const data = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
    let migrated = 0;

    const tx = this.db.transaction(() => {
      for (const [type, pattern] of Object.entries(data)) {
        this.storePattern({
          patternType: type,
          description: pattern.insight || type,
          data: pattern.data || {},
          confidence: 0.6
        });
        migrated++;
      }
    });

    tx();
    return { migrated };
  }

  /**
   * 从 time-decay JSON 导入
   */
  migrateFromTimeDecayJSON(userId) {
    const tdPath = path.join(os.homedir(), '.openclaw', 'memory', 'time-decay', 'users', userId, 'memories.json');
    if (!fs.existsSync(tdPath)) return { migrated: 0, skipped: 0 };

    const data = JSON.parse(fs.readFileSync(tdPath, 'utf8'));
    let migrated = 0, skipped = 0;

    const existingValues = new Set(
      this.db.prepare('SELECT value FROM masel_memories').all().map(r => r.value)
    );

    const tx = this.db.transaction(() => {
      for (const item of data) {
        if (existingValues.has(item.value)) { skipped++; continue; }
        const category = this._inferCategory(item.type || item.key);
        const tier = (item.originalWeight || item.weight || 0.5) >= 0.9 ? 'critical'
          : (item.originalWeight || item.weight || 0.5) >= 0.7 ? 'important' : 'temporary';
        const ts = item.createdAt ? new Date(item.createdAt).getTime() : Date.now();

        const id = this._genId();
        this.db.prepare(`
          INSERT OR IGNORE INTO masel_memories
            (id, category, tier, key, value, type, weight, context, tags, source, created_at, last_accessed, decay_score)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, 1.0)
        `).run(id, category, tier, item.key || '', item.value, item.type || 'fact', item.originalWeight || item.weight || 0.5, '', '', ts, ts);
        existingValues.add(item.value);
        migrated++;
      }
    });

    tx();
    return { migrated, skipped };
  }

  /**
   * 导出为 JSON（备份/可读）
   */
  exportToJSON() {
    const memories = this.db.prepare('SELECT * FROM masel_memories ORDER BY created_at DESC').all()
      .map(r => { r.tags = JSON.parse(r.tags || '[]'); return r; });
    const patterns = this.db.prepare('SELECT * FROM masel_patterns ORDER BY confidence DESC').all()
      .map(r => { r.data = JSON.parse(r.data || '{}'); r.evidence = JSON.parse(r.evidence || '[]'); return r; });
    const links = this.db.prepare('SELECT * FROM masel_links').all();
    return { memories, patterns, links, exportedAt: new Date().toISOString() };
  }

  /**
   * 统计信息
   */
  stats() {
    const memCount = this.db.prepare('SELECT COUNT(*) as c FROM masel_memories').get().c;
    const patCount = this.db.prepare('SELECT COUNT(*) as c FROM masel_patterns').get().c;
    const linkCount = this.db.prepare('SELECT COUNT(*) as c FROM masel_links').get().c;

    const byTier = this.db.prepare('SELECT tier, COUNT(*) as c FROM masel_memories GROUP BY tier').all();
    const byCategory = this.db.prepare('SELECT category, COUNT(*) as c FROM masel_memories GROUP BY category').all();

    return { memories: memCount, patterns: patCount, links: linkCount, byTier, byCategory };
  }

  // ========== 内部 ==========

  _logDecay(action, memoryId, oldTier, newTier, oldDecay, newDecay, reason) {
    this.db.prepare(`
      INSERT INTO masel_decay_log (action, memory_id, old_tier, new_tier, old_decay, new_decay, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(action, memoryId, oldTier, newTier, oldDecay, newDecay, reason, Date.now());
  }

  _inferCategory(type) {
    const map = {
      'preference': 'preference',
      'identity': 'fact',
      'ability': 'ability',
      'future': 'goal',
      'past': 'fact',
      'behavior': 'habit',
      'thought': 'fact',
      'value': 'value',
      'attribute': 'fact',
      'requirement': 'fact',
    };
    return map[type] || 'fact';
  }

  close() {
    this.db.close();
  }
}

// ========== 全局便捷接口 ==========

let _adapter = null;

function initSQLiteAdapter(dbPath) {
  _adapter = new MaselSQLiteAdapter(dbPath);
  return _adapter;
}

function getAdapter() {
  if (!_adapter) _adapter = new MaselSQLiteAdapter();
  return _adapter;
}

module.exports = {
  MaselSQLiteAdapter,
  initSQLiteAdapter,
  getAdapter,
};

// 直接运行时执行迁移
if (require.main === module) {
  const args = process.argv.slice(2);
  const adapter = new MaselSQLiteAdapter();

  if (args[0] === 'migrate') {
    const userId = args[1] || 'TvTongg';
    console.log(`📦 Migrating memories for ${userId}...`);

    const r1 = adapter.migrateFromSmartJSON(userId);
    console.log(`  Smart Memory: ${r1.migrated} migrated, ${r1.skipped} skipped`);

    const r2 = adapter.migrateFromTimeDecayJSON(userId);
    console.log(`  Time Decay: ${r2.migrated} migrated, ${r2.skipped} skipped`);

    console.log('\n📊 Stats:', adapter.stats());
  } else if (args[0] === 'stats') {
    console.log('📊 Stats:', JSON.stringify(adapter.stats(), null, 2));
  } else if (args[0] === 'export') {
    const out = args[1] || '/tmp/masel-export.json';
    fs.writeFileSync(out, JSON.stringify(adapter.exportToJSON(), null, 2));
    console.log(`📤 Exported to ${out}`);
  } else {
    console.log('Usage: node sqlite-adapter.js [migrate <userId>] [stats] [export <path>]');
  }

  adapter.close();
}
