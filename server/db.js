import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Connection pool configuration for Docker
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'nfeglobal_pass',
  database: process.env.DB_NAME || 'nfeglobal_game',
  port: process.env.DB_PORT || 5432,
});

// Robust connection test with retries
const connectWithRetry = async (retries = 5) => {
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connected successfully');
      
      // Auto-migrate tables that were added later (so they don't crash on existing DBs)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            max_seats INTEGER DEFAULT 100,
            price_nfeglobal NUMERIC(36, 18) DEFAULT 0,
            telegram_link VARCHAR(500),
            schedule_time VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Safe schema patch for existing production DBs
        ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_time VARCHAR(255);

        CREATE TABLE IF NOT EXISTS event_bookings (
            id SERIAL PRIMARY KEY,
            event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
            wallet_address VARCHAR(42) NOT NULL,
            paid_nfeglobal NUMERIC(36, 18) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(event_id, wallet_address)
        );

        CREATE INDEX IF NOT EXISTS idx_event_bookings_wallet ON event_bookings(wallet_address);
      `);
      console.log('✅ Auto-migrations verified');

      return;
    } catch (err) {
      console.log(`❌ Database connection failed. Retries left: ${retries-1}`);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  console.error('Final database connection failure');
  process.exit(-1);
};

connectWithRetry();

export const query = (text, params) => pool.query(text, params);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
