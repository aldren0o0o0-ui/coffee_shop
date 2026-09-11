from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.shared.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.modules.auth.models import AuthSession
    from app.modules.inventory.models import InventoryTransaction
    from app.modules.orders.models import Order
    from app.modules.procurement.models import PurchaseRequest


class User(TimestampMixin, Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    branch_id: Mapped[int | None] = mapped_column(
        ForeignKey("branches.branch_id"),
        default=1,
        server_default="1",
        nullable=True,
        index=True,
    )

    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    must_change_password: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    first_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    phone_number: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user_roles: Mapped[list[UserRole]] = relationship(
        "UserRole",
        back_populates="user",
    )

    orders: Mapped[list[Order]] = relationship(
        "Order",
        back_populates="staff_user",
        foreign_keys="Order.user_id",
    )

    purchase_requests: Mapped[list[PurchaseRequest]] = relationship(
        "PurchaseRequest",
        back_populates="requester",
        foreign_keys="PurchaseRequest.requested_by",
    )

    inventory_transactions: Mapped[list[InventoryTransaction]] = relationship(
        "InventoryTransaction",
        back_populates="creator",
        foreign_keys="InventoryTransaction.created_by",
    )

    auth_sessions: Mapped[list[AuthSession]] = relationship(
        "AuthSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Role(TimestampMixin, Base):
    __tablename__ = "roles"

    role_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    role_name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    user_roles: Mapped[list[UserRole]] = relationship(
        "UserRole",
        back_populates="role",
    )


class UserRole(Base):
    __tablename__ = "user_roles"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "role_id",
            name="uq_user_roles_user_role",
        ),
    )

    user_role_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.user_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    role_id: Mapped[int] = mapped_column(
        ForeignKey(
            "roles.role_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    user: Mapped[User] = relationship(
        "User",
        back_populates="user_roles",
    )

    role: Mapped[Role] = relationship(
        "Role",
        back_populates="user_roles",
    )
