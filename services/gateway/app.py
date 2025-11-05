"""FastAPI-based gateway for ingesting and broadcasting live metric events."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Set

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


class MetricEvent(BaseModel):
    """Normalized event payload produced by connectors."""

    metric: str = Field(..., description="Unique identifier for the metric")
    timestamp: datetime = Field(..., description="UTC timestamp of the measurement")
    value: float = Field(..., description="Numeric value for the metric")
    context: Dict[str, Any] | None = Field(default=None, description="Optional metadata")


class IngestRequest(BaseModel):
    """Body of the ingest endpoint."""

    token: str = Field(..., description="Workspace access token")
    event: MetricEvent


class WorkspaceRegistry:
    """In-memory workspace auth + broadcast manager.

    In production this would move to Redis or another shared store.
    """

    def __init__(self) -> None:
        self._valid_tokens: Dict[str, str] = {}
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._locks: Dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def register_workspace(self, workspace_id: str, token: str) -> None:
        self._valid_tokens[token] = workspace_id

    def authenticate(self, token: str) -> str:
        workspace_id = self._valid_tokens.get(token)
        if not workspace_id:
            raise HTTPException(status_code=401, detail="Invalid workspace token")
        return workspace_id

    async def attach(self, workspace_id: str, websocket: WebSocket) -> None:
        async with self._locks[workspace_id]:
            self._connections[workspace_id].add(websocket)

    async def detach(self, workspace_id: str, websocket: WebSocket) -> None:
        async with self._locks[workspace_id]:
            self._connections[workspace_id].discard(websocket)

    async def broadcast(self, workspace_id: str, payload: Dict[str, Any]) -> None:
        async with self._locks[workspace_id]:
            websockets: List[WebSocket] = list(self._connections[workspace_id])
        message = payload | {"workspace_id": workspace_id}
        stale: List[WebSocket] = []
        for ws in websockets:
            try:
                await ws.send_json(message)
            except RuntimeError:
                stale.append(ws)
        if stale:
            async with self._locks[workspace_id]:
                for ws in stale:
                    self._connections[workspace_id].discard(ws)


registry = WorkspaceRegistry()
registry.register_workspace("demo-workspace", token="demo-token")


def create_app() -> FastAPI:
    app = FastAPI(title="Forecast Alpha Gateway", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.post("/ingest", status_code=202)
    async def ingest(request: IngestRequest) -> Dict[str, str]:
        workspace_id = registry.authenticate(request.token)
        await registry.broadcast(workspace_id, request.event.model_dump())
        return {"status": "queued"}

    async def get_workspace(token: str) -> str:
        return registry.authenticate(token)

    @app.websocket("/ws/{token}")
    async def websocket_endpoint(websocket: WebSocket, token: str, workspace_id: str = Depends(get_workspace)) -> None:
        await websocket.accept()
        await registry.attach(workspace_id, websocket)
        try:
            while True:
                # Keep the connection alive; clients only receive messages.
                await websocket.receive_text()
        except WebSocketDisconnect:
            await registry.detach(workspace_id, websocket)

    return app


app = create_app()

