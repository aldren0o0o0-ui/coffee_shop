from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class MenuItemCosting(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    menu_item_id: int
    item_name: str
    category_name: str
    selling_price: Decimal
    ingredient_cost: Decimal
    gross_profit: Decimal
    margin_percent: Decimal | None
    has_complete_cost: bool


class CostingSummary(BaseModel):
    total_items: int
    complete_cost_items: int
    incomplete_cost_items: int
    average_margin_percent: Decimal | None
    items: list[MenuItemCosting]
