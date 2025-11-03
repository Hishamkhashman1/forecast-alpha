"""Utility helpers for database connections."""

from __future__ import annotations

from typing import Dict, Optional
from urllib.parse import quote_plus


def build_connection_url(
    driver: str,
    username: str,
    password: str,
    host: str,
    port: int,
    database: str,
    options: Optional[Dict[str, str]] = None,
) -> str:
    """Construct a SQLAlchemy-compatible database URL."""
    user = quote_plus(username)
    pwd = quote_plus(password)
    base = f"{driver}://{user}:{pwd}@{host}:{port}/{database}"
    if options:
        query = "&".join(
            f"{key}={quote_plus(str(value))}"
            for key, value in options.items()
        )
        return f"{base}?{query}"
    return base
