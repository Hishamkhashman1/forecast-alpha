from flask import Flask, jsonify
import os


def create_app() -> Flask:
    """Factory that creates the Flask application."""
    app = Flask(__name__)

    @app.route("/health", methods=["GET"])
    def health() -> tuple:
        """Simple endpoint Railway can use for health checks."""
        return jsonify(status="ok"), 200

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
