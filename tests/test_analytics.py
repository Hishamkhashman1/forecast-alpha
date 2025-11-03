"""Tests for analytics services."""

from __future__ import annotations

import pandas as pd

from backend.services import AnalyticsService


def _build_sample_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": pd.date_range("2024-01-01", periods=6, freq="D"),
            "revenue": [100, 105, 110, 400, 115, 120],
        }
    )


def test_detect_anomalies_flags_outliers():
    frame = _build_sample_frame()
    service = AnalyticsService(anomaly_threshold=2.0)
    anomalies = service.detect_anomalies(frame, "revenue", "date")
    assert any(anomaly["severity"] in {"high", "medium"} for anomaly in anomalies)


def test_forecast_returns_requested_periods():
    frame = _build_sample_frame()
    service = AnalyticsService(forecast_periods=2)
    forecast = service.forecast(frame, "revenue", "date")
    assert len(forecast) == 2
    for record in forecast:
        assert "date" in record and "prediction" in record
