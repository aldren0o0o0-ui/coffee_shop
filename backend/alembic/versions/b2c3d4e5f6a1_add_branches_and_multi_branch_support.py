"""add branches and multi branch support

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a1"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create branches table
    op.create_table(
        "branches",
        sa.Column("branch_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("timezone", sa.String(length=50), server_default="Asia/Manila", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("operational_settings", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("branch_id"),
    )
    op.create_index("ix_branches_code", "branches", ["code"], unique=True)

    # 2. Seed primary default branch (id=1, code='MAIN')
    branches_table = sa.table(
        "branches",
        sa.column("branch_id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("code", sa.String),
        sa.column("address", sa.String),
        sa.column("timezone", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("operational_settings", sa.Text),
    )
    op.bulk_insert(
        branches_table,
        [
            {
                "branch_id": 1,
                "name": "Main Roastery",
                "code": "MAIN",
                "address": "123 Artisan Coffee St., Manila",
                "timezone": "Asia/Manila",
                "is_active": True,
                "operational_settings": '{"opening_time":"07:00","closing_time":"22:00"}',
            }
        ],
    )
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("SELECT setval(pg_get_serial_sequence('branches', 'branch_id'), COALESCE((SELECT MAX(branch_id) FROM branches), 1))")

    # 3. Create branch_transfers and branch_transfer_items tables
    op.create_table(
        "branch_transfers",
        sa.Column("transfer_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_branch_id", sa.Integer(), nullable=False),
        sa.Column("destination_branch_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="pending", nullable=False),
        sa.Column("requested_by_user_id", sa.Integer(), nullable=False),
        sa.Column("approved_by_user_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["source_branch_id"], ["branches.branch_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["destination_branch_id"], ["branches.branch_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.user_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("transfer_id"),
    )
    op.create_index("ix_branch_transfers_source_branch_id", "branch_transfers", ["source_branch_id"])
    op.create_index("ix_branch_transfers_destination_branch_id", "branch_transfers", ["destination_branch_id"])

    op.create_table(
        "branch_transfer_items",
        sa.Column("transfer_item_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("transfer_id", sa.Integer(), nullable=False),
        sa.Column("inventory_item_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=10, scale=3), nullable=False),
        sa.ForeignKeyConstraint(["transfer_id"], ["branch_transfers.transfer_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.inventory_item_id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("transfer_item_id"),
    )
    op.create_index("ix_branch_transfer_items_transfer_id", "branch_transfer_items", ["transfer_id"])

    # 4. Add branch_id foreign keys and backfill to branch 1
    op.add_column("orders", sa.Column("branch_id", sa.Integer(), server_default="1", nullable=False))
    op.create_index("ix_orders_branch_id", "orders", ["branch_id"])

    op.add_column("inventory_items", sa.Column("branch_id", sa.Integer(), server_default="1", nullable=False))
    op.create_index("ix_inventory_items_branch_id", "inventory_items", ["branch_id"])

    op.add_column("shifts", sa.Column("branch_id", sa.Integer(), server_default="1", nullable=False))
    op.create_index("ix_shifts_branch_id", "shifts", ["branch_id"])

    op.add_column("purchase_requests", sa.Column("branch_id", sa.Integer(), server_default="1", nullable=False))
    op.create_index("ix_purchase_requests_branch_id", "purchase_requests", ["branch_id"])

    op.add_column("users", sa.Column("branch_id", sa.Integer(), server_default="1", nullable=True))
    op.create_index("ix_users_branch_id", "users", ["branch_id"])


def downgrade():
    op.drop_index("ix_users_branch_id", table_name="users")
    op.drop_column("users", "branch_id")

    op.drop_index("ix_purchase_requests_branch_id", table_name="purchase_requests")
    op.drop_column("purchase_requests", "branch_id")

    op.drop_index("ix_shifts_branch_id", table_name="shifts")
    op.drop_column("shifts", "branch_id")

    op.drop_index("ix_inventory_items_branch_id", table_name="inventory_items")
    op.drop_column("inventory_items", "branch_id")

    op.drop_index("ix_orders_branch_id", table_name="orders")
    op.drop_column("orders", "branch_id")

    op.drop_index("ix_branch_transfer_items_transfer_id", table_name="branch_transfer_items")
    op.drop_table("branch_transfer_items")

    op.drop_index("ix_branch_transfers_destination_branch_id", table_name="branch_transfers")
    op.drop_index("ix_branch_transfers_source_branch_id", table_name="branch_transfers")
    op.drop_table("branch_transfers")

    op.drop_index("ix_branches_code", table_name="branches")
    op.drop_table("branches")
