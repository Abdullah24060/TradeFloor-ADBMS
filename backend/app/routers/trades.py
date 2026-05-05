from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.database import get_db
from app.models import User, Trade, Order, Item
from app.schemas import TradeOut, TradeConfirm
from app.dependencies import get_verified_user

router = APIRouter(prefix="/trades", tags=["trades"])


async def _enrich_trade(trade: Trade, current_user_id: int, db: AsyncSession) -> TradeOut:
    """
    Populate item_name and counterparty info for a trade.
    Release code shown only to the buyer.
    """
    buy_order_result = await db.execute(select(Order).where(Order.id == trade.buy_order_id))
    buy_order = buy_order_result.scalar_one()
    is_buyer = buy_order.user_id == current_user_id

    # Get the other side's order
    sell_order_result = await db.execute(select(Order).where(Order.id == trade.sell_order_id))
    sell_order = sell_order_result.scalar_one()

    # Counterparty is whoever is NOT the current user
    counterparty_id = sell_order.user_id if is_buyer else buy_order.user_id
    cp_result = await db.execute(select(User).where(User.id == counterparty_id))
    counterparty = cp_result.scalar_one_or_none()

    # Item name
    item_result = await db.execute(select(Item).where(Item.id == buy_order.item_id))
    item = item_result.scalar_one_or_none()

    return TradeOut(
        id=trade.id,
        buy_order_id=trade.buy_order_id,
        sell_order_id=trade.sell_order_id,
        quantity=trade.quantity,
        price=trade.price,
        status=trade.status,
        release_code=trade.release_code if is_buyer else None,
        matched_at=trade.matched_at,
        completed_at=trade.completed_at,
        item_name=item.name if item else None,
        counterparty_name=counterparty.name if counterparty else "Unknown",
        counterparty_batch=counterparty.batch if counterparty else None,
        counterparty_degree=counterparty.degree if counterparty else None,
    )


@router.get("/pending", response_model=list[TradeOut])
async def get_pending_trades(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """
    Return all PENDING trades where the current user is buyer OR seller.
    Release code is only included when the caller is the buyer.
    Includes item name and counterparty info.
    """
    result = await db.execute(
        select(Trade)
        .join(Order, (Trade.buy_order_id == Order.id) | (Trade.sell_order_id == Order.id))
        .where(
            Trade.status == "PENDING",
            Order.user_id == current_user.id,
        )
        .distinct()
        .order_by(Trade.matched_at.desc())
    )
    trades = result.scalars().all()
    return [await _enrich_trade(t, current_user.id, db) for t in trades]


@router.get("/history", response_model=list[TradeOut])
async def get_trade_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Return all COMPLETED trades for the current user (no release codes, but with item + counterparty)."""
    result = await db.execute(
        select(Trade)
        .join(Order, (Trade.buy_order_id == Order.id) | (Trade.sell_order_id == Order.id))
        .where(
            Trade.status == "COMPLETED",
            Order.user_id == current_user.id,
        )
        .distinct()
        .order_by(Trade.completed_at.desc())
    )
    trades = result.scalars().all()

    enriched = []
    for t in trades:
        e = await _enrich_trade(t, current_user.id, db)
        e.release_code = None  # Never expose after completion
        enriched.append(e)
    return enriched


@router.post("/{trade_id}/confirm", response_model=dict)
async def confirm_trade(
    trade_id: int,
    payload: TradeConfirm,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """
    Seller enters the 6-digit release code to confirm physical settlement.
    Calls the confirm_trade() stored procedure.
    """
    # Extra safety: verify the caller is actually the seller before hitting the SP
    trade_result = await db.execute(
        select(Trade).where(Trade.id == trade_id, Trade.status == "PENDING")
    )
    trade = trade_result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found or already completed.")

    sell_order_result = await db.execute(select(Order).where(Order.id == trade.sell_order_id))
    sell_order = sell_order_result.scalar_one()
    if sell_order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the seller can confirm this trade.")

    result = await db.execute(
        text("SELECT confirm_trade(:trade_id, :code, :seller_id)"),
        {
            "trade_id": trade_id,
            "code": payload.release_code,
            "seller_id": current_user.id,
        },
    )
    success = result.scalar()

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Incorrect release code. Ask the buyer to share their code.",
        )

    await db.commit()
    return {
        "message": "Trade confirmed! Reputation points awarded to both parties.",
        "trade_id": trade_id,
    }
