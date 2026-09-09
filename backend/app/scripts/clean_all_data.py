import sys
from sqlalchemy import text
from app.database.session import SessionLocal

# Import all models to ensure mapper initialization
import app.main
from app.modules.users.models import User, Role, UserRole
from app.modules.auth.models import AuthSession
from app.modules.orders.models import Order, OrderItem, OrderItemAddon
from app.modules.payments.models import Payment
from app.modules.customers.models import Customer, LoyaltyTransaction
from app.modules.inventory.models import InventoryItem, InventoryTransaction
from app.modules.procurement.models import PurchaseRequest, PurchaseRequestItem
from app.modules.menu.models import (
    MenuCategory,
    MenuItem,
    MenuItemSize,
    MenuItemAddon,
    MenuItemIngredient,
    MenuItemImage,
)

PROTECTED_USERNAMES = {"dren", "bron", "stephen", "michael", "draemon"}
PROTECTED_EMAILS = {
    "ldrndc@gmail.com",
    "dicxo01@gmail.com",
    "aldren.dico.it@gmail.com",
    "ldrn20001@gmail.com",
    "loquias022@gmai.com",
    "loquias022@gmail.com",
}

def clean_system():
    db = SessionLocal()
    try:
        print("=== Step 1: Deleting Orders, Items, Addons, Payments, Customers ===")
        db.execute(text("DELETE FROM order_item_addons;"))
        db.execute(text("DELETE FROM order_items;"))
        db.execute(text("DELETE FROM payments;"))
        db.execute(text("DELETE FROM loyalty_transactions;"))
        db.execute(text("DELETE FROM orders;"))
        db.execute(text("DELETE FROM customers;"))
        print("Orders, payments, and customers cleared.")

        print("\n=== Step 2: Deleting Procurement & Purchasing Requests ===")
        db.execute(text("DELETE FROM purchase_request_items;"))
        db.execute(text("DELETE FROM purchase_requests;"))
        print("Purchasing cleared.")

        print("\n=== Step 3: Deleting Menu Products, Sizes, Addons, Images, Categories ===")
        db.execute(text("DELETE FROM menu_item_ingredients;"))
        db.execute(text("DELETE FROM menu_item_images;"))
        db.execute(text("DELETE FROM menu_item_addons;"))
        db.execute(text("DELETE FROM menu_item_sizes;"))
        db.execute(text("DELETE FROM menu_items;"))
        db.execute(text("DELETE FROM menu_categories;"))
        print("Menu catalog and categories cleared.")

        print("\n=== Step 4: Deleting Stock & Inventory Transactions ===")
        db.execute(text("DELETE FROM inventory_transactions;"))
        db.execute(text("DELETE FROM inventory_items;"))
        print("Inventory and stock cleared.")

        print("\n=== Step 5: Deleting Unwanted Users & Sessions ===")
        all_users = db.query(User).all()
        to_delete = [
            u for u in all_users
            if u.username.lower() not in PROTECTED_USERNAMES
            and u.email.lower() not in PROTECTED_EMAILS
        ]
        to_delete_ids = [u.user_id for u in to_delete]
        print(f"Found {len(to_delete)} users to delete: {[u.username for u in to_delete]}")

        if to_delete_ids:
            # Delete auth sessions for all users to ensure fresh logins
            db.execute(text("DELETE FROM auth_sessions;"))
            
            # Delete user roles for deleted users
            for uid in to_delete_ids:
                db.execute(text(f"DELETE FROM user_roles WHERE user_id = {uid};"))
                db.execute(text(f"DELETE FROM users WHERE user_id = {uid};"))
            print("Deleted unwanted users and their roles.")
        else:
            db.execute(text("DELETE FROM auth_sessions;"))

        db.commit()

        # Step 6: Verify Remaining Active Accounts
        print("\n=== Step 6: Remaining Active System Accounts ===")
        remaining_users = db.query(User).all()
        for u in remaining_users:
            roles = [ur.role.role_name for ur in u.user_roles if ur.is_active]
            print(f"- Username: {u.username} | Email: {u.email} | Name: {u.first_name} {u.last_name} | Roles: {roles}")

        # Verify counts in all wiped tables
        print("\n=== Step 7: Final Data Table Counts ===")
        for table in [
            "orders",
            "order_items",
            "payments",
            "customers",
            "purchase_requests",
            "inventory_items",
            "inventory_transactions",
            "menu_items",
            "menu_categories",
            "users",
        ]:
            count = db.execute(text(f"SELECT COUNT(*) FROM {table};")).scalar()
            print(f"- {table}: {count}")

        print("\nDatabase cleaning complete!")

    except Exception as e:
        db.rollback()
        print(f"ERROR during cleaning: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    clean_system()
