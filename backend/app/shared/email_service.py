import logging
import smtplib
import ssl
import threading
from datetime import datetime
from decimal import Decimal
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING, Any

from app.core.config import settings

if TYPE_CHECKING:
    from app.modules.orders.models import Order
    from app.modules.payments.models import Payment

logger = logging.getLogger("app.email_service")

# In-memory storage for test inspection and audit of recently dispatched emails (capped at 50)
RECENT_DISPATCHED_EMAILS: list[dict[str, Any]] = []
_RECENT_LOCK = threading.Lock()


def record_dispatched_email(email_record: dict[str, Any]) -> None:
    with _RECENT_LOCK:
        RECENT_DISPATCHED_EMAILS.insert(0, email_record)
        if len(RECENT_DISPATCHED_EMAILS) > 50:
            RECENT_DISPATCHED_EMAILS.pop()


def get_recent_dispatched_emails() -> list[dict[str, Any]]:
    with _RECENT_LOCK:
        return list(RECENT_DISPATCHED_EMAILS)


def clear_recent_dispatched_emails() -> None:
    with _RECENT_LOCK:
        RECENT_DISPATCHED_EMAILS.clear()


def format_currency(val: Decimal | float | int | None) -> str:
    if val is None:
        return "₱0.00"
    return f"₱{float(val):,.2f}"


def format_timestamp(dt: datetime | None) -> str:
    if not dt:
        return ""
    return dt.strftime("%B %d, %Y, %I:%M %p")


def send_email_message(
    recipient_email: str,
    subject: str,
    html_content: str,
    text_content: str,
) -> tuple[bool, str | None]:
    """
    Sends an email to the recipient.
    - If SMTP is configured in settings, connects via smtplib and delivers the email.
    - If SMTP is not configured (local dev/offline), safely logs the email and records it to in-memory audit store.
    Never throws unhandled exceptions that could interrupt order checkout.
    """
    clean_recipient = (recipient_email or "").strip().lower()
    if not clean_recipient or "@" not in clean_recipient:
        logger.warning(f"Cannot send email: Invalid recipient address '{recipient_email}'")
        return False, "Invalid recipient email address"

    record_entry = {
        "recipient": clean_recipient,
        "subject": subject,
        "html_content": html_content,
        "text_content": text_content,
        "timestamp": datetime.now(),
        "delivered_via": "smtp" if settings.smtp_host else "simulated_logger",
    }
    record_dispatched_email(record_entry)

    # If no SMTP host is configured, perform safe simulated delivery
    if not settings.smtp_host:
        logger.info(
            f"[EMAIL DISPATCH (DEV/SIMULATED)]\n"
            f"  To: {clean_recipient}\n"
            f"  Subject: {subject}\n"
            f"  From: {settings.smtp_from_name} <{settings.smtp_from_email}>\n"
            f"  Message Preview: {text_content[:200]}..."
        )
        return True, None

    # Connect to configured SMTP Server
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = clean_recipient

        part_text = MIMEText(text_content, "plain", "utf-8")
        part_html = MIMEText(html_content, "html", "utf-8")
        msg.attach(part_text)
        msg.attach(part_html)

        if settings.smtp_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=10) as server:
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                if settings.smtp_tls:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)

        logger.info(f"Successfully sent email to {clean_recipient}: '{subject}'")
        return True, None
    except Exception as exc:
        error_msg = f"SMTP dispatch failed: {exc}"
        logger.error(f"Error sending email to {clean_recipient}: {exc}")
        return False, error_msg


def dispatch_async(
    recipient_email: str,
    subject: str,
    html_content: str,
    text_content: str,
) -> None:
    """Dispatches the email asynchronously in a daemon thread so the API response is not blocked."""
    thread = threading.Thread(
        target=send_email_message,
        args=(recipient_email, subject, html_content, text_content),
        daemon=True,
    )
    thread.start()


# =========================================================================
# TEMPLATE 1: PAY-AT-COUNTER REFERENCE CODE & ORDER CONFIRMATION
# =========================================================================

def send_counter_order_confirmation_email(
    order: "Order",
    recipient_email: str | None = None,
    run_async: bool = True,
) -> tuple[bool, str | None]:
    """
    Generates and delivers the Pay-at-Counter confirmation email containing:
    - Reference Code (REF-XXXX)
    - Order Number (#XXXX)
    - Itemized order breakdown and totals
    - 24-hour expiration notice
    - Professional counter instructions and online tracking link
    """
    to_email = recipient_email or (order.customer.email if order.customer else None)
    if not to_email:
        return False, "No customer email address on order"

    customer_name = "Valued Customer"
    if order.customer:
        customer_name = f"{order.customer.first_name} {order.customer.last_name or ''}".strip() or customer_name

    ref_code = order.reference_code or f"REF-{order.order_id}"
    order_num = f"#{order.order_id}"
    total_str = format_currency(order.total_amount)
    expires_str = format_timestamp(order.expires_at) if order.expires_at else "in 24 hours"
    tracking_url = f"{settings.frontend_url}/track"

    # Build items rows for HTML & Text
    items_html = ""
    items_text = ""
    for item in order.order_items or []:
        item_name = item.menu_item.item_name if item.menu_item else "Artisan Coffee"
        size_label = f" ({item.menu_item_size.size_name})" if item.menu_item_size else ""
        qty_str = f"{item.quantity}x"
        line_price = format_currency(item.subtotal)

        addon_names = [a.menu_item_addon.addon_name for a in (item.addons or []) if a.menu_item_addon]
        addons_label = f"<div style='font-size: 11px; color: #78716c;'>+ {', '.join(addon_names)}</div>" if addon_names else ""
        addons_text = f" (+ {', '.join(addon_names)})" if addon_names else ""

        items_html += f"""
        <tr style="border-bottom: 1px solid #f5f5f4;">
            <td style="padding: 10px 0; font-size: 13px; color: #1c1917; font-weight: 600;">
                {qty_str} {item_name}{size_label}
                {addons_label}
            </td>
            <td style="padding: 10px 0; font-size: 13px; color: #1c1917; font-weight: 700; text-align: right;">
                {line_price}
            </td>
        </tr>
        """
        items_text += f"- {qty_str} {item_name}{size_label}{addons_text} : {line_price}\n"

    subject = f"Your Order Confirmation & Counter Reference Code - Order {order_num} [{ref_code}]"

    # Plain-text version
    text_content = f"""Hello {customer_name},

Thank you for placing your order with LDRN's Coffee Roastery!

Here is your counter reservation information:
--------------------------------------------------
REFERENCE CODE: {ref_code}
ORDER NUMBER:   {order_num}
TOTAL DUE:      {total_str}
VALID UNTIL:    {expires_str}
--------------------------------------------------

YOUR ORDER SUMMARY:
{items_text}
Subtotal: {format_currency(order.subtotal)}
Tax (8%): {format_currency(order.tax_amount)}
Total Due: {total_str}

HOW TO COMPLETE YOUR ORDER:
1. Visit our coffee shop counter within 24 hours.
2. Present your Reference Code ({ref_code}) to our cashier.
3. You may adjust items, drink sizes, or toppings if you wish before payment.
4. Pay via Cash or Card at the register. Once paid, our baristas will immediately prepare your handcrafted beverages!

You can also monitor live preparation status at:
{tracking_url}

Thank you for choosing LDRN's Coffee Roastery!
Artisan Coffee & Warm Hospitality
"""

    # Rich responsive HTML version
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f4; padding: 30px 15px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; border: 1px solid #e7e5e4; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                    <!-- BRAND HEADER -->
                    <tr>
                        <td style="background-color: #451a03; padding: 32px 30px; text-align: center;">
                            <span style="font-size: 28px; display: block; margin-bottom: 6px;">☕</span>
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">LDRN'S COFFEE</h1>
                            <p style="margin: 4px 0 0 0; color: #fde68a; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Artisan Coffee Roastery &amp; Cafe</p>
                        </td>
                    </tr>

                    <!-- GREETING & HERO NOTICE -->
                    <tr>
                        <td style="padding: 30px 30px 10px 30px;">
                            <h2 style="margin: 0 0 8px 0; color: #1c1917; font-size: 18px; font-weight: 800;">Hello {customer_name},</h2>
                            <p style="margin: 0; color: #57534e; font-size: 13px; line-height: 1.6;">
                                Thank you for ordering online! Your order is reserved and waiting for you at our cashier counter.
                            </p>
                        </td>
                    </tr>

                    <!-- REFERENCE CODE BANNER -->
                    <tr>
                        <td style="padding: 15px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border: 2px dashed #f59e0b; border-radius: 18px; text-align: center; padding: 22px 15px;">
                                <tr>
                                    <td>
                                        <span style="font-size: 10px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 1.5px; display: block;">Your Counter Reference Code</span>
                                        <span style="font-size: 32px; font-weight: 900; color: #451a03; letter-spacing: 3px; display: block; margin: 6px 0;">{ref_code}</span>
                                        <span style="font-size: 12px; font-weight: 700; color: #78350f;">Order {order_num} &bull; Total: {total_str}</span>
                                        <div style="margin-top: 10px; display: inline-block; background-color: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">
                                            ⏳ Valid for 24 hours (until {expires_str})
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- HOW IT WORKS INSTRUCTIONS -->
                    <tr>
                        <td style="padding: 10px 30px 20px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafaf9; border: 1px solid #f5f5f4; border-radius: 16px; padding: 18px 20px;">
                                <tr>
                                    <td>
                                        <h3 style="margin: 0 0 10px 0; color: #292524; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">📍 Next Steps at the Counter:</h3>
                                        <ol style="margin: 0; padding-left: 18px; color: #44403c; font-size: 12px; line-height: 1.6;">
                                            <li style="margin-bottom: 5px;"><strong>Present this code</strong> (<strong>{ref_code}</strong>) to the cashier at our store.</li>
                                            <li style="margin-bottom: 5px;"><strong>Review or customize</strong> your drinks (you can add toppings or change sizes).</li>
                                            <li><strong>Pay with cash or card</strong>. Once paid, our baristas will craft your drinks fresh!</li>
                                        </ol>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ORDER ITEMS SUMMARY -->
                    <tr>
                        <td style="padding: 10px 30px 20px 30px;">
                            <h3 style="margin: 0 0 12px 0; color: #292524; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Order Summary</h3>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                {items_html}
                            </table>

                            <!-- FINANCIAL TOTALS -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 14px; border-top: 1px solid #e7e5e4; padding-top: 10px;">
                                <tr>
                                    <td style="font-size: 12px; color: #78716c; padding: 2px 0;">Subtotal</td>
                                    <td style="font-size: 12px; color: #44403c; font-weight: 600; text-align: right; padding: 2px 0;">{format_currency(order.subtotal)}</td>
                                </tr>
                                <tr>
                                    <td style="font-size: 12px; color: #78716c; padding: 2px 0;">Tax (8%)</td>
                                    <td style="font-size: 12px; color: #44403c; font-weight: 600; text-align: right; padding: 2px 0;">{format_currency(order.tax_amount)}</td>
                                </tr>
                                <tr>
                                    <td style="font-size: 15px; color: #1c1917; font-weight: 900; padding: 8px 0 0 0;">Total Due at Counter</td>
                                    <td style="font-size: 16px; color: #451a03; font-weight: 900; text-align: right; padding: 8px 0 0 0;">{total_str}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA BUTTON -->
                    <tr>
                        <td style="padding: 10px 30px 30px 30px; text-align: center;">
                            <a href="{tracking_url}" target="_blank" style="display: inline-block; background-color: #451a03; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 14px; font-size: 13px; font-weight: 800; box-shadow: 0 2px 6px rgba(69, 26, 3, 0.2);">
                                Track Order Online &rarr;
                            </a>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="background-color: #fafaf9; border-top: 1px solid #f5f5f4; padding: 24px 30px; text-align: center;">
                            <p style="margin: 0; color: #78716c; font-size: 11px; line-height: 1.5;">
                                &copy; {datetime.now().year} LDRN's Coffee Roastery. All rights reserved.<br>
                                If you have questions about your order, please show this email to your barista or cashier upon arrival.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

    if run_async:
        dispatch_async(to_email, subject, html_content, text_content)
        return True, None
    return send_email_message(to_email, subject, html_content, text_content)


# =========================================================================
# TEMPLATE 2: PAYMENT RECEIPT & SINGLE-USE PICKUP CODE
# =========================================================================

def send_payment_receipt_email(
    order: "Order",
    payment: "Payment",
    recipient_email: str | None = None,
    run_async: bool = True,
) -> tuple[bool, str | None]:
    """
    Generates and delivers the official payment receipt email containing:
    - Single-Use Pickup Code (BF-XXXX)
    - Order Number (#XXXX)
    - Payment settlement details (Method, Amount, Cash Tendered/Change)
    - Itemized breakdown & Receipt PDF download link
    - Barista queue status and pickup instructions
    """
    to_email = recipient_email or (order.customer.email if order.customer else None)
    if not to_email:
        return False, "No customer email address on order"

    customer_name = "Valued Customer"
    if order.customer:
        customer_name = f"{order.customer.first_name} {order.customer.last_name or ''}".strip() or customer_name

    pickup_code = order.pickup_code or "READY"
    order_num = f"#{order.order_id}"
    paid_str = format_currency(payment.amount_paid)
    paid_at_str = format_timestamp(payment.paid_at or datetime.now())
    method_str = payment.payment_method.value.upper() if hasattr(payment.payment_method, "value") else str(payment.payment_method).upper()
    tracking_url = f"{settings.frontend_url}/track"

    receipt_url_full = ""
    if payment.receipt_pdf_url:
        receipt_url_full = f"{settings.frontend_url}{payment.receipt_pdf_url}"

    tender_html = ""
    tender_text = ""
    if payment.amount_tendered is not None:
        tender_html = f"""
        <tr>
            <td style="font-size: 12px; color: #78716c; padding: 2px 0;">Cash Tendered</td>
            <td style="font-size: 12px; color: #44403c; font-weight: 600; text-align: right; padding: 2px 0;">{format_currency(payment.amount_tendered)}</td>
        </tr>
        <tr>
            <td style="font-size: 12px; color: #047857; font-weight: 700; padding: 2px 0;">Change Given</td>
            <td style="font-size: 12px; color: #047857; font-weight: 700; text-align: right; padding: 2px 0;">{format_currency(payment.change_due or 0)}</td>
        </tr>
        """
        tender_text = f"\nCash Tendered: {format_currency(payment.amount_tendered)}\nChange Given: {format_currency(payment.change_due or 0)}"

    # Build items rows
    items_html = ""
    items_text = ""
    for item in order.order_items or []:
        item_name = item.menu_item.item_name if item.menu_item else "Artisan Coffee"
        size_label = f" ({item.menu_item_size.size_name})" if item.menu_item_size else ""
        qty_str = f"{item.quantity}x"
        line_price = format_currency(item.subtotal)

        addon_names = [a.menu_item_addon.addon_name for a in (item.addons or []) if a.menu_item_addon]
        addons_label = f"<div style='font-size: 11px; color: #78716c;'>+ {', '.join(addon_names)}</div>" if addon_names else ""
        addons_text = f" (+ {', '.join(addon_names)})" if addon_names else ""

        items_html += f"""
        <tr style="border-bottom: 1px solid #f5f5f4;">
            <td style="padding: 10px 0; font-size: 13px; color: #1c1917; font-weight: 600;">
                {qty_str} {item_name}{size_label}
                {addons_label}
            </td>
            <td style="padding: 10px 0; font-size: 13px; color: #1c1917; font-weight: 700; text-align: right;">
                {line_price}
            </td>
        </tr>
        """
        items_text += f"- {qty_str} {item_name}{size_label}{addons_text} : {line_price}\n"

    subject = f"Receipt & Pickup Code for Order {order_num} [{pickup_code}] - LDRN's Coffee"

    # Plain-text version
    text_content = f"""Hello {customer_name},

Thank you for your visit to LDRN's Coffee Roastery! Your payment has been confirmed.

--------------------------------------------------
SINGLE-USE PICKUP CODE: {pickup_code}
ORDER NUMBER:           {order_num}
TOTAL PAID:             {paid_str}
PAYMENT METHOD:         {method_str}
TRANSACTION REF:        {payment.transaction_reference or 'N/A'}
DATE & TIME:            {paid_at_str}{tender_text}
--------------------------------------------------

YOUR ORDER:
{items_text}
Subtotal: {format_currency(order.subtotal)}
Tax (8%): {format_currency(order.tax_amount)}
Total Paid: {paid_str}

BARISTA PICKUP INSTRUCTIONS:
Your drinks are currently queued at our barista station! When your order is called or displayed on the pickup counter, present your Pickup Code ({pickup_code}) to collect your freshly brewed beverages.

Track your order status live:
{tracking_url}

Thank you for being part of the LDRN's Coffee family!
"""

    # Rich responsive HTML version
    receipt_button_html = ""
    if receipt_url_full:
        receipt_button_html = f"""
        <div style="margin-top: 15px;">
            <a href="{receipt_url_full}" target="_blank" style="display: inline-block; background-color: #fef3c7; color: #92400e; text-decoration: none; padding: 8px 18px; border-radius: 12px; font-size: 12px; font-weight: 800; border: 1px solid #fde68a;">
                ⬇️ Download Official Thermal Receipt PDF
            </a>
        </div>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f4; padding: 30px 15px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; border: 1px solid #e7e5e4; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                    <!-- BRAND HEADER -->
                    <tr>
                        <td style="background-color: #451a03; padding: 32px 30px; text-align: center;">
                            <span style="font-size: 28px; display: block; margin-bottom: 6px;">✓</span>
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">PAYMENT CONFIRMED</h1>
                            <p style="margin: 4px 0 0 0; color: #fde68a; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">LDRN's Coffee Roastery &amp; Cafe</p>
                        </td>
                    </tr>

                    <!-- GREETING & CONFIRMATION -->
                    <tr>
                        <td style="padding: 30px 30px 10px 30px;">
                            <h2 style="margin: 0 0 8px 0; color: #1c1917; font-size: 18px; font-weight: 800;">Thank you, {customer_name}!</h2>
                            <p style="margin: 0; color: #57534e; font-size: 13px; line-height: 1.6;">
                                Your payment has been received and verified. Your order is dispatched to our barista workstation.
                            </p>
                        </td>
                    </tr>

                    <!-- PICKUP CODE BANNER -->
                    <tr>
                        <td style="padding: 15px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 18px; text-align: center; padding: 22px 15px;">
                                <tr>
                                    <td>
                                        <span style="font-size: 10px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 1.5px; display: block;">Your Single-Use Pickup Code</span>
                                        <span style="font-size: 34px; font-weight: 900; color: #065f46; letter-spacing: 3px; display: block; margin: 6px 0;">{pickup_code}</span>
                                        <span style="font-size: 12px; font-weight: 700; color: #047857;">Order {order_num} &bull; Sent to Barista Station</span>
                                        <div style="margin-top: 10px; color: #065f46; font-size: 11px; font-weight: 600;">
                                            Present this code when your drinks are ready at the counter.
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- PAYMENT RECEIPT DETAILS -->
                    <tr>
                        <td style="padding: 10px 30px 20px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafaf9; border: 1px solid #f5f5f4; border-radius: 16px; padding: 18px 20px;">
                                <tr>
                                    <td colspan="2">
                                        <h3 style="margin: 0 0 10px 0; color: #292524; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Payment Settlement</h3>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="font-size: 12px; color: #78716c; padding: 3px 0;">Payment Method</td>
                                    <td style="font-size: 12px; color: #1c1917; font-weight: 700; text-align: right; padding: 3px 0;">{method_str}</td>
                                </tr>
                                <tr>
                                    <td style="font-size: 12px; color: #78716c; padding: 3px 0;">Transaction Ref</td>
                                    <td style="font-size: 11px; color: #44403c; font-family: monospace; font-weight: 600; text-align: right; padding: 3px 0;">{payment.transaction_reference or 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="font-size: 12px; color: #78716c; padding: 3px 0;">Paid At</td>
                                    <td style="font-size: 12px; color: #44403c; font-weight: 600; text-align: right; padding: 3px 0;">{paid_at_str}</td>
                                </tr>
                                {tender_html}
                            </table>

                            {receipt_button_html}
                        </td>
                    </tr>

                    <!-- ITEMS SUMMARY -->
                    <tr>
                        <td style="padding: 10px 30px 20px 30px;">
                            <h3 style="margin: 0 0 12px 0; color: #292524; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Drinks Prepared</h3>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                {items_html}
                            </table>

                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 14px; border-top: 1px solid #e7e5e4; padding-top: 10px;">
                                <tr>
                                    <td style="font-size: 12px; color: #78716c; padding: 2px 0;">Subtotal</td>
                                    <td style="font-size: 12px; color: #44403c; font-weight: 600; text-align: right; padding: 2px 0;">{format_currency(order.subtotal)}</td>
                                </tr>
                                <tr>
                                    <td style="font-size: 12px; color: #78716c; padding: 2px 0;">Tax (8%)</td>
                                    <td style="font-size: 12px; color: #44403c; font-weight: 600; text-align: right; padding: 2px 0;">{format_currency(order.tax_amount)}</td>
                                </tr>
                                <tr>
                                    <td style="font-size: 15px; color: #1c1917; font-weight: 900; padding: 8px 0 0 0;">Total Paid</td>
                                    <td style="font-size: 16px; color: #047857; font-weight: 900; text-align: right; padding: 8px 0 0 0;">{paid_str}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- TRACK CTA -->
                    <tr>
                        <td style="padding: 10px 30px 30px 30px; text-align: center;">
                            <a href="{tracking_url}" target="_blank" style="display: inline-block; background-color: #065f46; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 14px; font-size: 13px; font-weight: 800; box-shadow: 0 2px 6px rgba(6, 95, 70, 0.2);">
                                View Live Order Status &rarr;
                            </a>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="background-color: #fafaf9; border-top: 1px solid #f5f5f4; padding: 24px 30px; text-align: center;">
                            <p style="margin: 0; color: #78716c; font-size: 11px; line-height: 1.5;">
                                &copy; {datetime.now().year} LDRN's Coffee Roastery. All rights reserved.<br>
                                Enjoy your coffee! Thank you for ordering with us.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

    if run_async:
        dispatch_async(to_email, subject, html_content, text_content)
        return True, None
    return send_email_message(to_email, subject, html_content, text_content)
