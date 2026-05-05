-- =============================================================
-- TradeFloor  |  setup.sql — Master Setup Script
-- Run this ONCE as postgres superuser to create and fully
-- initialise the tradefloor database.
--
-- Usage:
--   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f setup.sql
-- =============================================================

-- Create the database (connect to default postgres db first)
\connect postgres

DROP DATABASE IF EXISTS tradefloor;
CREATE DATABASE tradefloor;

\connect tradefloor

-- Enable pgcrypto (required by matching engine)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Run scripts in dependency order
\i database/01_create_tables.sql
\i database/02_triggers_and_rules.sql
\i database/03_stored_procedures.sql
\i database/04_materialized_views.sql
\i database/05_permissions.sql
\i database/seed_data.sql

\echo '============================================='
\echo 'TradeFloor database setup complete!'
\echo 'Database: tradefloor'
\echo 'App role:  tf_app / tf_secure_pass_2026'
\echo '============================================='
