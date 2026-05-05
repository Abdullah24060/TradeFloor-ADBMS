-- =============================================================
-- TradeFloor | Script 07 — Remove test user bsai24060
-- Strategy: anonymise + soft-delete (trades must keep order refs)
-- After this, bsai24060@itu.edu.pk can register again as a fresh user.
-- =============================================================

-- Step 1: Cancel all ACTIVE orders (no trades)
UPDATE orders
SET status = 'CANCELLED'
WHERE user_id = 1
  AND status IN ('ACTIVE', 'PARTIALLY_FILLED');

-- Step 2: Anonymise the user record
-- (Can't hard-delete because FILLED orders are referenced by trades)
-- Change email so the real address is free to register again
UPDATE users
SET name          = '[Deleted User]',
    email         = 'deleted_user_1@tradefloor.internal',
    password_hash = 'DELETED',
    is_verified   = FALSE,
    verify_token  = NULL,
    token_expiry  = NULL,
    batch         = NULL,
    degree        = NULL
WHERE id = 1;

-- Step 3: Mark any PENDING trades involving this user as DISPUTED
UPDATE trades
SET status = 'DISPUTED'
WHERE status = 'PENDING'
  AND (
    buy_order_id  IN (SELECT id FROM orders WHERE user_id = 1) OR
    sell_order_id IN (SELECT id FROM orders WHERE user_id = 1)
  );

-- Step 4: Nullify their item ownerships
UPDATE items SET created_by = NULL WHERE created_by = 1;

-- Confirm result
SELECT id, name, email, is_verified FROM users ORDER BY id;
SELECT COUNT(*) AS remaining_active_orders FROM orders WHERE user_id = 1 AND status = 'ACTIVE';
