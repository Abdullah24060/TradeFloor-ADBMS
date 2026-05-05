# TradeFloor-ADBMS

TradeFloor is a campus marketplace trading platform built as an ADBMS project. It combines a PostgreSQL-backed matching engine with a FastAPI backend and a React frontend. Users can register, verify email, place BUY/SELL orders, and complete trades using release codes.

## Project Overview
- Purpose-built ADBMS showcase with full SQL design (schema, triggers, procedures, views)
- Backend API for authentication, order management, and trade settlement
- Frontend dashboard for browsing items, placing orders, and tracking trades

## Core Functionalities
- **User authentication** with email verification and JWT sessions
- **Order placement and matching** with BUY/SELL limit orders
- **Trade confirmation** using secure release codes
- **Market radar** showing live order book depth
- **Reputation updates** after successful trade completion

## Tech Stack
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL 18
- Frontend: React + Vite, Axios
- Database: SQL scripts + triggers + stored procedures

## Project Structure
- backend/  FastAPI app
- database/ SQL scripts (schema, triggers, procedures, views, permissions)
- frontend/ React app
