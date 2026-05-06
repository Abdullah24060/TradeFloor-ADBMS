from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.database import get_db
from app.schemas import MarketRadarResponse, OrderBookRow, ItemCreate, ItemOut
from app.models import Item, User
from app.dependencies import get_verified_user

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/radar", response_model=MarketRadarResponse)
async def get_market_radar(
    item_id: int = Query(..., description="Item ID to fetch order book for"),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch the live order book depth for a specific item.
    Reads from the materialized view (fast; no write lock contention).
    Public endpoint — no auth required.
    """
    result = await db.execute(
        text("""
            SELECT item_id, item_name, category, order_type,
                   price, total_quantity, order_count
            FROM order_book_depth
            WHERE item_id = :iid
            ORDER BY order_type, price
        """),
        {"iid": item_id},
    )
    rows = result.fetchall()

    if not rows:
        # Item might exist but have no active orders — get item name
        item_result = await db.execute(select(Item).where(Item.id == item_id))
        item = item_result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found.")
        return MarketRadarResponse(
            item_id=item.id,
            item_name=item.name,
            category=item.category,
            bids=[],
            asks=[],
        )

    bids = [
        OrderBookRow(**dict(r._mapping))
        for r in rows if r.order_type == "BUY"
    ]
    asks = [
        OrderBookRow(**dict(r._mapping))
        for r in rows if r.order_type == "SELL"
    ]

    # Sort: bids highest first, asks lowest first
    bids.sort(key=lambda x: x.price, reverse=True)
    asks.sort(key=lambda x: x.price)

    # Calculate spread
    spread = None
    if bids and asks:
        spread = asks[0].price - bids[0].price

    # Get last trade price from trade_history_summary view
    summary_result = await db.execute(
        text("SELECT last_trade_price FROM trade_history_summary WHERE item_id = :iid"),
        {"iid": item_id},
    )
    summary_row = summary_result.fetchone()
    last_trade_price = summary_row.last_trade_price if summary_row else None

    return MarketRadarResponse(
        item_id=rows[0].item_id,
        item_name=rows[0].item_name,
        category=rows[0].category,
        bids=bids,
        asks=asks,
        last_trade_price=last_trade_price,
        spread=spread,
    )


@router.get("/items", response_model=list[ItemOut])
async def list_all_items(db: AsyncSession = Depends(get_db)):
    """List all tradeable items. Public endpoint."""
    result = await db.execute(
        select(Item).order_by(Item.category, Item.name)
    )
    return result.scalars().all()


@router.post("/items", response_model=ItemOut, status_code=201)
async def create_item(
    payload: ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Create a new tradeable item. Requires a verified account."""
    item = Item(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        created_by=current_user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/orders-at-price", response_model=list[dict])
async def get_orders_at_price(
    item_id: int = Query(...),
    order_type: str = Query(..., pattern="^(BUY|SELL)$"),
    price: float = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the public profiles (name, batch, degree, reputation) of users
    who have ACTIVE orders at a specific price level for an item.
    Used by the Market Radar page when a user clicks on a bid/ask row.
    Email is deliberately excluded for privacy.
    """
    from app.models import Order, User
    from app.schemas import UserPublic

    result = await db.execute(
        text("""
            SELECT DISTINCT u.id, u.name, u.batch, u.degree, u.reputation,
                   o.quantity, o.created_at,
                   ROUND(AVG(r.rating) OVER (PARTITION BY u.id), 1) AS avg_rating,
                   COUNT(r.id)         OVER (PARTITION BY u.id)      AS review_count
            FROM orders o
            JOIN users u ON u.id = o.user_id
            LEFT JOIN reviews r ON r.reviewee_id = u.id
            WHERE o.item_id   = :iid
              AND o.order_type = :otype
              AND o.price      = :price
              AND o.status     = 'ACTIVE'
            ORDER BY o.created_at ASC
            LIMIT 20
        """),
        {"iid": item_id, "otype": order_type, "price": price},
    )
    rows = result.fetchall()
    return [
        {
            "id": r.id,
            "name": r.name,
            "batch": r.batch,
            "degree": r.degree,
            "reputation": r.reputation,
            "quantity": r.quantity,
            "avg_rating": float(r.avg_rating) if r.avg_rating is not None else None,
            "review_count": r.review_count,
        }
        for r in rows
    ]
