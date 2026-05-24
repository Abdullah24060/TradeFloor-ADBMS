import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


async def send_email(to_email: str, subject: str, html_body: str) -> None:
    """
    Send an HTML email via SMTP (Gmail App Password locally, SES on AWS).
    Uses aiosmtplib for async, non-blocking delivery.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.app_name} <{settings.smtp_from}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=settings.smtp_pass,
        start_tls=True,
    )


async def send_verification_email(to_email: str, name: str, token: str) -> None:
    verify_url = f"{settings.frontend_url}/verify?token={token}"
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: 'Inter', Arial, sans-serif; background:#0f0f0f; color:#e0e0e0; padding:40px;">
      <div style="max-width:520px;margin:auto;background:#1a1a2e;border-radius:16px;padding:40px;
                  border:1px solid #2a2a4a;">
        <h1 style="color:#7c6af7;margin-bottom:8px;">{settings.app_name}</h1>
        <p style="color:#888;margin-top:0;font-size:13px;">Campus Micro-Economy Exchange</p>
        <hr style="border:none;border-top:1px solid #2a2a4a;margin:24px 0;">
        <h2 style="color:#e0e0e0;">Welcome, {name}!</h2>
        <p style="color:#aaa;line-height:1.6;">
          You're one step away from joining {settings.app_name} — the campus exchange for textbooks,
          tickets, electronics, and services.
        </p>
        <p style="color:#aaa;line-height:1.6;">
          Click the button below to verify your ITU email and activate your account:
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="{verify_url}"
             style="background:linear-gradient(135deg,#7c6af7,#a78bfa);color:#fff;
                    padding:14px 32px;border-radius:8px;text-decoration:none;
                    font-weight:600;font-size:16px;display:inline-block;">
            Verify My Email →
          </a>
        </div>
        <p style="color:#555;font-size:12px;">This link expires in 24 hours.</p>
        <p style="color:#555;font-size:12px;">
          If you didn't register on TradeFloor, ignore this email.
        </p>
      </div>
    </body>
    </html>
    """
    await send_email(to_email, f"Verify your {settings.app_name} account", html)


async def send_trade_notification(
    to_email: str,
    name: str,
    item_name: str,
    role: str,  # "buyer" or "seller"
    trade_id: int,
    release_code: str | None,
) -> None:
    if role == "buyer":
        subject = f"Trade matched! Your release code for {item_name}"
        body_content = f"""
        <p style="color:#aaa;line-height:1.6;">
          Great news — your <strong>BUY order</strong> for <strong>{item_name}</strong>
          has been matched! Here is your <strong>6-digit Release Code</strong>:
        </p>
        <div style="text-align:center;margin:32px 0;">
          <div style="background:#0f0f0f;border:2px solid #7c6af7;border-radius:12px;
                      padding:24px;display:inline-block;">
            <span style="font-size:42px;font-weight:800;color:#7c6af7;letter-spacing:12px;">
              {release_code}
            </span>
          </div>
        </div>
        <p style="color:#aaa;line-height:1.6;">
          Share this code with the seller <strong>ONLY after</strong> you have met on campus,
          inspected the item, and paid in cash. The trade cannot be cancelled once you share it.
        </p>
        """
    else:
        subject = f"Trade matched! Meet the buyer for {item_name}"
        body_content = f"""
        <p style="color:#aaa;line-height:1.6;">
          Your <strong>SELL order</strong> for <strong>{item_name}</strong>
          has been matched! Arrange a campus meetup with the buyer.
        </p>
        <p style="color:#aaa;line-height:1.6;">
          After the exchange, ask the buyer for their <strong>6-digit Release Code</strong>
          and enter it in your TradeFloor app to complete the trade and earn your reputation point.
        </p>
        <p style="color:#aaa;">Trade ID: <strong>#{trade_id}</strong></p>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:'Inter',Arial,sans-serif;background:#0f0f0f;color:#e0e0e0;padding:40px;">
      <div style="max-width:520px;margin:auto;background:#1a1a2e;border-radius:16px;padding:40px;
                  border:1px solid #2a2a4a;">
        <h1 style="color:#7c6af7;margin-bottom:8px;">{settings.app_name}</h1>
        <p style="color:#888;margin-top:0;font-size:13px;">Trade #{trade_id}</p>
        <hr style="border:none;border-top:1px solid #2a2a4a;margin:24px 0;">
        <h2 style="color:#e0e0e0;">Hi {name}!</h2>
        {body_content}
        <hr style="border:none;border-top:1px solid #2a2a4a;margin:24px 0;">
        <p style="color:#555;font-size:12px;">
          Login to your {settings.app_name} account to view full trade details.
        </p>
      </div>
    </body>
    </html>
    """
    await send_email(to_email, subject, html)
