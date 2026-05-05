-- =============================================================
-- TradeFloor | Script 08 — Nuclear Reset (Pre-Deployment Wipe)
-- =============================================================
-- Run as postgres superuser BEFORE going live.
-- Wipes ALL users, orders, and trades completely.
-- Resets all sequences to 1 so IDs start fresh.
-- Keeps the items catalogue (HP Laptop Charger, etc.) intact.
-- After this, the database is 100% clean — ready for real users.
--
-- Usage:
--   psql -U postgres -d tradefloor -f database/08_nuclear_reset.sql
-- =============================================================

-- ── Step 1: Disable ALL triggers so the append-only guard
--   on trades and the immutability guard don't block us.
--   session_replication_role = 'replica' is the standard
--   PostgreSQL superuser mechanism for bulk data operations.
-- ─────────────────────────────────────────────────────────────
SET session_replication_role = 'replica';

-- ── Step 2: Wipe in FK dependency order ──────────────────────
--   1. Nullify created_by FIRST so TRUNCATE users doesn't cascade to items
UPDATE items SET created_by = NULL;
--   2. Wipe trades, orders, users (CASCADE handles order automatically)
TRUNCATE TABLE trades  RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders  RESTART IDENTITY CASCADE;
TRUNCATE TABLE users   RESTART IDENTITY CASCADE;
--   Note: items are NOT truncated — your item catalogue is preserved.

-- ── Step 3: Re-enable triggers ────────────────────────────────
SET session_replication_role = 'origin';  -- 'origin' is the correct reset value

-- ── Step 4: Refresh materialized views (now empty) ───────────
REFRESH MATERIALIZED VIEW order_book_depth;
REFRESH MATERIALIZED VIEW trade_history_summary;

-- ── Step 5: Verify ───────────────────────────────────────────
SELECT 'users'  AS table_name, COUNT(*) AS rows FROM users
UNION ALL
SELECT 'orders',  COUNT(*) FROM orders
UNION ALL
SELECT 'trades',  COUNT(*) FROM trades
UNION ALL
SELECT 'items (kept)', COUNT(*) FROM items;
