from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.database import get_db
from app.models import User, Item, Order, Trade
from app.schemas import OrderCreate, OrderOut, OrderWithMatches, TradeOut
from app.dependencies import get_verified_user
from app.email_service import send_trade_notification

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderWithMatches, status_code=status.HTTP_201_CREATED)
async def place_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """
    Place a limit order (BUY or SELL).

    After insertion, immediately calls the matching engine stored procedure
    inside a SERIALIZABLE transaction. Any resulting trades are returned.

    The release code is only included in the response for the BUYER.
    """
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    # Note: an active transaction already exists from auth dependencies.
    # We reuse that session transaction and commit explicitly.
    try:
        # Verify item exists
        result = await db.execute(select(Item).where(Item.id == payload.item_id))
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {payload.item_id} not found.")

        # Insert the order
        order = Order(
            user_id=current_user.id,
            item_id=payload.item_id,
            order_type=payload.order_type,
            price=payload.price,
            quantity=payload.quantity,
            expires_at=expires_at,
        )
        db.add(order)
        await db.flush()   # get order.id without committing

        # Call matching engine stored procedure
        match_result = await db.execute(
            text("SELECT trade_id, matched_price, matched_qty, release_code FROM match_order(:oid)"),
            {"oid": order.id},
        )
        match_rows = match_result.fetchall()

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    # Reload the order (status may have changed to FILLED/PARTIALLY_FILLED)
    await db.refresh(order)

    # Build trade responses — release code only shown to buyer
    trades_out = []
    for row in match_rows:
        trade_result = await db.execute(
            select(Trade).where(Trade.id == row.trade_id)
        )
        trade = trade_result.scalar_one()

        trade_out = TradeOut(
            id=trade.id,
            buy_order_id=trade.buy_order_id,
            sell_order_id=trade.sell_order_id,
            quantity=trade.quantity,
            price=trade.price,
            status=trade.status,
            # Show release code only to buyer
            release_code=row.release_code if payload.order_type == "BUY" else None,
            matched_at=trade.matched_at,
            completed_at=trade.completed_at,
        )
        trades_out.append(trade_out)

        # Send email notifications asynchronously (best-effort)
        try:
            buyer_order_result = await db.execute(
                select(Order).where(Order.id == trade.buy_order_id)
            )
            buyer_order = buyer_order_result.scalar_one()
            buyer_result = await db.execute(select(User).where(User.id == buyer_order.user_id))
            buyer = buyer_result.scalar_one()

            seller_order_result = await db.execute(
                select(Order).where(Order.id == trade.sell_order_id)
            )
            seller_order = seller_order_result.scalar_one()
            seller_result = await db.execute(select(User).where(User.id == seller_order.user_id))
            seller = seller_result.scalar_one()

            await send_trade_notification(
                buyer.email, buyer.name, item.name, "buyer", trade.id, row.release_code
            )
            await send_trade_notification(
                seller.email, seller.name, item.name, "seller", trade.id, None
            )
        except Exception:
            pass  # Email failure should not affect trade

    order_out = OrderOut.model_validate(order)
    return OrderWithMatches(order=order_out, trades=trades_out)


@router.get("", response_model=list[OrderOut])
async def list_my_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Return all orders placed by the current user."""
    result = await db.execute(
        select(Order)
        .where(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/{order_id}", response_model=dict)
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """
    Cancel an ACTIVE order. Only the order owner can cancel.
    Orders already FILLED or PARTIALLY_FILLED cannot be cancelled.
    """
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised to cancel this order.")
    if order.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order in '{order.status}' state. Only ACTIVE orders can be cancelled.",
        )

    order.status = "CANCELLED"
    await db.flush()

    # Refresh the market view so the cancelled order disappears from Market Radar immediately.
    # Without this, the materialized view stays stale until the next trade triggers match_order().
    await db.execute(text("SELECT refresh_order_book_depth()"))

    await db.commit()
    return {"message": f"Order {order_id} cancelled successfully."}


@router.get("/items", response_model=list)
async def list_items(db: AsyncSession = Depends(get_db)):
    """Return all items (public endpoint — no auth required)."""
    from app.schemas import ItemOut
    from app.models import Item
    result = await db.execute(select(Item).order_by(Item.category, Item.name))
    return [ItemOut.model_validate(i) for i in result.scalars().all()]
