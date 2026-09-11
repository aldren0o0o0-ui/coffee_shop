from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.inventory.models import InventoryItem
from app.modules.inventory.schemas import InventoryOption
from app.modules.inventory.service import get_inventory_options as inventory_get_options
from app.modules.menu.models import (
    MenuCategory,
    MenuItem,
    MenuItemAddon,
    MenuItemImage,
    MenuItemIngredient,
    MenuItemSize,
)
from app.modules.menu.schemas import (
    MenuCategoryCatalog,
    MenuCategoryCreateRequest,
    MenuItemAddonCatalog,
    MenuItemCatalog,
    MenuItemCreateRequest,
    MenuItemDraftCreateRequest,
    MenuItemImageCatalog,
    MenuItemPublishRequest,
    MenuItemSizeCatalog,
    MenuItemUpdateRequest,
)
from app.modules.users.models import User
from app.shared.storage import delete_file_by_url, save_menu_item_image


def verify_menu_manager_or_owner(user: User):
    roles = [r.role.role_name.lower() for r in user.user_roles if r.is_active and r.role.is_active]
    if "owner" not in roles and "manager" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Store Owners and Managers have permission to add or modify menu products.",
        )


def verify_menu_editor(user: User):
    roles = [r.role.role_name.lower() for r in user.user_roles if r.is_active and r.role.is_active]
    if "owner" not in roles and "manager" not in roles and "barista" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to change item availability.",
        )


def _serialize_menu_item(item: MenuItem) -> MenuItemCatalog:
    sizes = [
        MenuItemSizeCatalog(
            menu_item_size_id=s.menu_item_size_id,
            size_name=s.size_name,
            price_adjustment=s.price_adjustment,
            is_default=s.is_default,
        )
        for s in item.sizes
    ]
    addons = [
        MenuItemAddonCatalog(
            menu_item_addon_id=a.menu_item_addon_id,
            addon_name=a.addon_name,
            additional_price=a.additional_price,
            is_active=a.is_active,
        )
        for a in item.addons
    ]
    ingredients = [
        ing.inventory_item.item_name
        for ing in item.ingredients
        if ing.inventory_item
    ]
    images = [
        MenuItemImageCatalog(
            menu_item_image_id=img.menu_item_image_id,
            image_url=img.image_url,
            is_primary=img.is_primary,
            display_order=img.display_order,
            file_size_bytes=img.file_size_bytes,
        )
        for img in item.images
    ]
    primary_img = next((img for img in item.images if img.is_primary), None)
    img_url = primary_img.image_url if primary_img else item.image_url

    return MenuItemCatalog(
        menu_item_id=item.menu_item_id,
        category_id=item.category_id,
        category_name=item.category.category_name if item.category else "",
        item_name=item.item_name,
        description=item.description,
        base_price=item.base_price,
        image_url=img_url,
        is_available=item.is_available,
        is_draft=item.is_draft,
        is_deleted=item.is_deleted,
        images=images,
        sizes=sizes,
        addons=addons,
        ingredients=ingredients,
    )


def _load_menu_item_with_relations(database: Session, item_id: int) -> MenuItem | None:
    stmt = (
        select(MenuItem)
        .options(
            selectinload(MenuItem.category),
            selectinload(MenuItem.images),
            selectinload(MenuItem.sizes),
            selectinload(MenuItem.addons),
            selectinload(MenuItem.ingredients).selectinload(MenuItemIngredient.inventory_item),
        )
        .where(MenuItem.menu_item_id == item_id)
    )
    return database.scalar(stmt)


def create_menu_category(
    database: Session,
    payload: MenuCategoryCreateRequest,
    user: User,
) -> MenuCategoryCatalog:
    verify_menu_manager_or_owner(user)

    clean_name = payload.category_name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name cannot be empty.",
        )

    existing = database.scalar(
        select(MenuCategory).where(func.lower(MenuCategory.category_name) == clean_name.lower())
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A category named '{clean_name}' already exists.",
        )

    category = MenuCategory(
        category_name=clean_name,
        description=payload.description.strip() if payload.description else None,
        display_order=payload.display_order,
        is_active=True,
    )
    database.add(category)
    database.commit()
    database.refresh(category)

    return MenuCategoryCatalog(
        category_id=category.category_id,
        category_name=category.category_name,
        description=category.description,
        display_order=category.display_order,
        items=[],
    )


def create_menu_item_draft(
    database: Session,
    payload: MenuItemDraftCreateRequest,
    user: User,
) -> MenuItemCatalog:
    """
    Initializes a draft product so images and recipes can be attached immediately in the wizard.
    """
    verify_menu_manager_or_owner(user)

    category = database.get(MenuCategory, payload.category_id)
    if not category or not category.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {payload.category_id} not found or is inactive.",
        )

    clean_name = payload.item_name.strip() or "Untitled Product Draft"

    menu_item = MenuItem(
        category_id=payload.category_id,
        item_name=clean_name,
        description=payload.description.strip() if payload.description else None,
        base_price=max(payload.base_price, Decimal("0.00")),
        image_url=None,
        is_available=True,
        is_draft=True,
    )
    database.add(menu_item)
    database.commit()

    saved_item = _load_menu_item_with_relations(database, menu_item.menu_item_id)
    return _serialize_menu_item(saved_item)


def upload_menu_item_image(
    database: Session,
    item_id: int,
    file_bytes: bytes,
    filename: str | None,
    user: User,
) -> MenuItemImageCatalog:
    """
    Uploads a single image to a product, enforcing max 5 images limit and assigning is_primary if first image.
    """
    verify_menu_manager_or_owner(user)

    item = database.get(MenuItem, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item with ID {item_id} not found.",
        )

    existing_images = list(
        database.scalars(
            select(MenuItemImage)
            .where(MenuItemImage.menu_item_id == item_id)
            .order_by(MenuItemImage.display_order.asc())
        ).all()
    )

    if len(existing_images) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum limit of 5 photos per product reached. Please remove an existing photo first.",
        )

    relative_url, file_size = save_menu_item_image(item_id, file_bytes, filename)

    # Set as primary if no existing primary image
    has_primary = any(img.is_primary for img in existing_images)
    is_primary = not has_primary

    next_display_order = max([img.display_order for img in existing_images], default=-1) + 1

    new_image = MenuItemImage(
        menu_item_id=item_id,
        image_url=relative_url,
        is_primary=is_primary,
        display_order=next_display_order,
        file_size_bytes=file_size,
    )
    database.add(new_image)

    if is_primary:
        item.image_url = relative_url

    database.commit()
    database.refresh(new_image)

    return MenuItemImageCatalog(
        menu_item_image_id=new_image.menu_item_image_id,
        image_url=new_image.image_url,
        is_primary=new_image.is_primary,
        display_order=new_image.display_order,
        file_size_bytes=new_image.file_size_bytes,
    )


def delete_menu_item_image(
    database: Session,
    item_id: int,
    image_id: int,
    user: User,
) -> MenuItemCatalog:
    """
    Deletes an image and auto-promotes the next image to primary if deleted image was primary.
    """
    verify_menu_manager_or_owner(user)

    image = database.scalar(
        select(MenuItemImage).where(
            MenuItemImage.menu_item_image_id == image_id,
            MenuItemImage.menu_item_id == item_id,
        )
    )
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image with ID {image_id} not found on product {item_id}.",
        )

    item = database.get(MenuItem, item_id)
    was_primary = image.is_primary
    image_url_to_delete = image.image_url

    database.delete(image)
    database.flush()

    delete_file_by_url(image_url_to_delete)

    if was_primary and item:
        remaining = list(
            database.scalars(
                select(MenuItemImage)
                .where(MenuItemImage.menu_item_id == item_id)
                .order_by(MenuItemImage.display_order.asc())
            ).all()
        )
        if remaining:
            remaining[0].is_primary = True
            item.image_url = remaining[0].image_url
        else:
            item.image_url = None

    database.commit()
    saved_item = _load_menu_item_with_relations(database, item_id)
    return _serialize_menu_item(saved_item)


def set_primary_menu_item_image(
    database: Session,
    item_id: int,
    image_id: int,
    user: User,
) -> MenuItemCatalog:
    """
    Atomically switches the primary photo for a product.
    """
    verify_menu_manager_or_owner(user)

    item = database.get(MenuItem, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item with ID {item_id} not found.",
        )

    images = list(
        database.scalars(
            select(MenuItemImage)
            .where(MenuItemImage.menu_item_id == item_id)
        ).all()
    )

    target_image = next((img for img in images if img.menu_item_image_id == image_id), None)
    if not target_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image with ID {image_id} not found for this product.",
        )

    for img in images:
        img.is_primary = (img.menu_item_image_id == image_id)

    item.image_url = target_image.image_url

    database.commit()
    saved_item = _load_menu_item_with_relations(database, item_id)
    return _serialize_menu_item(saved_item)


def reorder_menu_item_images(
    database: Session,
    item_id: int,
    image_ids: list[int],
    user: User,
) -> MenuItemCatalog:
    """
    Updates the display order sequence of product thumbnails.
    """
    verify_menu_manager_or_owner(user)

    images = list(
        database.scalars(
            select(MenuItemImage)
            .where(MenuItemImage.menu_item_id == item_id)
        ).all()
    )
    img_map = {img.menu_item_image_id: img for img in images}

    for order_idx, img_id in enumerate(image_ids):
        if img_id in img_map:
            img_map[img_id].display_order = order_idx

    database.commit()
    saved_item = _load_menu_item_with_relations(database, item_id)
    return _serialize_menu_item(saved_item)


def publish_menu_item(
    database: Session,
    item_id: int,
    payload: MenuItemPublishRequest,
    user: User,
) -> MenuItemCatalog:
    """
    Finalizes product creation wizard: updates details, sizes, recipes, and sets is_draft = False.
    """
    verify_menu_manager_or_owner(user)

    clean_name = payload.item_name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product name cannot be empty.",
        )

    if payload.base_price < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product base price cannot be negative.",
        )

    item = database.get(MenuItem, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item with ID {item_id} not found.",
        )

    category = database.get(MenuCategory, payload.category_id)
    if not category or not category.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {payload.category_id} not found or is inactive.",
        )

    item.category_id = payload.category_id
    item.item_name = clean_name
    item.description = payload.description.strip() if payload.description else None
    item.base_price = payload.base_price
    item.is_available = payload.is_available
    item.is_draft = False

    # Clear and replace sizes
    database.query(MenuItemSize).filter(MenuItemSize.menu_item_id == item_id).delete()
    if payload.sizes:
        for s in payload.sizes:
            database.add(
                MenuItemSize(
                    menu_item_id=item_id,
                    size_name=s.size_name.strip(),
                    price_adjustment=s.price_adjustment,
                    is_default=s.is_default,
                )
            )
    else:
        database.add(
            MenuItemSize(
                menu_item_id=item_id,
                size_name="Regular",
                price_adjustment=Decimal("0.00"),
                is_default=True,
            )
        )

    # Clear and replace addons
    database.query(MenuItemAddon).filter(MenuItemAddon.menu_item_id == item_id).delete()
    if payload.addons:
        for a in payload.addons:
            database.add(
                MenuItemAddon(
                    menu_item_id=item_id,
                    addon_name=a.addon_name.strip(),
                    additional_price=a.additional_price,
                    is_active=a.is_active,
                )
            )

    # Clear and replace ingredients
    database.query(MenuItemIngredient).filter(MenuItemIngredient.menu_item_id == item_id).delete()
    if payload.ingredients:
        for ing in payload.ingredients:
            inv_item = database.get(InventoryItem, ing.inventory_item_id)
            if not inv_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Inventory ingredient with ID {ing.inventory_item_id} not found.",
                )
            if ing.quantity_required <= Decimal("0.000"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Quantity required for ingredient '{inv_item.item_name}' must be greater than 0.",
                )

            database.add(
                MenuItemIngredient(
                    menu_item_id=item_id,
                    inventory_item_id=ing.inventory_item_id,
                    quantity_required=ing.quantity_required,
                    unit_of_measure=ing.unit_of_measure or inv_item.unit_of_measure,
                )
            )

    # Synchronize primary image if exists
    primary_img = database.scalar(
        select(MenuItemImage)
        .where(MenuItemImage.menu_item_id == item_id, MenuItemImage.is_primary.is_(True))
        .limit(1)
    )
    if primary_img:
        item.image_url = primary_img.image_url

    database.commit()
    saved_item = _load_menu_item_with_relations(database, item_id)
    return _serialize_menu_item(saved_item)


def create_menu_item(
    database: Session,
    payload: MenuItemCreateRequest,
    user: User,
) -> MenuItemCatalog:
    """
    Direct synchronous creation helper (backwards compatible).
    """
    verify_menu_manager_or_owner(user)

    clean_name = payload.item_name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product name cannot be empty.",
        )

    if payload.base_price < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product base price cannot be negative.",
        )

    category = database.get(MenuCategory, payload.category_id)
    if not category or not category.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {payload.category_id} not found or is inactive.",
        )

    menu_item = MenuItem(
        category_id=payload.category_id,
        item_name=clean_name,
        description=payload.description.strip() if payload.description else None,
        base_price=payload.base_price,
        image_url=payload.image_url.strip() if payload.image_url else None,
        is_available=payload.is_available,
        is_draft=False,
    )
    database.add(menu_item)
    database.flush()

    if payload.sizes:
        for s in payload.sizes:
            database.add(
                MenuItemSize(
                    menu_item_id=menu_item.menu_item_id,
                    size_name=s.size_name.strip(),
                    price_adjustment=s.price_adjustment,
                    is_default=s.is_default,
                )
            )
    else:
        database.add(
            MenuItemSize(
                menu_item_id=menu_item.menu_item_id,
                size_name="Regular",
                price_adjustment=Decimal("0.00"),
                is_default=True,
            )
        )

    if payload.addons:
        for a in payload.addons:
            database.add(
                MenuItemAddon(
                    menu_item_id=menu_item.menu_item_id,
                    addon_name=a.addon_name.strip(),
                    additional_price=a.additional_price,
                    is_active=a.is_active,
                )
            )

    if payload.ingredients:
        for ing in payload.ingredients:
            inv_item = database.get(InventoryItem, ing.inventory_item_id)
            if not inv_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Inventory ingredient with ID {ing.inventory_item_id} not found.",
                )
            if ing.quantity_required <= Decimal("0.000"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Quantity required for ingredient '{inv_item.item_name}' must be greater than 0.",
                )

            database.add(
                MenuItemIngredient(
                    menu_item_id=menu_item.menu_item_id,
                    inventory_item_id=ing.inventory_item_id,
                    quantity_required=ing.quantity_required,
                    unit_of_measure=ing.unit_of_measure or inv_item.unit_of_measure,
                )
            )

    database.commit()
    saved_item = _load_menu_item_with_relations(database, menu_item.menu_item_id)
    return _serialize_menu_item(saved_item)


def toggle_menu_item_availability(
    database: Session,
    item_id: int,
    is_available: bool,
    user: User,
) -> MenuItemCatalog:
    verify_menu_editor(user)

    item = _load_menu_item_with_relations(database, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item with ID {item_id} not found.",
        )

    item.is_available = is_available
    database.commit()
    database.refresh(item)
    return _serialize_menu_item(item)


def get_inventory_options(database: Session) -> list[InventoryOption]:
    return inventory_get_options(database)


def update_menu_item(
    database: Session,
    item_id: int,
    payload: MenuItemUpdateRequest,
    user: User,
) -> MenuItemCatalog:
    """
    Updates an existing menu item's basic info, pricing, sizes, addons, and recipe ingredients.
    """
    verify_menu_manager_or_owner(user)

    clean_name = payload.item_name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product name cannot be empty.",
        )

    if payload.base_price < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product base price cannot be negative.",
        )

    item = database.get(MenuItem, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item with ID {item_id} not found.",
        )

    category = database.get(MenuCategory, payload.category_id)
    if not category or not category.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {payload.category_id} not found or is inactive.",
        )

    item.category_id = payload.category_id
    item.item_name = clean_name
    item.description = payload.description.strip() if payload.description else None
    item.base_price = payload.base_price
    item.is_available = payload.is_available

    # Replace sizes
    database.query(MenuItemSize).filter(MenuItemSize.menu_item_id == item_id).delete()
    if payload.sizes:
        for s in payload.sizes:
            database.add(
                MenuItemSize(
                    menu_item_id=item_id,
                    size_name=s.size_name.strip(),
                    price_adjustment=s.price_adjustment,
                    is_default=s.is_default,
                )
            )
    else:
        database.add(
            MenuItemSize(
                menu_item_id=item_id,
                size_name="Regular",
                price_adjustment=Decimal("0.00"),
                is_default=True,
            )
        )

    # Replace addons
    database.query(MenuItemAddon).filter(MenuItemAddon.menu_item_id == item_id).delete()
    if payload.addons:
        for a in payload.addons:
            database.add(
                MenuItemAddon(
                    menu_item_id=item_id,
                    addon_name=a.addon_name.strip(),
                    additional_price=a.additional_price,
                    is_active=a.is_active,
                )
            )

    # Replace ingredients
    database.query(MenuItemIngredient).filter(MenuItemIngredient.menu_item_id == item_id).delete()
    if payload.ingredients:
        for ing in payload.ingredients:
            inv_item = database.get(InventoryItem, ing.inventory_item_id)
            if not inv_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Inventory ingredient with ID {ing.inventory_item_id} not found.",
                )
            if ing.quantity_required <= Decimal("0.000"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Quantity required for ingredient '{inv_item.item_name}' must be greater than 0.",
                )

            database.add(
                MenuItemIngredient(
                    menu_item_id=item_id,
                    inventory_item_id=ing.inventory_item_id,
                    quantity_required=ing.quantity_required,
                    unit_of_measure=ing.unit_of_measure or inv_item.unit_of_measure,
                )
            )

    database.commit()
    saved_item = _load_menu_item_with_relations(database, item_id)
    return _serialize_menu_item(saved_item)


def move_menu_item_to_trash(
    database: Session,
    item_id: int,
    is_deleted: bool,
    user: User,
) -> MenuItemCatalog:
    """
    Moves an item to trash (soft-delete) or restores it back to active catalog.
    """
    verify_menu_manager_or_owner(user)

    item = database.get(MenuItem, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item with ID {item_id} not found.",
        )

    item.is_deleted = is_deleted
    if is_deleted:
        # Trashed items are automatically marked unavailable
        item.is_available = False

    database.commit()
    saved_item = _load_menu_item_with_relations(database, item_id)
    return _serialize_menu_item(saved_item)


def delete_menu_item_permanently(
    database: Session,
    item_id: int,
    user: User,
) -> None:
    """
    Hard deletes a product, its photos from disk, and cascades associations.
    """
    verify_menu_manager_or_owner(user)

    item = _load_menu_item_with_relations(database, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu item with ID {item_id} not found.",
        )

    # Delete all physical image files from disk
    for img in item.images:
        delete_file_by_url(img.image_url)

    database.delete(item)
    try:
        database.commit()
    except Exception as exc:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot permanently delete an item with historical orders. Keep it in the Trash Bin instead to protect financial audit history.",
        ) from exc


def get_trash_catalog(
    database: Session,
    user: User,
) -> list[MenuItemCatalog]:
    """
    Retrieves all trashed products for Owner / Manager view.
    """
    verify_menu_manager_or_owner(user)

    stmt = (
        select(MenuItem)
        .options(
            selectinload(MenuItem.category),
            selectinload(MenuItem.images),
            selectinload(MenuItem.sizes),
            selectinload(MenuItem.addons),
            selectinload(MenuItem.ingredients).selectinload(MenuItemIngredient.inventory_item),
        )
        .where(MenuItem.is_deleted.is_(True))
        .order_by(MenuItem.updated_at.desc())
    )
    items = list(database.scalars(stmt).all())
    return [_serialize_menu_item(item) for item in items]


def empty_trash_catalog(
    database: Session,
    user: User,
) -> int:
    """
    Permanently purges all products in the trash bin and their photos from disk.
    """
    verify_menu_manager_or_owner(user)

    stmt = (
        select(MenuItem)
        .options(selectinload(MenuItem.images))
        .where(MenuItem.is_deleted.is_(True))
    )
    trashed_items = list(database.scalars(stmt).all())
    count = len(trashed_items)

    for item in trashed_items:
        for img in item.images:
            delete_file_by_url(img.image_url)
        database.delete(item)

    database.commit()
    return count
