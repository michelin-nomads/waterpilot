"""Private worker HTTP paths, shared by the worker app and the dispatch adapters."""

RUN_PATH = "/internal/jobs/run"
"""Cloud Tasks delivers one run request here (JSON ``{"jobId", "dispatchSeq"}``)."""
OUTBOX_EVENT_PATH = "/internal/outbox/events"
"""Eventarc delivers Firestore ``jobOutbox`` document-created events here."""
RECONCILE_PATH = "/internal/outbox/reconcile"
"""Cloud Scheduler triggers the reconciliation sweep here."""
