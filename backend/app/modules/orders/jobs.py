import asyncio
import logging
from app.database.session import SessionLocal
from app.modules.orders.service import expire_stale_orders

logger = logging.getLogger(__name__)


async def run_order_expiry_sweep_loop(interval_seconds: int = 60):
    """
    Background worker loop that runs every 60s and transitions unpaid orders
    past expires_at to EXPIRED status.
    """
    logger.info(f"Starting background order expiry sweep loop (interval: {interval_seconds}s)...")
    while True:
        try:
            db = SessionLocal()
            try:
                expire_stale_orders(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error during order expiry sweep job: {e}", exc_info=True)

        await asyncio.sleep(interval_seconds)
