from app.modules.orders.models import Order
from app.modules.orders.schemas import (
    CustomerOrderResponse,
    OrderEventResponse,
    OrderItemAddonResponse,
    OrderItemResponse,
    OrderTrackingResponse,
)


def serialize_order(order: Order) -> CustomerOrderResponse:
    customer_name = (
        f"{order.customer.first_name} {order.customer.last_name or ''}".strip()
        if order.customer and order.customer.first_name
        else "Guest"
    )
    items = []
    for oi in order.order_items:
        addons = [
            OrderItemAddonResponse(
                order_item_addon_id=a.order_item_addon_id,
                addon_name=a.menu_item_addon.addon_name if a.menu_item_addon else "Add-on",
                quantity=a.quantity,
                unit_price=a.unit_price,
            )
            for a in oi.addons
        ]
        items.append(
            OrderItemResponse(
                order_item_id=oi.order_item_id,
                item_name=oi.menu_item.item_name if oi.menu_item else "Item",
                size_name=oi.menu_item_size.size_name if oi.menu_item_size else None,
                quantity=oi.quantity,
                unit_price=oi.unit_price,
                subtotal=oi.subtotal,
                special_instructions=oi.special_instructions,
                addons=addons,
            )
        )

    # Extract latest payment metadata if available
    latest_payment = order.payments[-1] if hasattr(order, "payments") and order.payments else None
    receipt_pdf_url = latest_payment.receipt_pdf_url if latest_payment else None
    amount_tendered = latest_payment.amount_tendered if latest_payment else None
    change_due = latest_payment.change_due if latest_payment else None

    events = [
        OrderEventResponse(
            order_event_id=ev.order_event_id,
            order_id=ev.order_id,
            previous_status=ev.previous_status,
            new_status=ev.new_status,
            user_id=ev.user_id,
            staff_actor_name=(
                f"{ev.staff_user.first_name} {ev.staff_user.last_name or ''}".strip()
                if hasattr(ev, "staff_user") and ev.staff_user and ev.staff_user.first_name
                else None
            ),
            created_at=ev.created_at,
            metadata_json=ev.metadata_json,
        )
        for ev in (order.events if hasattr(order, "events") and order.events else [])
    ]

    return CustomerOrderResponse(
        order_id=order.order_id,
        customer_name=customer_name,
        customer_email=order.customer.email if order.customer else None,
        order_channel=order.order_channel,
        order_status=order.order_status,
        order_type=order.order_type,
        payment_method_intent=order.payment_method_intent,
        reference_code=order.reference_code,
        pickup_code=order.pickup_code,
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        discount_amount=order.discount_amount,
        total_amount=order.total_amount,
        amount_tendered=amount_tendered,
        change_due=change_due,
        receipt_pdf_url=receipt_pdf_url,
        order_date=order.order_date,
        expires_at=order.expires_at,
        picked_up_at=order.picked_up_at,
        items=items,
        events=events,
    )


def serialize_order_tracking(order: Order) -> OrderTrackingResponse:
    customer_name = (
        f"{order.customer.first_name} {order.customer.last_name or ''}".strip()
        if order.customer and order.customer.first_name
        else "Guest"
    )
    items = []
    for oi in order.order_items:
        addons = [
            OrderItemAddonResponse(
                order_item_addon_id=a.order_item_addon_id,
                addon_name=a.menu_item_addon.addon_name if a.menu_item_addon else "Add-on",
                quantity=a.quantity,
                unit_price=a.unit_price,
            )
            for a in oi.addons
        ]
        items.append(
            OrderItemResponse(
                order_item_id=oi.order_item_id,
                item_name=oi.menu_item.item_name if oi.menu_item else "Item",
                size_name=oi.menu_item_size.size_name if oi.menu_item_size else None,
                quantity=oi.quantity,
                unit_price=oi.unit_price,
                subtotal=oi.subtotal,
                special_instructions=oi.special_instructions,
                addons=addons,
            )
        )

    latest_payment = order.payments[-1] if hasattr(order, "payments") and order.payments else None
    receipt_pdf_url = latest_payment.receipt_pdf_url if latest_payment else None

    events = [
        OrderEventResponse(
            order_event_id=ev.order_event_id,
            order_id=ev.order_id,
            previous_status=ev.previous_status,
            new_status=ev.new_status,
            user_id=ev.user_id,
            staff_actor_name=(
                f"{ev.staff_user.first_name} {ev.staff_user.last_name or ''}".strip()
                if hasattr(ev, "staff_user") and ev.staff_user and ev.staff_user.first_name
                else None
            ),
            created_at=ev.created_at,
            metadata_json=ev.metadata_json,
        )
        for ev in (order.events if hasattr(order, "events") and order.events else [])
    ]

    return OrderTrackingResponse(
        order_id=order.order_id,
        order_status=order.order_status,
        order_type=order.order_type,
        total_amount=order.total_amount,
        reference_code=order.reference_code,
        pickup_code=order.pickup_code,
        receipt_pdf_url=receipt_pdf_url,
        order_date=order.order_date,
        expires_at=order.expires_at,
        picked_up_at=order.picked_up_at,
        customer_name=customer_name,
        items=items,
        events=events,
    )
