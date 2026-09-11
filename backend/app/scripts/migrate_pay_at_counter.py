from sqlalchemy import text

from app.database.session import engine


def migrate_pay_at_counter():
    with engine.connect() as conn:
        print("Migrating orders table...")
        conn.execute(
            text(
                """
                ALTER TABLE orders 
                ADD COLUMN IF NOT EXISTS payment_method_intent VARCHAR(30) DEFAULT 'online_card',
                ADD COLUMN IF NOT EXISTS reference_code VARCHAR(20);
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_orders_reference_code ON orders(reference_code);
                """
            )
        )

        print("Migrating payments table...")
        conn.execute(
            text(
                """
                ALTER TABLE payments
                ADD COLUMN IF NOT EXISTS amount_tendered NUMERIC(10, 2),
                ADD COLUMN IF NOT EXISTS change_due NUMERIC(10, 2),
                ADD COLUMN IF NOT EXISTS receipt_pdf_url VARCHAR(500),
                ADD COLUMN IF NOT EXISTS receipt_emailed_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS receipt_email_last_error TEXT;
                """
            )
        )

        print("Migrating customers table...")
        conn.execute(
            text(
                """
                ALTER TABLE customers
                ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0;
                """
            )
        )

        conn.commit()
        print("Pay at counter database migrations applied successfully!")


if __name__ == "__main__":
    migrate_pay_at_counter()
