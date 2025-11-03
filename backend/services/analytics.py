"""Analytical services wrapping anomaly detection and forecasting models."""

from __future__ import annotations

from typing import Any, List, Optional

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import IsolationForest
from statsmodels.tsa.holtwinters import ExponentialSmoothing


class AnalyticsService:
    """Runs ML models to detect anomalies and generate forecasts."""

    SUPPORTED_ANOMALY_METHODS = {"zscore", "isolation_forest"}
    SUPPORTED_FORECAST_METHODS = {"linear_regression", "holt_winters"}

    def __init__(
        self,
        anomaly_threshold: float = 3.0,
        forecast_periods: int = 3,
        anomaly_method: str = "zscore",
        forecast_method: str = "linear_regression",
        max_samples: Optional[int] = 20000,
    ) -> None:
        self._anomaly_threshold = anomaly_threshold
        self._forecast_periods = forecast_periods
        self._anomaly_method = anomaly_method if anomaly_method in self.SUPPORTED_ANOMALY_METHODS else "zscore"
        self._forecast_method = forecast_method if forecast_method in self.SUPPORTED_FORECAST_METHODS else "linear_regression"
        self._max_samples = max_samples

    def _prepare_series(self, frame: pd.DataFrame, column: str) -> pd.Series:
        if column not in frame.columns:
            return pd.Series(dtype=float)

        series = pd.to_numeric(frame[column], errors="coerce")
        valid_mask = series.notna()
        series = series[valid_mask]

        if self._max_samples and len(series) > self._max_samples:
            series = series.sample(self._max_samples, random_state=42).sort_index()

        return series

    def detect_anomalies(
        self,
        frame: pd.DataFrame,
        target_column: str,
        date_column: Optional[str] = None,
        features: Optional[pd.DataFrame] = None,
    ) -> List[dict[str, Any]]:
        """Return detected anomalies from the given data frame using the configured method."""
        series = self._prepare_series(frame, target_column)
        if series.empty:
            return []

        if self._anomaly_method == "isolation_forest":
            return self._detect_isolation_forest(frame, series.index, target_column, date_column, features)

        return self._detect_zscore(frame, series, target_column, date_column)

    def _detect_zscore(
        self,
        frame: pd.DataFrame,
        series: pd.Series,
        target_column: str,
        date_column: Optional[str],
    ) -> List[dict[str, Any]]:
        mean = series.mean()
        std = series.std(ddof=0)
        if std == 0 or np.isnan(std):
            return []

        z_scores = (series - mean) / std
        anomalies: List[dict[str, Any]] = []

        for idx, z_score in z_scores.items():
            if abs(z_score) <= self._anomaly_threshold:
                continue

            timestamp = self._resolve_timestamp(frame, idx, date_column)
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

    def _detect_isolation_forest(
        self,
        frame: pd.DataFrame,
        indices: pd.Index,
        target_column: str,
        date_column: Optional[str],
        features: Optional[pd.DataFrame],
    ) -> List[dict[str, Any]]:
        if features is not None:
            aligned_indices = features.index.intersection(indices)
            feature_df = features.loc[aligned_indices]
        else:
            feature_df = frame.loc[indices]
        feature_df = feature_df.select_dtypes(include=["number"]).copy()
        if target_column in feature_df.columns:
            feature_df[target_column] = pd.to_numeric(feature_df[target_column], errors="coerce")

        feature_df = feature_df.dropna()
        if feature_df.empty:
            return []

        sample_df = feature_df
        if self._max_samples and len(feature_df) > self._max_samples:
            sample_df = feature_df.sample(self._max_samples, random_state=42)

        clf = IsolationForest(random_state=42, contamination="auto")
        clf.fit(sample_df)

        scores = clf.decision_function(sample_df)
        threshold = np.quantile(scores, 0.02)
        anomalies: List[dict[str, Any]] = []

        for idx, score in zip(sample_df.index, scores):
            if score > threshold:
                continue
            value = frame.loc[idx, target_column]
            if pd.isna(value):
                continue
            timestamp = self._resolve_timestamp(frame, idx, date_column)
            anomalies.append(
                {
                    "timestamp": timestamp,
                    "metric": target_column,
                    "severity": "high" if score < threshold - 0.1 else "medium",
                    "z_score": None,
                    "value": float(value),
                    "score": float(score),
                }
            )

        return anomalies

    def _resolve_timestamp(self, frame: pd.DataFrame, idx: Any, date_column: Optional[str]) -> str:
        timestamp = str(idx)
        if date_column and date_column in frame.columns:
            try:
                date_value = frame.at[idx, date_column]
            except KeyError:
                return timestamp
            if isinstance(date_value, pd.Timestamp):
                timestamp = date_value.isoformat()
            else:
                timestamp = str(date_value)
        return timestamp

    def forecast(
        self,
        frame: pd.DataFrame,
        target_column: str,
        date_column: Optional[str] = None,
    ) -> List[dict[str, Any]]:
        """Generate trend predictions based on the configured method."""
        if self._forecast_method == "holt_winters":
            return self._forecast_holt_winters(frame, target_column, date_column)
        return self._forecast_linear_regression(frame, target_column, date_column)

    def _forecast_linear_regression(
        self,
        frame: pd.DataFrame,
        target_column: str,
        date_column: Optional[str],
    ) -> List[dict[str, Any]]:
        if target_column not in frame.columns:
            return []

        series = pd.to_numeric(frame[target_column], errors="coerce").dropna()
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

        future_dates = self._generate_future_dates(frame, series.index, date_column)

        return [
            {
                "date": future_dates[idx],
                "prediction": float(predictions[idx]),
            }
            for idx in range(len(predictions))
        ]

    def _forecast_holt_winters(
        self,
        frame: pd.DataFrame,
        target_column: str,
        date_column: Optional[str],
    ) -> List[dict[str, Any]]:
        series = pd.to_numeric(frame[target_column], errors="coerce").dropna()
        if series.empty:
            return []

        if len(series) < 3:
            return self._forecast_linear_regression(frame, target_column, date_column)

        model = ExponentialSmoothing(series, trend="add", seasonal=None, damped_trend=True, initialization_method="estimated")
        fit = model.fit()
        forecast = fit.forecast(self._forecast_periods)

        future_dates = self._generate_future_dates(frame, series.index, date_column)
        return [
            {"date": future_dates[idx], "prediction": float(value)}
            for idx, value in enumerate(forecast)
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
