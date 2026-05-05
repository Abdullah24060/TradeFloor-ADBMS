-- =============================================================
-- TradeFloor | seed_items_only.sql
-- Seeds ONLY the items catalogue (no users, no orders).
-- Run this after 08_nuclear_reset.sql to restore the item list.
-- created_by = NULL (no owner) — items are platform-owned.
-- =============================================================

INSERT INTO items (name, description, category, created_by) VALUES
('Calculus by Stewart (8th Ed)',   'Standard calculus textbook, good condition',    'textbook',    NULL),
('Discrete Mathematics by Rosen',  'Slightly highlighted, all chapters intact',     'textbook',    NULL),
('Linear Algebra by Lay',          'Brand new, still in plastic wrap',              'textbook',    NULL),
('ITU Sports Day Ticket',          'Access to all events on Sports Day 2026',       'ticket',      NULL),
('ITU Annual Gala Ticket',         'Single entry pass for gala dinner',             'ticket',      NULL),
('HP Laptop Charger (65W USB-C)', 'Compatible with HP Pavilion/Spectre series',    'electronics', NULL),
('Scientific Calculator FX-991',  'Casio FX-991ES Plus, barely used',              'electronics', NULL),
('USB-C Hub (7-in-1)',             'Multi-port hub, 4K HDMI + 3x USB3',            'electronics', NULL),
('Python Tutoring Session (1hr)', 'Advanced Python, data structures, algos',       'service',     NULL),
('Essay Proofreading Service',    'Native-level English editing for assignments',  'service',     NULL)
ON CONFLICT DO NOTHING;

SELECT id, name, category FROM items ORDER BY id;
