from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.shared.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.modules.menu.models import MenuItemIngredient
    from app.modules.users.models import User
    from app.modules.procurement.models import PurchaseRequestItem


class InventoryTransactionType(str, Enum):
    PURCHASE_IN = "purchase_in"
    USAGE_OUT = "usage_out"
    ADJUSTMENT = "adjustment"
    WASTE = "waste"


def enum_values(enum_cls):
    return [item.value for item in enum_cls]


class InventoryItem(TimestampMixin, Base):
    __tablename__ = "inventory_items"

    __table_args__ = (
        CheckConstraint(
            "quantity_on_hand >= 0",
            name="ck_inventory_quantity_nonnegative",
        ),
        CheckConstraint(
            "reorder_level >= 0",
            name="ck_inventory_reorder_nonnegative",
        ),
        CheckConstraint(
            "unit_cost >= 0",
            name="ck_inventory_unit_cost_nonnegative",
        ),
    )

    inventory_item_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    item_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    unit_of_measure: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    quantity_on_hand: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        default=Decimal("0.000"),
        nullable=False,
    )

    reorder_level: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        default=Decimal("0.000"),
        nullable=False,
    )

    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    menu_item_ingredients: Mapped[list["MenuItemIngredient"]] = relationship(
        "MenuItemIngredient",
        back_populates="inventory_item",
    )

    inventory_transactions: Mapped[list["InventoryTransaction"]] = relationship(
        "InventoryTransaction",
        back_populates="inventory_item",
    )

    purchase_request_items: Mapped[list["PurchaseRequestItem"]] = relationship(
        "PurchaseRequestItem",
        back_populates="inventory_item",
    )


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    __table_args__ = (
        CheckConstraint(
            "quantity_change <> 0",
            name="ck_inventory_transaction_quantity_nonzero",
        ),
    )

    inventory_transaction_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey(
            "inventory_items.inventory_item_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    transaction_type: Mapped[InventoryTransactionType] = mapped_column(
        SqlEnum(
            InventoryTransactionType,
            name="inventory_transaction_type",
            native_enum=False,
            values_callable=enum_values,
            validate_strings=True,
        ),
        nullable=False,
        index=True,
    )

    quantity_change: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
    )

    reference_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    reference_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey(
            "users.user_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
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

    inventory_item: Mapped["InventoryItem"] = relationship(
        "InventoryItem",
        back_populates="inventory_transactions",
    )

    creator: Mapped["User"] = relationship(
        "User",
        back_populates="inventory_transactions",
        foreign_keys=[created_by],
    )
