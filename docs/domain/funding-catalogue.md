# Funding catalogue — Prompt 18

The desktop admin editor is `/admin/funding`. Its HTTP API is
`GET` / `POST /v1/admin/funding-catalogue`. Both require a verified permanent
Firebase account whose UID appears in the server-only `WP_FUNDING_ADMIN_UIDS`
JSON list. The default empty list denies everyone. A browser role, submitted UID,
model suggestion or document instruction grants no authority.

The catalogue is bounded to 200 records. Existing public funding reads and matching
remain; drafts are unpublished, and expired/withdrawn schemes are excluded from new
matches. Only catalogue administration is privileged. The Make It Happen funding
matching/review screen belongs to the next prompt and is not implemented here.

## Offline importer

POST a `CatalogueImport` JSON envelope:

- `scheme`: full scheme metadata, using the existing `fsc_` opaque ID convention;
- `expected_revision`: `0` for a new ID, or the saved revision for an update;
- `human_reviewed`: explicit curator review, required for real active publication;
- `source_document_base64`: permitted document bytes, required for first real
  publication and whenever the source URL/hash changes;
- `source_content_type`: `application/pdf` or `application/json`.

Use a Firebase token only in the `Authorization: Bearer …` header. The editor
refreshes a rejected token once. No token is placed in a URL. The request is bounded
to 8 MiB before JSON parsing; metadata to 128 KiB; PDF to 5 MiB and JSON evidence to
256 KiB. Existing artifact type/magic-byte and private-storage protections apply.
The source hash is SHA-256 of the uploaded bytes, computed by the server. Evidence
is retained under an immutable, server-generated private system artifact key.
A failed revision save may leave an unreferenced immutable evidence artifact; it
cannot publish a scheme. No document content is executed or rendered as markup.

`funder` is the publisher name; `source_url` is its preserved reference URL.
Preserve geography, applicant categories, interventions, free-text amount rules,
exact `max_amount` minor-unit strings and currency, required documents,
`last_verified_at`, deadline instant and IANA timezone, permission note, evidence,
status and explicitly unknown fields. Unsupported curator fields are preserved in
`unknown_metadata`; use JSON null for unknown values rather than invented zeroes.
There is no FX conversion or guaranteed award amount.

A real `active` record requires validated evidence, `official_source: true`, explicit
human review, a permission note, a retained source document/hash and publisher
timezone. Verification dates cannot be in the future. Model extraction is not used;
any future extraction output must pass this same human publication boundary.

The importer never fetches URLs, follows redirects, resolves DNS, crawls or calls
models. Reference metadata must use HTTPS without credentials, literal IPs or local
hosts. Existing network ingestion adapters are unchanged; this endpoint cannot
reach private networks even when a document contains a hostile URL.

## Lifecycle and invalidation

- `draft`: unpublished curator work.
- `active`: reviewed real funding; never synthetic.
- `demo`: synthetic demonstration only, visibly labelled as not real funding.
- `withdrawn`: curator withdrawal; retained for history, unavailable for matching.
- `expired`: unavailable at or after the exact deadline or exclusive `closes_on`
  date in the publisher timezone. Read paths derive expiry without a scheduler.

Edit the full JSON and change `status` to withdraw. Each save atomically checks the
expected revision and increments it. Concurrent or duplicate stale submissions are
refused with `VERSION_CONFLICT`; the UI requires reloading/reviewing current metadata.
Synthetic records cannot change their evidence into real schemes. Updates survive
emulator API restarts; synthetic seeding does not overwrite existing records.

Matches retain their scheme revision. A changed revision, withdrawal or expiry
invalidates stored match reads and idempotent replay results; it does not delete
history or alter immutable reports/financial snapshots. Recalculation requires a
fresh explicit match request. The admin editor invalidates only funding catalogue
and funding-match caches. Other clients receive current eligibility on their next
query; there is no cross-client live push or global deadline scheduler.

## Hackathon mock source

The owner authorized a mock document instead of supplying official sources.
`examples/funding/mock-source.json` is explicitly synthetic, with fictional
publisher, hypothetical INR amount rules, timezone, documents and unknowns.
`mock-scheme.json` is its editable metadata; `mock-import.json` is a ready-to-POST
envelope containing the exact source bytes. For the editor, paste the scheme JSON,
use revision `0` and choose the mock source JSON file. Leave real-source review
unchecked; it saves as `demo`, never as real active funding.

No real official scheme is published or claimed verified in this prompt. Real
curation remains pending permitted official documents and an admin review. Global
locations, proposals, communities and tracking remain in scope; non-INR economics
remains an outstanding functionality gap.
