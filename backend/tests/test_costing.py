from decimal import Decimal

from fastapi.testclient import TestClient

from app.database.session import SessionLocal
from app.main import app
from app.modules.inventory.models import InventoryItem
from app.modules.menu.models import MenuCategory, MenuItem, MenuItemIngredient
from app.modules.costing.service import get_menu_costing

client = TestClient(app)


def test_recipe_costing_calculates_margin_and_marks_missing_recipes():
    database = SessionLocal()
    try:
        category = MenuCategory(category_name="Costing Test", display_order=99, is_active=True)
        ingredient = InventoryItem(
            item_name="Costing Beans",
            unit_of_measure="kg",
            quantity_on_hand=Decimal("5.000"),
            reorder_level=Decimal("1.000"),
            unit_cost=Decimal("400.00"),
            is_active=True,
        )
        database.add_all([category, ingredient])
        database.flush()
        latte = MenuItem(category_id=category.category_id, item_name="Costed Latte", base_price=Decimal("120.00"), is_available=True)
        no_recipe = MenuItem(category_id=category.category_id, item_name="Uncosted Drink", base_price=Decimal("90.00"), is_available=True)
        database.add_all([latte, no_recipe])
        database.flush()
        database.add(MenuItemIngredient(
            menu_item_id=latte.menu_item_id,
            inventory_item_id=ingredient.inventory_item_id,
            quantity_required=Decimal("0.020"),
            unit_of_measure="kg",
        ))
        database.commit()

        summary = get_menu_costing(database)
        result = next(item for item in summary.items if item.menu_item_id == latte.menu_item_id)
        assert result.ingredient_cost == Decimal("8.00")
        assert result.gross_profit == Decimal("112.00")
        assert result.margin_percent == Decimal("93.33")
        assert result.has_complete_cost is True
        assert any(item.menu_item_id == no_recipe.menu_item_id and not item.has_complete_cost for item in summary.items)
    finally:
        database.close()


def test_costing_endpoint_requires_manager_or_owner_role():
    unauthenticated = client.get("/api/v1/costing/menu")
    assert unauthenticated.status_code == 401

    login = client.post("/api/v1/auth/login", json={"identifier": "system_test_owner", "password": "TestOwnerPassword123!"})
    assert login.status_code == 200
    response = client.get("/api/v1/costing/menu")
    assert response.status_code == 200
    assert "items" in response.json()
