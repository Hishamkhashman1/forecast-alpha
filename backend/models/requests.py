"""Request payload schema definitions."""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional, List, Dict


class ConnectionRequest(BaseModel):
    """Payload for initiating a database connection."""

    host: str
    port: int = Field(default=3306, ge=1, le=65535)
    username: str
    password: str
    database: str
    ssl: Optional[bool] = False
    driver: str = "mysql+pymysql"
    engine_url: Optional[str] = None
    options: Optional[Dict[str, str]] = None


class AnalysisRequest(BaseModel):
    """Payload to request anomaly detection and forecasting."""

    connection_id: str
    table: str
    feature_columns: List[str]
    target_column: str
    date_column: Optional[str] = None
    limit: Optional[int] = Field(default=10000, gt=0)
