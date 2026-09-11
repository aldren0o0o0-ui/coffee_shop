import io
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.database.session import SessionLocal
from app.main import app
from app.modules.inventory.models import InventoryItem
from app.modules.menu.models import MenuCategory
from app.modules.users.models import Role, User, UserRole

client = TestClient(app)

PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"


def setup_trash_test_data():
    db = SessionLocal()

    # Roles
    owner_role = db.query(Role).filter(Role.role_name == "Owner").first()
    if not owner_role:
        owner_role = Role(role_name="Owner", description="Owner", is_active=True)
        db.add(owner_role)
        db.flush()

    barista_role = db.query(Role).filter(Role.role_name == "Barista").first()
    if not barista_role:
        barista_role = Role(role_name="Barista", description="Barista", is_active=True)
        db.add(barista_role)
        db.flush()

    # Users
    owner = db.query(User).filter(User.username == "trash_test_owner").first()
    if not owner:
        owner = User(
            username="trash_test_owner",
            email="trash_owner@brewflow.local",
            password_hash=hash_password("OwnerPassword123!"),
            first_name="Trash",
            last_name="Owner",
            is_active=True,
        )
        db.add(owner)
        db.flush()
        db.add(UserRole(user_id=owner.user_id, role_id=owner_role.role_id, is_active=True))

    barista = db.query(User).filter(User.username == "trash_test_barista").first()
    if not barista:
        barista = User(
            username="trash_test_barista",
            email="trash_barista@brewflow.local",
            password_hash=hash_password("BaristaPassword123!"),
            first_name="Trash",
            last_name="Barista",
            is_active=True,
        )
        db.add(barista)
        db.flush()
        db.add(UserRole(user_id=barista.user_id, role_id=barista_role.role_id, is_active=True))

    # Category
    category = db.query(MenuCategory).filter(MenuCategory.category_name == "Trash Test Category").first()
    if not category:
        category = MenuCategory(
            category_name="Trash Test Category",
            description="Testing category",
            display_order=1,
            is_active=True,
        )
        db.add(category)
        db.flush()

    # Inventory
    inv = db.query(InventoryItem).filter(InventoryItem.item_name == "Trash Test Milk").first()
    if not inv:
        inv = InventoryItem(
            item_name="Trash Test Milk",
            unit_of_measure="L",
            quantity_on_hand=Decimal("30.000"),
            reorder_level=Decimal("5.000"),
            unit_cost=Decimal("2.50"),
            is_active=True,
        )
        db.add(inv)
        db.flush()

    db.commit()
    cat_id = category.category_id
    inv_id = inv.inventory_item_id
    db.close()
    return cat_id, inv_id


def test_update_product_details_and_recipes():
    cat_id, inv_id = setup_trash_test_data()

    # Login as owner
    login_res = client.post("/api/v1/auth/login", json={"identifier": "trash_test_owner", "password": "OwnerPassword123!"})
    assert login_res.status_code == 200

    # 1. Create a published product
    create_res = client.post("/api/v1/menu/items", json={
        "category_id": cat_id,
        "item_name": "Vanilla Cold Brew",
        "description": "Slow steeped cold brew",
        "base_price": "4.50",
        "is_available": True,
        "sizes": [{"size_name": "Regular", "price_adjustment": "0.00", "is_default": True}],
        "addons": [],
        "ingredients": [],
    })
    assert create_res.status_code == 201
    item_id = create_res.json()["menu_item_id"]

    # 2. Update product details (Price, description, sizes, addons, ingredients)
    update_res = client.put(f"/api/v1/menu/items/{item_id}", json={
        "category_id": cat_id,
        "item_name": "Vanilla Cream Cold Brew (Special Edition)",
        "description": "Steeped for 20 hours with Madagascar vanilla sweet cream",
        "base_price": "5.25",
        "is_available": True,
        "sizes": [
            {"size_name": "Regular (12oz)", "price_adjustment": "0.00", "is_default": True},
            {"size_name": "Large (16oz)", "price_adjustment": "1.00", "is_default": False},
        ],
        "addons": [
            {"addon_name": "Extra Vanilla Cream", "additional_price": "0.75", "is_active": True},
        ],
        "ingredients": [
            {"inventory_item_id": inv_id, "quantity_required": "0.150", "unit_of_measure": "L"},
        ],
    })
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["item_name"] == "Vanilla Cream Cold Brew (Special Edition)"
    assert float(updated_data["base_price"]) == 5.25
    assert len(updated_data["sizes"]) == 2
    assert len(updated_data["addons"]) == 1
    assert len(updated_data["ingredients"]) == 1


def test_trash_bin_move_restore_and_permanent_delete():
    cat_id, _ = setup_trash_test_data()

    # Login as owner
    client.post("/api/v1/auth/login", json={"identifier": "trash_test_owner", "password": "OwnerPassword123!"})

    unique_name = f"Seasonal Pumpkin Drink {uuid.uuid4().hex[:6]}"
    create_res = client.post("/api/v1/menu/items", json={
        "category_id": cat_id,
        "item_name": unique_name,
        "base_price": "5.75",
        "is_available": True,
    })
    item_id = create_res.json()["menu_item_id"]

    # Attach an image
    client.post(
        f"/api/v1/menu/items/{item_id}/images",
        files={"file": ("pumpkin.png", io.BytesIO(PNG_BYTES), "image/png")},
    )

    # 1. Verify item is in public catalog
    cat_res1 = client.get("/api/v1/menu/catalog")
    all_catalog_ids = [i["menu_item_id"] for cat in cat_res1.json() for i in cat["items"]]
    assert item_id in all_catalog_ids

    # 2. Move item to Trash
    trash_res = client.patch(f"/api/v1/menu/items/{item_id}/trash", json={"is_deleted": True})
    assert trash_res.status_code == 200
    assert trash_res.json()["is_deleted"] is True
    assert trash_res.json()["is_available"] is False

    # 3. Verify item is NO LONGER in public catalog
    cat_res2 = client.get("/api/v1/menu/catalog")
    all_catalog_ids_after = [i["menu_item_id"] for cat in cat_res2.json() for i in cat["items"]]
    assert item_id not in all_catalog_ids_after, "Trashed item must be hidden from public catalog!"

    # 4. Verify item appears in Trash catalog
    trash_catalog_res = client.get("/api/v1/menu/trash")
    assert trash_catalog_res.status_code == 200
    trashed_ids = [i["menu_item_id"] for i in trash_catalog_res.json()]
    assert item_id in trashed_ids

    # 5. Restore item from Trash
    restore_res = client.patch(f"/api/v1/menu/items/{item_id}/trash", json={"is_deleted": False})
    assert restore_res.status_code == 200
    assert restore_res.json()["is_deleted"] is False

    # 6. Verify item is restored to public catalog
    cat_res3 = client.get("/api/v1/menu/catalog")
    all_catalog_ids_restored = [i["menu_item_id"] for cat in cat_res3.json() for i in cat["items"]]
    assert item_id in all_catalog_ids_restored

    # 7. Move back to trash and permanently delete
    client.patch(f"/api/v1/menu/items/{item_id}/trash", json={"is_deleted": True})
    perm_del_res = client.delete(f"/api/v1/menu/items/{item_id}/permanent")
    assert perm_del_res.status_code == 204, perm_del_res.text

    # 8. Verify item is completely gone from DB
    trash_after_del = client.get("/api/v1/menu/trash")
    assert item_id not in [i["menu_item_id"] for i in trash_after_del.json()]


def test_rbac_security_trash_and_update_blocked_for_barista():
    cat_id, _ = setup_trash_test_data()

    # Login as Barista
    client.post("/api/v1/auth/login", json={"identifier": "trash_test_barista", "password": "BaristaPassword123!"})

    # Try viewing trash catalog
    trash_view = client.get("/api/v1/menu/trash")
    assert trash_view.status_code == 403

    # Try updating product
    bad_update = client.put("/api/v1/menu/items/1", json={
        "category_id": cat_id,
        "item_name": "Rogue Update",
        "base_price": "1.00",
    })
    assert bad_update.status_code == 403

    # Try moving to trash
    bad_trash = client.patch("/api/v1/menu/items/1/trash", json={"is_deleted": True})
    assert bad_trash.status_code == 403

    # Try permanently deleting
    bad_delete = client.delete("/api/v1/menu/items/1/permanent")
    assert bad_delete.status_code == 403
