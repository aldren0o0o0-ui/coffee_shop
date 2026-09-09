from __future__ import annotations

import os
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

if TYPE_CHECKING:
    from app.modules.orders.models import Order
    from app.modules.payments.models import Payment

RECEIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads", "receipts")
os.makedirs(RECEIPTS_DIR, exist_ok=True)


def generate_receipt_pdf(order: Order, payment: Payment | None = None) -> str:
    """
    Generates an immutable standard 80mm thermal receipt PDF using ReportLab.
    Saves to /uploads/receipts/receipt_{order_id}.pdf and returns the relative URL.
    """
    filename = f"receipt_{order.order_id}.pdf"
    filepath = os.path.join(RECEIPTS_DIR, filename)

    # 80mm width standard thermal receipt, variable height
    page_width = 80 * mm
    page_height = 200 * mm

    doc = SimpleDocTemplate(
        filepath,
        pagesize=(page_width, page_height),
        leftMargin=4 * mm,
        rightMargin=4 * mm,
        topMargin=6 * mm,
        bottomMargin=6 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        "ReceiptTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=16,
        alignment=1,  # Center
        textColor=colors.HexColor("#292524"),
    )

    subtitle_style = ParagraphStyle(
        "ReceiptSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        alignment=1,
        textColor=colors.HexColor("#78716c"),
    )

    pickup_style = ParagraphStyle(
        "PickupCode",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        alignment=1,
        textColor=colors.HexColor("#78350f"),
    )

    body_style = ParagraphStyle(
        "ReceiptBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1c1917"),
    )

    body_bold = ParagraphStyle(
        "ReceiptBodyBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1c1917"),
    )

    elements = []

    # 1. Header
    elements.append(Paragraph("☕ ldrn's coffee", title_style))
    elements.append(Spacer(1, 1 * mm))
    elements.append(Paragraph("Artisan Brews & Espresso Bar", subtitle_style))
    elements.append(Paragraph("Official Customer Receipt", subtitle_style))
    elements.append(Spacer(1, 2 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d6d3d1"), spaceBefore=1, spaceAfter=2))

    # 2. Pickup Code Box
    if order.pickup_code:
        elements.append(Paragraph("SINGLE-USE PICKUP CODE", subtitle_style))
        elements.append(Spacer(1, 1 * mm))
        elements.append(Paragraph(order.pickup_code, pickup_style))
        elements.append(Spacer(1, 1 * mm))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d6d3d1"), spaceBefore=1, spaceAfter=2))

    # 3. Order Details
    customer_name = order.customer.first_name if order.customer and order.customer.first_name else "Walk-in Guest"
    if order.customer and order.customer.last_name:
        customer_name += f" {order.customer.last_name}"

    order_date_str = order.order_date.strftime("%Y-%m-%d %I:%M %p") if hasattr(order.order_date, "strftime") else str(order.order_date)

    meta_data = [
        [Paragraph("Order #:", body_bold), Paragraph(str(order.order_id), body_style)],
        [Paragraph("Date/Time:", body_bold), Paragraph(order_date_str, body_style)],
        [Paragraph("Customer:", body_bold), Paragraph(customer_name, body_style)],
        [Paragraph("Order Type:", body_bold), Paragraph(f"{order.order_channel.value.upper()} • {order.order_type.value.upper()}", body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[24 * mm, 48 * mm])
    meta_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 0.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.5),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 2 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d6d3d1"), spaceBefore=1, spaceAfter=2))

    # 4. Itemized Line Items
    item_rows = [[
        Paragraph("Item", body_bold),
        Paragraph("Qty", body_bold),
        Paragraph("Amount", body_bold),
    ]]

    for item in order.order_items:
        desc = item.menu_item.item_name
        if item.menu_item_size:
            desc += f" ({item.menu_item_size.size_name})"
        if item.addons:
            addon_names = ", ".join(a.menu_item_addon.addon_name for a in item.addons if a.menu_item_addon)
            if addon_names:
                desc += f"<br/><font size=6 color='#78716c'>+ {addon_names}</font>"

        item_rows.append([
            Paragraph(desc, body_style),
            Paragraph(str(item.quantity), body_style),
            Paragraph(f"${Decimal(item.subtotal):.2f}", body_style),
        ])

    items_table = Table(item_rows, colWidths=[42 * mm, 12 * mm, 18 * mm])
    items_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 2 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d6d3d1"), spaceBefore=1, spaceAfter=2))

    # 5. Financial Summary & Tender
    total_data = [
        [Paragraph("Subtotal:", body_style), Paragraph(f"${Decimal(order.subtotal):.2f}", body_style)],
        [Paragraph("Tax (8%):", body_style), Paragraph(f"${Decimal(order.tax_amount):.2f}", body_style)],
        [Paragraph("TOTAL DUE:", body_bold), Paragraph(f"${Decimal(order.total_amount):.2f}", body_bold)],
    ]

    if payment:
        method_str = payment.payment_method.value.upper()
        total_data.append([Paragraph(f"Payment ({method_str}):", body_style), Paragraph(f"${Decimal(payment.amount_paid):.2f}", body_style)])

        if payment.amount_tendered is not None and payment.change_due is not None:
            total_data.append([Paragraph("Cash Tendered:", body_style), Paragraph(f"${Decimal(payment.amount_tendered):.2f}", body_style)])
            total_data.append([Paragraph("Change Given:", body_bold), Paragraph(f"${Decimal(payment.change_due):.2f}", body_bold)])

    totals_table = Table(total_data, colWidths=[42 * mm, 30 * mm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 0.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.5),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 3 * mm))

    # 6. Footer
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d6d3d1"), spaceBefore=1, spaceAfter=2))
    elements.append(Paragraph("Thank you for ordering at ldrn's coffee!", subtitle_style))
    elements.append(Paragraph("Handcrafted fresh to order.", subtitle_style))

    doc.build(elements)

    relative_url = f"/uploads/receipts/{filename}"
    return relative_url
