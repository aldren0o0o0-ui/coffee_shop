"""Safe, isolated database setup for the backend integration suite."""

import os
from pathlib import Path

# These must be in place before importing any application module. Environment
# variables take precedence over the developer's local .env file.
TEST_DATABASE_PATH = Path(__file__).with_name(".test_database.sqlite3")
RECEIPTS_DIR = Path(__file__).parents[1] / "uploads" / "receipts"
MENU_UPLOADS_DIR = Path(__file__).parents[1] / "uploads" / "menu"
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{TEST_DATABASE_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["DEBUG"] = "true"
os.environ["APP_ENV"] = "test"

import pytest

import app.database.models  # noqa: F401 -- registers all model metadata
from app.core.security import hash_password
from app.database.base import Base
from app.database.session import SessionLocal, engine
from app.modules.users.models import Role, User, UserRole


@pytest.fixture(scope="session", autouse=True)
def isolated_test_database():
    """Create a disposable schema and remove it after the suite completes."""
    receipts_before = set(RECEIPTS_DIR.glob("*.pdf"))
    menu_files_before = set(MENU_UPLOADS_DIR.rglob("*"))
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    session = SessionLocal()
    try:
        owner_role = Role(role_name="Owner", description="Test owner role", is_active=True)
        owner = User(
            username="system_test_owner",
            email="system_test_owner@example.test",
            password_hash=hash_password("TestOwnerPassword123!"),
            first_name="System",
            last_name="Owner",
            is_active=True,
        )
        session.add_all([owner_role, owner])
        session.flush()
        session.add(UserRole(user_id=owner.user_id, role_id=owner_role.role_id, is_active=True))
        session.commit()
    finally:
        session.close()
    try:
        yield
    finally:
        engine.dispose()
        if TEST_DATABASE_PATH.exists():
            TEST_DATABASE_PATH.unlink()
        for receipt in set(RECEIPTS_DIR.glob("*.pdf")) - receipts_before:
            receipt.unlink()
        for menu_file in sorted(
            set(MENU_UPLOADS_DIR.rglob("*")) - menu_files_before,
            key=lambda path: len(path.parts),
            reverse=True,
        ):
            if menu_file.is_file():
                menu_file.unlink()
            elif menu_file.is_dir():
                menu_file.rmdir()
