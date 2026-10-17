"""Runtime ASGI entry point: ``uvicorn waterpilot.api.asgi:app``.

Importing this module loads and validates settings, so an unsafe configuration
fails closed before the server accepts requests.
"""

from __future__ import annotations

from waterpilot.api.main import create_app
from waterpilot.config import get_settings

app = create_app(get_settings())
