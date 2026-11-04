from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Coffee Shop Management System"
    app_env: str = "development"
    debug: bool = False

    database_url: str
    db_pool_size: int = Field(default=20, ge=1, le=100)
    db_max_overflow: int = Field(default=10, ge=0, le=50)
    db_pool_timeout: int = Field(default=30, ge=1, le=120)
    frontend_url: str = "http://localhost:5173"
    secret_key: str

    session_cookie_name: str = "ldrndc_session"
    session_lifetime_hours: int = Field(default=8, ge=1, le=168)
    # Set SESSION_COOKIE_SECURE=true in production environment variables over HTTPS (SEC-6)
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"

    @property
    def effective_cookie_samesite(self) -> str:
        # Cross-origin authentication (e.g. Vercel frontend calling Render backend)
        # requires SameSite=None when Secure=True over HTTPS.
        if self.session_cookie_secure:
            return "none"
        return self.session_cookie_samesite

    # SMTP / Email Notification Settings
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "orders@ldrncoffee.com"
    smtp_from_name: str = "LDRN's Coffee Roastery"
    smtp_tls: bool = True
    smtp_ssl: bool = False

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        """Automatically adjust postgres connection schemes for psycopg 3 driver."""
        if isinstance(value, str):
            normalized = value.strip()
            if normalized.startswith("postgres://"):
                normalized = normalized.replace("postgres://", "postgresql+psycopg://", 1)
            elif normalized.startswith("postgresql://") and not normalized.startswith("postgresql+"):
                normalized = normalized.replace("postgresql://", "postgresql+psycopg://", 1)
            return normalized
        return value

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> object:
        """Accept common deployment labels while keeping a boolean setting internally."""
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "production", "prod"}:
                return False
            if normalized in {"development", "dev"}:
                return True
        return value

    @property
    def cors_origins(self) -> list[str]:
        raw_origins = [o.strip().rstrip("/") for o in self.frontend_url.split(",") if o.strip()]
        dev_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ]
        if self.app_env.lower() in {"development", "dev", "test", "testing"} or self.debug:
            raw_origins.extend(dev_origins)
        return list(dict.fromkeys(raw_origins))

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
