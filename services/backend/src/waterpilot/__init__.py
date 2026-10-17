"""WaterPilot backend — modular monolith.

Boundaries (dependencies point inward: api/worker -> application -> domain;
adapters implement ports defined by application/domain):

- ``waterpilot.api``         HTTP entry point (FastAPI).
- ``waterpilot.worker``      Private worker entry point (durable jobs).
- ``waterpilot.application`` Use-cases, ports (protocols), orchestration.
- ``waterpilot.domain``      Pure deterministic logic. No I/O, no SDKs.
- ``waterpilot.adapters``    Concrete infrastructure (local storage, local jobs, ...).
"""

__version__ = "0.1.0"
