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

- The landing page (`backend/templates/index.html`) keeps the marketing content and links out to a dedicated demo window (`/demo`).
- `backend/templates/demo.html` walks users through registration → connection → configuration → insight review in a guided four-step flow, opened in a new tab when visitors click “Launch Demo”.
- Styling lives in `backend/static/css/style.css`, interaction logic in `backend/static/js/demo.js` (loaded only on the demo page). The introduction form simply captures details in-memory to gate the rest of the demo—no data is persisted.

### Next Up

- Persist connection state (or swap in a managed secrets store) instead of the in-memory registry.
- Expand anomaly and forecast models with configurable strategies and performance monitoring.
- Build the front-end demo that consumes these endpoints.
