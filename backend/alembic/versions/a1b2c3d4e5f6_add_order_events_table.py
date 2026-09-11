"""add order events table

Revision ID: a1b2c3d4e5f6
Revises: f7a51d2e4b5c
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "f7a51d2e4b5c"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "order_events",
        sa.Column("order_event_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("previous_status", sa.String(length=50), nullable=True),
        sa.Column("new_status", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["orders.order_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("order_event_id"),
    )
    op.create_index("ix_order_events_order_id", "order_events", ["order_id"])
    op.create_index("ix_order_events_created_at", "order_events", ["created_at"])


def downgrade():
    op.drop_index("ix_order_events_created_at", table_name="order_events")
    op.drop_index("ix_order_events_order_id", table_name="order_events")
    op.drop_table("order_events")
