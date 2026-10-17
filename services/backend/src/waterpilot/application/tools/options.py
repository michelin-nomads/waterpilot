"""Scenario and plan-comparison tools for the planning agent (ADR 0012).

The agent may turn words such as "what if rainfall falls by 20%?" into structured
adjustments and call ``preview_scenario``; it never calculates an outcome itself. Every
number comes from ``OptionService``, the same service the GraphQL API uses, so a tool
can never accept a scenario the API refuses or rank plans differently. Exact values stay
strings, exactly as in the API.

Each option carries its wider-system impact (ADR 0013). A summary the agent writes about
it is shown only after ``check_impact_summary`` finds no problem: every sentence cites
the assessment, numbers come from it, and unknown impact is never called safe.
"""

from __future__ import annotations

from fractions import Fraction
from typing import Any

from waterpilot.application.identity import RequestContext
from waterpilot.application.services import Services
from waterpilot.application.services.options import Assessed, ScenarioView
from waterpilot.application.tools.goals import Tool
from waterpilot.domain import baseline as bl
from waterpilot.domain.impact import check_narrative
from waterpilot.domain.impact_records import OptionImpact
from waterpilot.domain.options import Comparison, Option

type Json = dict[str, Any]


def _exact(value: Fraction | None) -> Json | None:
    if value is None:
        return None
    return {"exact": bl.exact_text(value), "value": bl.decimal_text(value)}


def option_json(o: Option) -> Json:
    return {
        "id": o.id,
        "rank": o.rank,
        "name": o.name,
        "interventionIds": list(o.intervention_ids),
        "measures": [
            {
                "interventionId": m.intervention_id,
                "name": m.name,
                "waterLow": _exact(m.water_low),
                "waterHigh": _exact(m.water_high),
                "cost": m.cost.model_dump(mode="json") if m.cost else None,
                "recurring": m.recurring.model_dump(mode="json") if m.recurring else None,
                "buildDays": m.build_days.model_dump(mode="json") if m.build_days else None,
                "benefitTiming": m.benefit_timing,
            }
            for m in o.measures
        ],
        "pessimistic": _exact(o.pessimistic),
        "optimistic": _exact(o.optimistic),
        "margin": _exact(o.margin),
        "waterLow": _exact(o.water_low),
        "waterHigh": _exact(o.water_high),
        "uncountedHigh": _exact(o.uncounted_high),
        "cost": o.cost.model_dump(mode="json") if o.cost else None,
        "buildDays": o.build_days.model_dump(mode="json") if o.build_days else None,
        "firstBenefit": o.first_benefit,
        "economics": _camel(o.economics.model_dump(mode="json")) if o.economics else None,
        "why": o.why,
        "tradeoffs": list(o.tradeoffs),
        "uncertainty": list(o.uncertainty),
        "sensitivity": [
            {
                "interventionId": s.intervention_id,
                "key": s.key,
                "label": s.label,
                "swing": _exact(s.swing),
            }
            for s in o.sensitivity
        ],
        "stress": [
            {
                "key": s.key,
                "label": s.label,
                "value": _exact(s.value),
                "meetsTarget": s.meets_target,
            }
            for s in o.stress
        ],
    }


def comparison_json(c: Comparison) -> Json:
    return {
        "id": c.id,
        "engineVersion": c.engine_version,
        "scenarioEngineVersion": c.scenario_engine_version,
        "catalogueVersion": c.catalogue_version,
        "baselineId": c.baseline_id,
        "status": c.status,
        "summary": c.summary,
        "metric": c.metric,
        "unit": c.unit,
        "baselineValue": _exact(c.baseline_value),
        "scenarioValue": _exact(c.scenario_value),
        "targetLevel": _exact(c.target_level),
        "options": [option_json(o) for o in c.options],
        "needs": list(c.needs),
        "excluded": list(c.excluded),
        "rejections": {f: getattr(c.rejections, f) for f in c.rejections.__dataclass_fields__},
        "assumptions": list(c.assumptions),
        "ranking": c.ranking,
    }


def _camel(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            k.split("_")[0] + "".join(p.title() for p in k.split("_")[1:]): _camel(v)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_camel(v) for v in value]
    return value


def impact_json(i: OptionImpact) -> Json:
    data: Json = _camel(i.model_dump(mode="json"))
    return data


def assessed_json(a: Assessed) -> Json:
    data = comparison_json(a.comparison)
    for o in data["options"]:
        o["impact"] = impact_json(a.impact.options[o["id"]])
    return data


def scenario_json(v: ScenarioView) -> Json:
    return {
        "status": v.status,
        "rows": [
            {
                "key": r.key,
                "label": r.label,
                "unit": r.unit,
                "baseline": _exact(r.baseline),
                "scenario": _exact(r.scenario),
                "change": _exact(r.change),
                "reason": r.reason,
            }
            for r in v.rows
        ],
        "notes": list(v.notes),
        "baselineId": v.baseline_id,
        "engineVersion": v.engine_version,
    }


def compare_plans(services: Services, ctx: RequestContext, session_id: str) -> Json:
    """Up to three genuinely feasible options for the saved goal and confirmed scenario,
    each with its wider-system impact."""
    return assessed_json(services.options.assessed(ctx, session_id))


def preview_scenario(
    services: Services, ctx: RequestContext, session_id: str, scenario: Json
) -> Json:
    """Validate structured adjustments and compare them with the baseline, unsaved."""
    result = services.options.preview_scenario(ctx, session_id, scenario)
    return {
        "errors": [{"field": e.field, "message": e.message} for e in result.errors],
        "comparison": scenario_json(result.view) if result.view else None,
    }


def explain_option(
    services: Services, ctx: RequestContext, session_id: str, option_id: str
) -> Json:
    """One current option with its ranking rule, assumptions and uncertainty, or why it
    is no longer among the options."""
    a = services.options.assessed(ctx, session_id)
    c = a.comparison
    found = next((o for o in c.options if o.id == option_id), None)
    if found is None:
        return {
            "option": None,
            "reason": "This plan is not one of the options for the current inputs.",
            "comparisonId": c.id,
        }
    return {
        "option": option_json(found),
        "impact": impact_json(a.impact.options[found.id]),
        "ranking": c.ranking,
        "assumptions": list(c.assumptions),
        "comparisonId": c.id,
    }


def check_impact_summary(
    services: Services, ctx: RequestContext, session_id: str, option_id: str, text: str
) -> Json:
    """Check a written summary of one option's impact before it is shown. It must cite
    the assessment ([F:finding id] or [U:unavailable key]) in every sentence, use only
    its numbers, never certify drinking water and never turn unknown impact into safe."""
    a = services.options.assessed(ctx, session_id)
    impact = a.impact.options.get(option_id)
    if impact is None:
        return {
            "ok": False,
            "problems": ["This plan is not one of the options for the current inputs."],
            "impactId": None,
        }
    problems = check_narrative(text, impact)
    return {"ok": not problems, "problems": list(problems), "impactId": impact.id}


TOOLS: tuple[Tool, ...] = (
    Tool("compare_plans", "Compare up to three feasible plans for the saved goal.", compare_plans),
    Tool(
        "preview_scenario",
        "Check a what-if scenario against the same baseline without saving it.",
        preview_scenario,
    ),
    Tool("explain_option", "Explain one current plan option.", explain_option),
    Tool(
        "check_impact_summary",
        "Check a summary of an option's wider impact against its validated assessment.",
        check_impact_summary,
    ),
)
