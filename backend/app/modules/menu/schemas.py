from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class MenuItemSizeCatalog(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    menu_item_size_id: int
    size_name: str
    price_adjustment: Decimal
    is_default: bool


class MenuItemAddonCatalog(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    menu_item_addon_id: int
    addon_name: str
    additional_price: Decimal
    is_active: bool


class MenuItemImageCatalog(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    menu_item_image_id: int
    image_url: str
    is_primary: bool
    display_order: int
    file_size_bytes: int | None = None


class MenuItemCatalog(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    menu_item_id: int
    category_id: int
    category_name: str
    item_name: str
    description: str | None
    base_price: Decimal
    image_url: str | None
    is_available: bool
    is_draft: bool = False
    is_deleted: bool = False
    images: list[MenuItemImageCatalog] = Field(default_factory=list)
    sizes: list[MenuItemSizeCatalog] = Field(default_factory=list)
    addons: list[MenuItemAddonCatalog] = Field(default_factory=list)
    ingredients: list[str] = Field(default_factory=list)


class MenuCategoryCatalog(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    category_name: str
    description: str | None
    display_order: int
    items: list[MenuItemCatalog] = Field(default_factory=list)


# --- Creation & Management Schemas ---

class MenuCategoryCreateRequest(BaseModel):
    category_name: str
    description: str | None = None
    display_order: int = 0


class MenuItemSizeCreateRequest(BaseModel):
    size_name: str
    price_adjustment: Decimal = Decimal("0.00")
    is_default: bool = False


class MenuItemAddonCreateRequest(BaseModel):
    addon_name: str
    additional_price: Decimal = Decimal("0.00")
    is_active: bool = True


class MenuItemIngredientCreateRequest(BaseModel):
    inventory_item_id: int
    quantity_required: Decimal
    unit_of_measure: str


class MenuItemCreateRequest(BaseModel):
    category_id: int
    item_name: str
    description: str | None = None
    base_price: Decimal
    image_url: str | None = None
    is_available: bool = True
    sizes: list[MenuItemSizeCreateRequest] = Field(default_factory=list)
    addons: list[MenuItemAddonCreateRequest] = Field(default_factory=list)
    ingredients: list[MenuItemIngredientCreateRequest] = Field(default_factory=list)


class MenuItemDraftCreateRequest(BaseModel):
    category_id: int
    item_name: str = ""
    description: str | None = None
    base_price: Decimal = Decimal("0.00")


class MenuItemPublishRequest(BaseModel):
    category_id: int
    item_name: str
    description: str | None = None
    base_price: Decimal
    is_available: bool = True
    sizes: list[MenuItemSizeCreateRequest] = Field(default_factory=list)
    addons: list[MenuItemAddonCreateRequest] = Field(default_factory=list)
    ingredients: list[MenuItemIngredientCreateRequest] = Field(default_factory=list)


class MenuItemUpdateRequest(BaseModel):
    category_id: int
    item_name: str
    description: str | None = None
    base_price: Decimal
    is_available: bool = True
    sizes: list[MenuItemSizeCreateRequest] = Field(default_factory=list)
    addons: list[MenuItemAddonCreateRequest] = Field(default_factory=list)
    ingredients: list[MenuItemIngredientCreateRequest] = Field(default_factory=list)


class MenuItemTrashRequest(BaseModel):
    is_deleted: bool = True


class MenuItemImageReorderRequest(BaseModel):
    image_ids: list[int] = Field(min_length=1)


class MenuItemAvailabilityUpdateRequest(BaseModel):
    is_available: bool


