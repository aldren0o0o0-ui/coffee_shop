from getpass import getpass

from sqlalchemy import func, select

from app.core.security import verify_password
from app.database.session import SessionLocal
from app.models.user import User


username = input("Username: ").strip().lower()
password = getpass("Password: ")

with SessionLocal() as database:
    user = database.scalar(
        select(User).where(
            func.lower(User.username) == username
        )
    )

    valid = (
        user is not None
        and user.is_active
        and verify_password(password, user.password_hash)
    )

print(
    "Password verification successful."
    if valid
    else "Invalid username or password."
)