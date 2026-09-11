from fastapi import APIRouter, File, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.menu.models import (
    MenuCategory,
    MenuItem,
    MenuItemIngredient,
)
from app.modules.menu.schemas import (
    InventoryOption,
    MenuCategoryCatalog,
    MenuCategoryCreateRequest,
    MenuItemAvailabilityUpdateRequest,
    MenuItemCatalog,
    MenuItemCreateRequest,
    MenuItemDraftCreateRequest,
    MenuItemImageCatalog,
    MenuItemImageReorderRequest,
    MenuItemPublishRequest,
    MenuItemTrashRequest,
    MenuItemUpdateRequest,
)
from app.modules.menu.service import (
    _serialize_menu_item,
    create_menu_category,
    create_menu_item,
    create_menu_item_draft,
    delete_menu_item_image,
    delete_menu_item_permanently,
    empty_trash_catalog,
    get_inventory_options,
    get_trash_catalog,
    move_menu_item_to_trash,
    publish_menu_item,
    reorder_menu_item_images,
    set_primary_menu_item_image,
    toggle_menu_item_availability,
    update_menu_item,
    upload_menu_item_image,
)
from app.shared.dependencies import DatabaseDependency

router = APIRouter(
    prefix="/menu",
    tags=["Menu Management & Catalog"],
)


@router.get("/catalog", response_model=list[MenuCategoryCatalog])
def get_menu_catalog(
    database: DatabaseDependency,
) -> list[MenuCategoryCatalog]:
    """
    Public menu catalog. Excludes unpublished draft products and trashed products.
    """
    stmt = (
        select(MenuCategory)
        .options(
            selectinload(MenuCategory.menu_items).selectinload(MenuItem.images),
            selectinload(MenuCategory.menu_items).selectinload(MenuItem.sizes),
            selectinload(MenuCategory.menu_items).selectinload(MenuItem.addons),
            selectinload(MenuCategory.menu_items)
            .selectinload(MenuItem.ingredients)
            .selectinload(MenuItemIngredient.inventory_item),
        )
        .where(MenuCategory.is_active.is_(True))
        .order_by(MenuCategory.display_order.asc())
    )
    categories = list(database.scalars(stmt).all())

    catalog = []
    for cat in categories:
        items = [
            _serialize_menu_item(item)
            for item in cat.menu_items
            if not item.is_draft and not item.is_deleted
        ]
        catalog.append(
            MenuCategoryCatalog(
                category_id=cat.category_id,
                category_name=cat.category_name,
                description=cat.description,
                display_order=cat.display_order,
                items=items,
            )
        )

    return catalog


@router.get(
    "/trash",
    response_model=list[MenuItemCatalog],
)
def fetch_trash_items(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> list[MenuItemCatalog]:
    """
    Retrieves all soft-deleted / trashed menu items (Owner & Manager only).
    """
    return get_trash_catalog(database, authentication.user)


@router.delete(
    "/trash/empty",
    status_code=status.HTTP_200_OK,
)
def empty_trash(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
):
    """
    Permanently purges all items currently in the trash bin (Owner & Manager only).
    """
    count = empty_trash_catalog(database, authentication.user)
    return {"message": f"Successfully emptied trash bin: {count} products permanently removed."}


@router.post(
    "/items",
    response_model=MenuItemCatalog,
    status_code=status.HTTP_201_CREATED,
)
def add_new_product(
    payload: MenuItemCreateRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MenuItemCatalog:
    return create_menu_item(database, payload, authentication.user)


@router.post(
    "/items/draft",
    response_model=MenuItemCatalog,
    status_code=status.HTTP_201_CREATED,
)
def create_product_draft(
    payload: MenuItemDraftCreateRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MenuItemCatalog:
    """
    Initializes a draft product for the multi-step wizard.
    """
    return create_menu_item_draft(database, payload, authentication.user)


@router.post(
    "/items/{item_id}/images",
    response_model=MenuItemImageCatalog,
    status_code=status.HTTP_201_CREATED,
)
async def upload_product_image(
    item_id: int,
    file: UploadFile = File(...),
    authentication: CurrentAuthenticationDependency = None,
    database: DatabaseDependency = None,
) -> MenuItemImageCatalog:
    """
    Uploads a single photo to a product. Enforces max 5 photos and magic bytes check.
    """
    file_bytes = await file.read()
    return upload_menu_item_image(
        database=database,
        item_id=item_id,
        file_bytes=file_bytes,
        filename=file.filename,
        user=authentication.user,
    )


@router.delete(
    "/items/{item_id}/images/{image_id}",
    response_model=MenuItemCatalog,
)
def delete_product_image(
    item_id: int,
    image_id: int,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MenuItemCatalog:
    """
    Deletes an image. If deleted image was primary, auto-promotes the next image to primary.
    """
    return delete_menu_item_image(database, item_id, image_id, authentication.user)


@router.patch(
    "/items/{item_id}/images/{image_id}/primary",
    response_model=MenuItemCatalog,
)
def set_primary_image(
    item_id: int,
    image_id: int,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MenuItemCatalog:
    """
    Sets a specific photo as the primary hero image.
    """
    return set_primary_menu_item_image(database, item_id, image_id, authentication.user)


@router.patch(
    "/items/{item_id}/images/reorder",
    response_model=MenuItemCatalog,
)
def reorder_images(
    item_id: int,
    payload: MenuItemImageReorderRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MenuItemCatalog:
    """
    Updates thumbnail ordering.
    """
    return reorder_menu_item_images(database, item_id, payload.image_ids, authentication.user)


@router.put(
    "/items/{item_id}/publish",
    response_model=MenuItemCatalog,
)
def publish_product(
    item_id: int,
    payload: MenuItemPublishRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MenuItemCatalog:
    """
    Finalizes wizard and publishes the product to the customer menu.
    """
    return publish_menu_item(database, item_id, payload, authentication.user)


@router.put(
    "/items/{item_id}",
    response_model=MenuItemCatalog,
)
def update_product_details(
    item_id: int,
    payload: MenuItemUpdateRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MenuItemCatalog:
    """
    Updates an existing product's info, pricing, sizes, addons, and recipes (Owner/Manager only).
    """
    return update_menu_item(database, item_id, payload, authentication.user)


@router.patch(
    "/items/{item_id}/trash",
    response_model=MenuItemCatalog,
)
def toggle_product_trash(
    item_id: int,
    payload: MenuItemTrashRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MenuItemCatalog:
    """
    Moves an item to trash (is_deleted=True) or restores it (is_deleted=False) (Owner/Manager only).
    """
    return move_menu_item_to_trash(database, item_id, payload.is_deleted, authentication.user)


@router.delete(
    "/items/{item_id}/permanent",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_product_permanently_route(
    item_id: int,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
):
    """
    Permanently deletes a menu item, associated images, and physical files (Owner/Manager only).
    """
    delete_menu_item_permanently(database, item_id, authentication.user)


@router.post(
    "/categories",
    response_model=MenuCategoryCatalog,
    status_code=status.HTTP_201_CREATED,
)
def add_new_category(
    payload: MenuCategoryCreateRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MenuCategoryCatalog:
    return create_menu_category(database, payload, authentication.user)


@router.patch(
    "/items/{item_id}/availability",
    response_model=MenuItemCatalog,
)
def update_product_availability(
    item_id: int,
    payload: MenuItemAvailabilityUpdateRequest,
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> MenuItemCatalog:
    return toggle_menu_item_availability(database, item_id, payload.is_available, authentication.user)


@router.get(
    "/inventory-options",
    response_model=list[InventoryOption],
)
def fetch_inventory_options(
    authentication: CurrentAuthenticationDependency,
    database: DatabaseDependency,
) -> list[InventoryOption]:
    return get_inventory_options(database)
