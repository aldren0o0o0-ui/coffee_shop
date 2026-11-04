from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.modules.branches.models import Branch
    from app.modules.users.models import User


class SystemAlert(Base):
    __tablename__ = "system_alerts"

    alert_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    branch_id: Mapped[int | None] = mapped_column(
        ForeignKey("branches.branch_id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    alert_type: Mapped[str] = mapped_column(
        String(50),  # stock_critical, cash_variance, queue_delay, low_margin, procurement_pending
        nullable=False,
        index=True,
    )

    severity: Mapped[str] = mapped_column(
        String(20),  # info, warning, critical
        default="warning",
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    is_resolved: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    resolved_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    branch: Mapped[Branch | None] = relationship("Branch")
    resolved_by: Mapped[User | None] = relationship("User", foreign_keys=[resolved_by_user_id])


class AlertPreference(Base):
    __tablename__ = "alert_preferences"

    preference_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    email_alerts: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    stock_alerts: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    financial_alerts: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    min_severity: Mapped[str] = mapped_column(
        String(20),
        default="warning",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped[User] = relationship("User")
