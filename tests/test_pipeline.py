"""Tests for the data pipeline service."""

from __future__ import annotations

import pandas as pd

from backend.services import DataPipelineService


def test_pipeline_clean_and_normalize():
    frame = pd.DataFrame(
        {
            "id": [1, 1, 2, 3],
            "value": [10, 10, None, 40],
            "category": ["A", None, "B", "B"],
        }
    )

    pipeline = DataPipelineService()
    cleaned = pipeline.clean(frame)
    normalized = pipeline.normalize(cleaned)

    assert "drop_duplicates" in pipeline.summary()
    assert normalized.shape[0] == cleaned.shape[0]
