-- =============================================================
-- TradeFloor  |  Script 02 — Triggers & Rules
-- Enforces append-only trades, reputation updates, order expiry
-- =============================================================

-- =============================================================
-- TRIGGER 1: Prevent DELETE on trades (append-only ledger)
-- Even the postgres superuser cannot delete a settled trade
-- =============================================================
CREATE OR REPLACE FUNCTION prevent_trade_delete()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        '[TradeFloor] trades table is append-only. DELETE is permanently forbidden. Trade ID: %', OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_delete_trades ON trades;
CREATE TRIGGER trg_no_delete_trades
    BEFORE DELETE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION prevent_trade_delete();

COMMENT ON FUNCTION prevent_trade_delete IS
    'Enforces append-only semantics on the trades ledger — part of the audit trail guarantee';

-- =============================================================
-- TRIGGER 2: Restrict UPDATE on trades
-- Only status transition PENDING → COMPLETED or DISPUTED is allowed.
-- Only status + completed_at columns may change; everything else is immutable.
-- =============================================================
CREATE OR REPLACE FUNCTION restrict_trade_update()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    -- Guard: can only mutate a PENDING trade
    IF OLD.status != 'PENDING' THEN
        RAISE EXCEPTION
            '[TradeFloor] Trade % is already %. Only PENDING trades can be updated.',
            OLD.id, OLD.status;
    END IF;

    -- Guard: status must move to COMPLETED or DISPUTED
    IF NEW.status NOT IN ('COMPLETED', 'DISPUTED') THEN
        RAISE EXCEPTION
            '[TradeFloor] Invalid status transition for trade %: % → %. Allowed targets: COMPLETED, DISPUTED.',
            OLD.id, OLD.status, NEW.status;
    END IF;

    -- Guard: immutable columns must not change
    IF  NEW.buy_order_id  != OLD.buy_order_id
     OR NEW.sell_order_id != OLD.sell_order_id
     OR NEW.quantity      != OLD.quantity
     OR NEW.price         != OLD.price
     OR NEW.release_code  != OLD.release_code
     OR NEW.matched_at    != OLD.matched_at
    THEN
        RAISE EXCEPTION
            '[TradeFloor] Trade % — only status and completed_at may be updated. Core trade data is immutable.',
            OLD.id;
    END IF;

    -- Auto-set completed_at if not already provided
    IF NEW.status = 'COMPLETED' AND NEW.completed_at IS NULL THEN
        NEW.completed_at := NOW();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_trade_update ON trades;
CREATE TRIGGER trg_restrict_trade_update
    BEFORE UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION restrict_trade_update();

COMMENT ON FUNCTION restrict_trade_update IS
    'Immutability enforcement for the trades ledger — ensures core trade data can never be altered post-creation';

-- =============================================================
-- TRIGGER 3: Auto-update reputation when trade COMPLETED
-- Atomically increments reputation for both buyer and seller.
-- Only fires on PENDING → COMPLETED transition.
-- =============================================================
CREATE OR REPLACE FUNCTION update_reputation_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_buyer_id  INTEGER;
    v_seller_id INTEGER;
BEGIN
    IF OLD.status = 'PENDING' AND NEW.status = 'COMPLETED' THEN
        -- Resolve user IDs from the linked orders
        SELECT user_id INTO v_buyer_id
            FROM orders WHERE id = NEW.buy_order_id;

        SELECT user_id INTO v_seller_id
            FROM orders WHERE id = NEW.sell_order_id;

        -- Increment reputation for both parties
        UPDATE users SET reputation = reputation + 1
            WHERE id IN (v_buyer_id, v_seller_id);

        RAISE NOTICE '[TradeFloor] Reputation updated: user % (buyer) and user % (seller) +1 each for trade %.',
            v_buyer_id, v_seller_id, NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reputation_on_complete ON trades;
CREATE TRIGGER trg_reputation_on_complete
    AFTER UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION update_reputation_on_completion();

COMMENT ON FUNCTION update_reputation_on_completion IS
    'Atomically increments reputation for buyer and seller when a trade is confirmed via release code exchange';

-- =============================================================
-- FUNCTION: expire_old_orders()
-- Mark ACTIVE orders past their expiry date as EXPIRED.
-- Called periodically (e.g., via a scheduled backend task).
-- =============================================================
CREATE OR REPLACE FUNCTION expire_old_orders()
RETURNS INTEGER   -- returns count of expired orders
LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE orders
    SET status = 'EXPIRED'
    WHERE status = 'ACTIVE'
      AND expires_at < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '[TradeFloor] Expired % stale orders.', v_count;
    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION expire_old_orders IS
    'Cleans up stale ACTIVE orders older than their expires_at timestamp; safe to call repeatedly';
