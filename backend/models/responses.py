"""Response payload schema definitions."""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List, Optional


class AnomalyRecord(BaseModel):
    """Represents a detected anomaly."""

    timestamp: str
    metric: str
    severity: str
    value: float | None = None
    z_score: Optional[float] = None


class ForecastRecord(BaseModel):
    """Represents a single forecasted data point."""

    date: str
    prediction: float


class AnalysisResponse(BaseModel):
    """Envelope for analysis results."""

    anomalies: List[AnomalyRecord]
    forecast: List[ForecastRecord]
    pipeline_steps: List[str] = Field(default_factory=list)
