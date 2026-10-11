"""Area reads. Catalogue areas and searched places are public; device and typed-in
locations are visible to their owner only (ADR 0009). Coverage comes from
``ReadinessService``."""

from __future__ import annotations

from waterlens.application.identity import RequestContext
from waterlens.application.pagination import Page, PageArgs
from waterlens.application.services.common import Deps
from waterlens.domain.errors import DomainError, ErrorCode, not_found
from waterlens.domain.ids import IdKind, require_id
from waterlens.domain.planning import Area


def viewer_uid(ctx: RequestContext) -> str | None:
    return ctx.principal.uid if ctx.principal is not None else None


class AreaService:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    def get(self, area_id: str, viewer: str | None = None) -> Area:
        """A location ``viewer`` (a uid, or ``None`` when signed out) may read; a private
        location of someone else is NOT_FOUND, like a missing one."""
        area = self._d.store.areas.get(require_id(area_id, IdKind.AREA))
        if area is None or not area.visible_to(viewer):
            raise not_found("location")
        return area

    def get_many(self, area_ids: list[str], viewer: str | None = None) -> dict[str, Area]:
        """Batched read for list resolvers; omits locations ``viewer`` may not read."""
        found = self._d.store.areas.get_many(area_ids)
        return {k: a for k, a in found.items() if a.visible_to(viewer)}

    def search(self, text: str, page: PageArgs) -> Page[Area]:
        prefix = text.strip()
        if not 2 <= len(prefix) <= 100:
            raise DomainError(
                ErrorCode.VALIDATION_FAILED, "search text must be 2-100 characters", field="query"
            )
        return self._d.store.areas.search(prefix, page.bind({"name_prefix": prefix.casefold()}))
