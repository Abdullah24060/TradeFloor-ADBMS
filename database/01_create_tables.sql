-- =============================================================
-- TradeFloor  |  Script 01 — Create Tables & Indexes
-- Run as: psql -U postgres -d postgres -f 01_create_tables.sql
-- =============================================================

-- ── Enable pgcrypto for cryptographically secure random values ──
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Create application database ───────────────────────────────
-- (Run from postgres database first, then reconnect)
-- If running standalone: uncomment below
-- CREATE DATABASE tradefloor;
-- \c tradefloor.

-- ── Create application role ───────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tf_app') THEN
        CREATE ROLE tf_app WITH LOGIN PASSWORD 'tf_secure_pass_2026';
    END IF;
END
$$;

-- =============================================================
-- TABLE: users
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,
    verify_token    VARCHAR(255),                           -- UUID token for email link
    token_expiry    TIMESTAMPTZ,                            -- token valid for 24 hours
    reputation      INTEGER         NOT NULL DEFAULT 0
                    CHECK (reputation >= 0),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users                IS 'ITU students registered on TradeFloor';
COMMENT ON COLUMN users.reputation     IS 'Increments only on COMPLETED trades — tamper-proof via stored procedure';
COMMENT ON COLUMN users.verify_token   IS 'One-time UUID sent in verification email; cleared after use';

-- =============================================================
-- TABLE: items
-- Represents tradeable goods/services. Users create items.
-- =============================================================
CREATE TABLE IF NOT EXISTS items (
    id          SERIAL          PRIMARY KEY,
    name        VARCHAR(200)    NOT NULL,
    description TEXT,
    category    VARCHAR(20)     NOT NULL
                CHECK (category IN ('textbook','ticket','electronics','service','other')),
    created_by  INTEGER         REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE items IS 'Catalogue of tradeable goods and services on campus';

-- =============================================================
-- TABLE: orders
-- The active order book — buy and sell limit orders
-- =============================================================
CREATE TABLE IF NOT EXISTS orders (
    id          SERIAL          PRIMARY KEY,
    user_id     INTEGER         NOT NULL REFERENCES users(id),
    item_id     INTEGER         NOT NULL REFERENCES items(id),
    order_type  VARCHAR(4)      NOT NULL CHECK (order_type IN ('BUY','SELL')),
    price       NUMERIC(12,2)   NOT NULL CHECK (price > 0),
    quantity    INTEGER         NOT NULL DEFAULT 1 CHECK (quantity > 0),
    status      VARCHAR(16)     NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE','FILLED','PARTIALLY_FILLED','CANCELLED','EXPIRED')),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ     NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

COMMENT ON TABLE  orders            IS 'Limit order book — all buy/sell orders with lifecycle tracking';
COMMENT ON COLUMN orders.order_type IS 'BUY = willing to buy at price; SELL = willing to sell at price';
COMMENT ON COLUMN orders.status     IS 'ACTIVE orders are eligible for matching; others are terminal states';

-- Composite index optimised for the matching engine query pattern:
-- "find ACTIVE orders for item X on opposite side within price range, ordered by best price then oldest first"
CREATE INDEX IF NOT EXISTS idx_orders_matching
    ON orders (item_id, order_type, price, created_at)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_orders_user
    ON orders (user_id, status);

-- =============================================================
-- TABLE: trades
-- Append-only trade ledger — immutable once inserted
-- UPDATE is tightly restricted by trigger (see 02_triggers_and_rules.sql)
-- =============================================================
CREATE TABLE IF NOT EXISTS trades (
    id              SERIAL          PRIMARY KEY,
    buy_order_id    INTEGER         NOT NULL REFERENCES orders(id),
    sell_order_id   INTEGER         NOT NULL REFERENCES orders(id),
    quantity        INTEGER         NOT NULL CHECK (quantity > 0),
    price           NUMERIC(12,2)   NOT NULL CHECK (price > 0),
    status          VARCHAR(10)     NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','COMPLETED','DISPUTED')),
    -- release_code is the 6-digit physical settlement code shown only to the buyer.
    -- Stored as plain text here for display; in higher-security systems, store hashed.
    release_code    VARCHAR(6)      NOT NULL,
    matched_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ                             -- set when status → COMPLETED
);

COMMENT ON TABLE  trades              IS 'Append-only trade ledger. No DELETE ever; UPDATE only PENDING→COMPLETED via trigger.';
COMMENT ON COLUMN trades.release_code IS '6-digit code generated by pgcrypto; shown only to buyer for physical settlement';
COMMENT ON COLUMN trades.status       IS 'PENDING = matched, awaiting physical meetup; COMPLETED = release code exchanged';

CREATE INDEX IF NOT EXISTS idx_trades_buy_order  ON trades (buy_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_sell_order ON trades (sell_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_status     ON trades (status) WHERE status = 'PENDING';

-- =============================================================
-- TABLE: reviews
-- Post-trade peer reviews. One review per (trade, reviewer).
-- Both buyer and seller can leave a review about the other party.
-- =============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id              SERIAL          PRIMARY KEY,
    trade_id        INTEGER         NOT NULL REFERENCES trades(id),
    reviewer_id     INTEGER         NOT NULL REFERENCES users(id),
    reviewee_id     INTEGER         NOT NULL REFERENCES users(id),
    rating          SMALLINT        NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_review_per_trade_reviewer UNIQUE (trade_id, reviewer_id)
);

COMMENT ON TABLE  reviews              IS 'Post-trade peer reviews. One per reviewer per trade. Rating 1–5.';
COMMENT ON COLUMN reviews.reviewer_id  IS 'User who wrote the review.';
COMMENT ON COLUMN reviews.reviewee_id  IS 'User being reviewed (the counterparty).';

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews (reviewee_id);
