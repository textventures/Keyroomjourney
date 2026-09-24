
const Database = require('better-sqlite3');

if (!process.env.DB_PATH) {
  throw new Error('DB_PATH environment variable is not set');
}

const db = new Database(process.env.DB_PATH);
db.pragma('journal_mode = WAL');

// users.address is the player's active wallet; wallets holds every wallet they have linked.
// chat_id is the Telegram user id (the bot only talks in private chats), which never changes,
// unlike a username.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    chat_id TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS wallets (
    chat_id TEXT NOT NULL,
    address TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (chat_id, address)
  );

  CREATE TABLE IF NOT EXISTS signin_tokens (
    token TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    name TEXT,
    expires_at INTEGER NOT NULL
  );
`);

// the door the player tried before signing in, so the bot can reopen it once they have linked a wallet
if (!db.prepare('PRAGMA table_info(signin_tokens)').all().some((column) => column.name === 'door')) {
  db.exec('ALTER TABLE signin_tokens ADD COLUMN door TEXT');
}

// wallets linked before multi-wallet support only exist in users
db.exec(`
  INSERT OR IGNORE INTO wallets (chat_id, address, added_at)
  SELECT chat_id, address, CAST(strftime('%s', 'now') AS INTEGER) FROM users
`);

module.exports = db;
