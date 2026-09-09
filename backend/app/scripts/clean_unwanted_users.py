from app.database.session import SessionLocal
from app.modules.users.models import User, UserRole
from app.modules.orders.models import Order
from app.modules.inventory.models import InventoryTransaction
from app.modules.procurement.models import PurchaseRequest


def clean_users():
    db = SessionLocal()
    allowed_emails = {
        "ldrndc@gmail.com",
        "dicxo01@gmail.com",
        "aldren.dico.it@gmail.com",
    }

    # Find owner user (dren)
    owner_user = db.query(User).filter(User.email == "ldrndc@gmail.com").first()
    if not owner_user:
        print("Error: Owner user ldrndc@gmail.com not found!")
        db.close()
        return

    owner_id = owner_user.user_id

    # Find all users to delete
    unwanted_users = db.query(User).filter(~User.email.in_(allowed_emails)).all()
    unwanted_ids = [u.user_id for u in unwanted_users]

    print(f"Found {len(unwanted_users)} unwanted users to delete: {unwanted_ids}")

    if unwanted_ids:
        # Reassign orders created/served by these users to owner_id
        db.query(Order).filter(Order.user_id.in_(unwanted_ids)).update(
            {Order.user_id: owner_id}, synchronize_session=False
        )

        # Reassign inventory transactions
        db.query(InventoryTransaction).filter(InventoryTransaction.created_by.in_(unwanted_ids)).update(
            {InventoryTransaction.created_by: owner_id}, synchronize_session=False
        )

        # Reassign purchase requests
        db.query(PurchaseRequest).filter(PurchaseRequest.requested_by.in_(unwanted_ids)).update(
            {PurchaseRequest.requested_by: owner_id}, synchronize_session=False
        )

        # Delete auth sessions
        db.query(AuthSession).filter(AuthSession.user_id.in_(unwanted_ids)).delete(synchronize_session=False)

        # Delete user roles
        db.query(UserRole).filter(UserRole.user_id.in_(unwanted_ids)).delete(synchronize_session=False)

        # Delete users
        db.query(User).filter(User.user_id.in_(unwanted_ids)).delete(synchronize_session=False)

        db.commit()
        print("Successfully deleted all unwanted users and cleaned up references.")

    # Print remaining users
    remaining = db.query(User).all()
    print("\n--- Remaining Accounts ---")
    for u in remaining:
        roles = [ur.role.role_name for ur in u.user_roles if ur.is_active]
        print(f"User ID: {u.user_id} | Username: {u.username} | Email: {u.email} | Name: {u.first_name} {u.last_name} | Roles: {roles}")

    db.close()


if __name__ == "__main__":
    clean_users()
