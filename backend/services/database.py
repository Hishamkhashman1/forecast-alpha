"""Database service responsible for connection management and metadata discovery."""

from __future__ import annotations

from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Engine
from typing import Any

class DatabaseService:
    """Handles connections to relational databases."""

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._engine: Engine | None = None

    def connect(self) -> Engine:
        """Create and cache a SQLAlchemy engine."""
        if self._engine is None:
            self._engine = create_engine(self._database_url, pool_pre_ping=True)
        return self._engine

    def validate_connection(self) -> bool:
        """Attempt a simple connection to ensure credentials are valid."""
        engine = self.connect()
        with engine.connect() as connection:
            connection.execute("SELECT 1")
        return True

    def list_tables(self) -> list[dict[str, Any]]:
        """Return table metadata for the connected database."""
        engine = self.connect()
        inspector = inspect(engine)
        tables = []
        for table_name in inspector.get_table_names():
            columns = [column["name"] for column in inspector.get_columns(table_name)]
            tables.append({"name": table_name, "columns": columns})
        return tables
