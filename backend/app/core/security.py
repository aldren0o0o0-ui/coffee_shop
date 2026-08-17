import hashlib
import secrets

from pwdlib import PasswordHash


password_hasher = PasswordHash.recommended()

SESSION_TOKEN_BYTES = 32


def hash_password(password: str) -> str:
    """Convert a plaintext password into a secure one-way hash."""
    return password_hasher.hash(password)


def verify_password(
    plain_password: str,
    password_hash: str,
) -> bool:
    """Check a plaintext password against a stored password hash."""
    return password_hasher.verify(
        plain_password,
        password_hash,
    )


def generate_session_token() -> str:
    """Generate a cryptographically secure token for the browser."""
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def hash_session_token(token: str) -> str:
    """Create the database-safe representation of a session token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def verify_password_safely(
    plain_password: str,
    password_hash: str,
) -> bool:
    """
    Verify a password without allowing a malformed stored hash
    to crash the authentication endpoint.
    """
    try:
        return verify_password(
            plain_password,
            password_hash,
        )
    except Exception:
        return False