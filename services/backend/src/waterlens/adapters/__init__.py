"""Concrete infrastructure adapters.

Phase 02 provides local-only adapters (filesystem object storage, file-backed job
runner). There are NO official local emulators for Cloud Tasks, Vertex AI or Earth
Engine — those adapters (added later) require real configured credentials and must
never be silently exercised by local commands.
"""
