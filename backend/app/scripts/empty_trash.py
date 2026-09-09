from app.database.session import SessionLocal
from app.modules.menu.models import MenuItem
from app.shared.storage import delete_file_by_url
from sqlalchemy.orm import selectinload


def purge_trash():
    db = SessionLocal()
    try:
        trashed_items = (
            db.query(MenuItem)
            .options(selectinload(MenuItem.images))
            .filter(MenuItem.is_deleted.is_(True))
            .all()
        )

        count = len(trashed_items)
        print(f"Found {count} items in the trash bin to permanently delete.")

        for item in trashed_items:
            # Delete physical files from uploads/
            for img in item.images:
                delete_file_by_url(img.image_url)

            db.delete(item)

        db.commit()
        print(f"Successfully emptied trash bin: {count} products permanently removed.")
    except Exception as exc:
        db.rollback()
        print(f"Error purging trash: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    purge_trash()
