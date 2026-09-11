from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.shared.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.modules.inventory.models import InventoryItem
    from app.modules.users.models import User


class Branch(TimestampMixin, Base):
    __tablename__ = "branches"

    branch_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    code: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        index=True,
        nullable=False,
    )

    address: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    timezone: Mapped[str] = mapped_column(
        String(50),
        default="Asia/Manila",
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    operational_settings: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    transfers_out: Mapped[list[BranchTransfer]] = relationship(
        "BranchTransfer",
        back_populates="source_branch",
        foreign_keys="BranchTransfer.source_branch_id",
    )

    transfers_in: Mapped[list[BranchTransfer]] = relationship(
        "BranchTransfer",
        back_populates="destination_branch",
        foreign_keys="BranchTransfer.destination_branch_id",
    )


class BranchTransfer(TimestampMixin, Base):
    __tablename__ = "branch_transfers"

    transfer_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    source_branch_id: Mapped[int] = mapped_column(
        ForeignKey("branches.branch_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    destination_branch_id: Mapped[int] = mapped_column(
        ForeignKey("branches.branch_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",  # pending, in_transit, completed, cancelled
        nullable=False,
    )

    requested_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    approved_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    source_branch: Mapped[Branch] = relationship(
        "Branch",
        foreign_keys=[source_branch_id],
        back_populates="transfers_out",
    )

    destination_branch: Mapped[Branch] = relationship(
        "Branch",
        foreign_keys=[destination_branch_id],
        back_populates="transfers_in",
    )

    requested_by: Mapped[User] = relationship(
        "User",
        foreign_keys=[requested_by_user_id],
    )

    approved_by: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[approved_by_user_id],
    )

    items: Mapped[list[BranchTransferItem]] = relationship(
        "BranchTransferItem",
        back_populates="transfer",
        cascade="all, delete-orphan",
    )


class BranchTransferItem(Base):
    __tablename__ = "branch_transfer_items"

    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_branch_transfer_item_quantity_positive",
        ),
    )

    transfer_item_id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    transfer_id: Mapped[int] = mapped_column(
        ForeignKey("branch_transfers.transfer_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    inventory_item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.inventory_item_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    quantity: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        nullable=False,
    )

    # Relationships
    transfer: Mapped[BranchTransfer] = relationship(
        "BranchTransfer",
        back_populates="items",
    )

    inventory_item: Mapped[InventoryItem] = relationship(
        "InventoryItem",
    )
