"""
Email service — sends OTP codes via Gmail SMTP.
Falls back gracefully if SMTP is not configured.
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def send_otp_email(to_email: str, otp_code: str, requester_name: str, system_name: str) -> bool:
    """Send OTP verification code to the requester's email."""
    if not settings.SMTP_EMAIL or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — OTP email not sent. Code: %s", otp_code)
        return False

    subject = "SecureDesk PAM — Identity Verification Code"
    body = f"""
Hello {requester_name},

An approver has issued a verification code for your access request to: {system_name}

Your One-Time Verification Code:

    {otp_code}

This code expires in 5 minutes.

To complete verification, read this code back to the approver over the phone.
Do NOT share this code via email, SMS, or chat.

— SecureDesk PAM
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(body, "plain"))

    try:
        if settings.SMTP_USE_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.ehlo()
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)

        server.login(settings.SMTP_EMAIL, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_EMAIL, to_email, msg.as_string())
        server.quit()
        logger.info("OTP email sent to %s for system=%s", to_email, system_name)
        return True
    except Exception as e:
        logger.error("Failed to send OTP email to %s: %s", to_email, e)
        return False
