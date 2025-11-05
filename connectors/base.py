"""Abstract base classes for connector plugins."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, AsyncIterator, Dict, Optional


@dataclass(slots=True)
class ConnectorConfig:
    """Common configuration shared across connectors."""

    workspace_token: str
    gateway_url: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class MetricSample:
    """Normalized sample emitted by a connector."""

    metric: str
    timestamp: datetime
    value: float
    context: Dict[str, Any] = field(default_factory=dict)


class BaseConnector(abc.ABC):
    """Blueprint for implementing data source connectors."""

    def __init__(self, config: ConnectorConfig) -> None:
        self.config = config

    @abc.abstractmethod
    async def stream(self) -> AsyncIterator[MetricSample]:
        """Yield metric samples as they are available."""

    async def run(self) -> None:
        """Continuously stream samples to the gateway."""
        import httpx

        async with httpx.AsyncClient() as client:
            async for sample in self.stream():
                payload = {
                    "token": self.config.workspace_token,
                    "event": {
                        "metric": sample.metric,
                        "timestamp": sample.timestamp.isoformat(),
                        "value": sample.value,
                        "context": sample.context,
                    },
                }
                await client.post(f"{self.config.gateway_url}/ingest", json=payload, timeout=10)
