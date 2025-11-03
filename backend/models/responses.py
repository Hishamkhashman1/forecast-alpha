"""Response payload schema definitions."""

from __future__ import annotations

from pydantic import BaseModel
from typing import List


class AnomalyRecord(BaseModel):
    """Represents a detected anomaly."""

    timestamp: str
    metric: str
    severity: str
    value: float | None = None


class ForecastRecord(BaseModel):
    """Represents a single forecasted data point."""

    date: str
    prediction: float


class AnalysisResponse(BaseModel):
    """Envelope for analysis results."""

    anomalies: List[AnomalyRecord]
    forecast: List[ForecastRecord]
    pipeline_steps: List[str] = []
