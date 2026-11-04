import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes.health import router as health_router
from app.core.config import settings
from app.modules.analytics.routes import router as dashboard_router
from app.modules.auth.routes import router as auth_router
from app.modules.branches.routes import router as branches_router
from app.modules.costing.routes import router as costing_router
from app.modules.customers.routes import router as customers_router
from app.modules.engagement.routes import router as engagement_router
from app.modules.fulfilment.routes import (
    customer_fulfilment_router,
)
from app.modules.fulfilment.routes import (
    router as fulfilment_router,
)
from app.modules.inventory.routes import router as inventory_router
from app.modules.menu.jobs import run_draft_cleanup_loop
from app.modules.menu.routes import router as menu_router
from app.modules.notifications.routes import router as notifications_router
from app.modules.orders.jobs import run_order_expiry_sweep_loop
from app.modules.orders.routes import (
    customer_router,
)
from app.modules.orders.routes import (
    router as orders_router,
)
from app.modules.payments.routes import router as payments_router
from app.modules.procurement.routes import router as procurement_router
from app.modules.shifts.routes import router as shifts_router
from app.modules.users.routes import router as team_router

# Ensure upload directory exists
Path("uploads/menu").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background order expiry sweep task and draft cleaner
    sweep_task = asyncio.create_task(run_order_expiry_sweep_loop(interval_seconds=60))
    draft_cleanup_task = asyncio.create_task(run_draft_cleanup_loop(interval_hours=6))
    try:
        yield
    finally:
        sweep_task.cancel()
        draft_cleanup_task.cancel()


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="API for ldrn's Coffee Shop Management System with live dashboards & guest online orders",
    lifespan=lifespan,
)

# Only menu images are public. Receipts can contain customer data and are served
# through the dedicated, authenticated route in the payments module.
app.mount("/uploads/menu", StaticFiles(directory="uploads/menu"), name="menu-uploads")

from app.modules.payments.receipt import RECEIPTS_DIR as PAYMENTS_RECEIPTS_DIR

RECEIPTS_DIR = Path(PAYMENTS_RECEIPTS_DIR).resolve()


@app.get("/uploads/receipts/{filename}", include_in_schema=False)
def download_receipt(filename: str, download: bool = False) -> FileResponse:
    """Serve only unguessable receipt files; reject traversal and other files."""
    if Path(filename).name != filename or not filename.endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found.")
    receipt_path = (RECEIPTS_DIR / filename).resolve()
    if RECEIPTS_DIR not in receipt_path.parents or not receipt_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found.")
    disposition = "attachment" if download else "inline"
    return FileResponse(
        receipt_path,
        media_type="application/pdf",
        content_disposition_type=disposition,
        filename=filename,
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(team_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(customer_router, prefix="/api/v1")
app.include_router(orders_router, prefix="/api/v1")
app.include_router(menu_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(procurement_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")
app.include_router(costing_router, prefix="/api/v1")
app.include_router(shifts_router, prefix="/api/v1")
app.include_router(engagement_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
app.include_router(fulfilment_router, prefix="/api/v1")
app.include_router(customer_fulfilment_router, prefix="/api/v1")
app.include_router(branches_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "Welcome to ldrn's Coffee Shop Management System API!"
    }
