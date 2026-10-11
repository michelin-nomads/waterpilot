"""Runtime ASGI entry point: ``uvicorn waterlens.api.asgi:app``.

Importing this module loads and validates settings, so an unsafe configuration
fails closed before the server accepts requests.
"""

from __future__ import annotations

from waterlens.api.main import create_app
from waterlens.config import get_settings

app = create_app(get_settings())
