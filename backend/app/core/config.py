from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Coffee Shop Management System"
    app_env: str = "development"
    debug: bool = False

    database_url: str
    frontend_url: str = "http://localhost:5173"
    secret_key: str

    session_cookie_name: str = "ldrndc_session"
    session_lifetime_hours: int = Field(default=8, ge=1, le=168)
    # Set SESSION_COOKIE_SECURE=true in production environment variables over HTTPS (SEC-6)
    session_cookie_secure: bool = False

    # SMTP / Email Notification Settings
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "orders@ldrncoffee.com"
    smtp_from_name: str = "LDRN's Coffee Roastery"
    smtp_tls: bool = True
    smtp_ssl: bool = False

    @property
    def cors_origins(self) -> list[str]:
        raw_origins = [o.strip() for o in self.frontend_url.split(",") if o.strip()]
        dev_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ]
        return list(dict.fromkeys(raw_origins + dev_origins))

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