"""Funding catalogue reads and deterministic matching for a session's plan option."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from waterpilot.application.idempotency import run_once
from waterpilot.application.identity import RequestContext
from waterpilot.application.pagination import (
    MAX_PAGE_SIZE,
    FilterValue,
    Page,
    PageArgs,
    page_query,
)
from waterpilot.application.policies import owned_session
from waterpilot.application.services.common import Deps, page_of
from waterpilot.application.services.funding_ranking import FundingRanking
from waterpilot.domain.errors import DomainError, ErrorCode, not_found
from waterpilot.domain.funding import (
    MATCH_RULES_VERSION,
    ApplicantInformation,
    CatalogueStatus,
    FundingMatch,
    FundingScheme,
    MatchFacts,
    eligibility,
    evaluate_scheme,
)
from waterpilot.domain.ids import IdKind, new_id, require_id
from waterpilot.domain.planning import Area, PlanOption
from waterpilot.domain.values import Frozen

MAX_SCHEMES_PER_MATCH = 200


class MatchFundingInput(Frozen):
    session_id: str
    plan_option_id: str
    information: ApplicantInformation = ApplicantInformation()
    semantic_query: str = ""


class FundingService:
    def __init__(self, deps: Deps) -> None:
        self._d = deps
        self._ranking = FundingRanking(deps)

    def scheme(self, scheme_id: str) -> FundingScheme:
        scheme = self._d.store.funding_schemes.get(require_id(scheme_id, IdKind.FUNDING_SCHEME))
        if (
            scheme is None
            or scheme.status is CatalogueStatus.DRAFT
            or (scheme.status is CatalogueStatus.ACTIVE and not scheme.has_verified_source)
        ):
            raise not_found("funding scheme")
        return scheme.model_copy(update={"status": scheme.effective_status(self._d.clock())})

    def schemes_by_id(self, scheme_ids: list[str]) -> dict[str, FundingScheme]:
        """Batched public read for list resolvers."""
        now = self._d.clock()
        return {
            k: s.model_copy(update={"status": s.effective_status(now)})
            for k, s in self._d.store.funding_schemes.get_many(scheme_ids).items()
            if s.status is not CatalogueStatus.DRAFT
            and (s.status is not CatalogueStatus.ACTIVE or s.has_verified_source)
        }

    def schemes(self, currency: str | None, page: PageArgs) -> Page[FundingScheme]:
        where: dict[str, FilterValue] = {} if currency is None else {"currency": currency}
        result = page_of(self._d.store.funding_schemes, where, page)
        now = self._d.clock()
        return Page(
            tuple(
                s.model_copy(update={"status": s.effective_status(now)})
                for s in result.items
                if s.is_public_catalogue_entry
                and s.effective_status(now) in {CatalogueStatus.ACTIVE, CatalogueStatus.DEMO}
            ),
            result.has_next_page,
            result.end_cursor,
        )

    def matches(
        self, ctx: RequestContext, session_id: str, plan_option_id: str | None, page: PageArgs
    ) -> Page[FundingMatch]:
        principal = ctx.require_principal()
        session = owned_session(self._d.store, require_id(session_id, IdKind.SESSION), principal)
        where: dict[str, FilterValue] = {"session_id": session.id}
        if plan_option_id is not None:
            where["plan_option_id"] = require_id(plan_option_id, IdKind.PLAN_OPTION, "planOptionId")
        result = page_of(self._d.store.funding_matches, where, page)
        return Page(self._valid_matches(result.items), result.has_next_page, result.end_cursor)

    def match(
        self,
        ctx: RequestContext,
        session_id: str,
        plan_option_id: str,
        idempotency_key: str,
        information: ApplicantInformation | None = None,
        semantic_query: str = "",
    ) -> tuple[FundingMatch, ...]:
        information = information or ApplicantInformation()
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
        if option.inputs_revision != session.inputs_revision:
            raise DomainError(
                ErrorCode.PRECONDITION_FAILED, "plan inputs changed; choose a current plan"
            )
        if len(semantic_query) > 1000:
            raise DomainError(ErrorCode.VALIDATION_FAILED, "ranking query exceeds 1000 characters")
        facts = _facts(area, option, session.community_id is not None, now)
        payload = MatchFundingInput(
            session_id=session.id,
            plan_option_id=option.id,
            information=information,
            semantic_query=semantic_query,
        )

        def create() -> tuple[str, ...]:
            current = owned_session(store, session.id, principal)
            if current.inputs_revision != session.inputs_revision:
                raise DomainError(
                    ErrorCode.VERSION_CONFLICT, "planning inputs changed; recalculate matches"
                )
            ids: list[str] = []
            previous = self._existing_matches(session.id, option.id)
            for scheme in store.funding_schemes.all_active(MAX_SCHEMES_PER_MATCH):
                if not scheme.is_public_catalogue_entry or scheme.effective_status(now) not in {
                    CatalogueStatus.ACTIVE,
                    CatalogueStatus.DEMO,
                }:
                    continue
                publisher_facts = facts.model_copy(
                    update={
                        "local_today": now.astimezone(
                            ZoneInfo(scheme.deadline_timezone or area.timezone)
                        ).date()
                    }
                )
                results, window = evaluate_scheme(scheme, publisher_facts)
                decision, evidence = eligibility(
                    scheme, publisher_facts, information, now, option.intervention_ids
                )
                existing = previous.get(scheme.id)
                if existing is None:
                    saved = store.funding_matches.insert(
                        FundingMatch(
                            id=new_id(IdKind.FUNDING_MATCH),
                            owner_uid=principal.uid,
                            session_id=session.id,
                            plan_option_id=option.id,
                            scheme_id=scheme.id,
                            scheme_revision=scheme.revision,
                            inputs_revision=session.inputs_revision,
                            information=information,
                            eligibility=decision,
                            eligibility_evidence=evidence,
                            results=results,
                            window=window,
                            created_at=now,
                            updated_at=now,
                        )
                    )
                else:
                    saved = store.funding_matches.replace(
                        existing.model_copy(
                            update={
                                "results": results,
                                "window": window,
                                "updated_at": now,
                                "scheme_revision": scheme.revision,
                                "inputs_revision": session.inputs_revision,
                                "information": information,
                                "eligibility": decision,
                                "eligibility_evidence": evidence,
                                "rules_version": MATCH_RULES_VERSION,
                            }
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
        valid = self._valid_matches(tuple(found[i] for i in ids if i in found))
        ranked = self._ranking.rank(
            ctx, semantic_query, valid, store.funding_schemes.get_many([m.scheme_id for m in valid])
        )
        # A manual edit or withdrawal during ranking must never produce stale eligibility.
        refreshed = {m.id: m for m in self._valid_matches(ranked)}
        return tuple(refreshed[m.id] for m in ranked if m.id in refreshed)

    def _valid_matches(self, items: tuple[FundingMatch, ...]) -> tuple[FundingMatch, ...]:
        schemes = self._d.store.funding_schemes.get_many([m.scheme_id for m in items])
        now = self._d.clock()
        return tuple(
            self._refresh(m, s, now)
            for m in items
            if (s := schemes.get(m.scheme_id)) is not None
            and s.is_public_catalogue_entry
            and m.scheme_revision == s.revision
            and m.rules_version == MATCH_RULES_VERSION
            and self._current(m)
            and s.effective_status(now) in {CatalogueStatus.ACTIVE, CatalogueStatus.DEMO}
        )

    def _current(self, match: FundingMatch) -> bool:
        session = self._d.store.sessions.get(match.session_id)
        return session is not None and match.inputs_revision == session.inputs_revision

    def _refresh(self, match: FundingMatch, scheme: FundingScheme, now: datetime) -> FundingMatch:
        session = self._d.store.sessions.get(match.session_id)
        option = self._d.store.plan_options.get(match.plan_option_id)
        area = self._d.store.areas.get(session.area_id) if session and session.area_id else None
        if not session or not option or not area:
            return match
        facts = _facts(area, option, session.community_id is not None, now).model_copy(
            update={
                "local_today": now.astimezone(
                    ZoneInfo(scheme.deadline_timezone or area.timezone)
                ).date()
            }
        )
        decision, evidence = eligibility(
            scheme, facts, match.information, now, option.intervention_ids
        )
        return match.model_copy(update={"eligibility": decision, "eligibility_evidence": evidence})

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
        plan_cost_low=option.cost.low if option.cost else None,
        in_community=in_community,
        local_today=now.astimezone(ZoneInfo(area.timezone)).date(),
    )
