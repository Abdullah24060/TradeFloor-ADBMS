import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User
from app.schemas import UserRegister, UserLogin, Token, UserOut, UserPublic
from app.auth import hash_password, verify_password, create_access_token
from app.dependencies import get_current_user
from app.email_service import send_verification_email

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    """
    Register a new ITU student.
    - Validates @itu.edu.pk email domain (enforced by Pydantic schema)
    - Creates unverified account
    - Sends verification email
    """
    # Check if email already taken
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Generate verification token (UUID v4)
    token = str(uuid.uuid4())
    expiry = datetime.now(timezone.utc) + timedelta(hours=24)

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        batch=payload.batch,
        degree=payload.degree,
        is_verified=False,
        verify_token=token,
        token_expiry=expiry,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Send verification email (non-blocking)
    try:
        await send_verification_email(payload.email, payload.name, token)
    except Exception:
        # Don't fail registration if email delivery fails — user can request resend
        pass

    return {
        "message": "Registration successful. Please check your @itu.edu.pk inbox to verify your account.",
        "email": payload.email,
    }


@router.get("/verify-email/{token}", response_model=dict)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """
    Verify a user's email address using the UUID token from the verification email.
    """
    result = await db.execute(
        select(User).where(User.verify_token == token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or already used verification link.")

    if user.token_expiry and datetime.now(timezone.utc) > user.token_expiry:
        raise HTTPException(status_code=400, detail="Verification link has expired. Please register again.")

    user.is_verified = True
    user.verify_token = None
    user.token_expiry = None
    await db.commit()

    return {"message": "Email verified successfully! You can now log in and start trading."}


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user and return a JWT access token.
    """
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user


@router.post("/resend-verification", response_model=dict)
async def resend_verification(
    payload: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """Resend verification email if the user hasn't verified yet."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    if user.is_verified:
        return {"message": "Account is already verified. Please log in."}

    # Refresh token
    token = str(uuid.uuid4())
    user.verify_token = token
    user.token_expiry = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.commit()

    await send_verification_email(payload.email, user.name, token)
    return {"message": "Verification email resent. Please check your inbox."}


@router.get("/profile/{user_id}", response_model=UserPublic)
async def get_public_profile(user_id: int, db: AsyncSession = Depends(get_db)):
    """
    Public profile endpoint — returns name, batch, degree, reputation only.
    Used by Market Radar when clicking a bid/ask price level to see who placed it.
    Deliberately excludes email and any private data.
    """
    result = await db.execute(select(User).where(User.id == user_id, User.is_verified == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user
