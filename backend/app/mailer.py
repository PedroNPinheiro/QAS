"""Outgoing email notifications.

Emails are sent from a background task so record creation never waits on
(or fails because of) the mail server; failures are logged.
"""
import html
import logging
import smtplib
import ssl
from datetime import date, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from .config import settings
from .crud_router import ENUM_FIELDS, ENUM_LABELS, _header_label

logger = logging.getLogger("qas.mail")


def send_email(recipients: list[str], subject: str, html_body: str) -> None:
    if not recipients:
        return
    if not settings.smtp_host or not settings.smtp_user:
        logger.warning("SMTP not configured — skipping notification %r", subject)
        return
    sender = settings.mail_from or settings.smtp_user
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    # BCC monitors go on the SMTP envelope only, never in the headers
    bcc = [a.strip().lower() for a in settings.mail_bcc.split(",") if a.strip()]
    envelope = list(dict.fromkeys([r.lower() for r in recipients] + bcc))
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.sendmail(sender, envelope, msg.as_string())
        logger.info("Notification sent to %s (bcc %s): %s", recipients, bcc or "—", subject)
    except Exception:
        logger.exception("Failed to send notification to %s (%s)", recipients, subject)


def _fmt(field: str, value) -> str:
    if value is None or value == "":
        return "—"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    if field in ENUM_FIELDS:
        return ENUM_LABELS.get(str(value), str(value))
    return str(value)


def record_email(
    *,
    display_name: str,
    record: dict,
    fields: list[str],
    record_path: str,
) -> tuple[str, str]:
    """Build (subject, html) for a newly created record."""
    reference = record.get("reference", "")
    subject = f"[QAS] {reference} — New {display_name}"
    url = f"{settings.app_base_url.rstrip('/')}{record_path}"

    rows = []
    for f in fields:
        label = html.escape(_header_label(f))
        value = html.escape(_fmt(f, record.get(f))).replace("\n", "<br>")
        rows.append(
            f"<tr><td style='padding:6px 12px;color:#6b6b66;font-size:13px;"
            f"vertical-align:top;white-space:nowrap'>{label}</td>"
            f"<td style='padding:6px 12px;font-size:13px;color:#1a1a19'>{value}</td></tr>"
        )

    body = f"""
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f4f4f0;padding:24px">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e1e0d9;border-radius:12px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #e1e0d9">
      <div style="font-size:12px;color:#898781">QAS — Quality, Safety &amp; Environment</div>
      <div style="font-size:18px;font-weight:600;color:#1a1a19;margin-top:2px">
        {html.escape(reference)} · New {html.escape(display_name)}
      </div>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0">
      {''.join(rows)}
    </table>
    <div style="padding:16px 20px;border-top:1px solid #e1e0d9">
      <a href="{url}" style="display:inline-block;background:#2a78d6;color:#ffffff;text-decoration:none;
         padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600">Open in QAS</a>
    </div>
  </div>
  <div style="max-width:640px;margin:10px auto 0;color:#898781;font-size:11px">
    Automatic notification from QAS. Replies to this mailbox are not monitored by the app.
  </div>
</div>"""
    return subject, body
