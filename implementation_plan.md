# TradeFloor — Complete Implementation Plan (Step 0 → Deployment)

## System Inventory (Confirmed on Your Machine)

| Tool | Version | Status |
|------|---------|--------|
| PostgreSQL | 18.3 | ✅ Installed & Running (`postgresql-x64-18` service) |
| Python | 3.13.6 | ✅ |
| Node.js | v22.20.0 | ✅ |
| npm | 10.9.3 | ✅ |
| pip | 25.3 | ✅ |

> [!WARNING]
> `psql` is NOT on your PATH. It exists at `C:\Program Files\PostgreSQL\18\bin\psql.exe`. We'll fix this in Step 0.

---

## (DONE) Step 0 — Environment Setup & PATH Fix

### (DONE) 0.1 Add PostgreSQL to PATH
Add `C:\Program Files\PostgreSQL\18\bin` to your system PATH so `psql` works from any terminal.

### (DONE) 0.2 Project Folder Structure
```
d:\Antigravity_Coding\ADBMS_4th_sem\Project\
├── backend/                 # FastAPI Python backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI app entry point
│   │   ├── config.py        # DB URL, JWT secret, email config
│   │   ├── database.py      # async SQLAlchemy engine + session
│   │   ├── models.py        # SQLAlchemy ORM models
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── auth.py          # JWT token creation & verification
│   │   ├── dependencies.py  # get_current_user, get_db
│   │   └── routers/
│   │       ├── users.py     # register, login, verify-email, profile
│   │       ├── orders.py    # place order, cancel order, my orders
│   │       ├── trades.py    # pending trades, confirm trade (release code)
│   │       └── market.py    # market radar (order book depth)
│   ├── requirements.txt
│   └── .env                 # local secrets (not committed)
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── api/             # axios instance + API helpers
│   │   ├── context/         # AuthContext (JWT state)
│   │   ├── pages/           # Login, Register, Dashboard, MarketRadar, MyOrders, MyTrades
│   │   └── components/      # OrderBook, OrderForm, TradeCard, Navbar, etc.
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── database/                # Pure SQL scripts (showcase for ADBMS)
│   ├── 01_create_tables.sql
│   ├── 02_triggers_and_rules.sql
│   ├── 03_stored_procedures.sql
│   ├── 04_materialized_views.sql
│   ├── 05_permissions.sql
│   └── seed_data.sql
└── planning.md
```

### (DONE) 0.3 Install Python Dependencies
```
pip install fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg psycopg2-binary \
            pydantic pydantic-settings python-jose[cryptography] passlib[bcrypt] \
            python-multipart aiosmtplib email-validator jinja2
```

### (DONE) 0.4 Create React Frontend (Vite)
```
npx -y create-vite@latest frontend -- --template react
cd frontend && npm install
npm install axios react-router-dom
```

Completed package install output:
```text
frontend@0.0.0 D:\Antigravity_Coding\ADBMS_4th_sem\Project\frontend
├── axios@1.15.2
├── react-dom@19.2.5
├── react-router-dom@7.14.2
└── react@19.2.5
```

✅ **Status:** All React components and pages fully implemented:
- ✅ src/main.jsx, App.jsx, index.css (style system complete)
- ✅ 9 pages: Landing, Register, Login, VerifyEmail, Dashboard, MarketRadar, MyOrders, MyTrades, BrowseItems
- ✅ Components: Navbar, AuthContext (JWT state management)
- ✅ api/axios.js (HTTP client with JWT interceptor)
- ✅ All dependencies installed and verified

---

## (DONE) Step 1 — PostgreSQL Database Setup (The ADBMS Core)

> [!IMPORTANT]
> This is the most critical part of your project. All SQL lives in the `database/` folder as standalone `.sql` files you can show your professor.

### (DONE) 1.1 Create Database & Roles — `01_create_tables.sql`

```sql
-- Run as superuser (postgres)
CREATE DATABASE tradefloor;
\c tradefloor

-- Application role (limited privileges)
CREATE ROLE tf_app WITH LOGIN PASSWORD 'tf_secure_pass_2026';

-- TABLES
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    is_verified   BOOLEAN       DEFAULT FALSE,
    verify_token  VARCHAR(255),
    token_expiry  TIMESTAMPTZ,
    reputation    INTEGER       DEFAULT 0,
    created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE items (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200)  NOT NULL,
    description TEXT,
    category    VARCHAR(50)   NOT NULL
                CHECK (category IN ('textbook','ticket','electronics','service','other')),
    created_by  INTEGER       REFERENCES users(id),
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE orders (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER       NOT NULL REFERENCES users(id),
    item_id    INTEGER       NOT NULL REFERENCES items(id),
    order_type VARCHAR(4)    NOT NULL CHECK (order_type IN ('BUY','SELL')),
    price      NUMERIC(12,2) NOT NULL CHECK (price > 0),
    quantity   INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
    status     VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE'
               CHECK (status IN ('ACTIVE','FILLED','PARTIALLY_FILLED','CANCELLED','EXPIRED')),
    created_at TIMESTAMPTZ   DEFAULT NOW(),
    expires_at TIMESTAMPTZ   DEFAULT (NOW() + INTERVAL '7 days')
);
CREATE INDEX idx_orders_matching ON orders (item_id, order_type, price, created_at)
    WHERE status = 'ACTIVE';

CREATE TABLE trades (
    id             SERIAL PRIMARY KEY,
    buy_order_id   INTEGER       NOT NULL REFERENCES orders(id),
    sell_order_id  INTEGER       NOT NULL REFERENCES orders(id),
    quantity       INTEGER       NOT NULL,
    price          NUMERIC(12,2) NOT NULL,
    status         VARCHAR(10)   NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','COMPLETED','DISPUTED')),
    release_code   VARCHAR(6)    NOT NULL,
    matched_at     TIMESTAMPTZ   DEFAULT NOW(),
    completed_at   TIMESTAMPTZ
);
```

### (DONE) 1.2 Append-Only Trigger & Rules — `02_triggers_and_rules.sql`

```sql
-- Prevent DELETE on trades (append-only ledger)
CREATE OR REPLACE FUNCTION prevent_trade_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'trades table is append-only: DELETE is forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_delete_trades
    BEFORE DELETE ON trades
    FOR EACH ROW EXECUTE FUNCTION prevent_trade_delete();

-- Prevent UPDATE on trades except status PENDING → COMPLETED
CREATE OR REPLACE FUNCTION restrict_trade_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != 'PENDING' THEN
        RAISE EXCEPTION 'Cannot modify a trade that is not PENDING';
    END IF;
    IF NEW.status NOT IN ('COMPLETED', 'DISPUTED') THEN
        RAISE EXCEPTION 'Trade can only move to COMPLETED or DISPUTED';
    END IF;
    -- Only allow status and completed_at to change
    IF NEW.buy_order_id != OLD.buy_order_id OR NEW.sell_order_id != OLD.sell_order_id
       OR NEW.price != OLD.price OR NEW.quantity != OLD.quantity
       OR NEW.release_code != OLD.release_code THEN
        RAISE EXCEPTION 'Only status and completed_at may be updated on trades';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restrict_trade_update
    BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION restrict_trade_update();

-- Auto-expire old orders
CREATE OR REPLACE FUNCTION expire_old_orders()
RETURNS void AS $$
BEGIN
    UPDATE orders SET status = 'EXPIRED'
    WHERE status = 'ACTIVE' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

### (DONE) 1.3 Matching Engine Stored Procedure — `03_stored_procedures.sql`

```sql
CREATE OR REPLACE FUNCTION match_order(p_order_id INTEGER)
RETURNS TABLE(trade_id INTEGER, matched_price NUMERIC, matched_qty INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
    v_order       RECORD;
    v_match       RECORD;
    v_remaining   INTEGER;
    v_trade_qty   INTEGER;
    v_code        VARCHAR(6);
BEGIN
    -- Fetch the incoming order
    SELECT * INTO v_order FROM orders WHERE id = p_order_id AND status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found or not active', p_order_id;
    END IF;

    v_remaining := v_order.quantity;

    -- Find matching orders on the opposite side
    -- BUY order → find cheapest SELL; SELL order → find highest BUY
    FOR v_match IN
        SELECT o.*
        FROM orders o
        WHERE o.item_id = v_order.item_id
          AND o.status = 'ACTIVE'
          AND o.order_type != v_order.order_type
          AND o.user_id != v_order.user_id
          AND CASE
                WHEN v_order.order_type = 'BUY'  THEN o.price <= v_order.price
                WHEN v_order.order_type = 'SELL' THEN o.price >= v_order.price
              END
        ORDER BY
            CASE WHEN v_order.order_type = 'BUY' THEN o.price END ASC,
            CASE WHEN v_order.order_type = 'SELL' THEN o.price END DESC,
            o.created_at ASC
        FOR UPDATE SKIP LOCKED
    LOOP
        EXIT WHEN v_remaining <= 0;

        v_trade_qty := LEAST(v_remaining, v_match.quantity);
        v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

        INSERT INTO trades (buy_order_id, sell_order_id, quantity, price, release_code)
        VALUES (
            CASE WHEN v_order.order_type = 'BUY'  THEN v_order.id ELSE v_match.id END,
            CASE WHEN v_order.order_type = 'SELL' THEN v_order.id ELSE v_match.id END,
            v_trade_qty,
            v_match.price,
            v_code
        )
        RETURNING trades.id, trades.price, trades.quantity
            INTO trade_id, matched_price, matched_qty;

        RETURN NEXT;

        -- Update matched order quantity/status
        IF v_match.quantity = v_trade_qty THEN
            UPDATE orders SET status = 'FILLED' WHERE id = v_match.id;
        ELSE
            UPDATE orders SET quantity = quantity - v_trade_qty,
                              status = 'PARTIALLY_FILLED'
            WHERE id = v_match.id;
        END IF;

        v_remaining := v_remaining - v_trade_qty;
    END LOOP;

    -- Update the incoming order
    IF v_remaining = 0 THEN
        UPDATE orders SET status = 'FILLED' WHERE id = v_order.id;
    ELSIF v_remaining < v_order.quantity THEN
        UPDATE orders SET quantity = v_remaining, status = 'PARTIALLY_FILLED'
        WHERE id = v_order.id;
    END IF;

    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY order_book_depth;

    RETURN;
END;
$$;
```

### (DONE) 1.4 Materialized View — `04_materialized_views.sql`

```sql
CREATE MATERIALIZED VIEW order_book_depth AS
SELECT
    i.id         AS item_id,
    i.name       AS item_name,
    i.category,
    o.order_type,
    o.price,
    SUM(o.quantity) AS total_quantity,
    COUNT(*)        AS order_count
FROM orders o
JOIN items i ON i.id = o.item_id
WHERE o.status = 'ACTIVE'
GROUP BY i.id, i.name, i.category, o.order_type, o.price
ORDER BY i.id, o.order_type, o.price;

CREATE UNIQUE INDEX idx_obd_unique
    ON order_book_depth (item_id, order_type, price);
```

### (DONE) 1.5 Permissions — `05_permissions.sql`

```sql
GRANT CONNECT ON DATABASE tradefloor TO tf_app;
GRANT USAGE ON SCHEMA public TO tf_app;
GRANT SELECT, INSERT, UPDATE ON users, orders, items TO tf_app;
GRANT SELECT, INSERT ON trades TO tf_app;     -- No UPDATE/DELETE from app role
GRANT UPDATE (status, completed_at) ON trades TO tf_app;  -- Only these columns
GRANT SELECT ON order_book_depth TO tf_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tf_app;
GRANT EXECUTE ON FUNCTION match_order(INTEGER) TO tf_app;
GRANT EXECUTE ON FUNCTION expire_old_orders() TO tf_app;
```

---

## (DONE) Step 2 — Backend: FastAPI Application

### (DONE) 2.1 Key Files

| File | Purpose |
|------|---------|
| `config.py` | Reads `.env` for `DATABASE_URL`, `JWT_SECRET`, `SMTP_*` settings |
| `database.py` | `create_async_engine` + `async_sessionmaker` using `asyncpg` |
| `models.py` | SQLAlchemy ORM models mirroring the SQL tables |
| `schemas.py` | Pydantic models for request validation & response serialization |
| `auth.py` | `create_access_token()`, `verify_token()` using `python-jose` + `passlib` for bcrypt hashing |
| `dependencies.py` | `get_db` (yield session), `get_current_user` (decode JWT from `Authorization` header) |
| `routers/users.py` | `POST /register`, `POST /login`, `GET /verify-email/{token}`, `GET /me` |
| `routers/orders.py` | `POST /orders` (place + auto-match), `DELETE /orders/{id}` (cancel), `GET /orders/mine` |
| `routers/trades.py` | `GET /trades/pending`, `POST /trades/{id}/confirm` (validate release code) |
| `routers/market.py` | `GET /market/radar?item_id=` (query materialized view) |

### (DONE) 2.2 Core API Flows

**(DONE) Registration + Email Verification:**
1. `POST /register` → validate `@itu.edu.pk` email → hash password → store user with `is_verified=False` → generate UUID token → send verification email → return success
2. Email contains link: `http://localhost:5173/verify?token=<uuid>`
3. Frontend hits `GET /api/verify-email/{token}` → backend marks `is_verified=True`

**(DONE) Email Sending (Local Dev):**
- Use Python's `aiosmtplib` with a **free SMTP provider** for dev:
  - **Option A (Recommended for local):** Use [Mailtrap](https://mailtrap.io) free tier — catches emails in a sandbox inbox, no real email sent. Perfect for testing.
  - **Option B (Production/AWS):** Amazon SES via SMTP — 62,000 free emails/month from EC2.
- The `.env` file holds `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — swap between Mailtrap and SES by changing these values.

**(DONE) Order Placement + Matching:**
1. `POST /orders` → insert order → call `SELECT * FROM match_order(new_order_id)` inside a `SERIALIZABLE` transaction
2. If matches found → return trade details (buyer sees release code)
3. If no match → order sits in book, visible on Market Radar

**(DONE) Trade Confirmation (Release Code):**
1. `POST /trades/{id}/confirm` with `{ "release_code": "482910" }`
2. Backend checks: trade belongs to seller, status is PENDING, code matches
3. If valid → `UPDATE trades SET status='COMPLETED', completed_at=NOW()` → increment both users' reputation

### 2.3 Running Locally
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
API docs auto-available at `http://localhost:8000/docs` (Swagger UI).

---

## (DONE) Step 3 — Frontend: React + Vite

### (DONE) 3.1 Pages

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Hero section, call-to-action |
| Register | `/register` | Name, email (@itu.edu.pk enforced), password |
| Login | `/login` | Email + password → JWT stored in localStorage |
| Email Verify | `/verify` | Reads `?token=` and calls backend |
| Dashboard | `/dashboard` | Overview: active orders, pending trades, reputation |
| Market Radar | `/market` | Live order book per item — bids/asks visualization |
| Place Order | `/market/:itemId/order` | Form to submit BUY or SELL limit order |
| My Orders | `/orders` | List of user's orders with cancel option |
| My Trades | `/trades` | Pending & completed trades; release code display (buyer) / confirm input (seller) |
| Browse Items | `/items` | Grid of all items with category filter; create new item |

### (DONE) 3.2 Key Frontend Features
- **AuthContext** wraps app; stores JWT, exposes `login()`, `logout()`, `user` object
- **Axios interceptor** attaches `Authorization: Bearer <token>` to every request
- **Market Radar** polls `GET /market/radar` every 5 seconds — shows bid/ask depth as a table/bar chart
- **Real-time feel** without WebSockets (simple polling; WebSockets can be added later)
- **Premium UI** with dark mode, glassmorphism cards, smooth transitions, Inter/Outfit font

### (DONE) 3.3 Running Locally
```bash
cd frontend
npm run dev    # → http://localhost:5173
```
Vite proxy config to forward `/api/*` to `http://localhost:8000`.

---

## (DONE) Step 4 — Local Integration Testing

✅ **All manual integration tests verified:**
1. **Start PostgreSQL** (already running as Windows service)
2. **Run SQL scripts** in order: `01` → `02` → `03` → `04` → `05` → `seed_data.sql`
3. **Start backend:** `uvicorn app.main:app --reload --port 8000`
4. **Start frontend:** `npm run dev` (port 5173)
5. **Tests completed successfully:**
   - ✅ Register two users with `@itu.edu.pk` emails
   - ✅ User A posts a SELL order for "Calculus Textbook" at PKR 1500
   - ✅ User B posts a BUY order at PKR 1500 → auto-match → trade created
   - ✅ User B sees release code → User A enters it → trade completes → reputation increments
   - ✅ Order cancellation working (permission fix applied)
   - ✅ Materialized view refresh working with SECURITY DEFINER helper
6. **Concurrency test:** Python script with `httpx.AsyncClient` sending 50 simultaneous BUY orders against 1 SELL order — only 1 trade should succeed

---

## 🟨 Step 5 — Concurrency Stress Test Script (OPTIONAL - NICE TO HAVE)

A standalone `tests/concurrency_test.py`:
- Creates 1 sell order (qty=1)
- Fires 50 concurrent buy orders using `asyncio.gather`
- Asserts exactly 1 trade is created
- Prints lock statistics from `pg_stat_activity`

> Note: Manual concurrency testing verified working. Automated suite can be added for production readiness.

---

## 🟨 Step 6 — Prepare for AWS Deployment (IN PROGRESS)

### 6.1 What You'll Use on AWS
- **1x EC2 Instance** (t2.micro or t3.micro — free tier eligible)
- **Amazon SES** for email (free from EC2)
- That's it. No RDS, no S3, no Lambda.

### 6.2 What Runs on the EC2 Instance
| Component | How |
|-----------|-----|
| PostgreSQL 18 | Installed directly on EC2 (apt install) |
| FastAPI backend | Run via `uvicorn` behind `systemd` |
| React frontend | `npm run build` → static files served by **Nginx** |
| Nginx | Reverse proxy: serves frontend + proxies `/api/*` to uvicorn |

### 6.3 Files to Upload to EC2
```
backend/           → /home/ubuntu/tradefloor/backend/
database/          → /home/ubuntu/tradefloor/database/
frontend/dist/     → /var/www/tradefloor/        (built static files)
```

---

## Step 7 — AWS EC2 Setup (Step-by-Step)

### 7.1 Launch EC2
1. Go to AWS Console → EC2 → Launch Instance
2. **AMI:** Ubuntu 24.04 LTS (free tier)
3. **Instance type:** t3.micro
4. **Key pair:** Create new → download `.pem` file
5. **Security group:** Allow inbound ports: `22` (SSH), `80` (HTTP), `443` (HTTPS)
6. Launch

### 7.2 Connect & Install Software
```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# System updates
sudo apt update && sudo apt upgrade -y

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql

# Python
sudo apt install -y python3 python3-pip python3-venv

# Node.js (for building frontend if needed)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 7.3 Setup Database on EC2
```bash
sudo -u postgres psql
CREATE DATABASE tradefloor;
CREATE ROLE tf_app WITH LOGIN PASSWORD 'your_secure_password';
\c tradefloor
\i /home/ubuntu/tradefloor/database/01_create_tables.sql
\i /home/ubuntu/tradefloor/database/02_triggers_and_rules.sql
\i /home/ubuntu/tradefloor/database/03_stored_procedures.sql
\i /home/ubuntu/tradefloor/database/04_materialized_views.sql
\i /home/ubuntu/tradefloor/database/05_permissions.sql
```

### 7.4 Deploy Backend
```bash
cd /home/ubuntu/tradefloor/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env with production values
# DATABASE_URL=postgresql+asyncpg://tf_app:password@localhost/tradefloor
# JWT_SECRET=<random-64-char-string>
# SMTP config for SES
```

Create a `systemd` service file `/etc/systemd/system/tradefloor.service`:
```ini
[Unit]
Description=TradeFloor FastAPI
After=network.target postgresql.service

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/tradefloor/backend
ExecStart=/home/ubuntu/tradefloor/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

### 7.5 Deploy Frontend
Build locally, then upload:
```bash
# On your laptop
cd frontend && npm run build   # creates frontend/dist/

# Upload to EC2
scp -i your-key.pem -r frontend/dist/* ubuntu@<IP>:/var/www/tradefloor/
```

### 7.6 Nginx Config
```nginx
server {
    listen 80;
    server_name <EC2_PUBLIC_IP>;

    root /var/www/tradefloor;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA routing
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 7.7 Setup Amazon SES for Email
1. Go to AWS Console → SES → Verify a sender email (e.g., `noreply@tradefloor.app` or your personal email)
2. In sandbox mode: also verify recipient emails for testing
3. Get SMTP credentials from SES console
4. Update backend `.env` with SES SMTP host/port/user/pass
5. Request production access when ready to send to any `@itu.edu.pk`

---

## Step 8 — Go Live Checklist

- [ ] EC2 instance running, SSH accessible
- [ ] PostgreSQL running on EC2 with all schemas loaded
- [ ] Backend running via systemd, accessible at `:8000`
- [ ] Frontend built and served by Nginx on port 80
- [ ] Nginx proxying `/api/*` to backend
- [ ] SES sending verification emails
- [ ] Test full flow: register → verify email → login → place order → match → confirm trade
- [ ] Concurrency test passes on EC2

---

## Step 9 — Execution Order (What We Build First) (Almost DONE)

| Phase | What | Est. Time |
|-------|------|-----------|
| **(DONE) Phase 1** | Database SQL scripts (all 5 files) | First |
| **(DONE) Phase 2** | Backend FastAPI (auth + CRUD + matching endpoint) | Second |
| **(DONE) Phase 3** | Frontend React (all pages + premium UI) | Third |
| **(DONE) Phase 4** | Local integration testing + manual verification | Fourth |
| **🟨 Phase 5** | AWS EC2 deployment (pending) | Last |

---

## Step 10 — What Needs to Be Installed (Summary)

### On Your Laptop (New Installs)
| Package | Install Command | Purpose |
|---------|----------------|---------|
| FastAPI + deps | `pip install fastapi uvicorn[standard] ...` (see Step 0.3) | Backend framework |
| Vite + React | `npx -y create-vite@latest` | Frontend scaffold |
| axios, react-router-dom | `npm install axios react-router-dom` | Frontend HTTP + routing |

### On AWS EC2 (Fresh Ubuntu)
| Package | Install Command |
|---------|----------------|
| PostgreSQL | `sudo apt install postgresql postgresql-contrib` |
| Python 3 + venv | `sudo apt install python3 python3-pip python3-venv` |
| Node.js 22 | `curl nodesource script + sudo apt install nodejs` |
| Nginx | `sudo apt install nginx` |

> [!NOTE]
> You do NOT need AWS RDS, S3, Lambda, or any managed database. Everything runs on your single EC2 instance with PostgreSQL installed directly on it — exactly as required for an ADBMS project where you control the database yourself.

---

## Open Questions

> [!IMPORTANT]
> **1. PostgreSQL superuser password:** Do you remember the password you set for the `postgres` user during PostgreSQL 18 installation? We need it to create the `tradefloor` database.

> [!IMPORTANT]
> **2. Email testing approach:** For local development, I recommend **Mailtrap** (free, no real emails sent — just catches them in a web inbox). For AWS production, we'll use **Amazon SES**. Are you okay with this approach, or do you want to skip email verification entirely for now and add it later?

> [!IMPORTANT]
> **3. Domain name:** Will you access the deployed app via the raw EC2 IP address (e.g., `http://3.110.45.67`), or do you have a domain name? A domain is optional but needed if you want HTTPS.
