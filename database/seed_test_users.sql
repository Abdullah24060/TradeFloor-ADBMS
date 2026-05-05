-- =============================================================
-- TradeFloor | seed_test_users.sql
-- 3 test users with real bcrypt hashes (password: Test@1234)
-- All pre-verified for immediate testing.
-- Run AFTER 08_nuclear_reset.sql + seed_items_only.sql
-- =============================================================

INSERT INTO users (name, email, password_hash, is_verified, reputation, batch, degree) VALUES
('Ali Raza',    'ali.test@itu.edu.pk',   '$2b$12$z7wcGNUoquJCFacM.JV8oOsBGLv.R37GVPdcLA1ObEqnKQYsMG.kq', TRUE, 0, 'BSAI-2024', 'BS Artificial Intelligence'),
('Sara Khan',   'sara.test@itu.edu.pk',  '$2b$12$8SupDPCgAKFNdl4.V1YfnOG4oncGGJ988L7xbJfGe.n8Oia0tMzUK', TRUE, 0, 'BSCS-2023', 'BS Computer Science'),
('Omar Sheikh', 'omar.test@itu.edu.pk',  '$2b$12$aCwx2hX./LiDirL/bUAX6.fgqeP2IoDYgBJIyu7N7DsIgvtn.Y/0e', TRUE, 0, 'BSSE-2024', 'BS Software Engineering')
ON CONFLICT (email) DO NOTHING;

-- Confirm
SELECT id, name, email, batch, degree, is_verified FROM users ORDER BY id;
