-- ════════════════════════════════════════════════════════════════════════
-- THE HUDSON DISTILLERY — Supabase schema setup
-- ════════════════════════════════════════════════════════════════════════
-- Run this in your Supabase Dashboard → SQL Editor → New query → Run.
--
-- ⚠️  This DROPS the existing (placeholder) tables named
--     orders, inventory, settings, stock_log, auth and recreates them with
--     the schema the recoded site expects. Any existing data in those tables
--     (e.g. "Test Item", the sample "admin" auth row) will be deleted.
--     Back up first if you need it.
--
-- Default credentials created below:
--   👑 Owner   — name: hudson   password: hudson123
--   👷 Employee— name: maria    password: staff123
--   (Both are also added to the access whitelist.)
-- ════════════════════════════════════════════════════════════════════════

-- Drop incompatible placeholder tables (CASCADE to clear dependencies).
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS stock_log CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS auth CASCADE;

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
CREATE POLICY "public read orders for tracking" ON orders FOR SELECT USING (true);
CREATE POLICY "public insert orders"           ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "public update orders cancel"    ON orders FOR UPDATE USING (true) WITH CHECK (true);

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
CREATE POLICY "public read inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY "server manage inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);

-- ── settings ─────────────────────────────────────────────────────────────
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "server manage settings" ON settings FOR ALL USING (true) WITH CHECK (true);

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
CREATE POLICY "server read stock log" ON stock_log FOR SELECT USING (true);
CREATE POLICY "server insert stock log" ON stock_log FOR INSERT WITH CHECK (true);

-- ── auth ─────────────────────────────────────────────────────────────────
CREATE TABLE auth (
  role          TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL
);
ALTER TABLE auth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server read auth" ON auth FOR SELECT USING (true);

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
INSERT INTO auth (role, password_hash, salt) VALUES
  ('owner',    'b51b0c27e5691b8804f0912014c0b01b433d444434209d0a3eaf4f3bd471c9e5', 'hdsalt2026'),
  ('employee', 'a3a9da851e6ecba8fe647bbba8c6e5671c3d628630556ba2aa3df75c6abbd81f', 'hdsalt2026');

-- Done. The site at / (admin) and ?view=order (public order page) will now
-- work end to end against this database.
