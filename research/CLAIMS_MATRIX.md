# Research claims matrix

| Claim | Evidence in project | Safe paper wording |
|---|---|---|
| Government data is used | DILRMP official snapshots | "Official publicly available DILRMP CLR data were used as the external reference/context layer." |
| Blockchain prevents bad source data | Not established | Do not claim this. Say blockchain makes accepted records tamper-evident/auditable. |
| Ownership transfer accuracy is 100% | Controlled tests only | "The controlled test suite achieved 100% precision/recall for the implemented rules." |
| System replaces government registry | Not established | "Prototype authority-in-the-loop transaction management framework." |
| Real citizen ownership records are available | Not established | Do not claim access to confidential/private records. |
| Document tampering is detectable | SHA-256 verification | "A changed document produces a different digest and is rejected by integrity verification." |
| Novelty | Combination of authority workflow, hashing, conflict checks and audit trail | Present as an integrated contribution, not as the first blockchain land registry. |


## Implemented research-gap extensions (v8)

| Gap from literature | Implemented evidence | Claim boundary |
|---|---|---|
| Hash proves integrity but not semantic document validity | `server/src/services/documentValidationService.js`: PDF text extraction/Tesseract OCR (optional binaries), deterministic parcel/claimant-name/area/address pattern extraction, suspicious-term and mismatch checks before ledger event | This is a prototype validation layer; it is not document-authenticity proof; authority remains responsible for legal review. |
| AI/ML fraud screening | `server/src/services/fraudRiskService.js`: reproducible logistic-regression risk model combining duplicate parcel, claimant-name mismatch, duplicate hash, suspicious document, missing fields and workflow features | Training/evaluation cases are controlled synthetic cases; do not report them as field fraud accuracy. |
| Pre-storage validation | Property/document upload runs validation before the document hash event is written to the ledger; parcel mismatch causes a validation rejection requiring authority review | A `REVIEW` result is not itself a fraud finding. |
| Reproducible evaluation | `research/evaluate.mjs` now reports workflow metrics plus the controlled fraud-risk model evaluation | Results are experimental and must be rerun after model/data changes. |
| Evidence in the UI | Research page exposes document-intelligence methodology and fraud-risk F1 with explicit synthetic-data wording | No fabricated real-world accuracy is shown. |


## v17 owner / parcel claims

| Claim | Evidence in v17 | Safe wording / boundary |
|---|---|---|
| Owner-by-owner parcel lookup | RBIH ULI Next-Gen async query adapter for 12 documented State backends; optional India Property Register single-plot adapter with 28/36 provider-reported plot coverage | "On-demand owner/parcel lookups are supported where a subscribed provider has coverage and the operator has lawful credentials." No API keys or owner rows are bundled. |
| National parcel coverage | 36 State/UT primary portal directory, state-specific identifier metadata, ABDB admin hierarchy; IPR provider-reported coverage 28/36; RBIH Next-Gen 12 | Do not claim all plots in India are available. Coverage depth/freshness varies; 8 jurisdictions are marked not loaded in IPR's cited coverage page. |
| Owner-to-parcel relation verified | Source-evidence schema, provenance, server-computed source-document SHA-256, authority review audit event | "Authority confirms the source record lists the submitted holder against the identified parcel." This is not legal title or statutory mutation. |
| Live source integration | Mocked service tests cover endpoint/path/headers/status parsing | Do not claim successful live provider connection: no RBIH institution credentials or IPR API key was configured in this package build. |
| Complete nationwide title register | No all-State title database or all-36 State data-sharing agreements | Not supported; State/UT departments retain record custody and access is subject to law/privacy/security. |
