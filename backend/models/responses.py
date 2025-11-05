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
    score: Optional[float] = None


class ForecastRecord(BaseModel):
    """Represents a single forecasted data point."""

    date: str
    prediction: float


class HistoricalRecord(BaseModel):
    """Represents a historical data point for charting."""

    date: str
    value: float


class Metrics(BaseModel):
    """Key performance indicators returned with the analysis."""

    rows_processed: int
    anomalies_detected: int
    forecast_horizon: int
    anomaly_method: str
    forecast_method: str
    target_column: str


class AnalysisResponse(BaseModel):
    """Envelope for analysis results."""

    anomalies: List[AnomalyRecord]
    forecast: List[ForecastRecord]
    historical: List[HistoricalRecord]
    metrics: Metrics
    pipeline_steps: List[str] = Field(default_factory=list)
