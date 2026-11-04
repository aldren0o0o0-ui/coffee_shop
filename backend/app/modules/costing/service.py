from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.costing.schemas import CostingSummary, MenuItemCosting
from app.modules.menu.models import MenuItem, MenuItemIngredient

MONEY = Decimal("0.01")


def get_menu_costing(database: Session) -> CostingSummary:
    """Calculate current recipe cost and margin using current inventory costs."""
    statement = (
        select(MenuItem)
        .options(
            selectinload(MenuItem.category),
            selectinload(MenuItem.ingredients).selectinload(MenuItemIngredient.inventory_item),
        )
        .where(MenuItem.is_deleted.is_(False), MenuItem.is_draft.is_(False))
        .order_by(MenuItem.item_name)
    )
    items: list[MenuItemCosting] = []
    margins: list[Decimal] = []
    for menu_item in database.scalars(statement):
        recipe_cost = Decimal("0.00")
        complete = bool(menu_item.ingredients)
        for ingredient in menu_item.ingredients:
            inventory_item = ingredient.inventory_item
            if inventory_item is None or not inventory_item.is_active:
                complete = False
                continue
            recipe_cost += Decimal(ingredient.quantity_required) * Decimal(inventory_item.unit_cost)
        recipe_cost = recipe_cost.quantize(MONEY, rounding=ROUND_HALF_UP)
        price = Decimal(menu_item.base_price).quantize(MONEY)
        gross_profit = (price - recipe_cost).quantize(MONEY, rounding=ROUND_HALF_UP)
        margin = ((gross_profit / price) * 100).quantize(MONEY, rounding=ROUND_HALF_UP) if price else None
        if complete and margin is not None:
            margins.append(margin)
        items.append(MenuItemCosting(
            menu_item_id=menu_item.menu_item_id,
            item_name=menu_item.item_name,
            category_name=menu_item.category.category_name,
            selling_price=price,
            ingredient_cost=recipe_cost,
            gross_profit=gross_profit,
            margin_percent=margin,
            has_complete_cost=complete,
        ))
    complete_count = sum(item.has_complete_cost for item in items)
    average = (sum(margins) / len(margins)).quantize(MONEY, rounding=ROUND_HALF_UP) if margins else None
    return CostingSummary(total_items=len(items), complete_cost_items=complete_count, incomplete_cost_items=len(items) - complete_count, average_margin_percent=average, items=items)
