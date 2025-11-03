"""API endpoints for the demo workflow."""

from __future__ import annotations

from flask import current_app, jsonify, request
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

    response_model = AnalysisResponse(
        anomalies=anomalies,
        forecast=forecast_points,
        pipeline_steps=pipeline.summary(),
    )

    return jsonify(status="success", **response_model.model_dump()), 200
