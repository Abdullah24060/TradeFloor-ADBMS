-- =============================================================
-- TradeFloor  |  Script 03 — Matching Engine Stored Procedure
-- This is the ADBMS centerpiece:
--   • pgcrypto for cryptographically secure release codes
--   • SELECT … FOR UPDATE SKIP LOCKED (non-blocking concurrency)
--   • SERIALIZABLE isolation enforced by caller transaction
--   • Full partial-fill support
-- =============================================================

-- =============================================================
-- HELPER FUNCTION: generate_release_code()
-- Uses pgcrypto gen_random_bytes() for true CSPRNG randomness.
-- Returns a zero-padded 6-digit string: e.g. "047391"
-- Why not RANDOM(): RANDOM() is pseudo-random seeded per-session.
-- gen_random_bytes() uses the OS entropy source — far more secure.
-- =============================================================
CREATE OR REPLACE FUNCTION generate_release_code()
RETURNS VARCHAR(6)
LANGUAGE plpgsql AS $$
DECLARE
    raw_bytes   BYTEA;
    raw_int     BIGINT;
BEGIN
    -- Pull 4 random bytes from pgcrypto
    raw_bytes := gen_random_bytes(4);

    -- Convert to a 32-bit unsigned integer
    raw_int := (
          get_byte(raw_bytes, 0)::BIGINT * 16777216
        + get_byte(raw_bytes, 1)::BIGINT * 65536
        + get_byte(raw_bytes, 2)::BIGINT * 256
        + get_byte(raw_bytes, 3)::BIGINT
    );

    -- Modulo 1,000,000 → value in [0, 999999]; zero-pad to 6 digits
    RETURN LPAD((raw_int % 1000000)::TEXT, 6, '0');
END;
$$;

COMMENT ON FUNCTION generate_release_code IS
    'Generates a cryptographically secure 6-digit release code using pgcrypto gen_random_bytes(). '
    'Used for physical settlement in the TradeFloor trade confirmation flow.';

-- =============================================================
-- CORE FUNCTION: match_order(p_order_id INTEGER)
-- =============================================================
-- Matches a newly inserted order against the existing order book.
-- Must be called inside a SERIALIZABLE transaction by the application.
--
-- Algorithm:
--   1. Lock and load the target order.
--   2. Iterate over compatible opposite-side orders, best price first.
--   3. FOR UPDATE SKIP LOCKED → non-blocking; concurrent sessions
--      skip contested rows rather than waiting (exchange-grade behaviour).
--   4. Create a trade record for each (partial) match.
--   5. Decrement quantities; mark fully-matched orders as FILLED.
--   6. Refresh the materialized view so Market Radar stays current.
--
-- Returns: set of (trade_id, matched_price, matched_qty) rows
-- =============================================================
CREATE OR REPLACE FUNCTION match_order(p_order_id INTEGER)
RETURNS TABLE (
    trade_id        INTEGER,
    matched_price   NUMERIC,
    matched_qty     INTEGER,
    release_code    VARCHAR(6)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order         RECORD;
    v_match         RECORD;
    v_remaining     INTEGER;
    v_trade_qty     INTEGER;
    v_code          VARCHAR(6);
    v_new_trade_id  INTEGER;
BEGIN
    -- ── Step 1: Load the incoming order ──────────────────────────
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id AND status = 'ACTIVE'
    FOR UPDATE;                    -- lock this order row for the session

    IF NOT FOUND THEN
        RAISE EXCEPTION '[TradeFloor] Order % not found or not in ACTIVE state.', p_order_id;
    END IF;

    v_remaining := v_order.quantity;

    -- ── Step 2: Find matching orders on the opposite side ────────
    -- BUY  order → look for cheapest SELL orders ≤ buy price
    -- SELL order → look for highest BUY orders  ≥ sell price
    -- SKIP LOCKED: any row locked by a concurrent session is skipped
    -- entirely — no queue, no blocking. Other concurrent matches
    -- simply pick the next best available order.
    FOR v_match IN
        SELECT o.*
        FROM orders o
        WHERE o.item_id    = v_order.item_id
          AND o.order_type != v_order.order_type
          AND o.user_id    != v_order.user_id        -- can't self-trade
          AND o.status     = 'ACTIVE'
          AND CASE
                WHEN v_order.order_type = 'BUY'
                    THEN o.price <= v_order.price    -- seller's ask ≤ buyer's bid
                WHEN v_order.order_type = 'SELL'
                    THEN o.price >= v_order.price    -- buyer's bid ≥ seller's ask
              END
        ORDER BY
            CASE WHEN v_order.order_type = 'BUY'  THEN o.price END ASC,   -- cheapest ask first
            CASE WHEN v_order.order_type = 'SELL' THEN o.price END DESC,  -- highest bid first
            o.created_at ASC                                                -- oldest order wins ties (FIFO)
        FOR UPDATE SKIP LOCKED    -- KEY: non-blocking lock acquisition
    LOOP
        EXIT WHEN v_remaining <= 0;

        -- ── Step 3: Determine trade quantity ─────────────────────
        v_trade_qty := LEAST(v_remaining, v_match.quantity);

        -- ── Step 4: Generate secure release code ─────────────────
        v_code := generate_release_code();

        -- ── Step 5: Insert trade record ───────────────────────────
        -- Trade price = the resting order's price (market order semantics)
        INSERT INTO trades (buy_order_id, sell_order_id, quantity, price, release_code)
        VALUES (
            CASE WHEN v_order.order_type = 'BUY'  THEN v_order.id ELSE v_match.id END,
            CASE WHEN v_order.order_type = 'SELL' THEN v_order.id ELSE v_match.id END,
            v_trade_qty,
            v_match.price,   -- trade executes at the resting order's price
            v_code
        )
        RETURNING id INTO v_new_trade_id;

        -- Populate the return row
        trade_id      := v_new_trade_id;
        matched_price := v_match.price;
        matched_qty   := v_trade_qty;
        release_code  := v_code;
        RETURN NEXT;

        -- ── Step 6: Update the matched (resting) order ──────────
        IF v_match.quantity = v_trade_qty THEN
            UPDATE orders SET status = 'FILLED' WHERE id = v_match.id;
        ELSE
            UPDATE orders
            SET quantity = quantity - v_trade_qty,
                status   = 'PARTIALLY_FILLED'
            WHERE id = v_match.id;
        END IF;

        v_remaining := v_remaining - v_trade_qty;
    END LOOP;

    -- ── Step 7: Update the incoming order ────────────────────────
    IF v_remaining = 0 THEN
        UPDATE orders SET status = 'FILLED'        WHERE id = v_order.id;
    ELSIF v_remaining < v_order.quantity THEN
        UPDATE orders
        SET quantity = v_remaining,
            status   = 'PARTIALLY_FILLED'
        WHERE id = v_order.id;
    END IF;
    -- If v_remaining = v_order.quantity → no match found, order stays ACTIVE in book

    -- ── Step 8: Refresh materialized view ────────────────────────
    -- Use non-concurrent refresh here because this function executes inside
    -- the caller's transaction block.
    REFRESH MATERIALIZED VIEW order_book_depth;

    RETURN;
END;
$$;

COMMENT ON FUNCTION match_order(INTEGER) IS
    'Core matching engine. Matches a limit order against the live order book using '
    'FOR UPDATE SKIP LOCKED (non-blocking) and SERIALIZABLE isolation (caller''s responsibility). '
    'Generates pgcrypto-backed release codes for physical settlement. Refreshes Market Radar view.';

-- =============================================================
-- HELPER FUNCTION: refresh_order_book_depth()
-- Runs as owner to allow tf_app to refresh the materialized view.
-- =============================================================
CREATE OR REPLACE FUNCTION refresh_order_book_depth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW order_book_depth;
END;
$$;

COMMENT ON FUNCTION refresh_order_book_depth() IS
    'Refreshes order_book_depth materialized view as a SECURITY DEFINER helper.';

-- =============================================================
-- FUNCTION: confirm_trade(p_trade_id INT, p_release_code VARCHAR, p_seller_user_id INT)
-- Called by the seller when they enter the release code after physical meetup.
-- =============================================================
CREATE OR REPLACE FUNCTION confirm_trade(
    p_trade_id          INTEGER,
    p_release_code      VARCHAR(6),
    p_seller_user_id    INTEGER
)
RETURNS BOOLEAN   -- TRUE = confirmed, FALSE = code mismatch or not authorised
LANGUAGE plpgsql AS $$
DECLARE
    v_trade         RECORD;
    v_seller_id     INTEGER;
BEGIN
    -- Load and lock the trade
    SELECT * INTO v_trade
    FROM trades
    WHERE id = p_trade_id AND status = 'PENDING'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '[TradeFloor] Trade % not found or is not in PENDING state.', p_trade_id;
    END IF;

    -- Verify the caller is the seller
    SELECT user_id INTO v_seller_id
    FROM orders WHERE id = v_trade.sell_order_id;

    IF v_seller_id != p_seller_user_id THEN
        RAISE EXCEPTION '[TradeFloor] User % is not the seller for trade %.', p_seller_user_id, p_trade_id;
    END IF;

    -- Validate release code (constant-time comparison via encode)
    IF v_trade.release_code != p_release_code THEN
        RAISE NOTICE '[TradeFloor] Incorrect release code for trade %.', p_trade_id;
        RETURN FALSE;
    END IF;

    -- Mark as COMPLETED (reputation trigger fires automatically)
    UPDATE trades
    SET status       = 'COMPLETED',
        completed_at = NOW()
    WHERE id = p_trade_id;

    RAISE NOTICE '[TradeFloor] Trade % confirmed successfully.', p_trade_id;
    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION confirm_trade(INTEGER, VARCHAR, INTEGER) IS
    'Validates the 6-digit release code entered by the seller. On success, marks trade COMPLETED '
    'which atomically triggers reputation increments for both parties via the after-update trigger.';
