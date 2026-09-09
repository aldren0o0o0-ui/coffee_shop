from app.modules.orders.models import Order, OrderItem, OrderItemAddon
from app.modules.payments.models import Payment


def purge_all_orders():
    db = SessionLocal()
    try:
        addons_count = db.query(OrderItemAddon).delete(synchronize_session=False)
        items_count = db.query(OrderItem).delete(synchronize_session=False)
        payments_count = db.query(Payment).delete(synchronize_session=False)
        orders_count = db.query(Order).delete(synchronize_session=False)

        db.commit()
        print(f"Purged: {orders_count} orders, {items_count} order items, {addons_count} addons, {payments_count} payments.")
        print("Database order history is now completely clean and ready for fresh orders.")
    except Exception as exc:
        db.rollback()
        print(f"Error purging orders: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    purge_all_orders()
