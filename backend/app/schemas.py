from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, EmailStr, field_validator, model_validator


# ── Auth ─────────────────────────────────────────────────────

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    batch: str              # e.g. "BSAI-2024"
    degree: str             # e.g. "BS Artificial Intelligence"

    @field_validator("email")
    @classmethod
    def must_be_itu_email(cls, v: str) -> str:
        if not v.lower().endswith("@itu.edu.pk"):
            raise ValueError("Only @itu.edu.pk email addresses are allowed")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v

    @field_validator("degree")
    @classmethod
    def degree_format(cls, v: str) -> str:
        import re
        v = v.strip()
        pattern = r'^(BS|MS|PhD|BE|BBA|MBA|MPhil|BDS|MBBS|BEd|MEd)\s+\S.{1,60}$'
        if not re.match(pattern, v):
            raise ValueError(
                'Degree must start with a valid level prefix (BS, MS, PhD, BE, BBA, MBA, MPhil...) '
                'followed by the subject. e.g. "BS Computer Science"'
            )
        return v

    @field_validator("batch")
    @classmethod
    def batch_format(cls, v: str) -> str:
        import re
        v = v.strip().upper()
        if not re.match(r'^[A-Z]{2,8}-20(1[0-9]|2[0-9]|3[0-5])$', v):
            raise ValueError(
                'Batch format must be PROGRAMME-YEAR, e.g. BSAI-2024, MSCS-2025, PhD-2026'
            )
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    is_verified: bool
    reputation: int
    batch: str | None
    degree: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    """Public profile — shown when clicking a bid/ask row in Market Radar. No email."""
    id: int
    name: str
    batch: str | None
    degree: str | None
    reputation: int

    model_config = {"from_attributes": True}


# ── Items ────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    name: str
    description: str | None = None
    category: Literal["textbook", "ticket", "electronics", "service", "other"]

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Item name cannot be empty")
        return v


class ItemOut(BaseModel):
    id: int
    name: str
    description: str | None
    category: str
    created_by: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Orders ───────────────────────────────────────────────────

class OrderCreate(BaseModel):
    item_id: int
    order_type: Literal["BUY", "SELL"]
    price: Decimal
    quantity: int = 1

    @field_validator("price")
    @classmethod
    def price_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Price must be greater than 0")
        return v

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: int) -> int:
        if v <= 0 or v > 100:
            raise ValueError("Quantity must be between 1 and 100")
        return v


class OrderOut(BaseModel):
    id: int
    user_id: int
    item_id: int
    order_type: str
    price: Decimal
    quantity: int
    status: str
    created_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}


class OrderWithMatches(BaseModel):
    order: OrderOut
    trades: list["TradeOut"]


# ── Trades ───────────────────────────────────────────────────

class TradeOut(BaseModel):
    id: int
    buy_order_id: int
    sell_order_id: int
    quantity: int
    price: Decimal
    status: str
    release_code: str | None = None   # only sent to the buyer
    matched_at: datetime
    completed_at: datetime | None
    # Enriched fields (populated by the router, not the ORM directly)
    item_name: str | None = None
    counterparty_name: str | None = None
    counterparty_batch: str | None = None
    counterparty_degree: str | None = None

    model_config = {"from_attributes": True}


class TradeConfirm(BaseModel):
    release_code: str

    @field_validator("release_code")
    @classmethod
    def code_six_digits(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit() or len(v) != 6:
            raise ValueError("Release code must be exactly 6 digits")
        return v


# ── Market Radar ─────────────────────────────────────────────

class OrderBookRow(BaseModel):
    item_id: int
    item_name: str
    category: str
    order_type: str
    price: Decimal
    total_quantity: int
    order_count: int

    model_config = {"from_attributes": True}


class MarketRadarResponse(BaseModel):
    item_id: int
    item_name: str
    category: str
    bids: list[OrderBookRow]    # BUY orders — highest price first
    asks: list[OrderBookRow]    # SELL orders — lowest price first
    last_trade_price: Decimal | None = None
    spread: Decimal | None = None  # best_ask - best_bid


OrderWithMatches.model_rebuild()
