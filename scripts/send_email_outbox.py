import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from urllib import error, request


SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SMTP_HOST = os.environ["SMTP_HOST"]
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ["SMTP_USER"]
SMTP_PASS = os.environ["SMTP_PASS"]
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "FieldHub Support")
BATCH_SIZE = int(os.environ.get("EMAIL_OUTBOX_BATCH_SIZE", "10"))


def supabase_request(method, path, body=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = request.Request(
        f"{SUPABASE_URL}{path}",
        data=data,
        method=method,
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )

    try:
        with request.urlopen(req, timeout=30) as response:
            text = response.read().decode("utf-8")
            return json.loads(text) if text else None
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path} failed: {exc.code} {detail}") from exc


def fetch_queued_emails():
    path = (
        "/rest/v1/email_outbox"
        f"?status=eq.queued"
        f"&select=*"
        f"&order=created_at.asc"
        f"&limit={BATCH_SIZE}"
    )
    return supabase_request("GET", path) or []


def mark_email(row_id, status, error_message=""):
    body = {
        "status": status,
        "error_message": error_message[:1000],
        "updated_at": "now()",
    }
    if status == "sent":
        body["sent_at"] = "now()"

    # PostgREST does not evaluate now() in JSON bodies, so use ISO timestamps instead.
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    body["updated_at"] = now
    if status == "sent":
        body["sent_at"] = now

    supabase_request("PATCH", f"/rest/v1/email_outbox?id=eq.{row_id}", body)


def build_message(row):
    message = EmailMessage()
    message["From"] = format_from(row.get("from_email") or SMTP_FROM)
    message["To"] = row["to_email"]
    message["Subject"] = row["subject"]
    message.set_content(row.get("text_body") or "")

    html_body = row.get("html_body") or ""
    if html_body:
        message.add_alternative(html_body, subtype="html")

    return message


def format_from(value):
    value = (value or SMTP_FROM).strip()
    if "<" in value and ">" in value:
        return value
    return f"{SMTP_FROM_NAME} <{value}>"


def send_message(message):
    if SMTP_PORT == 465:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=45) as smtp:
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.send_message(message)
        return

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=45) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ssl.create_default_context())
        smtp.ehlo()
        smtp.login(SMTP_USER, SMTP_PASS)
        smtp.send_message(message)


def main():
    queued = fetch_queued_emails()
    if not queued:
        print("No queued emails.")
        return 0

    sent = 0
    failed = 0
    for row in queued:
        row_id = row["id"]
        try:
            send_message(build_message(row))
            mark_email(row_id, "sent")
            sent += 1
            print(f"Sent email {row_id} to {row['to_email']}")
        except Exception as exc:
            failed += 1
            mark_email(row_id, "failed", str(exc))
            print(f"Failed email {row_id}: {exc}", file=sys.stderr)

    print(f"Processed {len(queued)} queued emails: {sent} sent, {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
