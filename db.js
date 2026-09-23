const Database = require('better-sqlite3');

if (!process.env.DB_PATH) {
  throw new Error('DB_PATH environment variable is not set');
}

const db = new Database(process.env.DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    chat_id TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    name TEXT
  )
`);

module.exports = db;
