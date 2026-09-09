from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.inventory.models import (
    InventoryItem,
    InventoryTransaction,
    InventoryTransactionType,
)
from app.modules.inventory.schemas import InventoryOption
from app.modules.menu.models import MenuItemIngredient


class InsufficientStockError(Exception):
    def __init__(self, item_name: str, needed: Decimal, available: Decimal):
        self.item_name = item_name
        self.needed = needed
        self.available = available
        super().__init__(
            f"'{item_name}' has insufficient stock (needed {needed}, available {available})"
        )


def get_inventory_options(database: Session) -> list[InventoryOption]:
    """
    Returns active inventory items for recipe mapping and product configuration.
    """
    stmt = (
        select(InventoryItem)
        .where(InventoryItem.is_active.is_(True))
        .order_by(InventoryItem.item_name.asc())
    )
    items = list(database.scalars(stmt).all())
    return [
        InventoryOption(
            inventory_item_id=i.inventory_item_id,
            item_name=i.item_name,
            unit_of_measure=i.unit_of_measure,
            quantity_on_hand=i.quantity_on_hand,
        )
        for i in items
    ]


def list_inventory_items(database: Session) -> list[InventoryItem]:
    """
    Lists all inventory items ordered by item name.
    """
    stmt = select(InventoryItem).order_by(InventoryItem.item_name.asc())
    return list(database.scalars(stmt).all())


def get_inventory_item(database: Session, item_id: int) -> InventoryItem | None:
    """
    Retrieves a single inventory item by ID.
    """
    return database.get(InventoryItem, item_id)


def get_low_stock_items(database: Session) -> list[InventoryItem]:
    """
    Retrieves active items where quantity_on_hand <= reorder_level.
    """
    stmt = (
        select(InventoryItem)
        .where(
            InventoryItem.is_active.is_(True),
            InventoryItem.quantity_on_hand <= InventoryItem.reorder_level,
        )
        .order_by(InventoryItem.quantity_on_hand.asc())
    )
    return list(database.scalars(stmt).all())


def deduct_inventory_for_order(
    database: Session,
    order_items: list[Any],
    order_id: int,
    created_by_user_id: int,
    now: datetime,
    reference_type: str = "order",
    note_prefix: str = "Order",
) -> None:
    """
    Shared atomic inventory deduction with row-level locking (SELECT ... FOR UPDATE)
    in deterministic primary key order to prevent deadlocks and race conditions.
    """
    if not order_items:
        return

    # Map menu_item_id to total quantity ordered
    item_qty_map: dict[int, int] = {}
    for item in order_items:
        item_qty_map[item.menu_item_id] = item_qty_map.get(item.menu_item_id, 0) + item.quantity

    # Fetch all ingredient recipes directly from database
    recipes = list(
        database.scalars(
            select(MenuItemIngredient)
            .where(MenuItemIngredient.menu_item_id.in_(list(item_qty_map.keys())))
        ).all()
    )

    required_ingredients: dict[int, Decimal] = {}
    for ing in recipes:
        order_qty = item_qty_map.get(ing.menu_item_id, 0)
        qty_needed = ing.quantity_required * Decimal(order_qty)
        required_ingredients[ing.inventory_item_id] = (
            required_ingredients.get(ing.inventory_item_id, Decimal("0")) + qty_needed
        )

    if not required_ingredients:
        return

    # Lock rows in inventory_items explicitly in ascending ID order with populate_existing=True
    sorted_item_ids = sorted(list(required_ingredients.keys()))
    locked_items = list(
        database.scalars(
            select(InventoryItem)
            .where(InventoryItem.inventory_item_id.in_(sorted_item_ids))
            .order_by(InventoryItem.inventory_item_id.asc())
            .with_for_update()
            .execution_options(populate_existing=True)
        ).all()
    )

    for inv_item in locked_items:
        needed = required_ingredients[inv_item.inventory_item_id]
        if inv_item.quantity_on_hand < needed:
            raise InsufficientStockError(
                item_name=inv_item.item_name,
                needed=needed,
                available=inv_item.quantity_on_hand,
            )

    # Deduct inventory and log transactions
    for inv_item in locked_items:
        needed = required_ingredients[inv_item.inventory_item_id]
        inv_item.quantity_on_hand -= needed

        inv_tx = InventoryTransaction(
            inventory_item_id=inv_item.inventory_item_id,
            transaction_type=InventoryTransactionType.USAGE_OUT,
            quantity_change=-needed,
            reference_type=reference_type,
            reference_id=order_id,
            notes=f"{note_prefix} #{order_id} inventory deduction",
            created_by=created_by_user_id,
            transaction_date=now,
        )
        database.add(inv_tx)


def record_inventory_transaction(
    database: Session,
    item_id: int,
    transaction_type: InventoryTransactionType,
    quantity_change: Decimal,
    created_by: int,
    reference_type: str | None = None,
    reference_id: int | None = None,
    notes: str | None = None,
    now: datetime | None = None,
) -> InventoryTransaction:
    """
    Records an inventory transaction and updates the item's on-hand quantity.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    inv_item = database.get(InventoryItem, item_id)
    if not inv_item:
        raise ValueError(f"InventoryItem with ID {item_id} not found")

    inv_item.quantity_on_hand += quantity_change

    tx = InventoryTransaction(
        inventory_item_id=item_id,
        transaction_type=transaction_type,
        quantity_change=quantity_change,
        reference_type=reference_type,
        reference_id=reference_id,
        notes=notes,
        created_by=created_by,
        transaction_date=now,
    )
    database.add(tx)
    return tx


def receive_stock(
    database: Session,
    item_id: int,
    quantity: Decimal,
    created_by: int,
    reference_type: str = "PurchaseRequest",
    reference_id: int | None = None,
    notes: str | None = None,
    now: datetime | None = None,
) -> InventoryTransaction:
    """
    Receives inventory stock, increments quantity_on_hand, and records a PURCHASE_IN transaction.
    """
    if quantity <= Decimal("0"):
        raise ValueError("Received stock quantity must be greater than zero.")

    return record_inventory_transaction(
        database=database,
        item_id=item_id,
        transaction_type=InventoryTransactionType.PURCHASE_IN,
        quantity_change=quantity,
        created_by=created_by,
        reference_type=reference_type,
        reference_id=reference_id,
        notes=notes,
        now=now,
    )

