from app.database.session import SessionLocal
from app.modules.menu.models import (
    MenuCategory,
    MenuItem,
)
from app.shared.storage import delete_file_by_url


def clean_all_categories_except_coffee():
    db = SessionLocal()
    try:
        coffee_cat = db.query(MenuCategory).filter(MenuCategory.category_name.ilike("coffee")).first()
        if not coffee_cat:
            coffee_cat = MenuCategory(category_name="Coffee", description="Artisan and brewed coffee", display_order=1, is_active=True)
            db.add(coffee_cat)
            db.flush()

        coffee_cat_id = coffee_cat.category_id

        # Delete any items not in Coffee or draft items from tests
        non_coffee_items = db.query(MenuItem).filter(MenuItem.category_id != coffee_cat_id).all()
        for it in non_coffee_items:
            for img in it.images:
                delete_file_by_url(img.image_url)
            db.delete(it)

        # Also purge any draft items
        draft_items = db.query(MenuItem).filter(MenuItem.is_draft.is_(True)).all()
        for it in draft_items:
            for img in it.images:
                delete_file_by_url(img.image_url)
            db.delete(it)

        db.flush()

        # Delete all categories except Coffee
        deleted_cats = db.query(MenuCategory).filter(MenuCategory.category_id != coffee_cat_id).delete(synchronize_session=False)

        db.commit()
        print(f"Retained category: '{coffee_cat.category_name}' (ID: {coffee_cat_id})")
        print(f"Removed {deleted_cats} non-coffee categories.")
    except Exception as exc:
        db.rollback()
        print(f"Error cleaning categories: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    clean_all_categories_except_coffee()
