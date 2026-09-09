import pytest
from sqlalchemy import text
from app.database.session import SessionLocal

PROTECTED_USERNAMES = ("'dren'", "'bron'", "'stephen'", "'michael'", "'draemon'")

def wipe_test_data():
    db = SessionLocal()
    try:
        # Delete orders, items, addons, payments, customers
        db.execute(text("DELETE FROM order_item_addons;"))
        db.execute(text("DELETE FROM order_items;"))
        db.execute(text("DELETE FROM payments;"))
        db.execute(text("DELETE FROM loyalty_transactions;"))
        db.execute(text("DELETE FROM orders;"))
        db.execute(text("DELETE FROM customers;"))

        # Delete purchasing
        db.execute(text("DELETE FROM purchase_request_items;"))
        db.execute(text("DELETE FROM purchase_requests;"))

        # Delete menu & categories
        db.execute(text("DELETE FROM menu_item_ingredients;"))
        db.execute(text("DELETE FROM menu_item_images;"))
        db.execute(text("DELETE FROM menu_item_addons;"))
        db.execute(text("DELETE FROM menu_item_sizes;"))
        db.execute(text("DELETE FROM menu_items;"))
        db.execute(text("DELETE FROM menu_categories;"))

        # Delete inventory
        db.execute(text("DELETE FROM inventory_transactions;"))
        db.execute(text("DELETE FROM inventory_items;"))

        # Delete all test-generated users and sessions
        db.execute(text("DELETE FROM auth_sessions;"))
        filter_str = f"({', '.join(PROTECTED_USERNAMES)})"
        db.execute(text(f"DELETE FROM user_roles WHERE user_id NOT IN (SELECT user_id FROM users WHERE LOWER(username) IN {filter_str});"))
        db.execute(text(f"DELETE FROM users WHERE LOWER(username) NOT IN {filter_str};"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning: automatic test cleanup encountered: {e}")
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def clean_database_after_test_session():
    """
    Session-scoped autouse fixture that guarantees all test-created users,
    orders, menu items, stocks, and categories are automatically wiped
    at the end of any pytest execution, preserving only the 5 system accounts.
    """
    yield
    wipe_test_data()
