# Build from services/backend so uv.lock and the src tree are the complete context.
# Python and uv are version-pinned; Python patch images should be digest-pinned by the
# release owner after reviewing the selected base image provenance.
FROM python:3.12.15-slim-bookworm AS build

ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python -m pip install --no-cache-dir "uv==0.13.0"

WORKDIR /app
COPY pyproject.toml uv.lock ./
# Install only locked runtime dependencies. Avoid an isolated PEP 517 build whose
# hatchling build-system dependency is not part of the runtime lock.
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12.15-slim-bookworm AS runtime

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONPATH="/app/src" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

WORKDIR /app
COPY --from=build /opt/venv /opt/venv
COPY src ./src
EXPOSE 8080
USER 65532:65532

# Cloud Run worker service overrides this command with waterlens.worker.asgi:app.
CMD ["uvicorn", "waterlens.api.asgi:app", "--host", "0.0.0.0", "--port", "8080"]
