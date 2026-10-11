"""WaterLens backend — modular monolith.

Boundaries (dependencies point inward: api/worker -> application -> domain;
adapters implement ports defined by application/domain):

- ``waterlens.api``         HTTP entry point (FastAPI).
- ``waterlens.worker``      Private worker entry point (durable jobs).
- ``waterlens.application`` Use-cases, ports (protocols), orchestration.
- ``waterlens.domain``      Pure deterministic logic. No I/O, no SDKs.
- ``waterlens.adapters``    Concrete infrastructure (local storage, local jobs, ...).
"""

__version__ = "0.1.0"
