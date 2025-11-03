## Forecast Alpha Backend

Fresh backend scaffold for the Forecast Alpha demo experience.

### Getting Started

Install the Python build tooling that Ubuntu needs to compile scientific packages (only once per machine):

```bash
sudo apt update
sudo apt install -y python3-venv python3-dev build-essential
```

1. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   python3 -m pip install --upgrade pip
   python3 -m pip install -r requirements.txt
   ```
3. Run the local server:
   ```bash
   export FLASK_APP=backend.app
   flask run --debug
   ```

Configuration values are pulled from environment variables. See `backend/config.py` for available settings (e.g., `SECRET_KEY`, `DATABASE_URL`, `ENVIRONMENT`).

### Running Tests

With the virtual environment active:

```bash
pytest
```

The suite exercises the health endpoint plus unit tests for the pipeline, analytics, and utility helpers. Extend these as the ML workflow matures.

### API Blueprint

The `/api` blueprint in `backend/api/routes.py` now wires the end-to-end workflow:

- `POST /api/connect` — validates credentials using SQLAlchemy and returns a connection token stored in-memory.
- `GET /api/tables` — reflects the connected database to list tables and columns.
- `POST /api/analyze` — pulls data into pandas, runs the cleaning pipeline, detects anomalies, and forecasts future values. Request payloads can specify `anomaly_method` (`zscore` or `isolation_forest`), `forecast_method` (`linear_regression` or `holt_winters`), thresholds, forecast periods, and `max_rows` safeguards for large datasets.

### Frontend demo

The landing page (`backend/templates/index.html`) adopts the refreshed marketing design and embeds a three-step demo:

- Step 1 collects database credentials and tests connectivity.
- Step 2 lets the user pick tables/columns and tune analysis parameters.
- Step 3 renders pipeline steps, anomalies, and forecast tables powered by the `/api` responses.

All styling lives under `backend/static/css/style.css`, and the interaction logic sits in `backend/static/js/demo.js`.

### Next Up

- Persist connection state (or swap in a managed secrets store) instead of the in-memory registry.
- Expand anomaly and forecast models with configurable strategies and performance monitoring.
- Build the front-end demo that consumes these endpoints.
