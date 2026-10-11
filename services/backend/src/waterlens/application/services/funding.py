"""Funding catalogue reads and deterministic matching for a session's plan option."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from waterlens.application.idempotency import run_once
from waterlens.application.identity import RequestContext
from waterlens.application.pagination import (
    MAX_PAGE_SIZE,
    FilterValue,
    Page,
    PageArgs,
    page_query,
)
from waterlens.application.policies import owned_session
from waterlens.application.services.common import Deps, page_of
from waterlens.domain.errors import DomainError, ErrorCode, not_found
from waterlens.domain.funding import FundingMatch, FundingScheme, MatchFacts, evaluate_scheme
from waterlens.domain.ids import IdKind, new_id, require_id
from waterlens.domain.planning import Area, PlanOption
from waterlens.domain.values import Frozen

MAX_SCHEMES_PER_MATCH = 200


class MatchFundingInput(Frozen):
    session_id: str
    plan_option_id: str


class FundingService:
    def __init__(self, deps: Deps) -> None:
        self._d = deps

    def scheme(self, scheme_id: str) -> FundingScheme:
        scheme = self._d.store.funding_schemes.get(require_id(scheme_id, IdKind.FUNDING_SCHEME))
        if scheme is None:
            raise not_found("funding scheme")
        return scheme

    def schemes_by_id(self, scheme_ids: list[str]) -> dict[str, FundingScheme]:
        """Batched public read for list resolvers."""
        return self._d.store.funding_schemes.get_many(scheme_ids)

    def schemes(self, currency: str | None, page: PageArgs) -> Page[FundingScheme]:
        where: dict[str, FilterValue] = {} if currency is None else {"currency": currency}
        return page_of(self._d.store.funding_schemes, where, page)

    def matches(
        self, ctx: RequestContext, session_id: str, plan_option_id: str | None, page: PageArgs
    ) -> Page[FundingMatch]:
        principal = ctx.require_principal()
        session = owned_session(self._d.store, require_id(session_id, IdKind.SESSION), principal)
        where: dict[str, FilterValue] = {"session_id": session.id}
        if plan_option_id is not None:
            where["plan_option_id"] = require_id(plan_option_id, IdKind.PLAN_OPTION, "planOptionId")
        return page_of(self._d.store.funding_matches, where, page)

    def match(
        self, ctx: RequestContext, session_id: str, plan_option_id: str, idempotency_key: str
    ) -> tuple[FundingMatch, ...]:
        principal = ctx.require_principal()
        store, now = self._d.store, self._d.clock()
        session = owned_session(store, require_id(session_id, IdKind.SESSION), principal)
        option = store.plan_options.get(
            require_id(plan_option_id, IdKind.PLAN_OPTION, "planOptionId")
        )
        if option is None or option.session_id != session.id:
            raise DomainError(
                ErrorCode.VALIDATION_FAILED,
                "the plan is not part of this session",
                field="planOptionId",
            )
        area = store.areas.get(session.area_id) if session.area_id else None
        if area is None:
            raise DomainError(ErrorCode.PRECONDITION_FAILED, "choose a location first")
        facts = _facts(area, option, session.community_id is not None, now)
        payload = MatchFundingInput(session_id=session.id, plan_option_id=option.id)

        def create() -> tuple[str, ...]:
            ids: list[str] = []
            previous = self._existing_matches(session.id, option.id)
            for scheme in store.funding_schemes.all_active(MAX_SCHEMES_PER_MATCH):
                results, window = evaluate_scheme(scheme, facts)
                existing = previous.get(scheme.id)
                if existing is None:
                    saved = store.funding_matches.insert(
                        FundingMatch(
                            id=new_id(IdKind.FUNDING_MATCH),
                            owner_uid=principal.uid,
                            session_id=session.id,
                            plan_option_id=option.id,
                            scheme_id=scheme.id,
                            results=results,
                            window=window,
                            created_at=now,
                            updated_at=now,
                        )
                    )
                else:
                    saved = store.funding_matches.replace(
                        existing.model_copy(
                            update={"results": results, "window": window, "updated_at": now}
                        ),
                        existing.version,
                    )
                ids.append(saved.id)
            return tuple(ids)

        ids = store.transaction(
            lambda: run_once(
                store,
                uid=principal.uid,
                operation="matchFunding",
                key=idempotency_key,
                payload=payload,
                now=now,
                create=create,
            )
        )
        found = store.funding_matches.get_many(list(ids))
        return tuple(found[i] for i in ids if i in found)

    def _existing_matches(self, session_id: str, option_id: str) -> dict[str, FundingMatch]:
        """Every stored match for the plan, read in bounded pages instead of one query
        per scheme."""
        where: dict[str, FilterValue] = {"session_id": session_id, "plan_option_id": option_id}
        found: dict[str, FundingMatch] = {}
        after: str | None = None
        for _ in range(-(-MAX_SCHEMES_PER_MATCH // MAX_PAGE_SIZE)):
            page = self._d.store.funding_matches.page(
                where, page_query(MAX_PAGE_SIZE, after, where)
            )
            found |= {m.scheme_id: m for m in page.items}
            if not page.has_next_page:
                break
            after = page.end_cursor
        return found


def _facts(area: Area, option: PlanOption, in_community: bool, now: datetime) -> MatchFacts:
    return MatchFacts(
        country_code=area.country_code,
        plan_cost_high=option.cost.high if option.cost else None,
        in_community=in_community,
        local_today=now.astimezone(ZoneInfo(area.timezone)).date(),
    )
