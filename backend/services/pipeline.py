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
        # TODO: Implement configurable cleaning logic (drop NA, type casting, etc.).
        self._steps.append("clean")
        return frame

    def normalize(self, frame: pd.DataFrame) -> pd.DataFrame:
        """Apply normalization/encoding to prepared data."""
        # TODO: Implement scaling and encoding logic.
        self._steps.append("normalize")
        return frame

    def summary(self) -> list[str]:
        """Return the steps executed in this pipeline."""
        return self._steps.copy()
