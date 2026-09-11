from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    Text,
    func,
)
from sqlalchemy import (
    Enum as SqlEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.shared.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.modules.inventory.models import InventoryItem
    from app.modules.users.models import User


class PurchaseRequestStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    RECEIVED = "received"


def enum_values(enum_cls):
    return [item.value for item in enum_cls]


class PurchaseRequest(TimestampMixin, Base):
    __tablename__ = "purchase_requests"

    __table_args__ = (
        CheckConstraint(
            "total_amount >= 0",
            name="ck_purchase_request_total_nonnegative",
        ),
        CheckConstraint(
            """
            request_status <> 'rejected'
            OR (
                rejection_reason IS NOT NULL
                AND length(trim(rejection_reason)) > 0
            )
            """,
            name="ck_purchase_request_rejection_reason",
        ),
    )

    purchase_request_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    requested_by: Mapped[int] = mapped_column(
        ForeignKey(
            "users.user_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    request_status: Mapped[PurchaseRequestStatus] = mapped_column(
        SqlEnum(
            PurchaseRequestStatus,
            name="purchase_request_status",
            native_enum=False,
            values_callable=enum_values,
            validate_strings=True,
        ),
        default=PurchaseRequestStatus.DRAFT,
        nullable=False,
        index=True,
    )

    rejection_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    request_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    expected_delivery_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    requester: Mapped[User] = relationship(
        "User",
        back_populates="purchase_requests",
        foreign_keys=[requested_by],
    )

    items: Mapped[list[PurchaseRequestItem]] = relationship(
        "PurchaseRequestItem",
        back_populates="purchase_request",
    )


class PurchaseRequestItem(TimestampMixin, Base):
    __tablename__ = "purchase_request_items"

    __table_args__ = (
        CheckConstraint(
            "quantity_requested > 0",
            name="ck_purchase_item_quantity_positive",
        ),
        CheckConstraint(
            "unit_cost >= 0",
            name="ck_purchase_item_unit_cost_nonnegative",
        ),
        CheckConstraint(
            "subtotal >= 0",
            name="ck_purchase_item_subtotal_nonnegative",
        ),
    )

    purchase_request_item_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    purchase_request_id: Mapped[int] = mapped_column(
        ForeignKey(
            "purchase_requests.purchase_request_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey(
            "inventory_items.inventory_item_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    quantity_requested: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
    )

    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    purchase_request: Mapped[PurchaseRequest] = relationship(
        "PurchaseRequest",
        back_populates="items",
    )

    inventory_item: Mapped[InventoryItem] = relationship(
        "InventoryItem",
        back_populates="purchase_request_items",
    )
