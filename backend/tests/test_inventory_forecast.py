from decimal import Decimal

from app.database.session import SessionLocal
from app.modules.inventory.models import InventoryItem, InventoryTransaction, InventoryTransactionType
from app.modules.inventory.service import get_inventory_forecast


def test_inventory_forecast_uses_usage_and_never_suggests_negative_purchase():
    database = SessionLocal()
    try:
        item = InventoryItem(item_name="Forecast Milk", unit_of_measure="liters", quantity_on_hand=Decimal("2.000"), reorder_level=Decimal("5.000"), unit_cost=Decimal("1.00"), is_active=True)
        database.add(item)
        database.flush()
        database.add(InventoryTransaction(inventory_item_id=item.inventory_item_id, transaction_type=InventoryTransactionType.USAGE_OUT, quantity_change=Decimal("-28.000"), created_by=1))
        database.commit()
        forecast = get_inventory_forecast(database, 7)
        result = next(row for row in forecast.items if row.inventory_item_id == item.inventory_item_id)
        assert result.average_daily_usage == Decimal("1.000")
        assert result.suggested_purchase_quantity == Decimal("5.000")
    finally:
        database.close()
