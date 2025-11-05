"""Gateway service package for Forecast Alpha live data streaming."""

__all__ = ["create_app"]

from .app import create_app  # noqa: E402,F401
