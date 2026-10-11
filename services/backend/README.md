# WaterLens backend

FastAPI modular monolith. Python is managed by **uv** (pinned to 3.12 via
`.python-version`). See the repo root `README.md` for the full command list.

## Layout
```
src/waterlens/
  config.py            # pydantic-settings; fail-closed startup validation
  domain/              # pure deterministic logic (no I/O)
  application/ports.py # ObjectStorage / JobRunner protocols, Job model
  adapters/            # local filesystem storage + file-backed local job runner
  api/main.py          # FastAPI app + /healthz, /readyz
  api/export_openapi.py# dumps OpenAPI for packages/contracts
  worker/main.py       # local worker: drains the job queue once
  cli/seed.py          # seeds SYNTHETIC fixtures into local object storage
tests/                 # pytest smoke + behaviour tests
```

## Common commands (run from this directory)
```bash
uv sync                                   # create venv + install (incl. dev group)
uv run uvicorn waterlens.api.main:app --reload --port 8000
uv run python -m waterlens.worker.main    # drain local job queue once
uv run python -m waterlens.cli.seed       # seed synthetic fixtures (local only)
uv run ruff check .                       # lint
uv run mypy src                           # type check (strict)
uv run pytest                             # tests
uv run python -m waterlens.api.export_openapi ../../packages/contracts/openapi.json
```

## Safety
- **Local mode requires emulators** and never touches real cloud services.
- **Pilot mode** fails closed if any emulator/test/demo setting is present.
- No service-account keys or secrets in code or `.env.example`; cloud auth uses ADC later.
- There are **no** official local emulators for Cloud Tasks / Vertex AI / Earth Engine;
  their adapters (later phases) require real configured credentials.
