"""API endpoints for the demo workflow."""

from __future__ import annotations

import json
import math
import random
import time

import pandas as pd
from flask import Response, current_app, jsonify, request, stream_with_context
from pydantic import ValidationError

from backend.models.requests import AnalysisRequest, ConnectionRequest
from backend.models.responses import AnalysisResponse
from backend.services import (
    AnalyticsService,
    DataPipelineService,
    DatabaseService,
    registry,
)
from backend.utils import build_connection_url

from . import api_bp


def _resolve_database_url(connection_id: str) -> str | None:
    database_url = registry.resolve(connection_id)
    if not database_url:
        current_app.logger.error("Unknown connection id requested: %s", connection_id)
    return database_url


@api_bp.route("/connect", methods=["POST"])
def connect_database():
    """Validate database credentials and return a connection token."""
    payload = request.get_json(silent=True) or {}
    try:
        data = ConnectionRequest.model_validate(payload)
    except ValidationError as exc:
        return jsonify(status="error", errors=exc.errors()), 400

    database_url = data.engine_url or build_connection_url(
        driver=data.driver,
        username=data.username,
        password=data.password,
        host=data.host,
        port=data.port,
        database=data.database,
        options=data.options,
    )

    service = DatabaseService(database_url)
    try:
        service.validate_connection()
    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.exception("Database connection failed")
        return jsonify(status="error", message="Unable to connect to database", detail=str(exc)), 400

    token = registry.register(database_url)
    return jsonify(status="success", connection_id=token), 200


@api_bp.route("/tables", methods=["GET"])
def list_tables():
    """Return the tables available for a given connection id."""
    connection_id = request.args.get("connection_id")
    if not connection_id:
        return jsonify(status="error", message="connection_id is required"), 400

    database_url = _resolve_database_url(connection_id)
    if not database_url:
        return jsonify(status="error", message="Unknown connection_id"), 404

    service = DatabaseService(database_url)
    try:
        tables = service.list_tables()
    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.exception("Failed to list tables")
        return jsonify(status="error", message="Unable to list tables", detail=str(exc)), 500

    return jsonify(status="success", tables=tables), 200


@api_bp.route("/analyze", methods=["POST"])
def analyze_data():
    """Clean data, detect anomalies, and forecast trends for a selected table."""
    payload = request.get_json(silent=True) or {}
    try:
        data = AnalysisRequest.model_validate(payload)
    except ValidationError as exc:
        return jsonify(status="error", errors=exc.errors()), 400

    database_url = _resolve_database_url(data.connection_id)
    if not database_url:
        return jsonify(status="error", message="Unknown connection_id"), 404

    database_service = DatabaseService(database_url)
    rows_limit = data.limit
    if data.max_rows:
        rows_limit = min(rows_limit, data.max_rows)

    try:
        raw_frame = database_service.fetch_table(data.table, limit=rows_limit)
    except Exception as exc:  # pylint: disable=broad-except
        current_app.logger.exception("Failed to fetch table data")
        return jsonify(status="error", message="Unable to fetch table data", detail=str(exc)), 500

    missing_columns = [col for col in [data.target_column, data.date_column] if col and col not in raw_frame.columns]
    if missing_columns:
        return jsonify(status="error", message="Missing columns in dataset", missing_columns=missing_columns), 400

    pipeline = DataPipelineService()
    cleaned_frame = pipeline.clean(raw_frame)
    normalized_frame = pipeline.normalize(cleaned_frame)

    analytics = AnalyticsService(
        anomaly_threshold=data.anomaly_threshold,
        forecast_periods=data.forecast_periods,
        anomaly_method=data.anomaly_method,
        forecast_method=data.forecast_method,
        max_samples=data.max_rows,
    )
    anomalies = analytics.detect_anomalies(
        cleaned_frame,
        data.target_column,
        data.date_column,
        features=normalized_frame,
    )
    forecast_points = analytics.forecast(cleaned_frame, data.target_column, data.date_column)

    if data.date_column and data.date_column in cleaned_frame.columns:
        historical_frame = cleaned_frame[[data.date_column, data.target_column]].copy()
        historical_frame[data.date_column] = pd.to_datetime(historical_frame[data.date_column], errors="coerce")
        historical_frame = historical_frame.dropna(subset=[data.date_column])
        historical_frame = historical_frame.sort_values(by=data.date_column)
        historical_series = [
            {
                "date": row[data.date_column].isoformat(),
                "value": float(row[data.target_column]),
            }
            for _, row in historical_frame.iterrows()
        ]
    else:
        historical_series = [
            {
                "date": str(index),
                "value": float(value),
            }
            for index, value in cleaned_frame[data.target_column].items()
        ]

    response_model = AnalysisResponse(
        anomalies=anomalies,
        forecast=forecast_points,
        historical=historical_series,
        metrics={
            "rows_processed": int(len(cleaned_frame)),
            "anomalies_detected": len(anomalies),
            "forecast_horizon": len(forecast_points),
            "anomaly_method": data.anomaly_method,
            "forecast_method": data.forecast_method,
            "target_column": data.target_column,
        },
        pipeline_steps=pipeline.summary(),
    )

    return jsonify(status="success", **response_model.model_dump()), 200


@api_bp.route("/stream/live", methods=["GET"])
def stream_live_metric():
    """Server-sent events endpoint that streams simulated metric data."""

    def event_stream():
        amplitude = 12
        baseline = 120
        t = random.randint(0, 500)
        while True:
            seasonal = amplitude * math.sin(t / 12)
            noise = random.gauss(0, 2.5)
            value = baseline + seasonal + noise
            is_anomaly = False
            severity = "normal"
            if random.random() < 0.07:
                spike = random.choice([random.uniform(18, 35), random.uniform(-30, -15)])
                value += spike
                is_anomaly = True
                severity = "high" if spike > 0 else "medium"
            payload = {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
                "value": round(value, 3),
                "baseline": baseline,
                "seasonal": round(seasonal, 3),
                "is_anomaly": is_anomaly,
                "severity": severity,
            }
            yield f"data: {json.dumps(payload)}\n\n"
            time.sleep(1)
            t += 1

    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return Response(stream_with_context(event_stream()), headers=headers)
