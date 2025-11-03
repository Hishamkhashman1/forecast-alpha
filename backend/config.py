"""Application configuration module."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import os


@dataclass
class Config:
    """Base configuration shared by all environments."""

    SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-secret-key")
    SQLALCHEMY_DATABASE_URI: Optional[str] = os.environ.get("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    PORT: int = int(os.environ.get("PORT", 5000))
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "development")


def load_config() -> Config:
    """Resolve the configuration based on environment variables."""
    return Config()
