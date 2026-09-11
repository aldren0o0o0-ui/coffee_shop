"""add system alerts and preferences

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-09-11
"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a1b2"
down_revision = "b2c3d4e5f6a1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "system_alerts",
        sa.Column("alert_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("alert_type", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=20), server_default="warning", nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_resolved", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("resolved_by_user_id", sa.Integer(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.branch_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_by_user_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("alert_id"),
    )
    op.create_index("ix_system_alerts_branch_id", "system_alerts", ["branch_id"])
    op.create_index("ix_system_alerts_alert_type", "system_alerts", ["alert_type"])
    op.create_index("ix_system_alerts_severity", "system_alerts", ["severity"])
    op.create_index("ix_system_alerts_is_resolved", "system_alerts", ["is_resolved"])
    op.create_index("ix_system_alerts_resolved_by_user_id", "system_alerts", ["resolved_by_user_id"])
    op.create_index("ix_system_alerts_created_at", "system_alerts", ["created_at"])

    op.create_table(
        "alert_preferences",
        sa.Column("preference_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("email_alerts", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("stock_alerts", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("financial_alerts", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("min_severity", sa.String(length=20), server_default="warning", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("preference_id"),
        sa.UniqueConstraint("user_id", name="uq_alert_preferences_user_id"),
    )
    op.create_index("ix_alert_preferences_user_id", "alert_preferences", ["user_id"])


def downgrade():
    op.drop_index("ix_alert_preferences_user_id", table_name="alert_preferences")
    op.drop_table("alert_preferences")

    op.drop_index("ix_system_alerts_created_at", table_name="system_alerts")
    op.drop_index("ix_system_alerts_resolved_by_user_id", table_name="system_alerts")
    op.drop_index("ix_system_alerts_is_resolved", table_name="system_alerts")
    op.drop_index("ix_system_alerts_severity", table_name="system_alerts")
    op.drop_index("ix_system_alerts_alert_type", table_name="system_alerts")
    op.drop_index("ix_system_alerts_branch_id", table_name="system_alerts")
    op.drop_table("system_alerts")
