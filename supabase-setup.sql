-- ════════════════════════════════════════════════════════════════════════
-- THE HUDSON DISTILLERY — Supabase schema setup
-- ════════════════════════════════════════════════════════════════════════
-- Run this in your Supabase Dashboard → SQL Editor → New query → Run.
--
-- ⚠️  This DROPS the existing tables named orders, inventory, settings,
--     stock_log, auth and messages and recreates them with the schema the
--     site expects. Any existing data in those tables will be deleted.
--     Back up first if you need it.
--
-- SECURITY MODEL (important):
--   RLS is ENABLED on every table and NO public policies are created.
--   That means the anon key can read nothing — by design. All data access
--   happens server-side through the Next.js API routes using the
--   service-role key (SUPABASE_SECRET_KEY), which bypasses RLS.
--   Never expose the service-role key to the browser.
--
-- Default credentials created below:
--   👑 Owner    — name: hudson   password: hudson123
--   👷 Employee — name: maria    password: staff123
--   (Both are also added to the access whitelist. Password hashes use the
--    legacy sha256(salt+pw+salt) scheme — the app transparently upgrades
--    them to scrypt on first login.)
-- ════════════════════════════════════════════════════════════════════════

-- Drop incompatible placeholder tables (CASCADE to clear dependencies).
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS stock_log CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS auth CASCADE;
DROP TABLE IF EXISTS messages CASCADE;

-- ── orders ───────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer    TEXT        NOT NULL,
  contact     TEXT,
  steam       TEXT,
  lines       TEXT,                       -- JSON string of [{itemId,name,qty,price}]
  notes       TEXT,
  status      TEXT        NOT NULL DEFAULT 'Preparing',
  date        DATE,
  created_by  TEXT,
  cancel_code TEXT,
  closed_at   BIGINT
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- No public policies: reads/writes go through the API with the service key.

-- ── inventory ────────────────────────────────────────────────────────────
CREATE TABLE inventory (
  id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name  TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  cat   TEXT  NOT NULL DEFAULT 'Other',
  -- When false, the item is hidden from the public order page and cannot be
  -- ordered. Defaults to TRUE for backward compatibility with old rows.
  active BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- ── settings ─────────────────────────────────────────────────────────────
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ── stock_log ────────────────────────────────────────────────────────────
CREATE TABLE stock_log (
  id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type TEXT,
  text TEXT,
  who  TEXT,
  ts   TEXT,
  date TEXT
);
ALTER TABLE stock_log ENABLE ROW LEVEL SECURITY;

-- ── auth ─────────────────────────────────────────────────────────────────
CREATE TABLE auth (
  username      TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('employee', 'owner')),
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL
);
ALTER TABLE auth ENABLE ROW LEVEL SECURITY;

-- ── messages ──────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author    TEXT NOT NULL,
  content   TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now())::bigint * 1000)
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ── Seed: inventory ──────────────────────────────────────────────────────
INSERT INTO inventory (name, price, stock, cat) VALUES
  ('Moonshine',   500,  0, 'Other'),
  ('Vodka',       250, 16, 'Other'),
  ('Wine',        400, 44, 'Other'),
  ('Berry Wine',  500,  0, 'Other'),
  ('Rum',         250, 17, 'Other'),
  ('Mead',        250,  8, 'Other'),
  ('Ale',         250, 68, 'Other'),
  ('Sake',        250,  6, 'Other'),
  ('Beer',        250, 10, 'Other'),
  ('Cider',       250,  9, 'Other');

-- ── Seed: settings ───────────────────────────────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('site_closed',         'false'),
  ('maintenance_mode',    'false'),
  ('site_closed_message', 'Orders are temporarily paused. Please check back soon.'),
  ('discord_link',        'https://discord.gg/anAmr5MQF'),
  ('auth_whitelist',      '{"employee":["hudson","maria","sam","jordan"],"owner":["hudson","owner"]}');

-- ── Seed: auth (salted SHA-256, scheme = sha256(salt + pw + salt)) ───────
--   owner   pw = hudson123  →  b51b0c27e5691b8804f0912014c0b01b433d444434209d0a3eaf4f3bd471c9e5
--   employee pw = staff123  →  a3a9da851e6ecba8fe647bbba8c6e5671c3d628630556ba2aa3df75c6abbd81f
INSERT INTO auth (username, role, password_hash, salt) VALUES
  ('hudson', 'owner', 'b51b0c27e5691b8804f0912014c0b01b433d444434209d0a3eaf4f3bd471c9e5', 'hdsalt2026'),
  ('maria', 'employee', 'a3a9da851e6ecba8fe647bbba8c6e5671c3d628630556ba2aa3df75c6abbd81f', 'hdsalt2026');

-- Done. The storefront at / and the staff panel at /admin now work end to
-- end against this database.

-- ── Performance indexes (added: optimization pass) ────────────────────────
-- The admin panel sorts/filters orders by status constantly and cleanup
-- targets closed_at; messages are read newest-first. Without these indexes
-- Postgres falls back to sequential scans as the tables grow.
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_closed_at ON orders (closed_at);
CREATE INDEX IF NOT EXISTS idx_orders_id_desc ON orders (id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_log_id_desc ON stock_log (id DESC);
