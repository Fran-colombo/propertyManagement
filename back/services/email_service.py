import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional


class EmailConfigError(Exception):
    pass


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def smtp_host() -> str:
    return _env("SMTP_HOST")


def smtp_port() -> int:
    raw = _env("SMTP_PORT", "587")
    try:
        return int(raw)
    except ValueError:
        return 587


def smtp_user() -> str:
    return _env("SMTP_USER")


def smtp_password() -> str:
    return os.getenv("SMTP_PASSWORD") or ""


def smtp_from() -> str:
    return _env("SMTP_FROM") or smtp_user()


def reminder_to_email() -> str:
    return _env("REMINDER_TO_EMAIL")


def smtp_configured() -> bool:
    return bool(smtp_host() and smtp_user() and reminder_to_email())


def send_email(to_addr: str, subject: str, body: str, html_body: Optional[str] = None) -> None:
    host = smtp_host()
    user = smtp_user()
    password = smtp_password()
    from_addr = smtp_from()
    to_addr = (to_addr or "").strip()
    if not host or not user or not from_addr or not to_addr:
        raise EmailConfigError("Falta configurar SMTP_HOST, SMTP_USER y el destinatario.")

    if html_body:
        message = MIMEMultipart("alternative")
        message.attach(MIMEText(body, "plain", "utf-8"))
        message.attach(MIMEText(html_body, "html", "utf-8"))
    else:
        message = MIMEText(body, "plain", "utf-8")
    message["Subject"] = subject
    message["From"] = formataddr(("Gestión Inmobiliaria", from_addr))
    message["To"] = to_addr

    port = smtp_port()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=20) as server:
            if password:
                server.login(user, password)
            server.sendmail(from_addr, [to_addr], message.as_string())
        return

    with smtplib.SMTP(host, port, timeout=20) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        if password:
            server.login(user, password)
        server.sendmail(from_addr, [to_addr], message.as_string())
