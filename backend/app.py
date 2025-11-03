"""Main application factory for Forecast Alpha."""

from __future__ import annotations

from flask import Flask, jsonify, render_template

from .config import load_config, Config
from .api import api_bp


def create_app(config: Config | None = None) -> Flask:
    """Factory that creates the Flask application."""
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app_config = config or load_config()
    app.config.update(
        SECRET_KEY=app_config.SECRET_KEY,
        SQLALCHEMY_DATABASE_URI=app_config.SQLALCHEMY_DATABASE_URI,
        SQLALCHEMY_TRACK_MODIFICATIONS=app_config.SQLALCHEMY_TRACK_MODIFICATIONS,
        ENVIRONMENT=app_config.ENVIRONMENT,
    )
    app.config["APP_CONFIG"] = app_config

    @app.route("/", methods=["GET"])
    def index() -> str:
        """Serve the landing page."""
        return render_template("index.html")

    @app.route("/health", methods=["GET"])
    def health() -> tuple:
        """Simple endpoint Railway can use for health checks."""
        return jsonify(status="ok", environment=app.config["ENVIRONMENT"]), 200

    app.register_blueprint(api_bp)

    return app


app = create_app()


if __name__ == "__main__":
    current_config: Config = app.config["APP_CONFIG"]
    app.run(
        host="0.0.0.0",
        port=current_config.PORT,
        debug=current_config.ENVIRONMENT == "development",
    )
