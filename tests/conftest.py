"""Pytest fixtures for the backend."""

from __future__ import annotations

import pytest

from backend.app import create_app


@pytest.fixture()
def app():
    flask_app = create_app()
    flask_app.testing = True
    return flask_app


@pytest.fixture()
def client(app):
    return app.test_client()
