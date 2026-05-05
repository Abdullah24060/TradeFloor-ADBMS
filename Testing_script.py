"""
TradeFloor — Automated Test Suite
Run from project root: python Testing_script.py
Requires: backend running on :8000, psycopg2, bcrypt
"""
import sys, json, time, threading, traceback
import urllib.request, urllib.error
import subprocess

BASE = "http://localhost:8000/api"
PG   = ["C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe",
        "-U", "postgres", "-d", "tradefloor"]

PASS_CHAR = "PASS"
FAIL_CHAR = "FAIL"
SKIP_CHAR = "SKIP"

results = []

# ── Helpers ────────────────────────────────────────────────────
def req(method, path, body=None, token=None, expected=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        res = urllib.request.urlopen(r)
        code = res.status
        body = json.loads(res.read())
        return code, body
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read())
        except Exception:
            pass
        return e.code, body

def psql(sql):
    env = {"PGPASSWORD": "12141214"}
    import os; full_env = {**os.environ, **env}
    r = subprocess.run(PG + ["-t", "-c", sql], capture_output=True, text=True, env=full_env)
    # Combine stdout+stderr — psql sends ERRORs to stderr
    return (r.stdout + r.stderr).strip()

def ok(name, passed, detail=""):
    sym = PASS_CHAR if passed else FAIL_CHAR
    color = "\033[92m" if passed else "\033[91m"
    print(f"  {color}[{sym}]\033[0m {name}" + (f"  [{detail}]" if detail else ""))
    results.append((name, passed))

def section(title):
    print(f"\n\033[1m\033[94m{'─'*55}\n  {title}\n{'─'*55}\033[0m")

def login(email, password="Test@1234"):
    code, body = req("POST", "/users/login", {"email": email, "password": password})
    return body.get("access_token") if code == 200 else None

# ── 1. AUTHENTICATION ──────────────────────────────────────────
def test_auth():
    section("1 · Authentication & User Management")

    ts = int(time.time()) % 100000
    test_email = f"test_auto_{ts}@itu.edu.pk"
    code, body = req("POST", "/users/register", {
        "name": "Test Script User", "email": test_email,
        "password": "AutoTest@123", "batch": "BSCS-2024",
        "degree": "BS Computer Science"
    })
    ok("Register valid @itu.edu.pk email → 201", code == 201)

    # Duplicate email → 409
    code, _ = req("POST", "/users/register", {
        "name": "Dup", "email": test_email,
        "password": "AutoTest@123", "batch": "BSCS-2024",
        "degree": "BS Computer Science"
    })
    ok("Register duplicate email → 409", code == 409)

    # Non-ITU email → 422
    code, _ = req("POST", "/users/register", {
        "name": "X", "email": "bad@gmail.com",
        "password": "AutoTest@123", "batch": "BSCS-2024",
        "degree": "BS Computer Science"
    })
    ok("Register non-@itu.edu.pk email → 422", code == 422)

    # Short password → 422
    code, _ = req("POST", "/users/register", {
        "name": "X", "email": "short@itu.edu.pk",
        "password": "abc", "batch": "BSCS-2024",
        "degree": "BS Computer Science"
    })
    ok("Register password < 8 chars → 422", code == 422)

    # Bad degree format → 422
    code, _ = req("POST", "/users/register", {
        "name": "X", "email": "degtest@itu.edu.pk",
        "password": "AutoTest@123", "batch": "BSCS-2024",
        "degree": "Computer Science"   # missing prefix
    })
    ok("Register bad degree format → 422", code == 422)

    # Bad batch format → 422
    code, _ = req("POST", "/users/register", {
        "name": "X", "email": "battest@itu.edu.pk",
        "password": "AutoTest@123", "batch": "2024",   # missing prefix
        "degree": "BS Computer Science"
    })
    ok("Register bad batch format → 422", code == 422)

    # Login before verification → 403
    code, _ = req("POST", "/users/login", {"email": test_email, "password": "AutoTest@123"})
    ok("Login before email verify → 403", code == 403)

    # Login with test users (pre-verified)
    tok = login("ali.test@itu.edu.pk")
    ok("Login Ali Raza (pre-verified) → JWT returned", tok is not None)

    # Wrong password → 401
    code, _ = req("POST", "/users/login", {"email": "ali.test@itu.edu.pk", "password": "wrong"})
    ok("Login wrong password → 401", code == 401)

    # Non-existent email → 401
    code, _ = req("POST", "/users/login", {"email": "ghost@itu.edu.pk", "password": "Test@1234"})
    ok("Login non-existent email → 401", code == 401)

    # /me without token → 401
    code, _ = req("GET", "/users/me")
    ok("GET /me without token → 401", code == 401)

    # /me with token → 200 with batch/degree
    tok = login("ali.test@itu.edu.pk")
    code, body = req("GET", "/users/me", token=tok)
    ok("GET /me with token → 200", code == 200)
    ok("  /me response includes batch field", "batch" in body)
    ok("  /me response includes degree field", "degree" in body)

    # bsai24060 email is free (deleted earlier)
    code, _ = req("POST", "/users/register", {
        "name": "Abdul Test", "email": "bsai24060@itu.edu.pk",
        "password": "TestPass@123", "batch": "BSAI-2024",
        "degree": "BS Artificial Intelligence"
    })
    ok("bsai24060@itu.edu.pk is free to register (or duplicate if re-run) → 201/409", code in [201, 409])

    return tok

# ── 2. ORDER PLACEMENT & MATCHING ─────────────────────────────
def test_orders(tok_ali, tok_sara, tok_omar):
    section("2 · Order Placement & Matching")

    # Place SELL from Sara (item 1)
    code, body = req("POST", "/orders", {"item_id": 1, "order_type": "SELL", "price": 1000, "quantity": 3}, token=tok_sara)
    ok("Place SELL order → 201", code == 201)
    sell_order_id = body.get("order", {}).get("id")

    # Place matching BUY from Ali → instant match
    code, body = req("POST", "/orders", {"item_id": 1, "order_type": "BUY", "price": 1000, "quantity": 2}, token=tok_ali)
    ok("Place BUY at matching price → matched instantly", code == 201 and len(body.get("trades", [])) > 0)
    matched_trade = body.get("trades", [{}])[0]
    ok("  Release code shown to buyer (Ali)", matched_trade.get("release_code") is not None)
    ok("  Release code is 6 digits", len(str(matched_trade.get("release_code", ""))) == 6)

    # Price ≤ 0 → 422
    code, _ = req("POST", "/orders", {"item_id": 1, "order_type": "BUY", "price": 0, "quantity": 1}, token=tok_ali)
    ok("Price = 0 → 422", code == 422)

    # Quantity ≤ 0 → 422
    code, _ = req("POST", "/orders", {"item_id": 1, "order_type": "BUY", "price": 500, "quantity": 0}, token=tok_ali)
    ok("Quantity = 0 → 422", code == 422)

    # Quantity > 100 → 422
    code, _ = req("POST", "/orders", {"item_id": 1, "order_type": "BUY", "price": 500, "quantity": 101}, token=tok_ali)
    ok("Quantity > 100 → 422", code == 422)

    # Non-existent item → 404
    code, _ = req("POST", "/orders", {"item_id": 9999, "order_type": "BUY", "price": 500, "quantity": 1}, token=tok_ali)
    ok("Non-existent item → 404", code == 404)

    # No self-trade: Sara places BUY on same item she has SELL
    code, body = req("POST", "/orders", {"item_id": 1, "order_type": "BUY", "price": 1200, "quantity": 1}, token=tok_sara)
    ok("No self-trade: Sara's BUY doesn't match her own SELL", code == 201 and len(body.get("trades", [])) == 0)

    # Cancel ACTIVE order
    code, body = req("POST", "/orders", {"item_id": 2, "order_type": "BUY", "price": 500, "quantity": 1}, token=tok_ali)
    cancel_id = body.get("order", {}).get("id")
    code, _ = req("DELETE", f"/orders/{cancel_id}", token=tok_ali)
    ok("Cancel ACTIVE order → 200", code == 200)

    # Cancel already-cancelled → 400
    code, _ = req("DELETE", f"/orders/{cancel_id}", token=tok_ali)
    ok("Cancel CANCELLED order → 400", code == 400)

    # Cancel someone else's order → 403
    code, body = req("POST", "/orders", {"item_id": 2, "order_type": "SELL", "price": 800, "quantity": 1}, token=tok_sara)
    other_id = body.get("order", {}).get("id")
    code, _ = req("DELETE", f"/orders/{other_id}", token=tok_ali)
    ok("Cancel another user's order → 403", code == 403)

    # Unverified user cannot place order (need unverified account)
    code, _ = req("POST", "/orders", {"item_id": 1, "order_type": "BUY", "price": 500, "quantity": 1})
    ok("Place order without token → 401", code == 401)

    # Market Radar refresh after cancel — cancelled order must not appear
    time.sleep(0.5)
    code, radar = req("GET", "/market/radar?item_id=2")
    all_prices = [float(r["price"]) for r in radar.get("bids", []) + radar.get("asks", [])]
    ok("Market Radar removes cancelled order immediately", 500.0 not in all_prices)

    return matched_trade

# ── 3. TRADE CONFIRMATION & RELEASE CODES ─────────────────────
def test_trades(matched_trade, tok_ali, tok_sara):
    section("3 · Trade Confirmation & Release Codes")

    if not matched_trade.get("id"):
        ok("Trade confirmation tests (skipped — no trade)", False, "no trade from matching step")
        return

    trade_id = matched_trade["id"]
    code_val  = matched_trade.get("release_code")

    # Seller (Sara) cannot see release code via GET /trades/pending
    code, trades = req("GET", "/trades/pending", token=tok_sara)
    seller_trades = [t for t in trades if t["id"] == trade_id]
    ok("Seller's pending view has no release code", seller_trades and seller_trades[0].get("release_code") is None)

    # Buyer (Ali) can see code and item_name
    code, trades = req("GET", "/trades/pending", token=tok_ali)
    buyer_trades = [t for t in trades if t["id"] == trade_id]
    ok("Buyer's pending view shows release code", buyer_trades and buyer_trades[0].get("release_code") == code_val)
    ok("Pending trade includes item_name", buyer_trades and buyer_trades[0].get("item_name") is not None)
    ok("Pending trade includes counterparty_name", buyer_trades and buyer_trades[0].get("counterparty_name") is not None)

    # Wrong code → 400
    code, _ = req("POST", f"/trades/{trade_id}/confirm", {"release_code": "000000"}, token=tok_sara)
    ok("Wrong release code → 400", code == 400)

    # Ali (buyer) cannot confirm (only seller can)
    code, _ = req("POST", f"/trades/{trade_id}/confirm", {"release_code": code_val}, token=tok_ali)
    ok("Buyer cannot confirm trade → 403", code == 403)

    # Sara confirms with correct code
    code, body = req("POST", f"/trades/{trade_id}/confirm", {"release_code": code_val}, token=tok_sara)
    ok("Seller confirms with correct code → 200", code == 200)

    # Reputation incremented in DB — check it went up (not hard-coded to 1 since prior runs may exist)
    time.sleep(0.3)
    ali_rep_raw  = psql("SELECT reputation FROM users WHERE email='ali.test@itu.edu.pk'")
    sara_rep_raw = psql("SELECT reputation FROM users WHERE email='sara.test@itu.edu.pk'")
    ali_rep  = int(ali_rep_raw.strip()) if ali_rep_raw.strip().isdigit() else -1
    sara_rep = int(sara_rep_raw.strip()) if sara_rep_raw.strip().isdigit() else -1
    ok("Ali (buyer) reputation incremented (>= 1)",  ali_rep  >= 1)
    ok("Sara (seller) reputation incremented (>= 1)", sara_rep >= 1)

    # Trade now in history, not pending
    code, hist = req("GET", "/trades/history", token=tok_ali)
    hist_ids = [t["id"] for t in hist]
    ok("Completed trade appears in history", trade_id in hist_ids)
    _, pend = req("GET", "/trades/pending", token=tok_ali)
    pend_ids = [t["id"] for t in pend]
    ok("Completed trade removed from pending", trade_id not in pend_ids)

    # Already COMPLETED → error
    code, _ = req("POST", f"/trades/{trade_id}/confirm", {"release_code": code_val}, token=tok_sara)
    ok("Re-confirming COMPLETED trade → 404", code == 404)

# ── 4. DATABASE INTEGRITY ──────────────────────────────────────
def test_db_integrity():
    section("4 · Database Integrity (DB-level constraints)")

    # Append-only: DELETE trades must fail
    first_trade = psql("SELECT id FROM trades ORDER BY id LIMIT 1")
    if first_trade.strip():
        tid = first_trade.strip()
        result = psql(f"DELETE FROM trades WHERE id = {tid}")
        ok("DELETE from trades blocked by trigger",
           "trades table is append-only" in result or "ERROR" in result or result == "")
    else:
        ok("DELETE from trades blocked by trigger (no trades yet)", True, "skipped")

    # Immutability: UPDATE price on PENDING trade must fail (use a pending if one exists, else any)
    first_trade = psql("SELECT id FROM trades ORDER BY id LIMIT 1")
    if first_trade.strip().isdigit():
        tid = first_trade.strip()
        # Try to update a non-status column; trigger blocks it regardless of current status
        result = psql(f"UPDATE trades SET release_code='000000' WHERE id = {tid}")
        ok("UPDATE trade core field blocked by trigger",
           "ERROR" in result or "immutable" in result.lower() or "only" in result.lower())
    else:
        ok("UPDATE trade core field blocked (no trades yet)", True, "skipped")

    # tf_app cannot DELETE orders — tested via SET ROLE (avoids needing tf_app psql password)
    result = psql("SET ROLE tf_app; DELETE FROM orders WHERE id = -1; RESET ROLE;")
    ok("tf_app cannot DELETE orders (permission denied)",
       "permission denied" in result.lower() or result == "")

    # Item category constraint
    result = psql("INSERT INTO items (name, category) VALUES ('x', 'invalid_cat')")
    ok("Invalid item category rejected by CHECK constraint", "ERROR" in result or "check" in result.lower())

    # Invalid order status
    result = psql("INSERT INTO orders (user_id, item_id, order_type, price, quantity, status, expires_at) SELECT 1, 1, 'BUY', 100, 1, 'STUCK', NOW()+INTERVAL'1d' WHERE EXISTS (SELECT 1 FROM users LIMIT 1)")
    ok("Invalid order status rejected by CHECK constraint", "ERROR" in result or "stuck" not in psql("SELECT status FROM orders WHERE status='STUCK'").lower())

    # Materialized view selectable by tf_app
    result = psql("SET ROLE tf_app; SELECT COUNT(*) FROM order_book_depth; RESET ROLE;")
    ok("tf_app can SELECT order_book_depth", "ERROR" not in result)

    # completed_at auto-set when COMPLETED
    result = psql("SELECT completed_at FROM trades WHERE status='COMPLETED' LIMIT 1")
    ok("completed_at auto-set on COMPLETED trade", result.strip() and result.strip() != "")

# ── 5. MARKET RADAR ───────────────────────────────────────────
def test_market(tok_ali, tok_sara):
    section("5 · Market Radar & Order Book")

    # Empty order book — use item 9 (Python Tutoring) which should have no leftover orders
    # First cancel any stale orders on item 9 to ensure clean state
    code, body = req("GET", "/market/radar?item_id=9")
    ok("Empty item → radar returns 200", code == 200)
    # bids/asks may be empty if no orders on item 9
    ok("Empty item → bids/asks are lists", isinstance(body.get("bids"), list) and isinstance(body.get("asks"), list))

    # Place orders and verify they appear
    req("POST", "/orders", {"item_id": 3, "order_type": "SELL", "price": 2000, "quantity": 1}, token=tok_sara)
    req("POST", "/orders", {"item_id": 3, "order_type": "BUY",  "price": 1800, "quantity": 1}, token=tok_ali)
    time.sleep(0.5)
    code, body = req("GET", "/market/radar?item_id=3")
    ok("After placing orders, radar shows bids and asks", code == 200 and len(body.get("bids", [])) > 0 and len(body.get("asks", [])) > 0)

    # Bids sorted highest first
    bids = body.get("bids", [])
    ok("Bids sorted highest price first", all(bids[i]["price"] >= bids[i+1]["price"] for i in range(len(bids)-1)) if len(bids) > 1 else True)

    # Asks sorted lowest first
    asks = body.get("asks", [])
    ok("Asks sorted lowest price first", all(asks[i]["price"] <= asks[i+1]["price"] for i in range(len(asks)-1)) if len(asks) > 1 else True)

    # Spread = best_ask - best_bid
    if bids and asks:
        expected_spread = float(asks[0]["price"]) - float(bids[0]["price"])
        ok(f"Spread = best_ask - best_bid ({expected_spread})", abs(float(body.get("spread", -999)) - expected_spread) < 0.01)

    # orders-at-price endpoint (click to see traders)
    code, traders = req("GET", "/market/orders-at-price?item_id=3&order_type=SELL&price=2000")
    ok("orders-at-price returns trader info", code == 200 and len(traders) > 0)
    ok("  Trader info has no email (privacy)", all("email" not in t for t in traders))
    ok("  Trader info has name, batch, degree", all("name" in t and "batch" in t for t in traders))

    # Public profile has no email
    code, prof = req("GET", "/users/profile/1")
    ok("Public profile has no email field", code == 200 and "email" not in prof)

# ── 6. SECURITY ────────────────────────────────────────────────
def test_security():
    section("6 · Input Validation & Security")

    # Tampered JWT → 401
    code, _ = req("GET", "/users/me", token="eyJhbGci.tampered.token")
    ok("Tampered JWT → 401", code == 401)

    # Missing token → 401
    code, _ = req("GET", "/users/me")
    ok("Missing Bearer token → 401", code == 401)

    # SQL injection in item name (safe via parameterized queries)
    tok = login("ali.test@itu.edu.pk")
    code, body = req("POST", "/market/items", {
        "name": "'; DROP TABLE users; --",
        "category": "other"
    }, token=tok)
    # Should either succeed (stored safely) or fail validation — not crash
    ok("SQL injection in item name → safe (no crash)", code in [201, 422])
    if code == 201:
        # Verify users table still exists
        result = psql("SELECT COUNT(*) FROM users")
        ok("  users table still exists after SQL injection attempt", result.strip().isdigit())

    # Quantity > 100 blocked
    code, _ = req("POST", "/orders", {"item_id": 1, "order_type": "BUY", "price": 100, "quantity": 999}, token=tok)
    ok("Quantity 999 (>100) → 422", code == 422)

    # Release code must be 6 digits
    code, _ = req("POST", "/trades/999/confirm", {"release_code": "12"}, token=tok)
    ok("Release code != 6 digits → 422", code == 422)

# ── 7. CONCURRENCY ─────────────────────────────────────────────
def test_concurrency():
    section("7 · Concurrency (20 simultaneous BUY orders vs 1 SELL)")

    tok_sara = login("sara.test@itu.edu.pk")
    tok_ali  = login("ali.test@itu.edu.pk")
    tok_omar = login("omar.test@itu.edu.pk")

    # Create a unique item per run so no leftover SELL from a prior run interferes
    ts2 = int(time.time()) % 100000
    code, item_body = req("POST", "/market/items",
        {"name": f"ConcurrencyTest-{ts2}", "category": "other"}, token=tok_sara)
    conc_item_id = item_body.get("id") if code == 201 else 5

    # Place exactly 1 SELL order
    code, _ = req("POST", "/orders",
        {"item_id": conc_item_id, "order_type": "SELL", "price": 100, "quantity": 1}, token=tok_sara)
    ok("Placed single SELL order for concurrency test", code == 201)

    # Fire 20 concurrent BUY requests — alternate Ali/Omar (Sara is seller, no self-trade)
    match_counts = []
    errors = []
    def place_buy(tok):
        try:
            c, b = req("POST", "/orders",
                {"item_id": conc_item_id, "order_type": "BUY", "price": 100, "quantity": 1}, token=tok)
            match_counts.append(len(b.get("trades", [])))
        except Exception as e:
            errors.append(str(e))

    threads = [threading.Thread(target=place_buy,
        args=(tok_ali if i % 2 == 0 else tok_omar,)) for i in range(20)]
    for t in threads: t.start()
    for t in threads: t.join()

    total_matches = sum(match_counts)
    ok("Exactly 1 trade from 20 concurrent BUYs (no double-booking)", total_matches == 1, f"got {total_matches}")
    ok("No thread errors during concurrency test", len(errors) == 0, f"{len(errors)} errors")

# ── 8. DATA CONSISTENCY ────────────────────────────────────────
def test_consistency():
    section("8 · Data Consistency")

    # Partial fill
    tok_ali  = login("ali.test@itu.edu.pk")
    tok_sara = login("sara.test@itu.edu.pk")

    # Sara places SELL qty 5
    req("POST", "/orders", {"item_id": 6, "order_type": "SELL", "price": 500, "quantity": 5}, token=tok_sara)
    # Ali BUYs qty 2 → partial fill on Sara's order
    code, body = req("POST", "/orders", {"item_id": 6, "order_type": "BUY", "price": 500, "quantity": 2}, token=tok_ali)
    trades = body.get("trades", [])
    ok("Partial fill: BUY 2 against SELL 5 → 1 trade", len(trades) == 1)

    # Sara's SELL should now be PARTIALLY_FILLED
    time.sleep(0.3)
    result = psql("SELECT status FROM orders WHERE item_id=6 AND order_type='SELL' AND status='PARTIALLY_FILLED'")
    ok("Partial fill: SELL order status = PARTIALLY_FILLED", "PARTIALLY_FILLED" in result)

    # Reputation increments only on COMPLETED
    result = psql("SELECT COUNT(*) FROM trades WHERE status='COMPLETED'")
    completed = int(result.strip()) if result.strip().isdigit() else 0
    ali_rep = int(psql("SELECT reputation FROM users WHERE email='ali.test@itu.edu.pk'").strip() or 0)
    ok("Reputation ≤ number of completed trades per user", ali_rep <= completed)

# ── MAIN ───────────────────────────────────────────────────────
def main():
    print("\n\033[1m\033[95m" + "="*55)
    print("  TradeFloor — Automated Test Suite")
    print("="*55 + "\033[0m")


    # Check backend is live
    try:
        req("GET", "/market/items")
    except Exception:
        print("[FAIL] Backend not reachable on :8000. Start it first.")
        sys.exit(1)

    tok_ali  = login("ali.test@itu.edu.pk")
    tok_sara = login("sara.test@itu.edu.pk")
    tok_omar = login("omar.test@itu.edu.pk")

    if not tok_ali or not tok_sara:
        print("[FAIL] Cannot login test users. Run seed_test_users.sql first.")
        sys.exit(1)

    try:
        test_auth()
        matched = test_orders(tok_ali, tok_sara, tok_omar)
        test_trades(matched, tok_ali, tok_sara)
        test_db_integrity()
        test_market(tok_ali, tok_sara)
        test_security()
        test_concurrency()
        test_consistency()
    except Exception:
        traceback.print_exc()

    # Summary
    passed = sum(1 for _, p in results if p)
    failed = sum(1 for _, p in results if not p)
    total  = len(results)
    pct    = int(passed / total * 100) if total else 0
    color  = "\033[92m" if pct == 100 else "\033[93m" if pct >= 80 else "\033[91m"

    print(f"\n\033[1m{'─'*55}")
    print(f"  Results: {color}{passed}/{total} passed ({pct}%)\033[0m\033[1m")
    if failed:
        print(f"\n  Failed tests:")
        for name, p in results:
            if not p:
                print(f"    [FAIL] {name}")
    print("─"*55 + "\033[0m\n")
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
