"""Stub API endpoints for the demo workflow."""

from __future__ import annotations

from flask import current_app, jsonify, request

from . import api_bp


@api_bp.route("/connect", methods=["POST"])
def connect_database():
    """Mock endpoint that pretends to validate database credentials."""
    payload = request.get_json(silent=True) or {}
    current_app.logger.info("Received connect request: %s", payload)

    # TODO: Replace with real connection validation using SQLAlchemy engine.
    return jsonify(
        status="success",
        message="Connection parameters accepted.",
        connection_id="demo-connection-id",
    ), 200


@api_bp.route("/tables", methods=["GET"])
def list_tables():
    """Mock endpoint returning a list of available tables."""
    connection_id = request.args.get("connection_id")
    current_app.logger.info("Listing tables for connection %s", connection_id)

    # TODO: Replace with real table discovery logic.
    return jsonify(
        tables=[
            {"name": "sales", "columns": ["date", "region", "revenue"]},
            {"name": "inventory", "columns": ["sku", "category", "quantity"]},
        ]
    ), 200


@api_bp.route("/analyze", methods=["POST"])
def analyze_data():
    """Mock endpoint that returns placeholder anomaly and forecast data."""
    payload = request.get_json(silent=True) or {}
    current_app.logger.info("Analyze request payload: %s", payload)

    # TODO: Replace with the real preprocessing + modeling pipeline.
    return jsonify(
        anomalies=[
            {"timestamp": "2024-10-01", "metric": "revenue", "severity": "high"},
            {"timestamp": "2024-10-05", "metric": "revenue", "severity": "medium"},
        ],
        forecast={
            "metric": "revenue",
            "values": [
                {"date": "2024-10-06", "prediction": 120000},
                {"date": "2024-10-07", "prediction": 122500},
                {"date": "2024-10-08", "prediction": 125000},
            ],
        },
    ), 200
