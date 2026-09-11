"""add shifts table

Revision ID: c4f28a9b1d2e
Revises: 26959d110705
"""
from alembic import op
import sqlalchemy as sa

revision = "c4f28a9b1d2e"
down_revision = "26959d110705"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shifts",
        sa.Column("shift_id", sa.Integer(), primary_key=True),
        sa.Column("opened_by", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False),
        sa.Column("closed_by", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="RESTRICT")),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("opening_cash", sa.Numeric(10, 2), nullable=False),
        sa.Column("expected_cash", sa.Numeric(10, 2)),
        sa.Column("counted_cash", sa.Numeric(10, 2)),
        sa.Column("variance", sa.Numeric(10, 2)),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("opening_cash >= 0", name="ck_shift_opening_cash_nonnegative"),
    )
    op.create_index("ix_shifts_status", "shifts", ["status"])
    op.create_index("ix_shifts_opened_by", "shifts", ["opened_by"])


def downgrade() -> None:
    op.drop_index("ix_shifts_opened_by", table_name="shifts")
    op.drop_index("ix_shifts_status", table_name="shifts")
    op.drop_table("shifts")
