"""Database service responsible for connection management and metadata discovery."""

from __future__ import annotations

from typing import Any, Optional
from sqlalchemy import create_engine, inspect, select, text, MetaData, Table
from sqlalchemy.engine import Engine
import pandas as pd

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
            connection.execute(text("SELECT 1"))
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

    def fetch_table(self, table_name: str, limit: Optional[int] = None) -> pd.DataFrame:
        """Load the provided table into a pandas DataFrame."""
        engine = self.connect()
        metadata = MetaData()
        table = Table(table_name, metadata, autoload_with=engine)
        stmt = select(table)
        if limit:
            stmt = stmt.limit(limit)
        with engine.connect() as connection:
            frame = pd.read_sql(stmt, connection)
        return frame
