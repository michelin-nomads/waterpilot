"""Shared water systems, effect directions and professional review kinds.

Kept free of other domain imports so the catalogue, the stored impact records and the
planning records can all use them (ADR 0013).
"""

from __future__ import annotations

from enum import StrEnum


class SharedSystem(StrEnum):
    """A system that can carry a measure's effect beyond the site."""

    AQUIFER = "aquifer"
    CATCHMENT = "catchment"
    """Surface runoff, drains and the streams they feed."""
    SUPPLY_NETWORK = "supply_network"
    """Shared piped supply and the infrastructure behind it."""


SYSTEM_LABEL: dict[SharedSystem, str] = {
    SharedSystem.AQUIFER: "groundwater aquifer",
    SharedSystem.CATCHMENT: "surface catchment and drains",
    SharedSystem.SUPPLY_NETWORK: "shared supply network",
}


class EffectDirection(StrEnum):
    POSSIBLE_BENEFIT = "possible_benefit"
    POSSIBLE_HARM = "possible_harm"
    EITHER = "either"
    """Could help or harm depending on local conditions."""


class ReviewKind(StrEnum):
    STRUCTURAL = "structural"
    """Construction: loads, excavation, shafts, earthworks."""
    HYDROGEOLOGICAL = "hydrogeological"
    """Soil, water table and aquifer suitability for putting water into the ground."""
    WATER_QUALITY = "water_quality"
    """Testing and treatment before water is used or put into the ground."""


REVIEW_LABEL: dict[ReviewKind, str] = {
    ReviewKind.STRUCTURAL: "structural or civil engineer",
    ReviewKind.HYDROGEOLOGICAL: "hydrogeologist or groundwater authority",
    ReviewKind.WATER_QUALITY: "accredited water-quality laboratory or public-health engineer",
}
