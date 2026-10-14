# ADR 0018 — Local authenticated agent conversation (Prompt 17)

Status: accepted for local fake inference only · 2026-10-13.

Use the actual ADK Runner with the existing gateway, session adapter and authorized tool
catalogue behind bearer-authenticated HTTP commands and a read-only fetch event stream.
Store a bounded public projection on each run with atomic monotonic IDs. Reconnect reads
that projection and never schedules inference. Explicit Continue keeps the same run and
cumulative allowance; interrupted/ambiguous calls are never blindly replayed.

Serialize execution with durable session leases. Persist tool replay guards and identical
call counters. Compare workspace versions and perform tool effects in a transaction, while
step claims remain durable even when the effect is refused. Meaningful actions remain
prepare-only until an explicit version/parameter-bound confirmation through the existing
application service.

Keep synchronous SDK transactions and backoff off the async loop. Bound RPC timeouts,
outer retry rounds and provider attempts by request/execution deadlines and lease expiry.
The local loop has an overall 35-second segment cap under a 45-second lease; recovery after
an expired segment requires Continue and does not promise automatic provider resumption.

Use the existing responsive planning layout and design-system controls. Preserve the
mounted conversation when switching modes, expose structured tool cards and explicit
workspace focus actions, and cancel/refetch only affected queries. No reasoning stream,
model-generated UI, animation or automatic scroll is introduced.

Local fake inference is opt-in and clearly labelled; pilot rejects the flag. Live model
streaming, live Vertex calls, pilot rollout, provisioning, deployment and billing remain
unauthorized. Funding catalogue work (Prompt 18) is not started by this decision.
