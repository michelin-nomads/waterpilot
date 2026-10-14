# Prompt 19 — eligibility and optional relevance

Eligibility is deterministic (`funding-rules/2`), with **eligible**, **ineligible** or
**needs-information** and evidence. It is not an award or a percentage likelihood.
Existing per-criterion results remain separate for compatibility.

## Recorded rules and facts

Curators supply `FundingScheme.eligibility_rules` through the Prompt 18 importer:

- `country_codes` or explicit `worldwide`; `geography_requires_review` for unsupported
  subnational restrictions. Provider place names alone cannot prove such eligibility.
- `applicant_types` or explicit `any_applicant`.
- `intervention_ids` from the intervention catalogue or explicit `any_intervention`.
- Optional exact `min_project_cost` / `max_project_cost`, or explicit
  `no_amount_restriction`. The existing `max_amount` caps **requested grant money**,
  not project cost. Unstructured amount text alone needs a human check.
- `rolling_open` only when the publisher explicitly allows an ongoing window.
- `required_information` field names, alongside preserved `required_documents`.

Location and intervention facts come from the authorized saved session/plan. Applicant
type, requested amount, document availability and supplied information are declared in
`MatchFundingInput.information`; they are not publisher verification. Unknown or
unsupported eligibility information remains needs-information. A failed known rule,
closed/upcoming window, withdrawal or expiry makes the result ineligible. Native
currency minor-unit strings are compared exactly; no FX conversion is introduced.
Estimated minimum-cost ranges crossing a limit remain uncertain.

Source URL/hash/date/timezone are attached to each scheme and shown beside evidence.
Synthetic demo schemes stay labelled even when they pass listed rules. The approved
mock has unknown co-funding information and therefore does not become fully eligible.

Matches bind scheme revision, rules version and session input revision. A saved manual
planning edit, catalogue change or expiry invalidates stale records; read paths refresh
current eligibility without any embedding call. Old `funding-rules/1` records require
explicit recalculation. Report snapshots and approved-funding economics are unchanged.

## Ranking boundary and local controls

Optional `semanticQuery` only orders eligible/needs-information results. Ineligible
schemes never reach retrieval. Eligible results remain before needs-information
results, regardless of relevance. No distance, percentage or likelihood is exposed.
A missing provider/index, incomplete vector response, kill switch, exhausted budget,
invitation denial or deadline returns **deterministic_fallback** with a reason.

Local ranking is opt-in via `WL_FUNDING_FAKE_EMBEDDINGS=true`, with existing
`WL_AI_ENABLED=true`, an explicit positive `WL_AI_DAILY_BUDGET_USD` and authorized
invitation/open-to-all policy. Fake embeddings are refused in pilot configuration.
The default disabled provider yields deterministic results. The fake token-hash
ordering is labelled `fake_semantic`; it is not evidence of real semantic quality.

Embedding calls go through the existing AI gateway ledger, shared daily budget,
request ceiling, invitations and kill switch. There is one atomic durable dispatch
claim per content key, no embedding retries, and terminal tombstones prevent replay
when a cache write is interrupted. These calls do not create conversation runs or
repeat ADK inference. Unknown dispatched outcomes settle conservatively. Cache hits
avoid model calls; policy still applies. Calls and sync Firestore work run off the
async event loop under a shared 10-second ranking deadline.

Hackathon bounds: at most four rankable candidates and five cold embeddings per
request (one query plus documents). Larger result sets use deterministic fallback,
not partial eligibility filtering. Ranking text is capped at 4,000 characters;
the cache identity hashes the **complete** metadata, not the truncated text. Curator
IDs/private artifact pointers are excluded from the embedding text. Query caches are
UID-scoped; public scheme caches are shared. No raw query text is stored in the cache.

## SDK, model and vector requirements

The existing unchanged Python lock pins **google-genai 2.29.0** and
**google-cloud-firestore 2.34.1**. SDK signatures/configuration were inspected locally.
No SDK was installed or upgraded, and no live call was made.

Selected future server model: `gemini-embedding-001`, proposed region `us-central1`,
output dimension **768**, `RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY`, auto-truncation off,
per-request timeout and SDK retries disabled (`HttpRetryOptions(attempts=1)`). Vertex
uses ADC/server identity; no browser key or embedding API is exposed to clients.
Model/region availability, token metering, pricing and real quality are **unverified**.

Records in `fundingEmbeddings` preserve model ID, dimension, embedding version, full
content hash, source hash (null when an old synthetic source is unknown), owner/kind,
scheme ID and the vector. Version `fake-token-hash-1` is isolated from future
`vertex-gemini-embedding-001-768-1`; model/dimension/version changes cannot reuse old
vectors. The cache record ID derives from those values, scope and content hash.
Firestore writes both the validated 768-value array and its native `_embeddingVector`
field. Real retrieval uses `Query.find_nearest` with COSINE distance and exact current
cache IDs, model ID and embedding version filters. Stale source hashes cannot enter
through a nearest-neighbour result. SDK 2.34.1's return annotation needs an explicit
`VectorQuery` cast; the adapter retains that typed workaround.

`infra/firebase/firestore.indexes.json` declares a COLLECTION index for
`fundingEmbeddings`: ascending `id`, `model_id`, `embedding_version`, followed by
`_embeddingVector` with `vectorConfig: {dimension: 768, flat: {}}`. It was **not
provisioned or deployed**. The emulator stores vectors but does not validate real
nearest-neighbour/index behavior; local ordering uses the fake adapter.
The existing live scalar-index probe explicitly skips vector indexes instead of
pretending an ordered scalar query verifies them.

The Vertex and Firestore vector adapters are retained but deliberately unarmed:
constructors require explicit authorization (and Vertex reviewed pricing). The local
factory never builds either. Authorized future setup must inject the live provider,
Firestore retriever and live embedding version together, deploy/verify the declared
index, verify ADC/region/model access, and review pricing/token bounds **after separate
Prompt 26 authorization**. No such setup or test is performed here.

The `0.30 USD / million input tokens` value is a **proposed local accounting ceiling**,
not verified model pricing or an invoice. Input holds use a conservative UTF-8-byte
ceiling; fake settlement is synthetic. The retained live path marks settlement as
estimated until provider usage/pricing reconciliation is implemented and verified.
Do not enable live calls on the basis of this document alone.

## Desktop interface and remaining gaps

`/make-it-happen` reads the saved session/selected plan and stored matches. It accepts
explicit declarations, displays eligible/needs-information cards, source evidence,
excluded reasons, optional fake relevance and deterministic fallback. No automatic
embedding calls occur during read/reload. A retry retains the same idempotency key for
unchanged submitted facts. Mode changes keep the same session; unsaved planning edits
block stale matching. Saved results reflect the last submitted declarations, not
currently edited form values. More saved pages can be loaded explicitly.

Global locations, funding, proposal, community and tracking requirements remain.
Subnational geography without reviewed machine rules needs information, rather than
an inferred boundary match. Real official funding curation and live vector quality/
index behavior remain unverified. Non-INR economics remains an outstanding functionality
gap; representing native currency funding limits does not close it. Prompt 17 core
browser acceptance remains pending for possible Prompt 24 verification.

Stop after Prompt 19. No Prompt 20 implementation, live Vertex/embedding/Maps,
provisioning, deployment or billing activation is authorized by this work.
