"""Goal tools for the planning agent (ADR 0011).

No language model is connected yet. These are the typed functions an agent would call,
built on the same ``GoalService`` the GraphQL API uses, so a tool can never accept a goal
the API refuses or describe its feasibility differently. Results are JSON-safe; exact
values stay strings, exactly as in the API.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from fractions import Fraction
from typing import Any

from waterlens.application.identity import RequestContext
from waterlens.application.services import Services
from waterlens.domain import baseline as bl
from waterlens.domain.goals import Finding, Fit, GoalAssessment, InterventionFit
from waterlens.domain.interventions import Intervention

type Json = dict[str, Any]


def _exact(value: Fraction | None) -> Json | None:
    if value is None:
        return None
    return {"exact": bl.exact_text(value), "value": bl.decimal_text(value)}


def _finding(f: Finding) -> Json:
    return {"code": f.code, "outcome": f.outcome, "message": f.message}


def _fit(f: Fit | None) -> Json | None:
    return None if f is None else {"outcome": f.outcome, "message": f.message}


def _intervention(i: Intervention) -> Json:
    return i.model_dump(mode="json")


def _intervention_fit(f: InterventionFit) -> Json:
    return {
        "interventionId": f.intervention.id,
        "name": f.intervention.name,
        "relevant": f.relevant,
        "outcome": f.outcome,
        "site": _fit(f.site),
        "cost": _fit(f.cost),
        "time": _fit(f.time),
        "benefit": f.benefit,
        "preferred": f.preferred,
        "estimate": f.estimate.model_dump(mode="json") if f.estimate else None,
    }


def assessment_json(a: GoalAssessment) -> Json:
    t = a.target
    return {
        "outcome": a.outcome,
        "summary": a.summary,
        "target": {
            "outcome": t.outcome,
            "message": t.message,
            "metric": t.metric,
            "unit": t.unit,
            "baseline": _exact(t.baseline),
            "targetLevel": _exact(t.target_level),
            "caveats": list(t.caveats),
        },
        "constraints": [_finding(f) for f in a.constraints],
        "conflicts": [_finding(f) for f in a.conflicts],
        "interventions": [_intervention_fit(f) for f in a.interventions],
        "nextSteps": list(a.next_steps),
        "catalogueVersion": a.catalogue_version,
        "baselineId": a.baseline_id,
    }


def check_goal(services: Services, ctx: RequestContext, session_id: str, goal: Json) -> Json:
    """Validate and screen a draft goal (snake_case fields) without saving it."""
    result = services.goals.check(ctx, session_id, goal)
    return {
        "errors": [{"field": e.field, "message": e.message} for e in result.errors],
        "assessment": assessment_json(result.assessment) if result.assessment else None,
    }


def explain_goal_fit(services: Services, ctx: RequestContext, session_id: str) -> Json:
    """Why the saved goal is feasible, infeasible or not yet assessable."""
    found = services.goals.assessment(ctx, session_id)
    return {"assessment": assessment_json(found) if found else None}


def list_interventions(services: Services) -> Json:
    catalogue = services.goals.catalogue
    return {
        "version": catalogue.version,
        "interventions": [_intervention(i) for i in catalogue.interventions],
    }


@dataclass(frozen=True, slots=True)
class Tool:
    name: str
    description: str
    run: Callable[..., Json]


TOOLS: tuple[Tool, ...] = (
    Tool("check_goal", "Validate and screen a draft goal without saving it.", check_goal),
    Tool("explain_goal_fit", "Explain the saved goal's feasibility.", explain_goal_fit),
    Tool("list_interventions", "List the versioned intervention catalogue.", list_interventions),
)
