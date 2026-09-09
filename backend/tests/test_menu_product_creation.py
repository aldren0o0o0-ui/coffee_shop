import uuid
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.modules.inventory.models import InventoryItem
from app.modules.menu.models import MenuCategory, MenuItem
from app.modules.users.models import Role, User, UserRole
from app.core.security import hash_password

client = TestClient(app)


def setup_users_and_inventory():
    db = SessionLocal()

    # Ensure Owner, Manager, and Barista roles
    roles = {}
    for rname in ["Owner", "Manager", "Barista"]:
        r = db.query(Role).filter(Role.role_name == rname).first()
        if not r:
            r = Role(role_name=rname, description=rname, is_active=True)
            db.add(r)
            db.flush()
        roles[rname] = r

    # Create Manager test user
    mgr_user = db.query(User).filter(User.username == "test_mgr_menu").first()
    if not mgr_user:
        mgr_user = User(
            username="test_mgr_menu",
            email="mgr_menu@brewflow.local",
            password_hash=hash_password("ManagerPass123!"),
            first_name="Mary",
            last_name="Manager",
            is_active=True,
        )
        db.add(mgr_user)
        db.flush()
        db.add(UserRole(user_id=mgr_user.user_id, role_id=roles["Manager"].role_id, is_active=True))

    # Ensure inventory item for recipe linking
    inv = db.query(InventoryItem).filter(InventoryItem.item_name == "Vanilla Syrup Bottle").first()
    if not inv:
        inv = InventoryItem(
            item_name="Vanilla Syrup Bottle",
            unit_of_measure="L",
            quantity_on_hand=Decimal("20.000"),
            reorder_level=Decimal("3.000"),
            unit_cost=Decimal("8.50"),
            is_active=True,
        )
        db.add(inv)
        db.flush()

    inv_id = inv.inventory_item_id
    db.commit()
    db.close()
    return inv_id


def test_real_menu_product_creation():
    inv_id = setup_users_and_inventory()

    # Step 1: Login as Manager
    login_res = client.post("/api/v1/auth/login", json={
        "identifier": "test_mgr_menu",
        "password": "ManagerPass123!",
    })
    assert login_res.status_code == 200, login_res.text

    # Step 2: Create a new category
    unique_suffix = uuid.uuid4().hex[:6]
    cat_name = f"Seasonal Brews {unique_suffix}"
    cat_res = client.post("/api/v1/menu/categories", json={
        "category_name": cat_name,
        "description": "Limited edition crafted seasonal drinks",
        "display_order": 10,
    })
    assert cat_res.status_code == 201, cat_res.text
    cat_data = cat_res.json()
    cat_id = cat_data["category_id"]
    assert cat_data["category_name"] == cat_name

    # Step 3: Add a new real product with sizes, addons, and recipe ingredients
    prod_name = f"Iced Honey Vanilla Latte {unique_suffix}"
    prod_payload = {
        "category_id": cat_id,
        "item_name": prod_name,
        "description": "Espresso poured over clover honey, vanilla syrup, and cold frothed milk.",
        "base_price": 5.25,
        "is_available": True,
        "sizes": [
            {"size_name": "Regular (12oz)", "price_adjustment": 0.00, "is_default": True},
            {"size_name": "Large (16oz)", "price_adjustment": 1.25, "is_default": False},
        ],
        "addons": [
            {"addon_name": "Extra Honey Drizzle", "additional_price": 0.60, "is_active": True},
            {"addon_name": "Oat Milk Swap", "additional_price": 0.80, "is_active": True},
        ],
        "ingredients": [
            {
                "inventory_item_id": inv_id,
                "quantity_required": 0.030,
                "unit_of_measure": "L",
            }
        ],
    }

    prod_res = client.post("/api/v1/menu/items", json=prod_payload)
    assert prod_res.status_code == 201, prod_res.text
    prod_data = prod_res.json()
    item_id = prod_data["menu_item_id"]
    assert prod_data["item_name"] == prod_name
    assert float(prod_data["base_price"]) == 5.25
    assert len(prod_data["sizes"]) == 2
    assert len(prod_data["addons"]) == 2
    assert "Vanilla Syrup Bottle" in prod_data["ingredients"]

    # Step 4: Toggle availability (86-ing an item)
    toggle_res = client.patch(f"/api/v1/menu/items/{item_id}/availability", json={
        "is_available": False,
    })
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_available"] is False

    # Toggle back to In Stock
    toggle_back = client.patch(f"/api/v1/menu/items/{item_id}/availability", json={
        "is_available": True,
    })
    assert toggle_back.status_code == 200
    assert toggle_back.json()["is_available"] is True

    # Step 5: Verify product appears in the public customer catalog
    catalog_res = client.get("/api/v1/menu/catalog")
    assert catalog_res.status_code == 200
    catalog = catalog_res.json()
    found_cat = next((c for c in catalog if c["category_id"] == cat_id), None)
    assert found_cat is not None
    found_item = next((i for i in found_cat["items"] if i["menu_item_id"] == item_id), None)
    assert found_item is not None
    assert found_item["item_name"] == prod_name

    print("ALL REAL MENU PRODUCT CREATION TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    test_real_menu_product_creation()
