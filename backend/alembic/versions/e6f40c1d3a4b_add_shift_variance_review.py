"""add shift variance review

Revision ID: e6f40c1d3a4b
Revises: d5e39b0c2f3a
"""
from alembic import op
import sqlalchemy as sa

revision = "e6f40c1d3a4b"
down_revision = "d5e39b0c2f3a"
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table("shifts") as batch_op:
        batch_op.add_column(sa.Column("variance_review_status", sa.String(20), nullable=False, server_default="not_required"))
        batch_op.add_column(sa.Column("variance_approved_by", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="RESTRICT", name="fk_shifts_variance_approved_by")))
        batch_op.add_column(sa.Column("variance_approved_at", sa.DateTime(timezone=True)))

def downgrade():
    with op.batch_alter_table("shifts") as batch_op:
        batch_op.drop_column("variance_approved_at")
        batch_op.drop_column("variance_approved_by")
        batch_op.drop_column("variance_review_status")
