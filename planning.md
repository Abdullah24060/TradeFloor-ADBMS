# TradeFloor — A High-Concurrency Campus Micro-Economy Matching Engine

## Detailed Project Explanation

This document distills the complete concept, motivation, and technical design of **TradeFloor**, an advanced database project that applies the principles of a financial *Limit Order Book* to solve fundamental inefficiencies in campus peer-to-peer trading. The core innovation lies not in the application features themselves but in how deep database mechanisms — concurrency control, transactional integrity, and append‑only auditing — are woven into the engine to guarantee correctness under simultaneous multi‑user pressure.

---

## 1. The Problem: Three Compounding Inefficiencies

Campus trading (textbooks, event tickets, electronics, tutoring sessions) currently relies on unstructured channels like WhatsApp groups or physical notice boards. This creates:

1. **Price Opacity & Chaos**  
   Students have no reference price for any good or service. A seller does not know if PKR 1,500 for a calculus textbook is fair; a buyer cannot tell if they are overpaying. Every transaction is negotiated from zero, consistently disadvantaging the less informed party.

2. **Concurrency Failure & Double‑Promising**  
   When a desirable item appears — a limited event ticket, a cheap exam guide — multiple buyers attempt to claim it simultaneously. Without atomic reservation, the same item gets promised to several people. The seller then has to manually adjudicate, breaking trust and causing frustration.

3. **Trust Deficit**  
   No formal, verifiable reputation system exists among students. First‑time transactions between strangers are risky, which suppresses trade volume and discourages participation.

The result is a market that operates far below its potential: students overpay, undersell, or avoid trading altogether.

---

## 2. The Core Idea: A Limit Order Book for Campus Commerce

TradeFloor adapts the **Limit Order Book** — the engine behind stock exchanges like NASDAQ — to the campus micro‑economy. Instead of posting an item at a fixed price and hoping someone responds, users declare their **willingness to buy or sell at a specific price**.

- **Sell orders (asks):** “I will sell my Calculus textbook for PKR 1,500.”
- **Buy orders (bids):** “I am willing to buy a Calculus textbook for up to PKR 1,400.”

The system automatically **matches** compatible orders in real time. When a buy price meets or exceeds a sell price, a trade is executed. Orders that cannot be matched immediately rest in the order book until they find a counterpart, are cancelled, or expire. This mechanism creates **continuous, transparent price discovery** — every student can see live bids and asks on the **Market Radar**, instantly knowing the fair market price.

The innovation: **all the hard real‑time, concurrent logic lives inside the database itself**, not scattered across application code. This guarantees consistency even when hundreds of students act simultaneously.

---

## 3. Complete Functionality Breakdown

### 3.1 User Roles & Registration
- **Primary users:** ITU Lahore undergraduate and postgraduate students (buyers/sellers).
- **Secondary users:** Student organisations, campus vendors (cafes, printing shops) who can post recurring offers.
- **Tertiary stakeholders:** University administration as potential licensees.
- Each user has a **reputation score** that updates only after verified trades, building a trust footprint over time.

### 3.2 Order Placement
- A student opens the app and navigates to the **Market Radar** to see current bids and asks for any item.
- They place a **limit order**: a commitment to buy or sell a specific quantity at a stated price.
- The order is submitted to the backend and immediately processed by the database's matching engine.
- Orders have a lifecycle: **Active → Matched/Cancelled/Expired**.

### 3.3 The Market Radar (Live Order Book View)
- A materialized view or query shows **aggregated order book depth**: list of open buy orders (bids) sorted by price descending, and open sell orders (asks) sorted by price ascending.
- This view is refreshed after every trade, so read performance stays fast even under heavy write loads.
- Purpose: **complete price transparency** — any student can determine the fair market value of a textbook, ticket, or service before placing an order.

### 3.4 Matching Engine & Trade Execution
The heart of TradeFloor. Implemented as a **PL/pgSQL stored procedure** that runs atomically inside a database transaction.

**How a match is found:**
1. A new limit order arrives (e.g., a buy order at PKR 1,500 for a Calculus textbook).
2. The procedure searches the opposite side of the book (sell orders) for the best available price ≤ 1,500.
3. If a matching sell order exists, the engine **locks** those rows using `SELECT ... FOR UPDATE SKIP LOCKED`. This ensures no other concurrent transaction can claim the same sell order.
4. The trade is recorded, order quantities are decremented (or orders fully filled), and the matched sell order row is removed from the active book.

**Why `SKIP LOCKED`:**  
Instead of blocking other sessions, transactions that cannot lock a contested row simply skip it and look for the next available match. This allows **hundreds of parallel matching attempts to proceed without waiting** — non‑blocking concurrency.

**SERIALIZABLE isolation:**  
The transaction runs under `SERIALIZABLE` isolation level to prevent phantom reads and guarantee that no two trades can be created for the same inventory item. PostgreSQL will abort and retry if a serialization anomaly is detected, maintaining financial‑grade consistency.

### 3.5 The Confirmation Code (Physical Settlement)
TradeFloor separates **digital matching** from **physical exchange**. There is no online payment integration; cash is used in person.

1. Upon match, the trade record enters a `PENDING` state.
2. The system generates a unique **6‑digit Release Code** and delivers it **only to the buyer** (shown in app).
3. Buyer and seller arrange a campus meetup. Buyer inspects the item and hands over cash.
4. Once satisfied, buyer gives the **Release Code** to the seller.
5. Seller enters the code into their TradeFloor app.
6. The backend validates the code against the pending trade. If correct, the trade advances to `COMPLETED`.
7. Only then do **both parties’ reputation scores update**.

This mechanism ensures:
- No trade is marked complete until a physical meetup has actually occurred and both sides agreed.
- The ledger is 100% accurate; no phantom completed trades.
- Costs nothing to operate (no payment processor fees).

### 3.6 Reputation System
- A user’s reputation score increments upon a successfully completed trade.
- The score is transaction‑count‑based (or could incorporate ratings later) and is stored in the user profile.
- Because the trades table is append‑only and validation is atomic, reputation is **tamper‑proof** — it cannot be artificially inflated without a genuine trade going through the full code‑exchange flow.

### 3.7 Concurrency Handling in Detail
This is the project’s technical centerpiece:

| Challenge | Database Solution |
|-----------|-------------------|
| Double‑promising (multiple buyers claiming same sell order) | `SELECT FOR UPDATE SKIP LOCKED` locks the chosen sell order row; others skip to next available order. |
| Phantom reads (new orders appearing mid‑match) | `SERIALIZABLE` isolation level detects and prevents inconsistent reads. |
| Write contention on the live order book | Matching engine runs entirely inside a stored procedure; minimal round trips. |
| Read scalability under heavy market activity | Materialized view of the order book decouples reads from writes; refreshed post‑trade. |

### 3.8 Append‑Only Trade Ledger (Audit Trail)
- The `trades` table is designed with **database‑level rules** (`ON INSERT` only; no `UPDATE`/`DELETE` from application code).
- Every matched and completed trade is permanently recorded, creating a full, immutable audit trail.
- Even administrators cannot alter or delete a settled trade; this is enforced at the database, not the application layer.

### 3.9 Database Schema Highlights
- **users**: id, name, email, reputation_score, etc.
- **orders**: id, user_id, type (BUY/SELL), item_id, price, quantity, status, created_at.
- **trades**: id, buy_order_id, sell_order_id, status (PENDING, COMPLETED), release_code (hashed or stored securely), matched_at, completed_at. **Append‑only**.
- **items**: id, name, description, category (textbook, ticket, electronics, service, etc.).
- **Materialized view**: `order_book_depth` displaying aggregated bids/asks per item.

### 3.10 Market Radar & Price Discovery in Action
Example: **Calculus Textbook**
- Sellers post asks: PKR 1,600, 1,550, 1,500.
- Buyers post bids: PKR 1,400, 1,450.
- The radar shows the spread (1,450 bid / 1,500 ask) — fair price around PKR 1,475.
- A new buyer placing a limit buy at 1,500 immediately matches the 1,500 ask. The trade clears at 1,500.

This eliminates negotiation friction and provides a transparent, competitive environment.

---

## 4. Technology Stack

| Layer | Technology |
|-------|--------------|
| Database | PostgreSQL 16 (relational) |
| Backend API | Python / FastAPI (async, high‑performance) |
| Frontend | React.js (responsive, real‑time UI) |
| Hosting | AWS Free Tier (pilot phase) |

The advanced database patterns used (stored procedures, isolation levels, row locking, append‑only tables, materialized views) are the core of the project, demonstrating how a relational database can solve genuinely hard concurrent application problems.

---

## 5. Business Viability (Post‑Pilot)

1. **Phase 1:** Free pilot at ITU Lahore to build user base and validate price discovery.
2. **University SaaS Licence:** Annual flat fee for institutions to deploy TradeFloor as a student welfare tool.
3. **Micro‑transaction Fee:** A nominal per‑trade charge (e.g., PKR 1–2) on trades above a certain value, covering costs at scale.
4. **Promoted Listings:** Campus vendors pay to feature their sell orders at the top of the order book for a fixed window.

Cost structure is extremely lean: AWS Free Tier suffices for development and early pilot. Scaling to additional universities requires only a schema partition on a shared database instance, keeping marginal cost low.

---

## 6. Conclusion: The Key Ideas

TradeFloor is **not** just a marketplace app. It is a demonstration of how deliberate, advanced database engineering can solve problems that are typically patched in application code (with queues, background jobs, or locks in memory). By moving the matching, concurrency control, and audit logic into the database layer, the system achieves:

- **Atomic, non‑blocking trade execution** even under heavy simultaneous load.
- **A permanently accurate, tamper‑proof ledger** that builds genuine trust.
- **Real‑time market transparency** without sacrificing write performance.

In essence, it brings exchange‑grade reliability to the smallest scale of commerce — the campus — and in doing so, teaches that the right database design is often the most elegant solution to concurrency and integrity challenges.

---

## 7. Implementation & Deployment Details

### 7.1 ITU User Authentication & Email Verification

**How are ITU students uniquely identified?**  
During registration, the system validates that the user's email address ends with `@itu.edu.pk`. This is enforced both on the frontend (immediate feedback) and on the backend (server‑side validation). A user who attempts to sign up with a non‑ITU email receives an error and cannot proceed.

**Registration workflow:**  
1. Student submits `name`, `email` (must be `...@itu.edu.pk`), and `password`.  
2. Backend checks email domain; if valid, creates an unverified user record and generates a unique verification token (stored with an expiry).  
3. A verification email is sent to that `@itu.edu.pk` address.  
4. Student clicks the link in the email, the backend marks the account as verified, and the user can now log in and trade.  
5. Only verified ITU accounts can place orders or build reputation, ensuring a closed, trusted community.

**How are emails sent for free?**  
The verification emails (and optional trade notifications) are sent via **Amazon Simple Email Service (SES)** using SMTP. SES offers 62,000 free outbound emails per month when sending from an EC2 instance or AWS Lambda, which is more than enough for a campus pilot with thousands of users. Implementation can use Python's `aiosmtplib` or `boto3` (AWS SDK) to send templated HTML emails. Here’s a minimal approach:

- Configure SES in sandbox mode initially (verify the sender email `noreply@tradefoor.app`).
- Later, move out of sandbox by requesting production access to send to any `@itu.edu.pk` address without verifying each recipient individually.
- The only cost is a negligible data transfer fee if the free tier limit is exceeded, easily covered by the $100 credits.

Alternative free fallback: use SendGrid's free tier (100 emails/day) or Mailgun's free plan, but SES integrates seamlessly with the AWS ecosystem.

### 7.2 Hosting on AWS with Free Credits

With $100 in AWS credits, the entire pilot can run comfortably for several months using AWS Free Tier services. The recommended architecture:

### 7.3 Frequently Asked Questions & Edge Cases

**Q: What if a buyer loses the Release Code before the physical meetup?**  
The buyer can request a resend of the Release Code from their “Pending Trades” page (the code is only shown to the authenticated buyer). The code is stored hashed in the database until the trade completes; the system can re-display it securely if the trade is still pending.

**Q: How is the database connection pool handled to avoid exhausting PostgreSQL connections?**  
FastAPI will use a connection pool via `psycopg2`’s pool or `asyncpg` with `SQLAlchemy`. Since the matching logic runs inside a stored procedure, backend connections are short-lived. A pool size of 20–50 connections works well; PostgreSQL on RDS accepts up to ~40 connections by default for a t2.micro, which is sufficient for parallel matching tests.

**Q: How do you test the concurrency scenarios (e.g., 100 users hitting the same order)?**  
A Python script using `httpx.AsyncClient` or `asyncio` will simulate concurrent API calls placing identical limit orders. The `SERIALIZABLE` isolation and `SKIP LOCKED` are verified by asserting that only one trade is completed per inventory unit and that no deadlocks occur. PostgreSQL’s `pg_stat_activity` and `pg_locks` views will be queried during tests to confirm locks behave as expected.

**Q: What prevents a user from registering multiple accounts to artificially inflate reputation?**  
The `@itu.edu.pk` email requirement ties each account to a unique, institution‑issued email address. Email verification further ensures authenticity. While a student could theoretically have multiple ITU aliases, that is rare and can be mitigated by detecting suspicious activity (e.g., rapid back‑and‑forth trading between two accounts).

**Q: How is the append‑only trades table enforced technically?**  
PostgreSQL row‑level security or a simple `BEFORE UPDATE/DELETE` trigger that raises an exception (`RAISE EXCEPTION 'trades table is append-only'`) will be defined. Additionally, the application role only holds `INSERT` and `SELECT` privileges on the `trades` table — no `UPDATE` or `DELETE` grants.

**Q: Can the system scale to multiple universities without architectural changes?**  
Yes. Adding a `university_id` column to users, items, and orders and partitioning the database schema by university (or using a shared instance with row‑level isolation) allows TradeFloor to serve multiple campuses. The matching stored procedure can be extended to accept a `university_id` parameter, keeping order books separated.

**Q: What happens if PostgreSQL fails during a trade match?**  
Since the entire match runs in a single database transaction, if PostgreSQL crashes before a commit, the transaction rolls back entirely. No partial trade is left behind. The API will receive an error and can safely ask the user to retry their order submission.

**Q: Will the frontend show real‑time order book updates?**  
Yes. The React frontend will poll the `order_book_depth` materialized view every few seconds or use WebSocket notifications (if implemented) to refresh the Market Radar. This keeps latency low without overloading the database — reads are cheap even under heavy write loads.


## Core Runtimes & Package Managers

PS C:\Users\abdul> psql --version
psql (PostgreSQL) 18.3
PS C:\Users\abdul> python --version
Python 3.13.6
PS C:\Users\abdul> pip --version
pip 25.3 from C:\Users\abdul\AppData\Roaming\Python\Python313\site-packages\pip (python 3.13)
PS C:\Users\abdul> npm --version
10.9.3
PS C:\Users\abdul> node --version
v22.20.0
PS C:\Users\abdul> 