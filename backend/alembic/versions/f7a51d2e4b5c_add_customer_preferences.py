"""add customer preferences

Revision ID: f7a51d2e4b5c
Revises: e6f40c1d3a4b
"""
from alembic import op
import sqlalchemy as sa
revision = "f7a51d2e4b5c"; down_revision = "e6f40c1d3a4b"; branch_labels = None; depends_on = None
def upgrade():
    op.add_column("customers", sa.Column("dietary_notes", sa.String(500)))
    op.add_column("customers", sa.Column("favorite_item_notes", sa.String(500)))
    op.add_column("customers", sa.Column("marketing_consent", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("customers", sa.Column("marketing_consent_at", sa.DateTime(timezone=True)))
def downgrade():
    op.drop_column("customers", "marketing_consent_at"); op.drop_column("customers", "marketing_consent"); op.drop_column("customers", "favorite_item_notes"); op.drop_column("customers", "dietary_notes")
