from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import users, orders, trades, market, reviews


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle events."""
    print(f"[START] {settings.app_name} backend starting...")
    yield
    print(f"[STOP] {settings.app_name} backend shutting down.")


app = FastAPI(
    title=f"{settings.app_name} API",
    description=(
        "High-concurrency campus micro-economy matching engine. "
        "Powered by PostgreSQL SERIALIZABLE transactions, "
        "SELECT FOR UPDATE SKIP LOCKED, and pgcrypto."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Build CORS origin list from env — always include localhost variants for dev
_origins = {settings.frontend_url, "http://localhost:5173", "http://127.0.0.1:5173"}
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────
app.include_router(users.router,  prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(trades.router, prefix="/api")
app.include_router(market.router,  prefix="/api")
app.include_router(reviews.router, prefix="/api")


@app.get("/", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
    }
