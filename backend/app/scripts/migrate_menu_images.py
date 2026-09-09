from sqlalchemy import text
from app.database.session import engine
from app.database.base import Base
import app.database.models  # load all models


def migrate():
    with engine.connect() as conn:
        conn.execute(
            text("ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;")
        )
        conn.commit()

    Base.metadata.create_all(engine)
    print("Migration complete: menu_items.is_draft added and menu_item_images table created.")


if __name__ == "__main__":
    migrate()
