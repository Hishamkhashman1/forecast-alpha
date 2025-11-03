"""API package exposing blueprints."""

from flask import Blueprint

api_bp = Blueprint("api", __name__, url_prefix="/api")


def register_routes() -> None:
    """Import route modules so their handlers attach to the blueprint."""
    from . import routes  # noqa: F401  # pylint: disable=unused-import


register_routes()
