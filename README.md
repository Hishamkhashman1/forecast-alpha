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

The suite currently includes placeholder tests under `tests/` that exercise the health endpoint and will expand alongside the data pipeline.

### API Blueprint (stub)

The `/api` blueprint currently exposes placeholder endpoints in `backend/api/routes.py`:

- `POST /api/connect` — logs connection details and returns a mock `connection_id`.
- `GET /api/tables` — returns sample table metadata.
- `POST /api/analyze` — returns dummy anomalies and forecast values.

Replace the TODOs with the real database, preprocessing, and modeling logic as the project evolves.

### Next Up

- Integrate real database connectivity and table discovery services.
- Flesh out automated tests to cover the data pipeline.
