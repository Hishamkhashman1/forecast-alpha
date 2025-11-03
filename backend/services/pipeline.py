"""Data preprocessing pipeline service."""

from __future__ import annotations

from typing import Any
import pandas as pd


class DataPipelineService:
    """Runs cleaning and normalization steps on raw data frames."""

    def __init__(self) -> None:
        self._steps: list[str] = []

    def clean(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Apply basic cleaning operations."""
        df = frame.copy()

        before_rows = len(df)
        df = df.drop_duplicates()
        removed = before_rows - len(df)
        self._steps.append("drop_duplicates")
        if removed:
            self._steps.append(f"drop_duplicates_removed:{removed}")

        empty_columns = [col for col in df.columns if df[col].isna().all()]
        if empty_columns:
            df = df.drop(columns=empty_columns)
            self._steps.append(f"drop_empty_columns:{','.join(empty_columns)}")

        # Attempt to convert string columns that look like datetimes
        for column in df.select_dtypes(include=["object"]).columns:
            try:
                converted = pd.to_datetime(df[column], errors="raise")
            except (ValueError, TypeError):
                continue
            if converted.notna().any():
                df[column] = converted
                self._steps.append(f"parse_datetime:{column}")

        numeric_columns = df.select_dtypes(include=["number"]).columns
        if len(numeric_columns) > 0:
            medians = df[numeric_columns].median()
            df[numeric_columns] = df[numeric_columns].fillna(medians)
            self._steps.append("fill_numeric_missing:median")

        categorical_columns = df.select_dtypes(include=["object", "category"]).columns
        if len(categorical_columns) > 0:
            for column in categorical_columns:
                mode_series = df[column].mode(dropna=True)
                if not mode_series.empty:
                    df[column] = df[column].fillna(mode_series[0])
            self._steps.append("fill_categorical_missing:mode")

        return df

    def normalize(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Apply normalization/encoding to prepared data."""
        df = frame.copy()

        numeric_columns = df.select_dtypes(include=["number"]).columns
        standardized_columns: list[str] = []
        for column in numeric_columns:
            std = df[column].std(ddof=0)
            if std and std != 0:
                df[column] = (df[column] - df[column].mean()) / std
            else:
                df[column] = 0.0
            standardized_columns.append(column)

        if standardized_columns:
            self._steps.append(f"standard_scale:{','.join(standardized_columns)}")

        categorical_columns = df.select_dtypes(include=["object", "category"]).columns
        if len(categorical_columns) > 0:
            df = pd.get_dummies(df, columns=list(categorical_columns), drop_first=True)
            self._steps.append(f"one_hot_encode:{','.join(categorical_columns)}")

        return df

    def summary(self) -> list[str]:
        """Return the steps executed in this pipeline."""
        return self._steps.copy()
