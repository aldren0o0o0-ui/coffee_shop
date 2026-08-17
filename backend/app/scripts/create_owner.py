from getpass import getpass

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database.session import SessionLocal
from app.models.role import Role
from app.models.user import User, UserRole


OWNER_ROLE_NAME = "owner"
MINIMUM_PASSWORD_LENGTH = 12


def ask_required(prompt: str) -> str:
    while True:
        value = input(prompt).strip()

        if value:
            return value

        print("This field is required.")


def ask_email() -> str:
    while True:
        email = ask_required("Email address: ").lower()

        # This is basic input validation, not full email verification.
        if "@" in email and "." in email.rsplit("@", maxsplit=1)[-1]:
            return email

        print("Enter a valid email address.")


def ask_username() -> str:
    while True:
        username = ask_required("Username: ").lower()

        if 3 <= len(username) <= 50 and all(
            character.isalnum() or character in "._-"
            for character in username
        ):
            return username

        print(
            "Use 3–50 letters, numbers, periods, underscores, or hyphens."
        )


def ask_password() -> str:
    while True:
        password = getpass("Password: ")
        confirmation = getpass("Confirm password: ")

        if len(password) < MINIMUM_PASSWORD_LENGTH:
            print(
                f"Use at least {MINIMUM_PASSWORD_LENGTH} characters."
            )
            continue

        if password != confirmation:
            print("The passwords do not match.")
            continue

        return password


def owner_already_exists(database: Session) -> bool:
    statement = (
        select(User.user_id)
        .join(UserRole, UserRole.user_id == User.user_id)
        .join(Role, Role.role_id == UserRole.role_id)
        .where(
            func.lower(Role.role_name) == OWNER_ROLE_NAME,
            UserRole.is_active.is_(True),
        )
        .limit(1)
    )

    return database.scalar(statement) is not None


def identity_already_exists(
    database: Session,
    username: str,
    email: str,
) -> bool:
    statement = (
        select(User.user_id)
        .where(
            or_(
                func.lower(User.username) == username.lower(),
                func.lower(User.email) == email.lower(),
            )
        )
        .limit(1)
    )

    return database.scalar(statement) is not None


def get_or_create_owner_role(database: Session) -> Role:
    statement = select(Role).where(
        func.lower(Role.role_name) == OWNER_ROLE_NAME.lower()
    )

    role = database.scalar(statement)

    if role is not None:
        if not role.is_active:
            role.is_active = True

        return role

    role = Role(
        role_name=OWNER_ROLE_NAME,
        description="Full access to the coffee shop system.",
        is_active=True,
    )

    database.add(role)
    database.flush()

    return role


def create_initial_owner() -> None:
    print("\nInitial Owner Setup")
    print("-------------------")
    print("This command creates the first account with full access.\n")

    with SessionLocal() as database:
        if owner_already_exists(database):
            print("An Owner account already exists. No account was created.")
            return

        first_name = ask_required("First name: ")
        last_name = ask_required("Last name: ")
        email = ask_email()
        username = ask_username()

        if identity_already_exists(database, username, email):
            print("That username or email address is already in use.")
            return

        password = ask_password()

        try:
            owner_role = get_or_create_owner_role(database)

            owner = User(
                username=username,
                email=email,
                password_hash=hash_password(password),
                first_name=first_name,
                last_name=last_name,
                phone_number=None,
                is_active=True,
            )

            database.add(owner)
            database.flush()

            database.add(
                UserRole(
                    user_id=owner.user_id,
                    role_id=owner_role.role_id,
                    is_active=True,
                )
            )

            database.commit()

        except IntegrityError as error:
            database.rollback()

            original_error = getattr(error, "orig", None)
            diagnostics = getattr(original_error, "diag", None)
            constraint_name = getattr(
                diagnostics,
                "constraint_name",
                None,
            )

            print("\nThe database rejected the account.")

            if constraint_name:
                print(f"Failed constraint: {constraint_name}")
            else:
                print(f"Database error type: {type(original_error).__name__}")

            print(
                "No changes were saved. "
                "The entered password was not stored."
            )
            return

        except Exception:
            database.rollback()
            print("The account could not be created.")
            raise

    print("\nOwner account created successfully.")
    print("You can now continue with the login system.")


if __name__ == "__main__":
    create_initial_owner()