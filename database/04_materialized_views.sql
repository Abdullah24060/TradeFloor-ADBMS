-- =============================================================
-- TradeFloor  |  Script 04 — Materialized Views
-- Market Radar: aggregated order book depth per item
-- =============================================================

-- =============================================================
-- MATERIALIZED VIEW: order_book_depth
-- Purpose: fast, non-blocking reads of the live order book.
-- Updated via REFRESH MATERIALIZED VIEW CONCURRENTLY after each
-- trade (called inside match_order stored procedure).
--
-- Why materialized?
--   • The matching engine writes heavily; reads from a live query
--     would compete with write locks. A mat view decouples reads
--     from writes completely.
--   • CONCURRENTLY: readers see the previous snapshot while
--     refresh runs — zero downtime, zero blocking.
-- =============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS order_book_depth AS
SELECT
    i.id                    AS item_id,
    i.name                  AS item_name,
    i.category,
    o.order_type,
    o.price,
    SUM(o.quantity)         AS total_quantity,
    COUNT(*)                AS order_count,
    MIN(o.created_at)       AS oldest_order_at,
    MAX(o.created_at)       AS newest_order_at
FROM orders o
JOIN items  i ON i.id = o.item_id
WHERE o.status = 'ACTIVE'
GROUP BY
    i.id, i.name, i.category,
    o.order_type, o.price
ORDER BY
    i.id,
    o.order_type,
    CASE WHEN o.order_type = 'BUY'  THEN -o.price END DESC,  -- bids: highest first
    CASE WHEN o.order_type = 'SELL' THEN  o.price END ASC;   -- asks: lowest first

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_obd_unique
    ON order_book_depth (item_id, order_type, price);

COMMENT ON MATERIALIZED VIEW order_book_depth IS
    'Aggregated live order book per item. Refreshed CONCURRENTLY after every trade. '
    'Powers the Market Radar page — shows bids/asks without blocking write transactions.';

-- =============================================================
-- MATERIALIZED VIEW: trade_history_summary
-- Per-item trade summary: last price, 24h volume, trade count
-- Useful for the Market Radar "ticker" info beside the order book
-- =============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS trade_history_summary AS
SELECT
    o.item_id,
    i.name                          AS item_name,
    COUNT(t.id)                     AS total_trades,
    SUM(t.quantity)                 AS total_volume,
    AVG(t.price)::NUMERIC(12,2)     AS avg_price,
    MIN(t.price)                    AS min_price,
    MAX(t.price)                    AS max_price,
    -- Last trade price (most recent COMPLETED)
    (
        SELECT t2.price
        FROM trades t2
        JOIN orders buy_o  ON buy_o.id  = t2.buy_order_id
        WHERE buy_o.item_id = o.item_id
          AND t2.status = 'COMPLETED'
        ORDER BY t2.completed_at DESC
        LIMIT 1
    )                               AS last_trade_price,
    -- 24-hour volume
    SUM(CASE
        WHEN t.matched_at >= NOW() - INTERVAL '24 hours'
        THEN t.quantity ELSE 0
    END)                            AS volume_24h
FROM trades t
JOIN orders o ON o.id = t.buy_order_id   -- use buy side to get item_id
JOIN items  i ON i.id = o.item_id
WHERE t.status = 'COMPLETED'
GROUP BY o.item_id, i.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ths_unique
    ON trade_history_summary (item_id);

COMMENT ON MATERIALIZED VIEW trade_history_summary IS
    'Per-item completed trade statistics: avg price, volume, last trade. Refreshed after each trade completion.';
