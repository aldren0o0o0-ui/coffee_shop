from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.shared.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.modules.orders.models import Order


class LoyaltyTransactionType(str, Enum):
    EARN = "earn"
    REDEEM = "redeem"
    ADJUSTMENT = "adjustment"


def enum_values(enum_cls):
    return [item.value for item in enum_cls]


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    __table_args__ = (
        CheckConstraint(
            "loyalty_points_balance >= 0",
            name="ck_customer_loyalty_balance_nonnegative",
        ),
    )

    customer_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    first_name: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    last_name: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    email: Mapped[str | None] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
        index=True,
    )

    phone_number: Mapped[str | None] = mapped_column(
        String(20),
        unique=True,
        nullable=True,
        index=True,
    )

    loyalty_points_balance: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    is_guest: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    is_blocked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    no_show_count: Mapped[int | None] = mapped_column(
        Integer,
        default=0,
        nullable=True,
    )

    registered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    orders: Mapped[list["Order"]] = relationship(
        "Order",
        back_populates="customer",
    )

    loyalty_transactions: Mapped[list["LoyaltyTransaction"]] = relationship(
        "LoyaltyTransaction",
        back_populates="customer",
    )


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    __table_args__ = (
        CheckConstraint(
            "points <> 0",
            name="ck_loyalty_points_nonzero",
        ),
        CheckConstraint(
            """
            transaction_type <> 'adjustment'
            OR (
                description IS NOT NULL
                AND length(trim(description)) > 0
            )
            """,
            name="ck_loyalty_adjustment_description",
        ),
    )

    loyalty_transaction_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey(
            "customers.customer_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    order_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "orders.order_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    transaction_type: Mapped[LoyaltyTransactionType] = mapped_column(
        SqlEnum(
            LoyaltyTransactionType,
            name="loyalty_transaction_type",
            native_enum=False,
            values_callable=enum_values,
            validate_strings=True,
        ),
        nullable=False,
        index=True,
    )

    points: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    customer: Mapped["Customer"] = relationship(
        "Customer",
        back_populates="loyalty_transactions",
    )

    order: Mapped["Order | None"] = relationship(
        "Order",
        back_populates="loyalty_transactions",
    )
