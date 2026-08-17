from enum import Enum


class OrderChannel(str, Enum):
    IN_STORE = "in_store"
    ONLINE = "online"


class OrderStatus(str, Enum):
    AWAITING_PAYMENT = "awaiting_payment"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class OrderType(str, Enum):
    DINE_IN = "dine_in"
    TAKEOUT = "takeout"
    DELIVERY = "delivery"


class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    E_WALLET = "e_wallet"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class LoyaltyTransactionType(str, Enum):
    EARN = "earn"
    REDEEM = "redeem"
    ADJUSTMENT = "adjustment"


class InventoryTransactionType(str, Enum):
    PURCHASE_IN = "purchase_in"
    USAGE_OUT = "usage_out"
    ADJUSTMENT = "adjustment"
    WASTE = "waste"


class PurchaseRequestStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    RECEIVED = "received"