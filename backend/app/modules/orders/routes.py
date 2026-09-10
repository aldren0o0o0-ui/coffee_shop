from fastapi import APIRouter, HTTPException, Request, status

from app.core.rate_limit import check_tracking_rate_limit
from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.orders import service as orders_service
from app.modules.orders.schemas import (
    CustomerOrderCreateRequest,
    CustomerOrderResponse,
    OrderStatusUpdateRequest,
    OrderTrackingRequest,
    OrderTrackingResponse,
    PendingOrderUpdateRequest,
    POSOrderCreateRequest,
)
from app.modules.orders.serializers import serialize_order, serialize_order_tracking
from app.modules.payments.schemas import (
    CustomerPaymentRequest,
    PayAtCounterRequest,
)
from app.shared.dependencies import DatabaseDependency

router = APIRouter(
    prefix="/orders",
    tags=["Staff Orders"],
)

customer_router = APIRouter(
    prefix="/customer",
    tags=["Customer Online Orders"],
)


# =========================================================================
# Staff Orders Endpoints (/api/v1/orders)
# =========================================================================

@router.get("", response_model=list[CustomerOrderResponse])
def get_all_orders(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> list[CustomerOrderResponse]:
    orders = orders_service.get_all_orders(database, limit=50)
    return [serialize_order(o) for o in orders]


@router.get("/counter-lookup", response_model=list[CustomerOrderResponse])
def search_pending_counter_orders(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
    q: str = "",
) -> list[CustomerOrderResponse]:
    """
    Look up pending Pay-at-Counter orders by reference code (REF-XXXX), email, or name.
    If q is empty, returns all active pending counter orders.
    """
    orders = orders_service.lookup_pending_counter_order(database, q)
    return [serialize_order(o) for o in orders]


@router.post("/{order_id}/pay-at-counter", response_model=CustomerOrderResponse)
def confirm_counter_payment(
    order_id: int,
    payload: PayAtCounterRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> CustomerOrderResponse:
    """
    Cashier confirms payment for a looked-up Pay-at-Counter order.
    """
    order = orders_service.pay_pending_counter_order(
        database=database,
        order_id=order_id,
        payload=payload,
        cashier_user=authentication.user,
    )
    return serialize_order(order)


@router.put("/{order_id}", response_model=CustomerOrderResponse)
def update_pending_order_items(
    order_id: int,
    payload: PendingOrderUpdateRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> CustomerOrderResponse:
    """
    Cashier updates items/sizes/addons on an AWAITING_PAYMENT order before taking payment.
    """
    order = orders_service.update_pending_order(
        database=database,
        order_id=order_id,
        items=payload.items,
        order_type=payload.order_type,
        cashier_user=authentication.user,
    )
    return serialize_order(order)


@router.patch("/{order_id}/status", response_model=CustomerOrderResponse)
def change_order_status(
    order_id: int,
    payload: OrderStatusUpdateRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> CustomerOrderResponse:
    order = orders_service.update_order_status(
        database=database,
        order_id=order_id,
        new_status=payload.status,
        current_user=authentication.user,
    )
    return serialize_order(order)


@router.post("/pos", response_model=CustomerOrderResponse, status_code=status.HTTP_201_CREATED)
def submit_pos_sale(
    payload: POSOrderCreateRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> CustomerOrderResponse:
    order = orders_service.create_pos_order(
        database=database,
        staff_user=authentication.user,
        payload=payload,
    )
    return serialize_order(order)


# =========================================================================
# Customer Online Orders Endpoints (/api/v1/customer)
# =========================================================================

@customer_router.post(
    "/orders",
    response_model=CustomerOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_customer_order(
    payload: CustomerOrderCreateRequest,
    request: Request,
    database: DatabaseDependency,
) -> CustomerOrderResponse:
    client_ip = request.client.host if request.client else None
    order = orders_service.create_customer_order(database, payload, client_ip)
    return serialize_order(order)


@customer_router.post(
    "/orders/{order_id}/pay",
    response_model=CustomerOrderResponse,
)
def pay_customer_order(
    order_id: int,
    payment_data: CustomerPaymentRequest,
    request: Request,
    database: DatabaseDependency,
) -> CustomerOrderResponse:
    client_ip = request.client.host if request.client else None
    order = orders_service.process_order_payment(database, order_id, payment_data, client_ip)
    return serialize_order(order)


@customer_router.post(
    "/orders/track",
    response_model=OrderTrackingResponse,
)
def track_customer_order(
    payload: OrderTrackingRequest,
    request: Request,
    database: DatabaseDependency,
) -> OrderTrackingResponse:
    client_ip = request.client.host if request.client else None
    if not check_tracking_rate_limit(client_ip, payload.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many tracking inquiries. Please wait a moment before trying again.",
            headers={"Retry-After": "30"},
        )

    order = orders_service.get_order_for_tracking(database, payload.order_id, payload.email)
    return serialize_order_tracking(order)
