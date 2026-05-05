"""Quick end-to-end API test for order placement using Ali Raza (id=2)."""
import urllib.request, json, urllib.error

BASE = "http://localhost:8000/api"

# Login as Ali Raza (user id=2, still has valid password)
req = urllib.request.Request(
    f"{BASE}/users/login",
    data=json.dumps({"email": "ali.test@itu.edu.pk", "password": "Test@1234"}).encode(),
    headers={"Content-Type": "application/json"},
)
try:
    res = urllib.request.urlopen(req)
    token = json.loads(res.read())["access_token"]
    print("Login OK:", token[:20] + "...")
except urllib.error.HTTPError as e:
    print("Login FAILED:", e.code, e.read())
    exit(1)

# Place BUY order for item 1
req2 = urllib.request.Request(
    f"{BASE}/orders",
    data=json.dumps({"item_id": 1, "order_type": "BUY", "price": 200, "quantity": 1}).encode(),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
)
try:
    res2 = urllib.request.urlopen(req2)
    data = json.loads(res2.read())
    print("Order placed OK!")
    print("  Order ID:", data["order"]["id"])
    print("  Status:", data["order"]["status"])
    print("  Trades matched:", len(data["trades"]))
    if data["trades"]:
        for t in data["trades"]:
            print(f"  Trade #{t['id']} release_code={t.get('release_code')}")
except urllib.error.HTTPError as e:
    body = e.read()
    print("Order FAILED:", e.code, body)
