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

# Real binary image fixtures
# 1x1 Transparent PNG
PNG_MAGIC_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
# 1x1 Minimal JPEG
JPEG_MAGIC_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
# Fake disguise executable
FAKE_EXE_BYTES = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00This is a fake windows executable file."


def setup_wizard_test_users_and_category():
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

    owner_user = db.query(User).filter(User.username == "test_owner").first()
    if not owner_user:
        owner_user = User(
            username="test_owner",
            email="owner_test@brewflow.local",
            password_hash=hash_password("OwnerPassword123!"),
            first_name="Admin",
            last_name="Owner",
            is_active=True,
        )
        db.add(owner_user)
        db.flush()
        db.add(UserRole(user_id=owner_user.user_id, role_id=owner_role.role_id, is_active=True))

    barista_user = db.query(User).filter(User.username == "test_barista").first()
    if not barista_user:
        barista_user = User(
            username="test_barista",
            email="barista_test@brewflow.local",
            password_hash=hash_password("BaristaPassword123!"),
            first_name="Bob",
            last_name="Barista",
            is_active=True,
        )
        db.add(barista_user)
        db.flush()
        db.add(UserRole(user_id=barista_user.user_id, role_id=barista_role.role_id, is_active=True))

    # Category
    category = db.query(MenuCategory).filter(MenuCategory.category_name == "Wizard Coffee").first()
    if not category:
        category = MenuCategory(
            category_name=f"Wizard Coffee {uuid.uuid4().hex[:6]}",
            description="Wizard test category",
            display_order=1,
            is_active=True,
        )
        db.add(category)
        db.flush()

    # Inventory
    inv = db.query(InventoryItem).filter(InventoryItem.item_name == "Wizard Beans").first()
    if not inv:
        inv = InventoryItem(
            item_name=f"Wizard Beans {uuid.uuid4().hex[:6]}",
            unit_of_measure="kg",
            quantity_on_hand=Decimal("20.000"),
            reorder_level=Decimal("2.000"),
            unit_cost=Decimal("12.00"),
            is_active=True,
        )
        db.add(inv)
        db.flush()

    db.commit()
    cat_id = category.category_id
    inv_id = inv.inventory_item_id
    db.close()
    return cat_id, inv_id


def test_multi_image_upload_primary_invariant_and_delete_promotion():
    cat_id, inv_id = setup_wizard_test_users_and_category()

    # Login as owner
    login_res = client.post("/api/v1/auth/login", json={"identifier": "test_owner", "password": "OwnerPassword123!"})
    assert login_res.status_code == 200

    # 1. Create a draft product
    draft_res = client.post("/api/v1/menu/items/draft", json={
        "category_id": cat_id,
        "item_name": "Caramel Macchiato Draft",
        "description": "Draft drink in wizard",
        "base_price": "5.50",
    })
    assert draft_res.status_code == 201, draft_res.text
    item_id = draft_res.json()["menu_item_id"]
    assert draft_res.json()["is_draft"] is True
    assert draft_res.json()["images"] == []

    # 2. Upload Image 1 (PNG) -> Should automatically be primary
    upload_res1 = client.post(
        f"/api/v1/menu/items/{item_id}/images",
        files={"file": ("hero.png", io.BytesIO(PNG_MAGIC_BYTES), "image/png")},
    )
    assert upload_res1.status_code == 201, upload_res1.text
    img1_data = upload_res1.json()
    img1_id = img1_data["menu_item_image_id"]
    assert img1_data["is_primary"] is True
    assert img1_data["display_order"] == 0

    # 3. Upload Image 2 (JPEG) -> Should NOT be primary (Primary stays on img1)
    upload_res2 = client.post(
        f"/api/v1/menu/items/{item_id}/images",
        files={"file": ("angle2.jpg", io.BytesIO(JPEG_MAGIC_BYTES), "image/jpeg")},
    )
    assert upload_res2.status_code == 201, upload_res2.text
    img2_data = upload_res2.json()
    img2_id = img2_data["menu_item_image_id"]
    assert img2_data["is_primary"] is False
    assert img2_data["display_order"] == 1

    # 4. Upload Image 3 (PNG) -> Should NOT be primary
    upload_res3 = client.post(
        f"/api/v1/menu/items/{item_id}/images",
        files={"file": ("angle3.png", io.BytesIO(PNG_MAGIC_BYTES), "image/png")},
    )
    assert upload_res3.status_code == 201, upload_res3.text
    img3_id = upload_res3.json()["menu_item_image_id"]

    # 5. Switch primary to Image 2
    switch_res = client.patch(f"/api/v1/menu/items/{item_id}/images/{img2_id}/primary")
    assert switch_res.status_code == 200
    images = switch_res.json()["images"]
    assert next(img["is_primary"] for img in images if img["menu_item_image_id"] == img2_id) is True
    assert next(img["is_primary"] for img in images if img["menu_item_image_id"] == img1_id) is False
    assert switch_res.json()["image_url"] == next(img["image_url"] for img in images if img["menu_item_image_id"] == img2_id)

    # 6. Reorder images (put img3 first, then img2, then img1)
    reorder_res = client.patch(f"/api/v1/menu/items/{item_id}/images/reorder", json={
        "image_ids": [img3_id, img2_id, img1_id],
    })
    assert reorder_res.status_code == 200
    reordered_images = reorder_res.json()["images"]
    reordered_dict = {img["menu_item_image_id"]: img["display_order"] for img in reordered_images}
    assert reordered_dict[img3_id] == 0
    assert reordered_dict[img2_id] == 1
    assert reordered_dict[img1_id] == 2

    # 7. Delete the current primary image (img2) -> Auto-promotes the next image in display_order
    del_res = client.delete(f"/api/v1/menu/items/{item_id}/images/{img2_id}")
    assert del_res.status_code == 200
    remaining_images = del_res.json()["images"]
    assert len(remaining_images) == 2
    # Exactly one primary must remain
    primary_count = sum(1 for img in remaining_images if img["is_primary"])
    assert primary_count == 1
    assert del_res.json()["image_url"] is not None


def test_magic_bytes_security_rejection_and_quota_limit():
    cat_id, _ = setup_wizard_test_users_and_category()

    # Login as owner
    client.post("/api/v1/auth/login", json={"identifier": "test_owner", "password": "OwnerPassword123!"})

    draft_res = client.post("/api/v1/menu/items/draft", json={
        "category_id": cat_id,
        "item_name": "Security Test Drink",
        "base_price": "4.00",
    })
    item_id = draft_res.json()["menu_item_id"]

    # 1. Attempt to upload disguised executable file named .jpg
    fake_upload = client.post(
        f"/api/v1/menu/items/{item_id}/images",
        files={"file": ("virus_disguised.jpg", io.BytesIO(FAKE_EXE_BYTES), "image/jpeg")},
    )
    assert fake_upload.status_code == 400
    assert "invalid image format" in fake_upload.json()["detail"].lower()

    # 2. Upload 5 valid images (reach max quota)
    for i in range(5):
        up_res = client.post(
            f"/api/v1/menu/items/{item_id}/images",
            files={"file": (f"img_{i}.png", io.BytesIO(PNG_MAGIC_BYTES), "image/png")},
        )
        assert up_res.status_code == 201

    # 3. Attempt to upload 6th image -> Must be rejected with 400 limit message
    sixth_upload = client.post(
        f"/api/v1/menu/items/{item_id}/images",
        files={"file": ("sixth.png", io.BytesIO(PNG_MAGIC_BYTES), "image/png")},
    )
    assert sixth_upload.status_code == 400
    assert "maximum limit of 5" in sixth_upload.json()["detail"].lower()


def test_draft_isolation_and_publish_flow():
    cat_id, inv_id = setup_wizard_test_users_and_category()

    # Login as owner
    client.post("/api/v1/auth/login", json={"identifier": "test_owner", "password": "OwnerPassword123!"})

    unique_title = f"Published Honey Latte {uuid.uuid4().hex[:6]}"
    draft_res = client.post("/api/v1/menu/items/draft", json={
        "category_id": cat_id,
        "item_name": unique_title,
        "base_price": "6.00",
    })
    item_id = draft_res.json()["menu_item_id"]

    # Verify draft does NOT appear in public catalog
    catalog_res = client.get("/api/v1/menu/catalog")
    assert catalog_res.status_code == 200
    all_catalog_item_ids = [
        item["menu_item_id"]
        for cat in catalog_res.json()
        for item in cat["items"]
    ]
    assert item_id not in all_catalog_item_ids, "Unpublished draft item must not appear in public catalog!"

    # Upload image
    client.post(
        f"/api/v1/menu/items/{item_id}/images",
        files={"file": ("honey.png", io.BytesIO(PNG_MAGIC_BYTES), "image/png")},
    )

    # Publish product (Step 6)
    publish_res = client.put(f"/api/v1/menu/items/{item_id}/publish", json={
        "category_id": cat_id,
        "item_name": unique_title,
        "description": "Rich honey infused latte with oat milk",
        "base_price": "6.00",
        "is_available": True,
        "sizes": [
            {"size_name": "Regular", "price_adjustment": "0.00", "is_default": True},
            {"size_name": "Large", "price_adjustment": "1.20", "is_default": False},
        ],
        "addons": [
            {"addon_name": "Extra Honey Drizzle", "additional_price": "0.50", "is_active": True},
        ],
        "ingredients": [
            {"inventory_item_id": inv_id, "quantity_required": "0.025", "unit_of_measure": "kg"},
        ],
    })
    assert publish_res.status_code == 200, publish_res.text
    pub_data = publish_res.json()
    assert pub_data["is_draft"] is False
    assert len(pub_data["sizes"]) == 2
    assert len(pub_data["addons"]) == 1
    assert len(pub_data["ingredients"]) == 1

    # Verify product NOW appears in public catalog
    cat2_res = client.get("/api/v1/menu/catalog")
    all_catalog_items = [
        item
        for cat in cat2_res.json()
        for item in cat["items"]
    ]
    published_in_catalog = next((i for i in all_catalog_items if i["menu_item_id"] == item_id), None)
    assert published_in_catalog is not None, "Published product MUST now appear in public catalog!"
    assert published_in_catalog["item_name"] == unique_title
    assert published_in_catalog["image_url"] is not None


def test_rbac_security_barista_and_unauthorized_blocked():
    cat_id, _ = setup_wizard_test_users_and_category()

    # Login as Barista (unauthorized for product management)
    client.post("/api/v1/auth/login", json={"identifier": "test_barista", "password": "BaristaPassword123!"})

    # Try draft creation
    bad_draft = client.post("/api/v1/menu/items/draft", json={
        "category_id": cat_id,
        "item_name": "Barista Rogue Drink",
        "base_price": "1.00",
    })
    assert bad_draft.status_code == 403

    # Try image upload
    bad_upload = client.post(
        "/api/v1/menu/items/1/images",
        files={"file": ("rogue.png", io.BytesIO(PNG_MAGIC_BYTES), "image/png")},
    )
    assert bad_upload.status_code == 403
