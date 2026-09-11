import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.database.session import SessionLocal
from app.modules.menu.models import MenuItem, MenuItemImage
from app.shared.storage import delete_file_by_url

logger = logging.getLogger(__name__)


def purge_orphaned_drafts() -> int:
    """
    Deletes draft menu items and associated files that have been inactive for >24 hours.
    """
    db = SessionLocal()
    purged_count = 0
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        drafts = list(
            db.scalars(
                select(MenuItem)
                .where(
                    MenuItem.is_draft.is_(True),
                    MenuItem.created_at < cutoff,
                )
            ).all()
        )

        for item in drafts:
            # Delete physical files
            images = list(
                db.scalars(
                    select(MenuItemImage).where(MenuItemImage.menu_item_id == item.menu_item_id)
                ).all()
            )
            for img in images:
                delete_file_by_url(img.image_url)

            db.delete(item)
            purged_count += 1

        if purged_count > 0:
            db.commit()
            logger.info(f"Purged {purged_count} orphaned draft menu items and associated image files.")
    except Exception as exc:
        logger.error(f"Error purging orphaned drafts: {exc}", exc_info=True)
        db.rollback()
    finally:
        db.close()

    return purged_count


async def run_draft_cleanup_loop(interval_hours: int = 6):
    """
    Runs periodic draft cleanup worker in the background.
    """
    while True:
        try:
            purge_orphaned_drafts()
        except Exception as err:
            logger.error(f"Draft cleanup worker encountered error: {err}")

        await asyncio.sleep(interval_hours * 3600)
