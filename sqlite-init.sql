CREATE TABLE IF NOT EXISTS stats (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    newUsers INTEGER DEFAULT 0,
    activeUsers INTEGER DEFAULT 0,
    messagesProcessed INTEGER DEFAULT 0,
    totalChats INTEGER DEFAULT 0,
    totalBans INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS broadcast_history (
    id TEXT PRIMARY KEY,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    message TEXT NOT NULL,
    targetType TEXT,
    recipientsCount INTEGER DEFAULT 0,
    successCount INTEGER DEFAULT 0,
    failCount INTEGER DEFAULT 0,
    status TEXT
);

CREATE TABLE IF NOT EXISTS whitelist (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE,
    username TEXT,
    addedBy TEXT,
    addedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stats_date ON stats(date);
CREATE INDEX IF NOT EXISTS idx_broadcast_timestamp ON broadcast_history(timestamp);

-- SQLite schema for MotoInfo Bot Admin Panel

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- ADMIN, ADVERTISER, SUPER_ADMIN
    assignedChatIds TEXT,
    maxMessages INTEGER DEFAULT 100,
    messagesSent INTEGER DEFAULT 0,
    accessPeriodDays INTEGER DEFAULT 30,
    canPin INTEGER DEFAULT 0, -- Boolean 0/1
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    expiresAt TEXT NULL
);

CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    members INTEGER DEFAULT 0,
    muteNewcomers INTEGER DEFAULT 0,
    muteDurationHours INTEGER DEFAULT 0,
    muteMessage TEXT,
    autoApprove INTEGER DEFAULT 0,
    captchaEnabled INTEGER DEFAULT 0,
    captchaQuestion TEXT,
    captchaAnswer TEXT,
    blockLinks INTEGER DEFAULT 0,
    blockTelegramLinks INTEGER DEFAULT 0,
    blockMedia INTEGER DEFAULT 0,
    blockForwards INTEGER DEFAULT 0,
    forbiddenWords TEXT,
    msgCount INTEGER DEFAULT 0,
    avatarUrl TEXT,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS global_bans (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    reason TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_bans (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    chatId TEXT NOT NULL,
    chatTitle TEXT,
    reason TEXT,
    type TEXT, -- BAN, MUTE
    untilDate TEXT,
    addedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS filters (
    id TEXT PRIMARY KEY,
    chatId TEXT NOT NULL,
    pattern TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    addedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL,
    user TEXT,
    chat TEXT,
    details TEXT
);

CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    username TEXT,
    firstName TEXT,
    lastName TEXT,
    chatId TEXT NOT NULL,
    joinedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    lastSeen TEXT NULL,
    msgCount INTEGER DEFAULT 0,
    isAdmin INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    data TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS config (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(userId);
CREATE INDEX IF NOT EXISTS idx_memberships_chat ON memberships(chatId);

-- Insert default super admin (password: admin123)
-- Hash for 'admin123'
INSERT OR IGNORE INTO users (id, username, email, password, role, createdAt) 
VALUES ('superadmin', 'admin', 'admin@example.com', '$2b$10$1xUBiO5w/emNGq1aEgxDguYE7AyDu7rQygeHhn27SwUsZFJIQV09C', 'SUPER_ADMIN', CURRENT_TIMESTAMP);
