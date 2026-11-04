
"""reconcile local schema differences

Revision ID: 4da31fa73655
Revises: c3d4e5f6a1b2
Create Date: 2026-11-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4da31fa73655"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Customers
    op.add_column(
        "customers",
        sa.Column("no_show_count", sa.Integer(), nullable=True, server_default="0"),
    )

    # Menu items
    op.add_column(
        "menu_items",
        sa.Column("is_draft", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "menu_items",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Orders
    op.add_column(
        "orders",
        sa.Column("payment_method_intent", sa.String(length=30), nullable=True,
                  server_default="online_card"),
    )
    op.add_column(
        "orders",
        sa.Column("reference_code", sa.String(length=20), nullable=True),
    )
    op.create_index(
        "ix_orders_reference_code",
        "orders",
        ["reference_code"],
        unique=False,
    )

    # Payments
    op.add_column(
        "payments",
        sa.Column("amount_tendered", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("change_due", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("receipt_pdf_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("receipt_emailed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("receipt_email_last_error", sa.Text(), nullable=True),
    )

    # Menu item images
    op.create_table(
        "menu_item_images",
        sa.Column(
            "menu_item_image_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "menu_item_id",
            sa.Integer(),
            sa.ForeignKey("menu_items.menu_item_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("image_url", sa.String(length=500), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_menu_item_images_menu_item_id",
        "menu_item_images",
        ["menu_item_id"],
        unique=False,
    )
    op.create_index(
        "ix_menu_item_images_is_primary",
        "menu_item_images",
        ["is_primary"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_menu_item_images_is_primary", table_name="menu_item_images")
    op.drop_index("ix_menu_item_images_menu_item_id", table_name="menu_item_images")
    op.drop_table("menu_item_images")

    op.drop_index("ix_orders_reference_code", table_name="orders")

    op.drop_column("payments", "receipt_email_last_error")
    op.drop_column("payments", "receipt_emailed_at")
    op.drop_column("payments", "receipt_pdf_url")
    op.drop_column("payments", "change_due")
    op.drop_column("payments", "amount_tendered")

    op.drop_column("orders", "reference_code")
    op.drop_column("orders", "payment_method_intent")

    op.drop_column("menu_items", "is_deleted")
    op.drop_column("menu_items", "is_draft")

    op.drop_column("customers", "no_show_count")
