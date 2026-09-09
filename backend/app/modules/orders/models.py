from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Index,
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
    from app.modules.customers.models import Customer, LoyaltyTransaction
    from app.modules.users.models import User
    from app.modules.menu.models import MenuItem, MenuItemAddon, MenuItemSize
    from app.modules.payments.models import Payment


class OrderChannel(str, Enum):
    IN_STORE = "in_store"
    ONLINE = "online"


class OrderStatus(str, Enum):
    AWAITING_PAYMENT = "awaiting_payment"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class OrderType(str, Enum):
    DINE_IN = "dine_in"
    TAKEOUT = "takeout"
    DELIVERY = "delivery"


def enum_values(enum_cls):
    return [item.value for item in enum_cls]


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    __table_args__ = (
        CheckConstraint(
            "subtotal >= 0",
            name="ck_order_subtotal_nonnegative",
        ),
        CheckConstraint(
            "tax_amount >= 0",
            name="ck_order_tax_nonnegative",
        ),
        CheckConstraint(
            "discount_amount >= 0",
            name="ck_order_discount_nonnegative",
        ),
        CheckConstraint(
            "total_amount >= 0",
            name="ck_order_total_nonnegative",
        ),
        Index(
            "ix_orders_order_date",
            "order_date",
        ),
        Index(
            "ix_orders_pickup_code",
            "pickup_code",
        ),
        Index(
            "ix_orders_order_status",
            "order_status",
        ),
    )

    order_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "customers.customer_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.user_id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    order_channel: Mapped[OrderChannel] = mapped_column(
        SqlEnum(
            OrderChannel,
            name="order_channel",
            native_enum=False,
            values_callable=enum_values,
            validate_strings=True,
        ),
        nullable=False,
    )

    order_status: Mapped[OrderStatus] = mapped_column(
        SqlEnum(
            OrderStatus,
            name="order_status",
            native_enum=False,
            values_callable=enum_values,
            validate_strings=True,
        ),
        default=OrderStatus.AWAITING_PAYMENT,
        nullable=False,
    )

    order_type: Mapped[OrderType] = mapped_column(
        SqlEnum(
            OrderType,
            name="order_type",
            native_enum=False,
            values_callable=enum_values,
            validate_strings=True,
        ),
        nullable=False,
    )

    payment_method_intent: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        default="online_card",
    )

    reference_code: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        index=True,
    )

    pickup_code: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )

    pickup_code_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    picked_up_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    order_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    customer: Mapped["Customer | None"] = relationship(
        "Customer",
        back_populates="orders",
    )

    staff_user: Mapped["User | None"] = relationship(
        "User",
        back_populates="orders",
        foreign_keys=[user_id],
    )

    order_items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
    )

    payments: Mapped[list["Payment"]] = relationship(
        "Payment",
        back_populates="order",
    )

    loyalty_transactions: Mapped[list["LoyaltyTransaction"]] = relationship(
        "LoyaltyTransaction",
        back_populates="order",
    )


class OrderItem(TimestampMixin, Base):
    __tablename__ = "order_items"

    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_order_item_quantity_positive",
        ),
        CheckConstraint(
            "unit_price >= 0",
            name="ck_order_item_price_nonnegative",
        ),
        CheckConstraint(
            "subtotal >= 0",
            name="ck_order_item_subtotal_nonnegative",
        ),
    )

    order_item_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    order_id: Mapped[int] = mapped_column(
        ForeignKey(
            "orders.order_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    menu_item_id: Mapped[int] = mapped_column(
        ForeignKey(
            "menu_items.menu_item_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    menu_item_size_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "menu_item_sizes.menu_item_size_id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    special_instructions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    order: Mapped["Order"] = relationship(
        "Order",
        back_populates="order_items",
    )

    menu_item: Mapped["MenuItem"] = relationship(
        "MenuItem",
        back_populates="order_items",
    )

    menu_item_size: Mapped["MenuItemSize | None"] = relationship(
        "MenuItemSize",
        back_populates="order_items",
    )

    addons: Mapped[list["OrderItemAddon"]] = relationship(
        "OrderItemAddon",
        back_populates="order_item",
    )


class OrderItemAddon(Base):
    __tablename__ = "order_item_addons"

    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_order_item_addon_quantity_positive",
        ),
        CheckConstraint(
            "unit_price >= 0",
            name="ck_order_item_addon_price_nonnegative",
        ),
    )

    order_item_addon_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    order_item_id: Mapped[int] = mapped_column(
        ForeignKey(
            "order_items.order_item_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    menu_item_addon_id: Mapped[int] = mapped_column(
        ForeignKey(
            "menu_item_addons.menu_item_addon_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    order_item: Mapped["OrderItem"] = relationship(
        "OrderItem",
        back_populates="addons",
    )

    menu_item_addon: Mapped["MenuItemAddon"] = relationship(
        "MenuItemAddon",
        back_populates="order_item_addons",
    )
