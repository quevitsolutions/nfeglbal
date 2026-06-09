-- NFEGlobal Game Database Schema (Modernized Web3 Version)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    telegram_id BIGINT,
    taps INTEGER DEFAULT 0,
    demo_taps INTEGER DEFAULT 0,
    local_reward NUMERIC(36, 18) DEFAULT 0,
    total_earned NUMERIC(36, 18) DEFAULT 0,
    energy INTEGER DEFAULT 500,
    max_energy INTEGER DEFAULT 500,
    mining_rate NUMERIC(36, 18) DEFAULT 1000,
    last_claim_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    streak INTEGER DEFAULT 0,
    last_streak_date DATE,
    daily_streak INTEGER DEFAULT 0,
    last_daily_claim TIMESTAMP,
    referrer_id BIGINT REFERENCES users(id),
    referred_by_memo TEXT,
    activated_refs INTEGER DEFAULT 0,
    -- Node / Matrix fields
    node_id INTEGER UNIQUE,
    node_tier INTEGER DEFAULT 0,
    node_active BOOLEAN DEFAULT TRUE,
    is_premium BOOLEAN DEFAULT FALSE,
    sponsor_node_id INTEGER,
    matrix_parent_id INTEGER,
    matrix_parent_node_id INTEGER,
    matrix_counts JSONB DEFAULT '[]',
    -- Milestone / reward tracking
    claimed_milestones TEXT DEFAULT '[]',
    -- Sync tracking
    last_synced_block INTEGER DEFAULT 0,
    last_rpc_sync TIMESTAMP,
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optimized indices for wallet-first lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer_id);

-- Snapshots table for audits and distributions
CREATE TABLE IF NOT EXISTS snapshots (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    total_users INTEGER DEFAULT 0,
    total_coins NUMERIC(36, 18) DEFAULT 0,
    data JSONB DEFAULT '[]', -- Array of {wallet, balance}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at);

-- User-specific conversion history for fast lookups
CREATE TABLE IF NOT EXISTS user_conversions (
    id SERIAL PRIMARY KEY,
    snapshot_id INTEGER REFERENCES snapshots(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) NOT NULL,
    mined_amount NUMERIC(36, 18) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_conv_wallet ON user_conversions(wallet_address);

-- Tasks Management System
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    reward NUMERIC(36, 18) DEFAULT 0,
    icon VARCHAR(50) DEFAULT '💎',
    url VARCHAR(500),
    type VARCHAR(50) DEFAULT 'social',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_tasks (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_address, task_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tasks_wallet ON user_tasks(wallet_address);

-- Team Income History Tracking (Precision indexed from on-chain)
CREATE TABLE IF NOT EXISTS income_history (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    source_contract VARCHAR(42) NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- Referral, Direct, Layer, Matrix, PoolClaim
    from_node_id INTEGER,
    amount_bnb NUMERIC(36, 18) NOT NULL,
    amount_usd NUMERIC(36, 18) NOT NULL,
    tier INTEGER DEFAULT 0, -- Context: Tier 0-17
    layer INTEGER DEFAULT 0, -- Context: Layer depth
    is_missed BOOLEAN DEFAULT FALSE,
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_income_wallet ON income_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_income_timestamp ON income_history(timestamp DESC);

-- Telegram broadcast audit log
CREATE TABLE IF NOT EXISTS telegram_broadcasts (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    target_filter VARCHAR(50) DEFAULT 'all',
    sent_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VIP Events & Webinars system
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    max_seats INTEGER DEFAULT 100,
    price_nfeglobal NUMERIC(36, 18) DEFAULT 0,
    telegram_link VARCHAR(500),
    schedule_time VARCHAR(255),   -- FIX: was missing — used by admin event creation endpoint
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_bookings (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) NOT NULL,
    paid_nfeglobal NUMERIC(36, 18) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_event_bookings_wallet ON event_bookings(wallet_address);
