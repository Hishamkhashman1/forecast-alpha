"""Analytical services wrapping anomaly detection and forecasting models."""

from __future__ import annotations

from typing import Any, List, Optional

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression


class AnalyticsService:
    """Runs ML models to detect anomalies and generate forecasts."""

    def __init__(self, anomaly_threshold: float = 3.0, forecast_periods: int = 3) -> None:
        self._anomaly_threshold = anomaly_threshold
        self._forecast_periods = forecast_periods

    def detect_anomalies(
        self,
        frame: pd.DataFrame,
        target_column: str,
        date_column: Optional[str] = None,
    ) -> List[dict[str, Any]]:
        """Return detected anomalies from the given data frame using a z-score heuristic."""
        if target_column not in frame.columns:
            return []

        series = pd.to_numeric(frame[target_column], errors="coerce")
        valid_mask = series.notna()
        series = series[valid_mask]
        if series.empty:
            return []

        mean = series.mean()
        std = series.std(ddof=0)
        if std == 0 or np.isnan(std):
            return []

        z_scores = (series - mean) / std
        anomalies: List[dict[str, Any]] = []

        for idx, z_score in z_scores.items():
            if abs(z_score) <= self._anomaly_threshold:
                continue

            timestamp = str(idx)
            if date_column and date_column in frame.columns:
                date_value = frame.loc[idx, date_column]
                if isinstance(date_value, pd.Timestamp):
                    timestamp = date_value.isoformat()
                else:
                    timestamp = str(date_value)

            severity = "high" if abs(z_score) > self._anomaly_threshold + 1 else "medium"
            anomalies.append(
                {
                    "timestamp": timestamp,
                    "metric": target_column,
                    "severity": severity,
                    "z_score": float(z_score),
                    "value": float(series.loc[idx]),
                }
            )

        return anomalies

    def forecast(
        self,
        frame: pd.DataFrame,
        target_column: str,
        date_column: Optional[str] = None,
    ) -> List[dict[str, Any]]:
        """Generate trend predictions based on a simple linear regression."""
        if target_column not in frame.columns:
            return []

        series = pd.to_numeric(frame[target_column], errors="coerce")
        valid_mask = series.notna()
        series = series[valid_mask]
        if series.empty:
            return []

        y = series.to_numpy().reshape(-1, 1)
        x = np.arange(len(series)).reshape(-1, 1)

        if len(series) < 2:
            mean_value = float(series.mean())
            return [
                {"date": str(i), "prediction": mean_value}
                for i in range(len(series), len(series) + self._forecast_periods)
            ]

        model = LinearRegression()
        model.fit(x, y)

        future_x = np.arange(len(series), len(series) + self._forecast_periods).reshape(-1, 1)
        predictions = model.predict(future_x).flatten()

        future_dates = self._generate_future_dates(frame, valid_mask.index, date_column)

        return [
            {
                "date": future_dates[idx],
                "prediction": float(predictions[idx]),
            }
            for idx in range(len(predictions))
        ]

    def _generate_future_dates(
        self,
        frame: pd.DataFrame,
        valid_index: pd.Index,
        date_column: Optional[str],
    ) -> List[str]:
        if not date_column or date_column not in frame.columns:
            return [str(i) for i in range(len(valid_index), len(valid_index) + self._forecast_periods)]

        dates = pd.to_datetime(frame.loc[valid_index, date_column], errors="coerce")
        dates = dates.dropna()
        if dates.empty:
            return [str(i) for i in range(len(valid_index), len(valid_index) + self._forecast_periods)]

        dates = dates.sort_values()
        freq = pd.infer_freq(dates)
        if freq is None:
            freq = "D"

        future_range = pd.date_range(start=dates.max(), periods=self._forecast_periods + 1, freq=freq)[1:]
        return [dt.isoformat() for dt in future_range]
