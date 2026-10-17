"""Application services shared by the GraphQL API, HTTP routes, worker and agents."""

from __future__ import annotations

from dataclasses import dataclass

from waterpilot.application.services.accounts import AccountService
from waterpilot.application.services.ai import AiGateway
from waterpilot.application.services.areas import AreaService
from waterpilot.application.services.baseline import BaselineService
from waterpilot.application.services.common import Deps
from waterpilot.application.services.communities import CommunityService
from waterpilot.application.services.funding import FundingService
from waterpilot.application.services.funding_catalogue import FundingCatalogueAdmin
from waterpilot.application.services.goals import GoalService
from waterpilot.application.services.jobs import JobService
from waterpilot.application.services.locations import LocationService
from waterpilot.application.services.options import OptionService
from waterpilot.application.services.readiness import ReadinessService
from waterpilot.application.services.reports import ProposalService, ReportService
from waterpilot.application.services.sessions import SessionService
from waterpilot.application.services.tracking import TrackingService


@dataclass(frozen=True, slots=True)
class Services:
    deps: Deps
    areas: AreaService
    locations: LocationService
    readiness: ReadinessService
    baseline: BaselineService
    sessions: SessionService
    goals: GoalService
    options: OptionService
    funding: FundingService
    funding_catalogue: FundingCatalogueAdmin
    reports: ReportService
    proposals: ProposalService
    communities: CommunityService
    tracking: TrackingService
    jobs: JobService
    accounts: AccountService
    ai: AiGateway

    @classmethod
    def build(cls, deps: Deps) -> Services:
        areas = AreaService(deps)
        readiness = ReadinessService(deps, areas)
        baseline = BaselineService(deps, readiness)
        options = OptionService(deps, baseline)
        return cls(
            deps=deps,
            accounts=AccountService(deps),
            areas=areas,
            locations=LocationService(deps),
            readiness=readiness,
            baseline=baseline,
            sessions=SessionService(deps, options),
            goals=GoalService(deps, baseline),
            options=options,
            funding=FundingService(deps),
            funding_catalogue=FundingCatalogueAdmin(deps),
            reports=ReportService(deps, options),
            proposals=ProposalService(deps),
            communities=CommunityService(deps),
            tracking=TrackingService(deps),
            jobs=JobService(deps),
            ai=AiGateway(deps),
        )


__all__ = ["Deps", "Services"]
