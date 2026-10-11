# infra/

Infrastructure configuration. **No cloud resources are provisioned in Phase 02.**

Current contents:

- `firebase/firestore.rules` — deny-by-default client access (HLD §11). Used by the local Firestore emulator and, later, the deployed project.
- `firebase/firestore.indexes.json` — empty index set placeholder.

Deferred to later phases (do not add early):

- Terraform / deployable GCP configuration and `docs/cloud-setup.md` — **Phase 18**.
- Cloud Run, Cloud Tasks, Artifact Registry, buckets, IAM, Hosting config — **Phase 18/19**.

Local development uses the Firebase Emulator Suite (Auth + Firestore) with the demo
project `demo-waterlens`; see the root `README.md`.
