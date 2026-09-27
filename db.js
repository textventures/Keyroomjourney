
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

  -- Dwelryn's Snow Queen calls in the tavern: when each is due, the group message, and who answered it
  CREATE TABLE IF NOT EXISTS snowqueen_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    due_at INTEGER NOT NULL,
    posted_at INTEGER,
    skipped INTEGER NOT NULL DEFAULT 0,
    chat_id TEXT,
    message_id INTEGER,
    claimed_by TEXT,
    claimed_name TEXT,
    claimed_at INTEGER,
    started_at INTEGER,
    closed_at INTEGER
  );

  -- which room of the Snow Queen's castle keep each player is in (moved with /east, /west, ...)
  CREATE TABLE IF NOT EXISTS snowqueen_positions (
    user_id TEXT PRIMARY KEY,
    room TEXT,
    updated_at INTEGER NOT NULL
  );

  -- the step (count of rooms entered this quest) at which each player last entered each keep room
  CREATE TABLE IF NOT EXISTS snowqueen_visits (
    user_id TEXT NOT NULL,
    room TEXT NOT NULL,
    last_step INTEGER NOT NULL,
    PRIMARY KEY (user_id, room)
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

// when a Snow Queen quest was won, so it can only be won (and announced in the tavern) once
if (!db.prepare('PRAGMA table_info(snowqueen_calls)').all().some((column) => column.name === 'won_at')) {
  db.exec('ALTER TABLE snowqueen_calls ADD COLUMN won_at INTEGER');
}

// how many keep rooms each player has entered this quest, for "the room seems familiar"
if (!db.prepare('PRAGMA table_info(snowqueen_positions)').all().some((column) => column.name === 'steps')) {
  db.exec('ALTER TABLE snowqueen_positions ADD COLUMN steps INTEGER NOT NULL DEFAULT 0');
}

// which bot a sign-in link came from, so that bot carries on after sign-in (empty means Keyroom)
if (!db.prepare('PRAGMA table_info(signin_tokens)').all().some((column) => column.name === 'bot')) {
  db.exec('ALTER TABLE signin_tokens ADD COLUMN bot TEXT');
}

// wallets linked before multi-wallet support only exist in users
db.exec(`
  INSERT OR IGNORE INTO wallets (chat_id, address, added_at)
  SELECT chat_id, address, CAST(strftime('%s', 'now') AS INTEGER) FROM users
`);

module.exports = db;
