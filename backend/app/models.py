from datetime import datetime, timezone
from sqlalchemy import (
    Integer, String, Boolean, Numeric, Text, DateTime,
    ForeignKey, CheckConstraint, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verify_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    token_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reputation: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    batch: Mapped[str | None] = mapped_column(String(20), nullable=True)   # e.g. BSAI-2024
    degree: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. BS Artificial Intelligence
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    orders: Mapped[list["Order"]] = relationship("Order", back_populates="user")


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    orders: Mapped[list["Order"]] = relationship("Order", back_populates="item")
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint(
            "category IN ('textbook','ticket','electronics','service','other')",
            name="ck_item_category"
        ),
    )


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    order_type: Mapped[str] = mapped_column(String(4), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="orders")
    item: Mapped["Item"] = relationship("Item", back_populates="orders")

    __table_args__ = (
        CheckConstraint("order_type IN ('BUY','SELL')", name="ck_order_type"),
        CheckConstraint(
            "status IN ('ACTIVE','FILLED','PARTIALLY_FILLED','CANCELLED','EXPIRED')",
            name="ck_order_status"
        ),
        CheckConstraint("price > 0", name="ck_order_price"),
        CheckConstraint("quantity > 0", name="ck_order_quantity"),
        Index("idx_orders_matching_orm", "item_id", "order_type", "price", "created_at",
              postgresql_where="status = 'ACTIVE'"),
    )


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    buy_order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    sell_order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(10), default="PENDING", nullable=False)
    release_code: Mapped[str] = mapped_column(String(6), nullable=False)
    matched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    buy_order: Mapped["Order"] = relationship("Order", foreign_keys=[buy_order_id])
    sell_order: Mapped["Order"] = relationship("Order", foreign_keys=[sell_order_id])

    __table_args__ = (
        CheckConstraint("status IN ('PENDING','COMPLETED','DISPUTED')", name="ck_trade_status"),
        CheckConstraint("quantity > 0", name="ck_trade_quantity"),
        CheckConstraint("price > 0", name="ck_trade_price"),
    )
