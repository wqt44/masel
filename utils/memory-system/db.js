/**
 * Shared SQLite connection for memory-system
 * 避免每个文件各自 require('better-sqlite3') + new Database()
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.MEMORY_DB_PATH || path.join(__dirname, 'memory.db');

let _db = null;

function getDB() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
  }
  return _db;
}

function closeDB() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = { getDB, closeDB, DB_PATH };
