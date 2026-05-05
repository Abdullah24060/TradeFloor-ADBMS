-- =============================================================
-- TradeFloor | Migration 06 — New Features + Security Hardening
-- Run as: psql -U postgres -d tradefloor -f database/06_migration.sql
-- =============================================================

-- ── 1. Add batch & degree columns to users ───────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS batch  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS degree VARCHAR(50);

COMMENT ON COLUMN users.batch  IS 'Student batch year e.g. BSAI-2024';
COMMENT ON COLUMN users.degree IS 'Degree programme e.g. BS Artificial Intelligence';

-- Grant tf_app permission to update new columns
GRANT UPDATE (batch, degree) ON users TO tf_app;

-- ── 2. Grant tf_app REFRESH on materialized views ────────────
-- This is needed so the SECURITY DEFINER match_order function can
-- refresh the view even when called by tf_app. Without SECURITY
-- DEFINER the caller needs ownership; with it the function owner
-- (postgres) does it. But we also grant here for belt-and-suspenders.
ALTER MATERIALIZED VIEW order_book_depth     OWNER TO postgres;
ALTER MATERIALIZED VIEW trade_history_summary OWNER TO postgres;

-- ── 3. Create release_code_expiry: if a trade stays PENDING    ──
-- for more than 48 hours its release code is considered expired.
-- Both orders are requeued as new ACTIVE orders at the same price.
-- The expired trade is marked DISPUTED (append-only — never deleted).
CREATE OR REPLACE FUNCTION expire_stale_trades()
RETURNS INTEGER   -- number of trades expired
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trade         RECORD;
    v_buy_order     RECORD;
    v_sell_order    RECORD;
    v_expired_count INTEGER := 0;
BEGIN
    FOR v_trade IN
        SELECT * FROM trades
        WHERE status = 'PENDING'
          AND matched_at < NOW() - INTERVAL '48 hours'
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Load both sides
        SELECT * INTO v_buy_order  FROM orders WHERE id = v_trade.buy_order_id;
        SELECT * INTO v_sell_order FROM orders WHERE id = v_trade.sell_order_id;

        -- Mark the original orders EXPIRED
        UPDATE orders SET status = 'EXPIRED' WHERE id IN (v_trade.buy_order_id, v_trade.sell_order_id);

        -- Requeue buyer: insert a fresh ACTIVE order at same price
        INSERT INTO orders (user_id, item_id, order_type, price, quantity, status, expires_at)
        VALUES (
            v_buy_order.user_id,
            v_buy_order.item_id,
            'BUY',
            v_buy_order.price,
            v_trade.quantity,
            'ACTIVE',
            NOW() + INTERVAL '7 days'
        );

        -- Requeue seller: insert a fresh ACTIVE order at same price
        INSERT INTO orders (user_id, item_id, order_type, price, quantity, status, expires_at)
        VALUES (
            v_sell_order.user_id,
            v_sell_order.item_id,
            'SELL',
            v_sell_order.price,
            v_trade.quantity,
            'ACTIVE',
            NOW() + INTERVAL '7 days'
        );

        -- Mark trade DISPUTED (expired) — NOT deleted (append-only ledger)
        UPDATE trades SET status = 'DISPUTED' WHERE id = v_trade.id;

        v_expired_count := v_expired_count + 1;
    END LOOP;

    -- Refresh market view after requeuing
    REFRESH MATERIALIZED VIEW order_book_depth;

    RETURN v_expired_count;
END;
$$;

COMMENT ON FUNCTION expire_stale_trades() IS
    'Expires PENDING trades older than 48 hours. Requeues both buyer and seller '
    'as fresh ACTIVE orders at the same price. Marks trade DISPUTED (never deleted). '
    'Called by the backend scheduler or manually.';

GRANT EXECUTE ON FUNCTION expire_stale_trades() TO tf_app;

-- ── 4. Add DISPUTED to trade status check constraint ─────────
-- (Already present in existing schema — skip if already there)

-- ── 5. Grant tf_app INSERT on orders for requeue ─────────────
-- (Already granted in 05_permissions.sql — verified)

-- ── 6. Fix confirm_trade to also grant SECURITY DEFINER ──────
CREATE OR REPLACE FUNCTION confirm_trade(
    p_trade_id          INTEGER,
    p_release_code      VARCHAR(6),
    p_seller_user_id    INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trade         RECORD;
    v_seller_id     INTEGER;
BEGIN
    SELECT * INTO v_trade
    FROM trades
    WHERE id = p_trade_id AND status = 'PENDING'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '[TradeFloor] Trade % not found or not PENDING.', p_trade_id;
    END IF;

    SELECT user_id INTO v_seller_id
    FROM orders WHERE id = v_trade.sell_order_id;

    IF v_seller_id != p_seller_user_id THEN
        RAISE EXCEPTION '[TradeFloor] User % is not the seller for trade %.', p_seller_user_id, p_trade_id;
    END IF;

    IF v_trade.release_code != p_release_code THEN
        RETURN FALSE;
    END IF;

    UPDATE trades
    SET status       = 'COMPLETED',
        completed_at = NOW()
    WHERE id = p_trade_id;

    -- Refresh trade history summary
    REFRESH MATERIALIZED VIEW trade_history_summary;

    RETURN TRUE;
END;
$$;

-- ── 7. Clean cascade delete of test user bsai24060 ───────────
-- Delete trades first (referencing orders of this user), then orders, then user.
-- We can't truly delete trades (append-only) but we can delete the user's
-- orders that haven't been matched yet, and cancel matched ones.
-- For any PENDING trade involving this user, mark it DISPUTED and expire both orders.

DO $$
DECLARE
    v_uid INTEGER;
BEGIN
    SELECT id INTO v_uid FROM users WHERE email = 'bsai24060@itu.edu.pk';
    IF NOT FOUND THEN
        RAISE NOTICE 'User bsai24060@itu.edu.pk not found — skipping.';
        RETURN;
    END IF;

    -- Cancel all ACTIVE orders belonging to this user
    UPDATE orders SET status = 'CANCELLED'
    WHERE user_id = v_uid AND status IN ('ACTIVE', 'PARTIALLY_FILLED');

    -- Mark PENDING trades involving this user as DISPUTED
    UPDATE trades SET status = 'DISPUTED'
    WHERE status = 'PENDING'
      AND (
          buy_order_id  IN (SELECT id FROM orders WHERE user_id = v_uid) OR
          sell_order_id IN (SELECT id FROM orders WHERE user_id = v_uid)
      );

    -- Nullify created_by on items they created (preserve items)
    UPDATE items SET created_by = NULL WHERE created_by = v_uid;

    -- Finally delete the user (orders FK has no ON DELETE CASCADE so
    -- we leave cancelled orders in the ledger for audit, but remove the user)
    -- To do a real full delete, we need to delete orders too.
    DELETE FROM orders WHERE user_id = v_uid AND status IN ('CANCELLED','EXPIRED');
    DELETE FROM users  WHERE id = v_uid;

    RAISE NOTICE 'User bsai24060@itu.edu.pk removed successfully.';
END;
$$;

-- ── 8. Refresh materialized view after cleanup ────────────────
REFRESH MATERIALIZED VIEW order_book_depth;

-- ── 9. Verify result ──────────────────────────────────────────
SELECT id, name, email, batch, degree, reputation
FROM users
ORDER BY id;
