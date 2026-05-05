-- =============================================================
-- TradeFloor  |  Script 05 — Permissions & Role Grants
-- Principle of Least Privilege for the tf_app application role
-- =============================================================

-- ── Basic access ─────────────────────────────────────────────
GRANT CONNECT ON DATABASE tradefloor TO tf_app;
GRANT USAGE   ON SCHEMA public        TO tf_app;

-- ── Sequence access (for SERIAL columns) ─────────────────────
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tf_app;

-- ── users table ──────────────────────────────────────────────
-- App can read, create, and update users (verification, reputation)
-- It CANNOT delete users
GRANT SELECT, INSERT ON users TO tf_app;
GRANT UPDATE (name, is_verified, verify_token, token_expiry, reputation) ON users TO tf_app;

-- ── items table ──────────────────────────────────────────────
GRANT SELECT, INSERT ON items TO tf_app;
GRANT UPDATE (name, description, category) ON items TO tf_app;

-- ── orders table ─────────────────────────────────────────────
-- App can place orders and update their status/quantity (for matching/cancellation)
GRANT SELECT, INSERT ON orders TO tf_app;
GRANT UPDATE (status, quantity) ON orders TO tf_app;

-- ── trades table ─────────────────────────────────────────────
-- App can INSERT new trades and SELECT them.
-- UPDATE is limited to (status, completed_at) for release-code confirmation.
-- DELETE is forbidden at table level AND enforced by trigger (double protection).
GRANT SELECT, INSERT ON trades TO tf_app;
GRANT UPDATE (status, completed_at) ON trades TO tf_app;
-- Explicitly NO DELETE grant on trades

-- ── Materialized views ───────────────────────────────────────
GRANT SELECT ON order_book_depth      TO tf_app;
GRANT SELECT ON trade_history_summary TO tf_app;

-- ── Stored procedures ────────────────────────────────────────
GRANT EXECUTE ON FUNCTION match_order(INTEGER)                              TO tf_app;
GRANT EXECUTE ON FUNCTION confirm_trade(INTEGER, VARCHAR, INTEGER)          TO tf_app;
GRANT EXECUTE ON FUNCTION generate_release_code()                           TO tf_app;
GRANT EXECUTE ON FUNCTION refresh_order_book_depth()                        TO tf_app;
GRANT EXECUTE ON FUNCTION expire_old_orders()                               TO tf_app;

-- ── Summary ──────────────────────────────────────────────────
-- tf_app role CANNOT:
--   • DELETE any row from any table
--   • UPDATE core trade data (buy_order_id, sell_order_id, price, quantity, release_code, matched_at)
--   • DROP tables, CREATE tables, or ALTER schema
--   • Access pg_catalog system tables beyond what is default
--
-- This means even if the application layer is fully compromised,
-- the trade ledger's integrity is preserved at the database level.
