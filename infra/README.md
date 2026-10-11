# infra/

Infrastructure configuration. **No cloud resources have been provisioned.** Reviewable
deployment assets are Prompt 25; applying them is Prompt 26.

Current contents:

- `firebase/firestore.rules`: deny-by-default browser access (HLD §11). Used by the local
  Firestore emulator and, later, the deployed project.
- `firebase/firestore.indexes.json`: composite indexes and single-field exemptions for the
  query shapes the backend uses (ADR 0005). It declares **no TTL policies**: deploying it
  never enables automatic deletion.

## Google Maps Platform keys (pilot only, owner action)

Local mode refuses both keys and uses the fixture gazetteer (ADR 0009). Nothing here is
applied automatically. Before setting either key, an owner should:

1. Create a **browser key** for `VITE_GOOGLE_MAPS_API_KEY`:
   - **Application restriction:** HTTP referrers, limited to the Hosting domains (for
     example `https://PROJECT_ID.web.app/*` and the custom domain).
   - **API restriction:** Maps JavaScript API, Places API (New) and Geocoding API only.
   - This key is public by design: it is bundled into the web app.
2. Optionally create a **Map ID** (`VITE_GOOGLE_MAPS_MAP_ID`) for vector maps and
   advanced markers.
3. Create a **server key** for `WL_PLACES_SERVER_KEY`, only if server-side search is
   wanted (agent and fallback search):
   - **API restriction:** Places API (New) only.
   - Restrict it to the API's service account or egress, and store it in Secret Manager.
     Never put it in a `VITE_` variable.
4. Set **per-API daily quotas** and a **billing budget with alerts**. Check current SKUs,
   free caps and prices on the Google Maps Platform pricing page: they change, and usage
   beyond them is billed.
5. Review the Google Maps Platform terms. ADR 0009 assumes place ids may be kept and that
   other Places content is cached for at most 30 days. A purge job for expired provider
   content is still pending.
6. Add the Maps origins to the Content-Security-Policy (Prompt 25):
   - `https://maps.googleapis.com` and `https://maps.gstatic.com` for script, image and
     connect;
   - `https://places.googleapis.com` for connect.

## TTL policies (opt-in, cloud only)

Two collections carry a timestamp field that marks when a document **may** be deleted.
Nothing reads these fields and correctness never depends on deletion happening, or on
when it happens; without a policy the documents are simply kept.

| Collection group  | Field        | Set by                                                                          | Value                                       |
| ----------------- | ------------ | ------------------------------------------------------------------------------- | ------------------------------------------- |
| `jobOutbox`       | `_expiresAt` | `FirestoreDueRepository._encode` via `domain.jobs.outbox_expires_at` (ADR 0007) | `settled_at` + 7 days; absent while pending |
| `idempotencyKeys` | `expiresAt`  | `FirestoreIdempotencyStore.put` (`IDEMPOTENCY_RETENTION`, ADR 0005)             | `created_at` + 7 days                       |

Both fields are exempt from single-field indexing (above), as Firestore recommends for TTL
timestamps. To enable deletion, an owner runs, per project, after reviewing the costs
below:

```bash
gcloud firestore fields ttls update _expiresAt --collection-group=jobOutbox --enable-ttl --project=PROJECT_ID
gcloud firestore fields ttls update expiresAt --collection-group=idempotencyKeys --enable-ttl --project=PROJECT_ID
gcloud firestore fields ttls list --project=PROJECT_ID   # check state: CREATING → ACTIVE
```

Billing and behaviour (Firestore TTL documentation, checked 2026-10-10; re-check pricing
before enabling):

- Each TTL deletion is billed as a document delete at the normal rate (and counts against
  any free daily delete allowance). Enabling a policy on a collection that already holds
  expired documents deletes them in bulk, which is billed the same way.
- Deletion is typically within 24 hours of expiry, not guaranteed, and in no particular
  order. Expired documents still appear in reads until deleted, and storage is billed
  until then.
- TTL deletes fire Firestore triggers. The outbox Eventarc trigger must filter on
  `google.cloud.firestore.document.v1.created` only, so deletions never call the worker.
- Without TTL, settled outbox records (about 1 KB each, one per dispatch) and idempotency
  records accumulate; at pilot volume the storage cost is negligible, and they can be
  removed later by enabling the policy.

Local development uses the Firebase Emulator Suite (Auth + Firestore) with the demo
project `demo-waterlens`; see the root `README.md`. The emulator does not run TTL
deletion.
