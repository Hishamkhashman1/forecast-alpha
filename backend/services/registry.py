"""Connection registry to keep track of validated database URLs."""

from __future__ import annotations

from typing import Dict
from uuid import uuid4


class ConnectionRegistry:
    """In-memory storage for connection URLs keyed by a token."""

    def __init__(self) -> None:
        self._connections: Dict[str, str] = {}

    def register(self, database_url: str) -> str:
        token = str(uuid4())
        self._connections[token] = database_url
        return token

    def resolve(self, token: str) -> str | None:
        return self._connections.get(token)

    def remove(self, token: str) -> None:
        self._connections.pop(token, None)


registry = ConnectionRegistry()
