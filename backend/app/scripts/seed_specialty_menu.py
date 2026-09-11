"""
Curated Specialty Coffee Menu & Inventory Seeder
Populates professional categories, inventory raw ingredients, handcrafted drinks,
sizing, add-on options, and recipe associations.
"""
from decimal import Decimal

from app.database.session import SessionLocal
from app.modules.inventory.models import InventoryItem
from app.modules.menu.models import (
    MenuCategory,
    MenuItem,
    MenuItemAddon,
    MenuItemIngredient,
    MenuItemSize,
)


def seed_specialty_coffee_catalog():
    print("Beginning Specialty Coffee Catalog seeding...")

    categories_data = [
        {
            "category_name": "Espresso Classics",
            "description": "Purist espresso shots, cortados, flat whites, and balanced milk-to-coffee ratios.",
            "display_order": 1,
        },
        {
            "category_name": "Filter & Pour-Over",
            "description": "Delicate single-origin manual pour-overs and daily batch brews.",
            "display_order": 2,
        },
        {
            "category_name": "Cold Brew & Draft",
            "description": "18-hour slow-steeped chilled elixirs, sparkling tonics, and smooth cold pours.",
            "display_order": 3,
        },
        {
            "category_name": "Signature Creations",
            "description": "House specialty crafted drinks, Spanish lattes, sea salt cold foam, and artisan infusions.",
            "display_order": 4,
        },
        {
            "category_name": "Non-Coffee & Botanical",
            "description": "Ceremonial Japanese matcha, single-estate Davao cacao, and botanical teas.",
            "display_order": 5,
        },
    ]

    inventory_data = [
        {
            "item_name": "Specialty Espresso Blend (Arabica)",
            "unit_of_measure": "kg",
            "quantity_on_hand": Decimal("15.000"),
            "reorder_level": Decimal("5.000"),
            "unit_cost": Decimal("850.00"),
        },
        {
            "item_name": "Single-Origin Filter Beans (Benguet)",
            "unit_of_measure": "kg",
            "quantity_on_hand": Decimal("10.000"),
            "reorder_level": Decimal("3.000"),
            "unit_cost": Decimal("950.00"),
        },
        {
            "item_name": "Fresh Whole Milk",
            "unit_of_measure": "L",
            "quantity_on_hand": Decimal("40.000"),
            "reorder_level": Decimal("10.000"),
            "unit_cost": Decimal("95.00"),
        },
        {
            "item_name": "Barista Oat Milk (Oatly)",
            "unit_of_measure": "L",
            "quantity_on_hand": Decimal("20.000"),
            "reorder_level": Decimal("5.000"),
            "unit_cost": Decimal("180.00"),
        },
        {
            "item_name": "Sweetened Condensed Milk",
            "unit_of_measure": "kg",
            "quantity_on_hand": Decimal("10.000"),
            "reorder_level": Decimal("2.500"),
            "unit_cost": Decimal("120.00"),
        },
        {
            "item_name": "Ceremonial Uji Matcha Powder",
            "unit_of_measure": "kg",
            "quantity_on_hand": Decimal("3.000"),
            "reorder_level": Decimal("1.000"),
            "unit_cost": Decimal("2800.00"),
        },
        {
            "item_name": "Single-Estate Davao Cacao Tablea",
            "unit_of_measure": "kg",
            "quantity_on_hand": Decimal("5.000"),
            "reorder_level": Decimal("1.500"),
            "unit_cost": Decimal("750.00"),
        },
        {
            "item_name": "House Caramel Syrup",
            "unit_of_measure": "L",
            "quantity_on_hand": Decimal("5.000"),
            "reorder_level": Decimal("1.500"),
            "unit_cost": Decimal("320.00"),
        },
        {
            "item_name": "Madagascar Vanilla Syrup",
            "unit_of_measure": "L",
            "quantity_on_hand": Decimal("5.000"),
            "reorder_level": Decimal("1.500"),
            "unit_cost": Decimal("350.00"),
        },
        {
            "item_name": "Sea Salt Cream Cold Foam Base",
            "unit_of_measure": "L",
            "quantity_on_hand": Decimal("6.000"),
            "reorder_level": Decimal("2.000"),
            "unit_cost": Decimal("210.00"),
        },
        {
            "item_name": "Premium Tonic Water",
            "unit_of_measure": "L",
            "quantity_on_hand": Decimal("12.000"),
            "reorder_level": Decimal("3.000"),
            "unit_cost": Decimal("110.00"),
        },
        {
            "item_name": "Wild Raw Forest Honey",
            "unit_of_measure": "kg",
            "quantity_on_hand": Decimal("4.000"),
            "reorder_level": Decimal("1.000"),
            "unit_cost": Decimal("450.00"),
        },
        {
            "item_name": "Ceylon Cinnamon Powder",
            "unit_of_measure": "kg",
            "quantity_on_hand": Decimal("2.000"),
            "reorder_level": Decimal("0.500"),
            "unit_cost": Decimal("550.00"),
        },
    ]

    drinks_data = [
        # --- Category 1: Espresso Classics ---
        {
            "category_name": "Espresso Classics",
            "item_name": "Espresso (Doppio)",
            "description": "A concentrated, full-bodied double shot with rich crema, offering balanced sweetness, delicate acidity, and a lingering bittersweet finish.",
            "base_price": Decimal("95.00"),
            "image_url": "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Single (1 oz)", "price_adjustment": Decimal("-15.00"), "is_default": False},
                {"size_name": "Double (2 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
            ],
            "addons": [
                {"addon_name": "Extra Espresso Shot", "additional_price": Decimal("35.00")},
            ],
            "ingredients": [
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.018"), "unit": "kg"},
            ],
        },
        {
            "category_name": "Espresso Classics",
            "item_name": "Americano / Long Black",
            "description": "Clean, crisp, and bold. Hot filtered water highlights the nuanced aromatics of our espresso blend without diluting body.",
            "base_price": Decimal("110.00"),
            "image_url": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Hot (8 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
                {"size_name": "Iced (16 oz)", "price_adjustment": Decimal("15.00"), "is_default": False},
            ],
            "addons": [
                {"addon_name": "Extra Espresso Shot", "additional_price": Decimal("35.00")},
                {"addon_name": "Madagascar Vanilla Pump", "additional_price": Decimal("25.00")},
            ],
            "ingredients": [
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.018"), "unit": "kg"},
            ],
        },
        {
            "category_name": "Espresso Classics",
            "item_name": "Artisan Cortado",
            "description": "Equal parts espresso and velvety steamed milk. The Spanish classic that cuts the espresso's intensity while letting the bean profile shine through.",
            "base_price": Decimal("130.00"),
            "image_url": "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Standard (4 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
            ],
            "addons": [
                {"addon_name": "Oat Milk Substitute", "additional_price": Decimal("30.00")},
                {"addon_name": "Extra Espresso Shot", "additional_price": Decimal("35.00")},
            ],
            "ingredients": [
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.018"), "unit": "kg"},
                {"item_name": "Fresh Whole Milk", "quantity": Decimal("0.060"), "unit": "L"},
            ],
        },
        {
            "category_name": "Espresso Classics",
            "item_name": "Velvet Flat White",
            "description": "Crafted with a double ristretto shot and velvety micro-textured milk for an espresso-forward, creamy cup.",
            "base_price": Decimal("140.00"),
            "image_url": "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Standard (6 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
            ],
            "addons": [
                {"addon_name": "Oat Milk Substitute", "additional_price": Decimal("30.00")},
                {"addon_name": "Extra Espresso Shot", "additional_price": Decimal("35.00")},
            ],
            "ingredients": [
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.018"), "unit": "kg"},
                {"item_name": "Fresh Whole Milk", "quantity": Decimal("0.150"), "unit": "L"},
            ],
        },
        {
            "category_name": "Espresso Classics",
            "item_name": "Classic Café Latte",
            "description": "Smooth, mellow, and comfortingly sweet. The natural sugars of fresh steamed milk balance our rich espresso roast.",
            "base_price": Decimal("135.00"),
            "image_url": "https://images.unsplash.com/photo-1561047029-3000c68339ca?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Hot (8 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
                {"size_name": "Iced (16 oz)", "price_adjustment": Decimal("20.00"), "is_default": False},
            ],
            "addons": [
                {"addon_name": "Oat Milk Substitute", "additional_price": Decimal("30.00")},
                {"addon_name": "Madagascar Vanilla Syrup", "additional_price": Decimal("25.00")},
                {"addon_name": "House Caramel Syrup", "additional_price": Decimal("25.00")},
                {"addon_name": "Extra Espresso Shot", "additional_price": Decimal("35.00")},
            ],
            "ingredients": [
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.018"), "unit": "kg"},
                {"item_name": "Fresh Whole Milk", "quantity": Decimal("0.220"), "unit": "L"},
            ],
        },

        # --- Category 2: Filter & Pour-Over ---
        {
            "category_name": "Filter & Pour-Over",
            "item_name": "Single-Origin V60 Pour-Over",
            "description": "Manual gravity extraction that preserves the delicate floral aromatics and bright fruity acidity characteristic of single-origin terroir.",
            "base_price": Decimal("160.00"),
            "image_url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Hot Carafe (10 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
                {"size_name": "Iced Carafe (10 oz)", "price_adjustment": Decimal("15.00"), "is_default": False},
            ],
            "addons": [],
            "ingredients": [
                {"item_name": "Single-Origin Filter Beans (Benguet)", "quantity": Decimal("0.015"), "unit": "kg"},
            ],
        },
        {
            "category_name": "Filter & Pour-Over",
            "item_name": "Daily Batch Brew",
            "description": "Quick, clean, and consistent daily filter coffee celebrating seasonal harvest profiles.",
            "base_price": Decimal("110.00"),
            "image_url": "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Regular (8 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
                {"size_name": "Large (12 oz)", "price_adjustment": Decimal("20.00"), "is_default": False},
            ],
            "addons": [],
            "ingredients": [
                {"item_name": "Single-Origin Filter Beans (Benguet)", "quantity": Decimal("0.015"), "unit": "kg"},
            ],
        },

        # --- Category 3: Cold Brew & Draft ---
        {
            "category_name": "Cold Brew & Draft",
            "item_name": "18-Hour Slow Cold Brew",
            "description": "Slow extraction eliminates harsh bitterness, leaving an extraordinarily smooth, naturally sweet iced elixir.",
            "base_price": Decimal("145.00"),
            "image_url": "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Regular (12 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
                {"size_name": "Large (16 oz)", "price_adjustment": Decimal("20.00"), "is_default": False},
            ],
            "addons": [
                {"addon_name": "Sweet Cream Cold Foam", "additional_price": Decimal("35.00")},
                {"addon_name": "Madagascar Vanilla Syrup", "additional_price": Decimal("25.00")},
            ],
            "ingredients": [
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.025"), "unit": "kg"},
            ],
        },
        {
            "category_name": "Cold Brew & Draft",
            "item_name": "Cold Brew Tonic & Citrus",
            "description": "An effervescent, sparkling coffee mocktail pairing crisp botanical tonic water with deep cold brew concentrate.",
            "base_price": Decimal("165.00"),
            "image_url": "https://images.unsplash.com/photo-1592663527359-cf6642f54cff?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Standard (12 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
            ],
            "addons": [],
            "ingredients": [
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.020"), "unit": "kg"},
                {"item_name": "Premium Tonic Water", "quantity": Decimal("0.180"), "unit": "L"},
            ],
        },

        # --- Category 4: Signature Creations ---
        {
            "category_name": "Signature Creations",
            "item_name": "Artisan Spanish Latte",
            "description": "The crowd favorite. Sweetened condensed milk gently warmed with bold espresso and layered over chilled milk and ice.",
            "base_price": Decimal("150.00"),
            "image_url": "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Hot (12 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
                {"size_name": "Iced (16 oz)", "price_adjustment": Decimal("15.00"), "is_default": False},
            ],
            "addons": [
                {"addon_name": "Oat Milk Substitute", "additional_price": Decimal("30.00")},
                {"addon_name": "Extra Espresso Shot", "additional_price": Decimal("35.00")},
            ],
            "ingredients": [
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.018"), "unit": "kg"},
                {"item_name": "Fresh Whole Milk", "quantity": Decimal("0.180"), "unit": "L"},
                {"item_name": "Sweetened Condensed Milk", "quantity": Decimal("0.030"), "unit": "kg"},
            ],
        },
        {
            "category_name": "Signature Creations",
            "item_name": "Sea Salt Caramel Cream Latte",
            "description": "Decadent caramel latte crowned with house-whipped sea salt cold foam that creates a delightful contrast of sweet, salty, and bold coffee.",
            "base_price": Decimal("165.00"),
            "image_url": "https://images.unsplash.com/photo-1582293041079-7814c2f12063?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Iced (16 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
            ],
            "addons": [
                {"addon_name": "Extra Espresso Shot", "additional_price": Decimal("35.00")},
                {"addon_name": "Oat Milk Substitute", "additional_price": Decimal("30.00")},
            ],
            "ingredients": [
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.018"), "unit": "kg"},
                {"item_name": "Fresh Whole Milk", "quantity": Decimal("0.180"), "unit": "L"},
                {"item_name": "House Caramel Syrup", "quantity": Decimal("0.025"), "unit": "L"},
                {"item_name": "Sea Salt Cream Cold Foam Base", "quantity": Decimal("0.050"), "unit": "L"},
            ],
        },
        {
            "category_name": "Signature Creations",
            "item_name": "Dirty Uji Matcha Latte",
            "description": "A stunning visual two-tone drink combining grassy Kyoto matcha, smooth milk, and a freshly pulled shot of dark espresso.",
            "base_price": Decimal("175.00"),
            "image_url": "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Iced (16 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
            ],
            "addons": [
                {"addon_name": "Oat Milk Substitute", "additional_price": Decimal("30.00")},
                {"addon_name": "Extra Espresso Shot", "additional_price": Decimal("35.00")},
            ],
            "ingredients": [
                {"item_name": "Ceremonial Uji Matcha Powder", "quantity": Decimal("0.005"), "unit": "kg"},
                {"item_name": "Fresh Whole Milk", "quantity": Decimal("0.180"), "unit": "L"},
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.018"), "unit": "kg"},
            ],
        },
        {
            "category_name": "Signature Creations",
            "item_name": "Cinnamon Honey Oat Latte",
            "description": "Naturally dairy-free comfort. Creamy steamed oat milk harmonizes with local raw honey and warming Ceylon cinnamon.",
            "base_price": Decimal("165.00"),
            "image_url": "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Hot (12 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
                {"size_name": "Iced (16 oz)", "price_adjustment": Decimal("15.00"), "is_default": False},
            ],
            "addons": [
                {"addon_name": "Extra Espresso Shot", "additional_price": Decimal("35.00")},
            ],
            "ingredients": [
                {"item_name": "Specialty Espresso Blend (Arabica)", "quantity": Decimal("0.018"), "unit": "kg"},
                {"item_name": "Barista Oat Milk (Oatly)", "quantity": Decimal("0.200"), "unit": "L"},
                {"item_name": "Wild Raw Forest Honey", "quantity": Decimal("0.020"), "unit": "kg"},
                {"item_name": "Ceylon Cinnamon Powder", "quantity": Decimal("0.002"), "unit": "kg"},
            ],
        },

        # --- Category 5: Non-Coffee & Botanical ---
        {
            "category_name": "Non-Coffee & Botanical",
            "item_name": "Ceremonial Uji Matcha Latte",
            "description": "Pure, unadulterated Japanese ceremonial green tea stone-ground in Kyoto and paired with silky microfoam.",
            "base_price": Decimal("155.00"),
            "image_url": "https://images.unsplash.com/photo-1515823662273-ad9525e58846?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Hot (10 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
                {"size_name": "Iced (16 oz)", "price_adjustment": Decimal("15.00"), "is_default": False},
            ],
            "addons": [
                {"addon_name": "Oat Milk Substitute", "additional_price": Decimal("30.00")},
                {"addon_name": "Madagascar Vanilla Syrup", "additional_price": Decimal("25.00")},
            ],
            "ingredients": [
                {"item_name": "Ceremonial Uji Matcha Powder", "quantity": Decimal("0.005"), "unit": "kg"},
                {"item_name": "Fresh Whole Milk", "quantity": Decimal("0.220"), "unit": "L"},
            ],
        },
        {
            "category_name": "Non-Coffee & Botanical",
            "item_name": "Davao Tablea Hot Chocolate",
            "description": "Rich, indulgent chocolate drink celebrating Philippine cacao heritage with a velvety, comforting body.",
            "base_price": Decimal("135.00"),
            "image_url": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=800&q=80",
            "sizes": [
                {"size_name": "Hot (8 oz)", "price_adjustment": Decimal("0.00"), "is_default": True},
                {"size_name": "Large (12 oz)", "price_adjustment": Decimal("25.00"), "is_default": False},
            ],
            "addons": [
                {"addon_name": "Oat Milk Substitute", "additional_price": Decimal("30.00")},
            ],
            "ingredients": [
                {"item_name": "Single-Estate Davao Cacao Tablea", "quantity": Decimal("0.030"), "unit": "kg"},
                {"item_name": "Fresh Whole Milk", "quantity": Decimal("0.200"), "unit": "L"},
            ],
        },
    ]

    with SessionLocal() as db:
        # 1. Categories
        cat_map = {}
        for c in categories_data:
            existing = db.query(MenuCategory).filter_by(category_name=c["category_name"]).first()
            if not existing:
                cat_obj = MenuCategory(
                    category_name=c["category_name"],
                    description=c["description"],
                    display_order=c["display_order"],
                    is_active=True,
                )
                db.add(cat_obj)
                db.flush()
                cat_map[c["category_name"]] = cat_obj.category_id
                print(f"Created Category: {c['category_name']} (ID {cat_obj.category_id})")
            else:
                cat_map[c["category_name"]] = existing.category_id
                print(f"Category exists: {c['category_name']} (ID {existing.category_id})")

        # 2. Inventory Ingredients
        inv_map = {}
        for inv in inventory_data:
            existing = db.query(InventoryItem).filter_by(item_name=inv["item_name"]).first()
            if not existing:
                inv_obj = InventoryItem(
                    item_name=inv["item_name"],
                    unit_of_measure=inv["unit_of_measure"],
                    quantity_on_hand=inv["quantity_on_hand"],
                    reorder_level=inv["reorder_level"],
                    unit_cost=inv["unit_cost"],
                    is_active=True,
                )
                db.add(inv_obj)
                db.flush()
                inv_map[inv["item_name"]] = inv_obj.inventory_item_id
                print(f"Created Inventory Item: {inv['item_name']} (ID {inv_obj.inventory_item_id})")
            else:
                inv_map[inv["item_name"]] = existing.inventory_item_id
                print(f"Inventory Item exists: {inv['item_name']} (ID {existing.inventory_item_id})")

        # 3. Menu Items, Sizes, Addons, and Recipes
        for d in drinks_data:
            cat_id = cat_map[d["category_name"]]
            item_obj = db.query(MenuItem).filter_by(item_name=d["item_name"]).first()
            if not item_obj:
                item_obj = MenuItem(
                    category_id=cat_id,
                    item_name=d["item_name"],
                    description=d["description"],
                    base_price=d["base_price"],
                    image_url=d["image_url"],
                    is_available=True,
                    is_draft=False,
                    is_deleted=False,
                )
                db.add(item_obj)
                db.flush()
                print(f"\nCreated Menu Item: {d['item_name']} (ID {item_obj.menu_item_id})")
            else:
                print(f"\nMenu Item exists: {d['item_name']} (ID {item_obj.menu_item_id})")

            # Sizes
            for sz in d["sizes"]:
                existing_sz = db.query(MenuItemSize).filter_by(menu_item_id=item_obj.menu_item_id, size_name=sz["size_name"]).first()
                if not existing_sz:
                    size_obj = MenuItemSize(
                        menu_item_id=item_obj.menu_item_id,
                        size_name=sz["size_name"],
                        price_adjustment=sz["price_adjustment"],
                        is_default=sz["is_default"],
                    )
                    db.add(size_obj)

            # Addons
            for ad in d["addons"]:
                existing_ad = db.query(MenuItemAddon).filter_by(menu_item_id=item_obj.menu_item_id, addon_name=ad["addon_name"]).first()
                if not existing_ad:
                    addon_obj = MenuItemAddon(
                        menu_item_id=item_obj.menu_item_id,
                        addon_name=ad["addon_name"],
                        additional_price=ad["additional_price"],
                        is_active=True,
                    )
                    db.add(addon_obj)

            # Recipe Ingredients
            for ing in d["ingredients"]:
                inv_id = inv_map.get(ing["item_name"])
                if inv_id:
                    existing_ing = db.query(MenuItemIngredient).filter_by(menu_item_id=item_obj.menu_item_id, inventory_item_id=inv_id).first()
                    if not existing_ing:
                        recipe_obj = MenuItemIngredient(
                            menu_item_id=item_obj.menu_item_id,
                            inventory_item_id=inv_id,
                            quantity_required=ing["quantity"],
                            unit_of_measure=ing["unit"],
                        )
                        db.add(recipe_obj)

        db.commit()
        print("\nSpecialty Coffee Catalog seeding successfully completed!")


if __name__ == "__main__":
    seed_specialty_coffee_catalog()
