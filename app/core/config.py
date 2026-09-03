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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30


# Pydantic fills the no-default fields from .env, so no args are needed
settings = Settings()  # type: ignore[call-arg] #pyright: ignore[reportCallIssue]
