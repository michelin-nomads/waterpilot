"""Versioned intervention catalogue (ADR 0011).

Each entry states what a measure needs from the site, where it applies, what its cost
depends on, upkeep, permissions and when a benefit can first appear. It deliberately
holds no prices, durations, effect sizes or confidence: none has been reviewed for any
place, and a figure from one city is not valid elsewhere. Costs come only from a cited
source (none registered yet) or from the person's own estimate, labelled as such.

Prerequisites are generic physical necessities (a roof to collect from, ground to dig
into). Local rules differ, so permissions say what to check, not what is allowed.

Wider effects name the shared system a measure could affect beyond the site (an aquifer,
a catchment, a supply network), the possible direction and the mechanism, in words. They
carry no size: none is modelled. Whether a place shares that system with anyone else is
a question of connectivity evidence (``domain/impact.py``), never of the catalogue.
Professional reviews say which qualified check a measure needs and when.

The JSON copy in ``docs/domain/interventions.catalogue.json`` is generated from this
module (``waterlens.cli.intervention_catalogue``); a test checks it has not drifted.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Self

from pydantic import Field, model_validator

from waterlens.domain.planning import (
    INTERVENTION_ID,
    DayRange,
    GoalKind,
    SiteRestriction,
    SiteScale,
)
from waterlens.domain.systems import EffectDirection, ReviewKind, SharedSystem
from waterlens.domain.values import DecimalString, Frozen, Unit

CATALOGUE_VERSION = "interventions-3"


class InterventionFamily(StrEnum):
    RAINWATER_HARVESTING = "rainwater_harvesting"
    RECHARGE = "recharge"
    LEAKAGE_REDUCTION = "leakage_reduction"
    GREYWATER_REUSE = "greywater_reuse"
    DEMAND_CONSERVATION = "demand_conservation"
    STORAGE = "storage"
    STORMWATER = "stormwater"


class SiteRequirement(StrEnum):
    """A site fact the measure cannot work without."""

    ROOF_AREA = "roof_area"
    OPEN_GROUND = "open_ground"
    STORAGE_SPACE = "storage_space"
    PIPED_SUPPLY = "piped_supply"


REQUIREMENT_LABEL: dict[SiteRequirement, str] = {
    SiteRequirement.ROOF_AREA: "a roof whose rainwater can be collected",
    SiteRequirement.OPEN_GROUND: "open or unpaved ground that can be dug or opened",
    SiteRequirement.STORAGE_SPACE: "space for a tank",
    SiteRequirement.PIPED_SUPPLY: "a piped water supply",
}


class BenefitTiming(StrEnum):
    """Earliest plausible benefit, as a condition rather than a number of days."""

    AFTER_COMMISSIONING = "after_commissioning"
    AFTER_RAINFALL = "after_rainfall"
    AFTER_WET_SEASONS = "after_wet_seasons"


class CostInput(Frozen):
    """Something the cost depends on; the amount comes from a source or the person."""

    key: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    label: str


class EffectInput(Frozen):
    """Something a measure's water effect depends on. The value is always the person's
    own estimate range (or a site fact); the catalogue holds only the physical bounds."""

    key: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    label: str
    unit: Unit
    minimum: DecimalString
    maximum: DecimalString
    required: bool = True
    """False when a registered source can supply the value instead (e.g. rainfall)."""
    note: str = ""


class WiderEffect(Frozen):
    """A mechanism by which a measure could affect a shared system. No size: none is
    modelled, so it is always a possibility, never a result."""

    key: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    system: SharedSystem
    direction: EffectDirection
    mechanism: str = Field(min_length=1, max_length=400)
    """How the effect could arise, in plain words."""
    matters_when: str = Field(min_length=1, max_length=300)
    """The local condition that decides whether it matters."""


class ProfessionalReview(Frozen):
    kind: ReviewKind
    required: bool
    """True: needed before work starts. False: needed only in the stated case."""
    reason: str = Field(min_length=1, max_length=300)


class Intervention(Frozen):
    id: str = Field(pattern=INTERVENTION_ID)
    family: InterventionFamily
    name: str
    summary: str
    serves: tuple[GoalKind, ...] = Field(min_length=1)
    scales: tuple[SiteScale, ...] = Field(min_length=1)
    requires: tuple[SiteRequirement, ...] = ()
    blocked_by: tuple[SiteRestriction, ...] = ()
    permissions: tuple[str, ...] = Field(min_length=1)
    maintenance: tuple[str, ...] = Field(min_length=1)
    cost_inputs: tuple[CostInput, ...] = Field(min_length=1)
    cost_sources: tuple[str, ...] = ()
    """Registered source ids with reviewed local costs. Empty: no sourced cost exists."""
    construction: str
    """What building involves, in words."""
    construction_days: DayRange | None = None
    """Reviewed build duration; None until evidence exists (never a guess)."""
    benefit_timing: BenefitTiming
    benefit_note: str
    evidence: tuple[str, ...] = ()
    """Registered source ids for effect evidence. Empty: effect not evidenced here."""
    effect_model: str | None = None
    """Reviewed effect model id; None means the effect is not modelled."""
    effect_inputs: tuple[EffectInput, ...] = ()
    """What the option engine needs from the person to estimate a water effect. Empty:
    the effect is not quantified (e.g. recharge, which needs a groundwater model)."""
    cautions: tuple[str, ...] = ()
    wider_effects: tuple[WiderEffect, ...] = Field(default=(), max_length=6)
    reviews: tuple[ProfessionalReview, ...] = Field(default=(), max_length=3)

    @model_validator(mode="after")
    def _honest(self) -> Self:
        if self.effect_model is not None and not self.evidence:
            raise ValueError("an effect model needs registered evidence")
        if self.construction_days is not None and not self.evidence:
            raise ValueError("a construction duration needs registered evidence")
        if len({e.key for e in self.wider_effects}) != len(self.wider_effects):
            raise ValueError("each wider effect is listed once")
        kinds = {r.kind for r in self.reviews if r.required}
        if len({r.kind for r in self.reviews}) != len(self.reviews):
            raise ValueError("each review kind is listed once")
        if (
            self.family is InterventionFamily.RECHARGE
            and not {
                ReviewKind.HYDROGEOLOGICAL,
                ReviewKind.WATER_QUALITY,
            }
            <= kinds
        ):
            raise ValueError("recharge needs required hydrogeological and water-quality reviews")
        if self.family is InterventionFamily.GREYWATER_REUSE and ReviewKind.WATER_QUALITY not in (
            kinds
        ):
            raise ValueError("greywater reuse needs a required water-quality review")
        return self


class Catalogue(Frozen):
    version: str
    interventions: tuple[Intervention, ...]

    @model_validator(mode="after")
    def _unique(self) -> Self:
        ids = [i.id for i in self.interventions]
        if len(set(ids)) != len(ids):
            raise ValueError("intervention ids are unique")
        return self

    def get(self, intervention_id: str) -> Intervention | None:
        return next((i for i in self.interventions if i.id == intervention_id), None)


_CHECK_LOCAL = "Check local building, water and planning rules before work starts."
_S = SiteScale
_G = GoalKind
_R = SiteRestriction
_Q = SiteRequirement
_W = WiderEffect
_SYS = SharedSystem
_DIR = EffectDirection
_REV = ProfessionalReview
_K = ReviewKind
_SHARED_DRAW = _W(
    key="less_draw_on_shared_supply",
    system=_SYS.SUPPLY_NETWORK,
    direction=_DIR.POSSIBLE_BENEFIT,
    mechanism="Drawing less from a shared supply can leave more water or pressure for "
    "others on the same network.",
    matters_when="The site is on a supply network that others also depend on.",
)
_RECHARGE_ADDS = _W(
    key="adds_to_groundwater",
    system=_SYS.AQUIFER,
    direction=_DIR.POSSIBLE_BENEFIT,
    mechanism="Water soaking into the ground may add to groundwater that others also draw on.",
    matters_when="The ground lets water through and the aquifer below is used by others.",
)
_RECHARGE_POLLUTES = _W(
    key="contaminants_into_groundwater",
    system=_SYS.AQUIFER,
    direction=_DIR.POSSIBLE_HARM,
    mechanism="Runoff that is not clean can carry contaminants into groundwater that "
    "others may drink.",
    matters_when="The runoff picks up pollution, or wells nearby draw from shallow groundwater.",
)

CATALOGUE = Catalogue(
    version=CATALOGUE_VERSION,
    interventions=(
        Intervention(
            id="rooftop_rainwater_harvesting",
            family=InterventionFamily.RAINWATER_HARVESTING,
            name="Rooftop rainwater harvesting for use",
            summary="Collect roof runoff through gutters and a first-flush diverter into a "
            "tank for later use.",
            serves=(_G.REDUCE_SHORTAGE, _G.REDUCE_TANKER_DEPENDENCE, _G.REDUCE_WATER_BILLS),
            scales=(_S.HOUSEHOLD, _S.BUILDING, _S.NEIGHBOURHOOD),
            requires=(_Q.ROOF_AREA, _Q.STORAGE_SPACE),
            permissions=(_CHECK_LOCAL, "Some places require harvesting on new buildings."),
            maintenance=(
                "Clean gutters, filter and first-flush diverter before and during the "
                "rainy season.",
                "Keep the tank covered and clean it periodically.",
            ),
            cost_inputs=(
                CostInput(key="roof_area_connected", label="Roof area connected (square metres)"),
                CostInput(key="tank_volume", label="Tank volume (litres)"),
                CostInput(key="filtration", label="Filter and first-flush parts"),
                CostInput(key="labour", label="Labour and plumbing"),
            ),
            effect_inputs=(
                EffectInput(
                    key="collection_efficiency",
                    label="Share of roof rainfall that reaches the tank and is used",
                    unit=Unit.RATIO,
                    minimum="0",
                    maximum="1",
                    note="Losses from first flush, spills and overflow when the tank is full.",
                ),
                EffectInput(
                    key="annual_rainfall",
                    label="Rainfall in a typical year (millimetres)",
                    unit=Unit.MILLIMETRE,
                    minimum="0",
                    maximum="20000",
                    required=False,
                    note="Used only when no rainfall source covers a full year here.",
                ),
            ),
            construction="Gutters, downpipes, a filter and a tank; no excavation unless "
            "the tank is underground.",
            benefit_timing=BenefitTiming.AFTER_RAINFALL,
            benefit_note="Water is available only after rain falls once the system is "
            "built; supply in dry months depends on tank size.",
            cautions=("Harvested water used for drinking needs treatment and testing.",),
            wider_effects=(
                _W(
                    key="less_runoff_downstream",
                    system=_SYS.CATCHMENT,
                    direction=_DIR.EITHER,
                    mechanism="Less roof runoff reaches drains: this can ease local flooding, "
                    "and can also reduce water reaching streams or recharge downstream.",
                    matters_when="Many roofs in the catchment harvest, or downstream users "
                    "rely on that runoff.",
                ),
            ),
            reviews=(
                _REV(
                    kind=_K.WATER_QUALITY,
                    required=False,
                    reason="Before harvested water is used for drinking or cooking.",
                ),
                _REV(
                    kind=_K.STRUCTURAL,
                    required=False,
                    reason="If the tank sits on a roof or is built underground.",
                ),
            ),
        ),
        Intervention(
            id="rooftop_recharge_pit",
            family=InterventionFamily.RECHARGE,
            name="Rooftop runoff recharge pit",
            summary="Route filtered roof runoff into a pit or trench so it soaks into the ground.",
            serves=(_G.IMPROVE_GROUNDWATER, _G.REDUCE_FLOOD_RISK),
            scales=(_S.HOUSEHOLD, _S.BUILDING, _S.NEIGHBOURHOOD),
            requires=(_Q.ROOF_AREA, _Q.OPEN_GROUND),
            blocked_by=(_R.NO_RECHARGE, _R.NO_EXCAVATION),
            permissions=(_CHECK_LOCAL,),
            maintenance=("Clean the filter media and remove silt after heavy rain.",),
            cost_inputs=(
                CostInput(key="pit_volume", label="Pit or trench size"),
                CostInput(key="filter_media", label="Filter media"),
                CostInput(key="labour", label="Digging and labour"),
            ),
            construction="Excavate a pit or trench, fill with filter media, connect downpipes.",
            benefit_timing=BenefitTiming.AFTER_WET_SEASONS,
            benefit_note="Any groundwater response builds up over one or more wet "
            "seasons and is not guaranteed locally.",
            cautions=(
                "Only roof water: keep away from sewage, septic tanks and polluted runoff.",
                "Recharge can carry contaminants into groundwater without filtering.",
            ),
            wider_effects=(_RECHARGE_ADDS, _RECHARGE_POLLUTES),
            reviews=(
                _REV(
                    kind=_K.HYDROGEOLOGICAL,
                    required=True,
                    reason="Check the soil takes water and the water table is deep enough.",
                ),
                _REV(
                    kind=_K.WATER_QUALITY,
                    required=True,
                    reason="Check the runoff is clean enough to put into the ground.",
                ),
            ),
        ),
        Intervention(
            id="recharge_well",
            family=InterventionFamily.RECHARGE,
            name="Recharge well or shaft",
            summary="A deeper shaft that lets filtered runoff reach permeable layers.",
            serves=(_G.IMPROVE_GROUNDWATER, _G.REDUCE_FLOOD_RISK),
            scales=(_S.BUILDING, _S.NEIGHBOURHOOD, _S.UTILITY),
            requires=(_Q.OPEN_GROUND,),
            blocked_by=(_R.NO_RECHARGE, _R.NO_EXCAVATION, _R.NO_PERMIT_WORKS),
            permissions=(
                _CHECK_LOCAL,
                "Deep shafts often need approval from the local water or groundwater authority.",
            ),
            maintenance=("Desilt the shaft and renew the filter periodically.",),
            cost_inputs=(
                CostInput(key="depth", label="Shaft depth"),
                CostInput(key="lining", label="Lining and filter"),
                CostInput(key="labour", label="Drilling or digging"),
            ),
            construction="Drill or dig a lined shaft with a silt trap and filter.",
            benefit_timing=BenefitTiming.AFTER_WET_SEASONS,
            benefit_note="Depends on soil and aquifer conditions that need a local survey.",
            cautions=("Needs a site survey of soil, aquifer and nearby pollution sources.",),
            wider_effects=(_RECHARGE_ADDS, _RECHARGE_POLLUTES),
            reviews=(
                _REV(
                    kind=_K.HYDROGEOLOGICAL,
                    required=True,
                    reason="A shaft reaches deeper layers directly; the aquifer and nearby "
                    "wells need a survey.",
                ),
                _REV(
                    kind=_K.WATER_QUALITY,
                    required=True,
                    reason="Water entering a shaft bypasses soil filtering.",
                ),
                _REV(
                    kind=_K.STRUCTURAL,
                    required=True,
                    reason="Drilling or digging and lining a shaft.",
                ),
            ),
        ),
        Intervention(
            id="leak_detection_and_repair",
            family=InterventionFamily.LEAKAGE_REDUCTION,
            name="Leak detection and repair",
            summary="Find and fix leaks in pipes, tanks, valves and fittings.",
            serves=(_G.REDUCE_SHORTAGE, _G.REDUCE_TANKER_DEPENDENCE, _G.REDUCE_WATER_BILLS),
            scales=(_S.HOUSEHOLD, _S.BUILDING, _S.NEIGHBOURHOOD, _S.UTILITY),
            requires=(_Q.PIPED_SUPPLY,),
            permissions=(
                "Work on public mains is for the utility; private pipes are the owner's.",
            ),
            maintenance=("Repeat checks periodically; leaks recur as pipes age.",),
            cost_inputs=(
                CostInput(key="survey", label="Leak survey"),
                CostInput(key="repairs", label="Repairs and parts"),
            ),
            effect_inputs=(
                EffectInput(
                    key="leakage_share",
                    label="Share of piped supply lost to leaks",
                    unit=Unit.RATIO,
                    minimum="0",
                    maximum="1",
                    note="From a water audit or meter comparison.",
                ),
                EffectInput(
                    key="recovered_share",
                    label="Share of those losses the repairs stop",
                    unit=Unit.RATIO,
                    minimum="0",
                    maximum="1",
                    note="Repairs rarely stop every leak.",
                ),
            ),
            construction="A survey, then repairs; buried pipes may need digging.",
            benefit_timing=BenefitTiming.AFTER_COMMISSIONING,
            benefit_note="Savings start once repairs are done; their size depends on how "
            "much is leaking, which needs measuring.",
            cautions=("Without metering the leak volume, savings cannot be estimated.",),
            wider_effects=(
                _W(
                    key="water_kept_in_network",
                    system=_SYS.SUPPLY_NETWORK,
                    direction=_DIR.POSSIBLE_BENEFIT,
                    mechanism="Water no longer lost to leaks can stay in the network for others.",
                    matters_when="The leaks are on pipes shared with others.",
                ),
                _W(
                    key="less_leakage_recharge",
                    system=_SYS.AQUIFER,
                    direction=_DIR.POSSIBLE_HARM,
                    mechanism="Leaking pipes can feed shallow groundwater; stopping them may "
                    "lower it slightly where they did.",
                    matters_when="Shallow wells nearby depend on water from leaking pipes.",
                ),
            ),
        ),
        Intervention(
            id="greywater_reuse",
            family=InterventionFamily.GREYWATER_REUSE,
            name="Greywater reuse",
            summary="Treat water from basins, showers and laundry for non-drinking uses "
            "such as toilet flushing or gardens.",
            serves=(_G.REDUCE_SHORTAGE, _G.REDUCE_TANKER_DEPENDENCE, _G.REDUCE_WATER_BILLS),
            scales=(_S.HOUSEHOLD, _S.BUILDING, _S.NEIGHBOURHOOD),
            requires=(_Q.STORAGE_SPACE,),
            blocked_by=(_R.NO_GREYWATER_REUSE, _R.NO_STRUCTURAL_CHANGES),
            permissions=(_CHECK_LOCAL, "Reuse rules and treatment standards vary by place."),
            maintenance=(
                "Regular cleaning of filters and treatment units.",
                "Periodic water-quality checks.",
            ),
            cost_inputs=(
                CostInput(key="separate_plumbing", label="Separate plumbing"),
                CostInput(key="treatment_unit", label="Treatment unit"),
                CostInput(key="operation", label="Power and upkeep"),
            ),
            effect_inputs=(
                EffectInput(
                    key="reuse_share",
                    label="Share of remaining water use that treated greywater can replace",
                    unit=Unit.RATIO,
                    minimum="0",
                    maximum="1",
                    note="Typically flushing and garden use only.",
                ),
            ),
            construction="Separate drain and supply pipes, a treatment unit and a tank.",
            benefit_timing=BenefitTiming.AFTER_COMMISSIONING,
            benefit_note="Savings start once the system runs.",
            cautions=("Never for drinking or cooking.", "Poor treatment is a health risk."),
            wider_effects=(
                _W(
                    key="less_return_flow",
                    system=_SYS.CATCHMENT,
                    direction=_DIR.EITHER,
                    mechanism="Less wastewater returns to drains or sewers, which can change "
                    "the flow others downstream receive.",
                    matters_when="Downstream users or treatment works rely on that flow.",
                ),
            ),
            reviews=(
                _REV(
                    kind=_K.WATER_QUALITY,
                    required=True,
                    reason="The treatment must meet the local reuse standard for its use.",
                ),
            ),
        ),
        Intervention(
            id="efficient_fixtures",
            family=InterventionFamily.DEMAND_CONSERVATION,
            name="Water-efficient fixtures",
            summary="Low-flow taps and showers, dual-flush toilets and similar fittings.",
            serves=(_G.REDUCE_SHORTAGE, _G.REDUCE_TANKER_DEPENDENCE, _G.REDUCE_WATER_BILLS),
            scales=(_S.HOUSEHOLD, _S.BUILDING),
            permissions=("Usually none for replacing fittings.",),
            maintenance=("Clean aerators; replace worn seals.",),
            cost_inputs=(
                CostInput(key="fixture_count", label="Number of fixtures"),
                CostInput(key="fixture_price", label="Price per fixture"),
                CostInput(key="labour", label="Fitting labour"),
            ),
            effect_inputs=(
                EffectInput(
                    key="demand_reduction",
                    label="Share of water use the fixtures save",
                    unit=Unit.RATIO,
                    minimum="0",
                    maximum="1",
                    note="Depends on which fixtures are replaced and how they are used.",
                ),
            ),
            construction="Replace fittings.",
            benefit_timing=BenefitTiming.AFTER_COMMISSIONING,
            benefit_note="Savings start once fittings are replaced; their size depends on "
            "current use.",
            wider_effects=(_SHARED_DRAW,),
        ),
        Intervention(
            id="metering_and_demand_awareness",
            family=InterventionFamily.DEMAND_CONSERVATION,
            name="Metering and demand awareness",
            summary="Meter use and share it so households can see and reduce consumption.",
            serves=(_G.REDUCE_SHORTAGE, _G.REDUCE_TANKER_DEPENDENCE, _G.REDUCE_WATER_BILLS),
            scales=(_S.BUILDING, _S.NEIGHBOURHOOD, _S.UTILITY),
            requires=(_Q.PIPED_SUPPLY,),
            permissions=(_CHECK_LOCAL, "Meters on utility connections are the utility's."),
            maintenance=("Read and maintain meters; keep sharing results.",),
            cost_inputs=(
                CostInput(key="meters", label="Meters"),
                CostInput(key="installation", label="Installation"),
                CostInput(key="outreach", label="Outreach"),
            ),
            effect_inputs=(
                EffectInput(
                    key="demand_reduction",
                    label="Share of water use saved by metering and feedback",
                    unit=Unit.RATIO,
                    minimum="0",
                    maximum="1",
                    note="Savings can fade without continued feedback.",
                ),
            ),
            construction="Install meters and set up reading and feedback.",
            benefit_timing=BenefitTiming.AFTER_COMMISSIONING,
            benefit_note="Any saving depends on how people respond and is not assumed.",
            wider_effects=(_SHARED_DRAW,),
        ),
        Intervention(
            id="storage_tank",
            family=InterventionFamily.STORAGE,
            name="Additional storage",
            summary="More tank capacity to bridge gaps between supply days.",
            serves=(_G.REDUCE_SHORTAGE, _G.REDUCE_TANKER_DEPENDENCE),
            scales=(_S.HOUSEHOLD, _S.BUILDING, _S.NEIGHBOURHOOD),
            requires=(_Q.STORAGE_SPACE,),
            permissions=(_CHECK_LOCAL, "Rooftop tanks may need a structural check."),
            maintenance=("Keep covered; clean periodically.",),
            cost_inputs=(
                CostInput(key="tank_volume", label="Tank volume (litres)"),
                CostInput(key="installation", label="Base, plumbing and installation"),
            ),
            construction="Install a tank and connect it.",
            benefit_timing=BenefitTiming.AFTER_COMMISSIONING,
            benefit_note="Storage shifts when water is available; it adds no water.",
            cautions=("Does not increase total supply.",),
            wider_effects=(
                _W(
                    key="filling_lowers_pressure",
                    system=_SYS.SUPPLY_NETWORK,
                    direction=_DIR.POSSIBLE_HARM,
                    mechanism="Filling large tanks while supply runs can lower pressure for "
                    "others on the same network.",
                    matters_when="Supply is intermittent and shared, and many tanks fill at once.",
                ),
            ),
            reviews=(
                _REV(
                    kind=_K.STRUCTURAL,
                    required=False,
                    reason="If the tank sits on a roof or raised stand.",
                ),
            ),
        ),
        Intervention(
            id="stormwater_detention_and_permeable_surfaces",
            family=InterventionFamily.STORMWATER,
            name="Stormwater detention and permeable surfaces",
            summary="Slow and hold storm runoff with permeable paving, swales or detention areas.",
            serves=(_G.REDUCE_FLOOD_RISK, _G.IMPROVE_GROUNDWATER),
            scales=(_S.BUILDING, _S.NEIGHBOURHOOD, _S.UTILITY),
            requires=(_Q.OPEN_GROUND,),
            blocked_by=(_R.NO_EXCAVATION,),
            permissions=(
                _CHECK_LOCAL,
                "Changes to drains or public land need the local authority.",
            ),
            maintenance=("Clear silt and litter; keep surfaces permeable.",),
            cost_inputs=(
                CostInput(key="area_treated", label="Area treated (square metres)"),
                CostInput(key="materials", label="Materials"),
                CostInput(key="labour", label="Labour"),
            ),
            construction="Earthworks and paving changes.",
            benefit_timing=BenefitTiming.AFTER_RAINFALL,
            benefit_note="Effect appears in storms after construction; its size needs "
            "local drainage data.",
            wider_effects=(
                _W(
                    key="slower_runoff_downstream",
                    system=_SYS.CATCHMENT,
                    direction=_DIR.EITHER,
                    mechanism="Holding storm runoff can reduce flooding downstream, and it "
                    "also delays or reduces water reaching downstream channels.",
                    matters_when="Downstream areas flood, or rely on storm flows.",
                ),
                _W(
                    key="urban_runoff_into_groundwater",
                    system=_SYS.AQUIFER,
                    direction=_DIR.POSSIBLE_HARM,
                    mechanism="Street and yard runoff soaking in can carry oil, metals and "
                    "other pollutants into groundwater.",
                    matters_when="The runoff comes from roads or polluted surfaces, or "
                    "wells draw from shallow groundwater nearby.",
                ),
            ),
            reviews=(
                _REV(
                    kind=_K.STRUCTURAL,
                    required=True,
                    reason="Earthworks and changes to drainage.",
                ),
                _REV(
                    kind=_K.HYDROGEOLOGICAL,
                    required=False,
                    reason="Where runoff is meant to soak in near wells.",
                ),
            ),
        ),
    ),
)
