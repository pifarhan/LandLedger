# LandLedger v18 — Final Build and Validation Report

**Build date:** 14 November 2026  
**Version:** v18 — Advanced acquisition, parcel-evidence, privacy-safe Fabric and ML governance release  
**Release type:** Academic prototype; not a statutory land registry.

## Release additions

- Expanded public acquisition catalogue to 58 selected official metadata entries, including 19 GNCTD award PDF references (Bamnoli: 8; Bharthal: 11).
- Manually reviewed two actual GNCTD award PDFs and structured them into JSON and CSV with notification dates, award references, amounts, selected parcel/khasra schedules, court-status notes, source page references and data-quality flags.
- Expanded acquisition schema to preserve stage-specific dates, source-document URLs, area as published, compensation award vs. payment, parcel-identifier coverage, possession/title caveats and evidence references.
- Added strict government-domain source discovery parsing and source-document extraction limits/allowlists; imported values remain unverified until authority review.
- Kept named owner evidence store empty; no personal owner rows are fabricated or bulk scraped.
- Hardened source-record verification and SHA-256 return path; source inspection checks exact parcel, record reference and holder match where source text supports it.
- Added a real-government fraud training gate with written authorisation, de-identification, adjudicated labels, independent labelers, grouped holdout and three model comparisons.
- Added an official Supreme Court case-law reference that is explicitly not a fraud label because it discusses an unfinished investigation.
- Changed Fabric chaincode state to HMAC-SHA-256 references for owner/account/parcel/title/address/storage references; rejection text is also represented as HMAC. Raw personal names/parcel IDs/address fields are not part of the on-channel state model.
- Added 3 privacy-anchor unit/static checks and expanded security audit to 14 controls.
- Updated documentation, provenance and reproducibility instructions.

## Data coverage in this package

| Layer | Package contents | Scope boundary |
|---|---|---|
| DILRMP CLR | 36 State/UT aggregate rows, with aggregate owner indicators | Not named people; no owner→parcel mapping |
| State portal directory | 36 State/UT official portal/authority links | A portal link is not permission or an open bulk API |
| NGDRS | Selected aggregate registration activity snapshot | Not individual deeds or title records |
| ABDB | 36 State/UT administrative master hierarchy, with feature gaps retained | Not cadastral parcel geometry or title |
| LACRRIS | National KPI snapshot and 36 State/UT report selectors | Does not provide a universal parcel join key |
| Acquisition catalogue | 58 official metadata references; 19 Delhi award PDF references | Selected list, not all India case census |
| Detailed acquisition extracts | 2 human-reviewed Delhi award records, one Bamnoli and one Bharthal | Award/selected schedule only; not payment proof/current title/complete parcel schedule |
| Individual owner evidence | 0 rows | No authorised national owner export or live API credentials supplied |
| Parcel title/owner relationship evidence | 0 preverified rows | Exact parcel connector/import path exists; no all-India title database |
| Fraud ML | Gated trainer and synthetic self-test | Real-government data gate remains false; no real model card trained |
| Hyperledger Fabric | Chaincode, Gateway, dev bootstrap, role-separated identities, HMAC-only references | No production network deployed or benchmarked |

## Validation performed in this build environment

| Validation | Result |
|---|---|
| Dependency-free Node test suites | 45 passed, 0 failed |
| Client JSX TypeScript transpile | 0 diagnostics |
| Modified backend/research JavaScript syntax checks | Passed |
| Shell syntax (`bootstrap.sh`, `preflight.sh`) | Passed |
| Official data verifier | PASS | 36 State/UT rows, 58 acquisition notice metadata rows, 2 detailed Delhi awards, 0 nationwide owner/parcel evidence rows, 41 dataset checksums; ABDB raw archive SHA-256 verified |
| Static security audit | 14/14 checks passed; source-level only, not a penetration test or independent security audit |
| Research evaluation | 10/10 deterministic workflow policy scenarios passed; controlled policy tests, not real transaction, fraud or land-title validation |
| ML pipeline self-test | Passed on synthetic-only dataset; not research evidence |
| Real authorised ML data gate | Blocked as expected: no qualifying dataset supplied |
| Fabric preflight | Blocked: Docker daemon / Fabric deployment prerequisites unavailable |
| Go chaincode test | Not completed: Fabric Go dependency download unavailable in offline environment |
| API integration test | Blocked before execution by missing `bcryptjs` module; dependency is declared in `server/package.json` but npm install was unavailable in this environment |
| Full Vite production build | Not completed; npm dependencies are not installed and network access is blocked |

## Exact validation summary from the final run

- `node --test` over the nine dependency-free suites: **45 passed, 0 failed**.
- `research/verify-official-data.mjs`: **PASS**; 36 DILRMP State/UT rows, aggregate land-owner total 510,604,000, 58 acquisition notice metadata rows, 2 structured public-source awards, 0 imported statewide case rows, 0 parcel evidence rows, 41 checksum files, raw ABDB archive digest verified.
- Static security audit: **14/14**; secondary application-control verification: **10/10**.
- Deterministic policy evaluation: **10/10**; JSX transpile diagnostics: **0**; changed JS/MJS syntax, shell scripts and Python compilation: **PASS**.
- ML self-test: **PASS on synthetic-only records**. Real-authorised dataset gate: **BLOCKED_NO_QUALIFYING_AUTHORISED_DATASET** (expected; no authorised records supplied).
- API integration suite: **not executed** because the installed workspace lacks the declared `bcryptjs` dependency. Full npm/Vite build not run because dependencies could not be installed in this offline workspace.
- Fabric preflight: **blocked** because Docker/Docker daemon is unavailable; `fabric-samples` and generated certificates are absent. Go chaincode test remains uncompleted because Fabric Go dependency retrieval is unavailable in this environment.

## External prerequisites that remain

1. Government/State authority data-sharing approval, endpoint documentation, institutional onboarding, IP allowlisting and consent for owner/parcel query.
2. If IPR is selected, an API key, paid usage approval and written terms for each data purpose; no bulk extraction unless separately licensed.
3. Actual certified State RoR/parcel records and authority reviewers to populate owner-to-parcel evidence.
4. State/project-specific acquisition award, payment and possession data exports or source PDFs to cover additional States/UTs.
5. A final-judgment/competent-authority-confirmed, de-identified fraud dataset with research permission and the required label-review metadata.
6. Docker/Kubernetes or production host, Fabric peer/orderer/CA certificates, HSM/KMS, multi-organisation governance, operations/backups/monitoring, chaincode compile/deploy, and live benchmark.
7. Install dependencies and run full API integration, production front-end build, penetration test and deployment smoke tests.

## Important result semantics

- DILRMP owner totals are aggregate published values; not unique named owner identities.
- Acquisition amount shown in the two Delhi records is award amount, not proof of payment. Parcel lists are selected award schedule entries; not current title certificates.
- `AUTHORITY_VERIFIED_SOURCE_RECORD` is source-record matching under review, not legal title adjudication or statutory mutation.
- SHA-256 proves integrity after capture; it does not establish authenticity/truth of the originating document.
- Synthetic fraud metrics are not real-world accuracy.
- Fabric development test-network bootstrap is not a live production deployment.

## Final presentation statement

LandLedger v18 is an advanced academic prototype combining official aggregate land-administration data, selected government acquisition award extracts, federated parcel lookup connectors, authority-reviewed evidence capture, tamper-evident source references, privacy-minimised Fabric chaincode anchors and an authorised-data-gated fraud analytics pipeline. It does not claim a complete national owner-by-owner title database or production government deployment.
