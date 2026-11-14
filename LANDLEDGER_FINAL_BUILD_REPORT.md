# LandLedger final build report — 14 November 2026

## Delivered build

Version: **v15 — All-India Public-Data / Claimant-Workflow Research Build**.
Base: the full V13 application, with updated backend, frontend, research evidence, official data and Survey of India ABDB reference index.

## Important data and legal boundary

- No demo owners or sample properties are seeded. The default ledger is blank.
- Public DILRMP and NGDRS sources provide aggregate administrative/registration metrics, not a public nationwide person-level landowner/title dataset.
- The supplied ABDB source is administrative geography, not a cadastral parcel-owner database.
- All application property records are self-submitted claimant records until verified through an authorised statutory source.
- Authority approval in this application is a workflow decision, not statutory mutation or legal title transfer.
- SHA-256 is an integrity fingerprint after receipt; OCR and pattern checks do not prove source-document authenticity.

## Official data coverage

- DILRMP CLR aggregate: **36/36 State/UT rows**.
- DILRMP published national totals in the snapshot: **783 districts, 6,974 tehsils, 650,819 villages, 403,404,057 RoRs**.
- Survey of India ABDB: **36 State/UT master entries, 780 assigned district features, 6,578 indexed sub-district rows**.
- ABDB quality flags: **28 disputed/unassigned district features, 89 incomplete sub-district features**; Arunachal Pradesh, Meghalaya have no indexed sub-district rows in the supplied archive.
- NGDRS live State IGR feed: **26/36 reporting rows**; 10 remain not reported in that feed.
- NGDRS manual data-entry feed: **5 separate historical rows**, not merged into the live feed totals.
- DILRMP village-level file: 14 historical Karnataka/West Bengal rows, with 2024 status dates; it is not a nationwide village census.

## Verification results

- Dependency-light Node test suite: **FAIL** — 15/17 passed; 2 failed.
- Official-data/source verification (including raw ABDB RAR SHA-256): **PASS**.
- Static source-level security audit: **12/12 controls passed**.
- JavaScript source syntax checks: **PASS** (20 files).
- JSX TypeScript transpilation syntax check: **PASS** (0 diagnostics).
- Controlled claimant-workflow policy cases: **10 cases**, accuracy 1.0000, false positives 0, false negatives 0. These are deterministic unit cases, not field data.
- Synthetic fraud-risk holdout: 256 cases; accuracy 0.9805, precision 0.9662, recall 1.0000, F1 0.9828. This is rule-labelled synthetic data only, not real government fraud evaluation.
- Real-government ML gate: **see gate output** because no authorised, anonymised, expert-labelled parcel/fraud dataset is included.

## Not verified in this environment

- Full Express/API integration tests and Vite production build/browser smoke test: npm dependencies were unavailable in this packaging environment.
- Hyperledger Fabric Go chaincode compile/test and live-network integration: Go dependencies/network were unavailable; Fabric code is supplied but not deployed.
- Live Fabric TPS/latency, independent penetration test and production government-registry integration were not performed.
- The prototype has no distributed atomic transaction or durable outbox between PostgreSQL and Fabric; production deployment must add reconciliation.

## Run locally

See `README.md`, `DEMO_SETUP.md`, `DATA_PROVENANCE.md` and `ABDB_DATA_PROVENANCE.md`.
Install root/server/client npm dependencies, configure secrets in a private `.env`, then run the provided test and verification scripts.

## Evidence files

- `research/evaluation-result.json`
- `research/security-audit-result.json`
- `research/gap-evidence.json`
- `server/data/manifest.json` and `server/data/CHECKSUMS.sha256`
- `TEST_REPORT.md`
