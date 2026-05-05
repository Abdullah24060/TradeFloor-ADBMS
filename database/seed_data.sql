-- =============================================================
-- TradeFloor  |  seed_data.sql — Sample Data for Local Testing
-- Creates 4 test users, 10 items across all categories,
-- and a few open orders to populate the Market Radar
-- =============================================================

-- ── Test Users ────────────────────────────────────────────────
-- Passwords are all "Test@1234" — hashed via bcrypt externally.
-- For seeding we store a placeholder; actual hashes generated
-- by the backend at registration time.
-- These users are pre-verified (is_verified = TRUE) for quick testing.
INSERT INTO users (name, email, password_hash, is_verified, reputation) VALUES
('Abdul (You)',     'bsai24060@itu.edu.pk',  '$2b$12$placeholder_hash_1', TRUE, 5),
('Ali Raza',        'ali.test@itu.edu.pk',   '$2b$12$placeholder_hash_2', TRUE, 3),
('Sara Khan',       'sara.test@itu.edu.pk',  '$2b$12$placeholder_hash_3', TRUE, 7),
('Omar Sheikh',     'omar.test@itu.edu.pk',  '$2b$12$placeholder_hash_4', TRUE, 1)
ON CONFLICT (email) DO NOTHING;

-- ── Items ─────────────────────────────────────────────────────
INSERT INTO items (name, description, category, created_by) VALUES
('Calculus by Stewart (8th Ed)',   'Standard calculus textbook, good condition',   'textbook',    1),
('Discrete Mathematics by Rosen',  'Slightly highlighted, all chapters intact',    'textbook',    2),
('Linear Algebra by Lay',          'Brand new, still in plastic wrap',             'textbook',    1),
('ITU Sports Day Ticket',          'Access to all events on Sports Day 2026',      'ticket',      3),
('ITU Annual Gala Ticket',         'Single entry pass for gala dinner',            'ticket',      4),
('HP Laptop Charger (65W USB-C)', 'Compatible with HP Pavilion/Spectre series',   'electronics', 2),
('Scientific Calculator FX-991',  'Casio FX-991ES Plus, barely used',             'electronics', 3),
('USB-C Hub (7-in-1)',             'Multi-port hub, 4K HDMI + 3x USB3',           'electronics', 1),
('Python Tutoring Session (1hr)', 'Advanced Python, data structures, algos',      'service',     4),
('Essay Proofreading Service',    'Native-level English editing for assignments', 'service',     3)
ON CONFLICT DO NOTHING;

-- ── Open Orders (Market Radar seed) ──────────────────────────
-- Item 1: Calculus textbook — active order book
INSERT INTO orders (user_id, item_id, order_type, price, quantity, status) VALUES
-- SELL side (asks) — sorted lowest to highest
(2, 1, 'SELL', 1500.00, 1, 'ACTIVE'),
(3, 1, 'SELL', 1550.00, 1, 'ACTIVE'),
(4, 1, 'SELL', 1600.00, 2, 'ACTIVE'),
-- BUY side (bids) — sorted highest to lowest
(1, 1, 'BUY',  1400.00, 1, 'ACTIVE'),
(3, 1, 'BUY',  1350.00, 1, 'ACTIVE');

-- Item 2: Discrete Mathematics
INSERT INTO orders (user_id, item_id, order_type, price, quantity, status) VALUES
(1, 2, 'SELL', 900.00,  1, 'ACTIVE'),
(4, 2, 'BUY',  800.00,  1, 'ACTIVE'),
(2, 2, 'BUY',  850.00,  1, 'ACTIVE');

-- Item 4: Sports Day Ticket (high demand)
INSERT INTO orders (user_id, item_id, order_type, price, quantity, status) VALUES
(3, 4, 'SELL', 500.00, 3, 'ACTIVE'),
(1, 4, 'BUY',  450.00, 1, 'ACTIVE'),
(2, 4, 'BUY',  480.00, 1, 'ACTIVE'),
(4, 4, 'BUY',  500.00, 1, 'ACTIVE');  -- This BUY matches the SELL at 500

-- Item 7: Scientific Calculator
INSERT INTO orders (user_id, item_id, order_type, price, quantity, status) VALUES
(2, 7, 'SELL', 2200.00, 1, 'ACTIVE'),
(4, 7, 'SELL', 2100.00, 1, 'ACTIVE'),
(1, 7, 'BUY',  1900.00, 1, 'ACTIVE');

-- ── Refresh views after seed ──────────────────────────────────
REFRESH MATERIALIZED VIEW order_book_depth;

-- NOTE: The BUY order for Sports Day Ticket at 500 == SELL at 500.
-- Run the matching engine to see it execute:
-- SELECT * FROM match_order(<the buy order id at 500>);
-- You should see 1 trade created with a pgcrypto release code.
