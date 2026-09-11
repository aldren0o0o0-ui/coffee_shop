"""add cash movements

Revision ID: d5e39b0c2f3a
Revises: c4f28a9b1d2e
"""
from alembic import op
import sqlalchemy as sa

revision = "d5e39b0c2f3a"
down_revision = "c4f28a9b1d2e"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("cash_movements", sa.Column("cash_movement_id", sa.Integer(), primary_key=True), sa.Column("shift_id", sa.Integer(), sa.ForeignKey("shifts.shift_id", ondelete="RESTRICT"), nullable=False), sa.Column("movement_type", sa.String(20), nullable=False), sa.Column("amount", sa.Numeric(10,2), nullable=False), sa.Column("reason", sa.String(500), nullable=False), sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_cash_movements_shift_id", "cash_movements", ["shift_id"])

def downgrade():
    op.drop_index("ix_cash_movements_shift_id", table_name="cash_movements")
    op.drop_table("cash_movements")
