import logging
import time
from collections import defaultdict
from threading import Lock

logger = logging.getLogger(__name__)

# Thread-safe in-memory rate limiter with sliding window
class SlidingWindowRateLimiter:
    def __init__(self):
        self._requests = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        with self._lock:
            timestamps = self._requests[key]
            # Prune timestamps outside window
            cutoff = now - window_seconds
            self._requests[key] = [ts for ts in timestamps if ts > cutoff]

            if len(self._requests[key]) >= max_requests:
                logger.warning(
                    f"Rate limit exceeded for key='{key}'. "
                    f"Count={len(self._requests[key])}, Limit={max_requests}/{window_seconds}s"
                )
                return False

            self._requests[key].append(now)
            return True

    def reset(self, key: str) -> None:
        with self._lock:
            self._requests.pop(key, None)

    def clear_all(self) -> None:
        with self._lock:
            self._requests.clear()


# Global instance
limiter = SlidingWindowRateLimiter()


def check_order_creation_rate_limit(ip_address: str | None, email: str | None) -> bool:
    """
    Limits guest order creation:
    - Max 5 orders per 10 minutes per IP
    - Max 5 orders per 10 minutes per Email
    """
    if ip_address:
        if not limiter.is_allowed(f"order_create_ip:{ip_address}", max_requests=5, window_seconds=600):
            return False

    if email:
        normalized_email = email.strip().lower()
        if not limiter.is_allowed(f"order_create_email:{normalized_email}", max_requests=5, window_seconds=600):
            return False

    return True


def check_payment_attempt_rate_limit(order_id: int, ip_address: str | None) -> bool:
    """
    Limits payment attempts:
    - Max 5 attempts per 10 minutes per Order ID
    - Max 10 attempts per 10 minutes per IP
    """
    if not limiter.is_allowed(f"pay_order:{order_id}", max_requests=5, window_seconds=600):
        return False

    if ip_address:
        if not limiter.is_allowed(f"pay_ip:{ip_address}", max_requests=10, window_seconds=600):
            return False

    return True


def check_tracking_rate_limit(ip_address: str | None, email: str | None) -> bool:
    """
    Limits order tracking queries to prevent ID and customer order enumeration:
    - Max 10 tracking queries per 10 minutes per IP
    - Max 10 tracking queries per 10 minutes per Email
    """
    if ip_address:
        if not limiter.is_allowed(f"track_ip:{ip_address}", max_requests=10, window_seconds=600):
            return False

    if email:
        normalized_email = email.strip().lower()
        if not limiter.is_allowed(f"track_email:{normalized_email}", max_requests=10, window_seconds=600):
            return False

    return True


def check_step_up_risk(email: str, ip_address: str | None) -> bool:
    """
    Layer 5: Conditional step-up verification hook (Phase 2 scaffold - NOT ACTIVE in v1).
    Currently a no-op placeholder. Active fraud scoring and OTP verification will be activated in Phase 2.
    """
    return False
