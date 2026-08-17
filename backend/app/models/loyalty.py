from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
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
from app.models.enums import LoyaltyTransactionType


def enum_values(enum_cls):
    return [item.value for item in enum_cls]


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