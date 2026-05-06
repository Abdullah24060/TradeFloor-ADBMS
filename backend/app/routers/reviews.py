from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import Trade, Order, User
from app.dependencies import get_verified_user

router = APIRouter(prefix="/reviews", tags=["reviews"])


# ── Schemas ──────────────────────────────────────────────────
class ReviewCreate(BaseModel):
    trade_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(None, max_length=500)


class ReviewOut(BaseModel):
    id: int
    trade_id: int
    reviewer_id: int
    reviewee_id: int
    rating: int
    comment: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── POST /reviews — leave a review ───────────────────────────
@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def leave_review(
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    # Load trade
    trade_result = await db.execute(select(Trade).where(Trade.id == payload.trade_id))
    trade = trade_result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found.")
    if trade.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Can only review COMPLETED trades.")

    # Resolve buyer and seller
    buy_order_result  = await db.execute(select(Order).where(Order.id == trade.buy_order_id))
    sell_order_result = await db.execute(select(Order).where(Order.id == trade.sell_order_id))
    buy_order  = buy_order_result.scalar_one()
    sell_order = sell_order_result.scalar_one()

    buyer_id  = buy_order.user_id
    seller_id = sell_order.user_id

    if current_user.id not in (buyer_id, seller_id):
        raise HTTPException(status_code=403, detail="You were not part of this trade.")

    # Who is being reviewed?
    reviewee_id = seller_id if current_user.id == buyer_id else buyer_id

    # Check duplicate
    existing = await db.execute(
        text("SELECT id FROM reviews WHERE trade_id = :t AND reviewer_id = :r"),
        {"t": payload.trade_id, "r": current_user.id},
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You have already reviewed this trade.")

    # Insert review
    result = await db.execute(
        text("""
            INSERT INTO reviews (trade_id, reviewer_id, reviewee_id, rating, comment, created_at)
            VALUES (:trade_id, :reviewer_id, :reviewee_id, :rating, :comment, NOW())
            RETURNING id, trade_id, reviewer_id, reviewee_id, rating, comment, created_at
        """),
        {
            "trade_id":    payload.trade_id,
            "reviewer_id": current_user.id,
            "reviewee_id": reviewee_id,
            "rating":      payload.rating,
            "comment":     payload.comment,
        },
    )
    row = result.fetchone()
    await db.commit()

    return ReviewOut(
        id=row.id,
        trade_id=row.trade_id,
        reviewer_id=row.reviewer_id,
        reviewee_id=row.reviewee_id,
        rating=row.rating,
        comment=row.comment,
        created_at=row.created_at,
    )


# ── GET /reviews/my-submitted — reviews I already left ───────
@router.get("/my-submitted", response_model=list[dict])
async def my_submitted_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    result = await db.execute(
        text("SELECT trade_id FROM reviews WHERE reviewer_id = :uid"),
        {"uid": current_user.id},
    )
    return [{"trade_id": row.trade_id} for row in result.fetchall()]


# ── GET /reviews/user/{user_id} — public reviews for a user ──
@router.get("/user/{user_id}", response_model=list[dict])
async def user_reviews(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT r.id, r.trade_id, r.rating, r.comment, r.created_at,
                   u.name AS reviewer_name
            FROM reviews r
            JOIN users u ON u.id = r.reviewer_id
            WHERE r.reviewee_id = :uid
            ORDER BY r.created_at DESC
        """),
        {"uid": user_id},
    )
    rows = result.fetchall()
    return [
        {
            "id": row.id,
            "trade_id": row.trade_id,
            "rating": row.rating,
            "comment": row.comment,
            "created_at": row.created_at.isoformat(),
            "reviewer_name": row.reviewer_name,
        }
        for row in rows
    ]
