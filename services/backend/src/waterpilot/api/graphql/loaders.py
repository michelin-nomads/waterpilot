"""Per-request batched reads for list resolvers (no N+1 queries, ADR 0005).

Each loader batches the keys requested while one GraphQL level resolves into a single
service call (one ``get_all`` in Firestore). Loaders exist only for data the caller may
already see: public areas (plus the caller's own private locations), communities and
the caller's own memberships. Private records keep going through their authorizing service methods.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence

from starlette.concurrency import run_in_threadpool
from strawberry.dataloader import DataLoader

from waterpilot.application.identity import RequestContext
from waterpilot.application.services import Services
from waterpilot.domain.communities import Community, Membership
from waterpilot.domain.errors import not_found
from waterpilot.domain.funding import FundingScheme
from waterpilot.domain.planning import Area


def _loader[V](fetch: Callable[[list[str]], Mapping[str, V]]) -> DataLoader[str, V | None]:
    async def load(keys: Sequence[str]) -> list[V | None]:
        found = await run_in_threadpool(fetch, list(keys))
        return [found.get(key) for key in keys]

    return DataLoader(load_fn=load)


class Loaders:
    def __init__(self, services: Services, ctx: RequestContext) -> None:
        viewer = ctx.principal.uid if ctx.principal is not None else None
        self.area: DataLoader[str, Area | None] = _loader(
            lambda ids: services.areas.get_many(ids, viewer)
        )
        self.community: DataLoader[str, Community | None] = _loader(services.communities.get_many)
        self.funding_scheme: DataLoader[str, FundingScheme | None] = _loader(
            services.funding.schemes_by_id
        )
        self.viewer_membership: DataLoader[str, Membership | None] = _loader(
            lambda ids: services.communities.viewer_memberships(ctx, ids)
        )


async def load_existing[V](loader: DataLoader[str, V | None], key: str, kind: str) -> V:
    """Load a referenced record that must exist; a dangling reference is NOT_FOUND."""
    found = await loader.load(key)
    if found is None:
        raise not_found(kind)
    return found
