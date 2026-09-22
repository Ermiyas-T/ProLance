from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# resolve the project root from this file so .env is found regardless of cwd
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    # keep access tokens short-lived so a stolen browser cookie has limited value
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    # allow users to keep a session while the rotating refresh session remains valid
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # keep cookie transport configurable because local HTTP cannot use Secure cookies
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: str = "lax"
    AUTH_COOKIE_DOMAIN: str | None = None
    ALLOWED_ORIGINS: str = ""


# Pydantic fills the no-default fields from .env, so no args are needed
settings = Settings()  # type: ignore[call-arg] #pyright: ignore[reportCallIssue]
