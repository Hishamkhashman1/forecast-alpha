"""Tests for utility helpers."""

from __future__ import annotations

from backend.utils import build_connection_url


def test_build_connection_url_encodes_credentials():
    url = build_connection_url(
        driver="mysql+pymysql",
        username="user name",
        password="p@ss word",
        host="localhost",
        port=3306,
        database="analytics",
        options={"charset": "utf8mb4"},
    )
    assert "user+name" in url
    assert "p%40ss+word" in url
    assert url.endswith("charset=utf8mb4")
