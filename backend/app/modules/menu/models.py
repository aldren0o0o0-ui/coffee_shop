from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.shared.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.modules.inventory.models import InventoryItem
    from app.modules.orders.models import OrderItem, OrderItemAddon


class MenuCategory(TimestampMixin, Base):
    __tablename__ = "menu_categories"

    __table_args__ = (
        UniqueConstraint(
            "category_name",
            name="uq_menu_categories_name",
        ),
        CheckConstraint(
            "display_order >= 0",
            name="ck_menu_category_display_order_nonnegative",
        ),
    )

    category_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    category_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    menu_items: Mapped[list["MenuItem"]] = relationship(
        "MenuItem",
        back_populates="category",
    )


class MenuItem(TimestampMixin, Base):
    __tablename__ = "menu_items"

    __table_args__ = (
        CheckConstraint(
            "base_price >= 0",
            name="ck_menu_item_base_price_nonnegative",
        ),
    )

    menu_item_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    category_id: Mapped[int] = mapped_column(
        ForeignKey(
            "menu_categories.category_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    item_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    base_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    image_url: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    is_available: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    is_draft: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    category: Mapped["MenuCategory"] = relationship(
        "MenuCategory",
        back_populates="menu_items",
    )

    images: Mapped[list["MenuItemImage"]] = relationship(
        "MenuItemImage",
        back_populates="menu_item",
        cascade="all, delete-orphan",
        order_by="MenuItemImage.display_order.asc()",
    )

    sizes: Mapped[list["MenuItemSize"]] = relationship(
        "MenuItemSize",
        back_populates="menu_item",
        cascade="all, delete-orphan",
    )

    addons: Mapped[list["MenuItemAddon"]] = relationship(
        "MenuItemAddon",
        back_populates="menu_item",
        cascade="all, delete-orphan",
    )

    ingredients: Mapped[list["MenuItemIngredient"]] = relationship(
        "MenuItemIngredient",
        back_populates="menu_item",
        cascade="all, delete-orphan",
    )

    order_items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="menu_item",
    )


class MenuItemSize(TimestampMixin, Base):
    __tablename__ = "menu_item_sizes"

    __table_args__ = (
        UniqueConstraint(
            "menu_item_id",
            "size_name",
            name="uq_menu_item_size",
        ),
    )

    menu_item_size_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    menu_item_id: Mapped[int] = mapped_column(
        ForeignKey(
            "menu_items.menu_item_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    size_name: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    price_adjustment: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    menu_item: Mapped["MenuItem"] = relationship(
        "MenuItem",
        back_populates="sizes",
    )

    order_items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="menu_item_size",
    )


class MenuItemAddon(TimestampMixin, Base):
    __tablename__ = "menu_item_addons"

    __table_args__ = (
        UniqueConstraint(
            "menu_item_id",
            "addon_name",
            name="uq_menu_item_addon",
        ),
        CheckConstraint(
            "additional_price >= 0",
            name="ck_menu_addon_price_nonnegative",
        ),
    )

    menu_item_addon_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    menu_item_id: Mapped[int] = mapped_column(
        ForeignKey(
            "menu_items.menu_item_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    addon_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    additional_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    menu_item: Mapped["MenuItem"] = relationship(
        "MenuItem",
        back_populates="addons",
    )

    order_item_addons: Mapped[list["OrderItemAddon"]] = relationship(
        "OrderItemAddon",
        back_populates="menu_item_addon",
    )


class MenuItemIngredient(TimestampMixin, Base):
    __tablename__ = "menu_item_ingredients"

    __table_args__ = (
        UniqueConstraint(
            "menu_item_id",
            "inventory_item_id",
            name="uq_menu_item_ingredient",
        ),
        CheckConstraint(
            "quantity_required > 0",
            name="ck_menu_ingredient_quantity_positive",
        ),
    )

    menu_item_ingredient_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    menu_item_id: Mapped[int] = mapped_column(
        ForeignKey(
            "menu_items.menu_item_id",
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

    quantity_required: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
    )

    unit_of_measure: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    menu_item: Mapped["MenuItem"] = relationship(
        "MenuItem",
        back_populates="ingredients",
    )

    inventory_item: Mapped["InventoryItem"] = relationship(
        "InventoryItem",
        back_populates="menu_item_ingredients",
    )


class MenuItemImage(Base):
    __tablename__ = "menu_item_images"

    menu_item_image_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    menu_item_id: Mapped[int] = mapped_column(
        ForeignKey(
            "menu_items.menu_item_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    image_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    file_size_bytes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    menu_item: Mapped["MenuItem"] = relationship(
        "MenuItem",
        back_populates="images",
    )
