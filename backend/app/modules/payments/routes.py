from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, status

from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.payments import service
from app.modules.payments.schemas import PaymentResponse, ReceiptResponse
from app.shared.dependencies import DatabaseDependency

router = APIRouter(
    prefix="/payments",
    tags=["Payments & Receipts"],
)


@router.get("/order/{order_id}", response_model=list[PaymentResponse])
def get_order_payments(
    order_id: int,
    current_auth: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> list[PaymentResponse]:
    payments = service.get_order_payments(database, order_id)
    return [PaymentResponse.model_validate(p) for p in payments]


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    current_auth: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> PaymentResponse:
    payment = service.get_payment_by_id(database, payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found.",
        )
    return PaymentResponse.model_validate(payment)


@router.get("/receipt/{order_id}", response_model=ReceiptResponse)
def get_order_receipt(
    order_id: int,
    current_auth: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> ReceiptResponse:
    payments = service.get_order_payments(database, order_id)
    completed_payment = next((p for p in payments if p.payment_status.value == "completed" and p.receipt_pdf_url), None)
    if not completed_payment or not completed_payment.receipt_pdf_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found for this order.",
        )
    return ReceiptResponse(
        order_id=order_id,
        receipt_pdf_url=completed_payment.receipt_pdf_url,
        generated_at=completed_payment.paid_at or completed_payment.created_at,
    )
