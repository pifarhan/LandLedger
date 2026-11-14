# Research Evaluation Plan and Results — LandLedger v18

## Research question

Can a federated, authority-reviewed, privacy-minimised prototype make land-transaction evidence more traceable, detect selected inconsistencies/duplicate submissions, and preserve legal/data boundaries while integrating source-backed public information?

## Evaluation dimensions

1. **Official data provenance:** 36 State/UT DILRMP aggregate rows, reconciled published totals, NGDRS feed separation and 41-file data manifest plus raw ABDB archive checksum.
2. **Administrative geography:** Survey of India ABDB hierarchy, parent matching and quality exceptions. Not cadastral title coverage.
3. **Acquisition evidence:** 58 selected public catalogue/notice entries, 19 Delhi award PDF references, two manual PDF extractions with source-page, parcel-schedule and legal-stage caveats.
4. **Document integrity:** server-computed SHA-256 and audit payload binding.
5. **Document consistency:** embedded PDF text extraction, optional Tesseract OCR, deterministic candidate extraction and exact parcel/source/holder matching where text allows.
6. **Claim conflict screening:** duplicate parcel scoped to State/District, repeated file hash and claimant consistency signals.
7. **Workflow correctness:** non-current claimant, invalid approval sequence, unauthorised buyer and premature finalisation policy cases.
8. **Privacy-minimised Fabric anchor:** HMAC-SHA-256 pseudonymous references for claimant/buyer/seller, parcel/title/address and storage; static checks confirm no raw owner/plot/address JSON fields are defined in on-channel property/transfer model.
9. **Fraud model governance:** authorised-data gate, source/authorization manifest, de-identification, independent label review and case-grouped 75/25 split. Real data gate remains blocked.
10. **Production Fabric performance:** measure TPS, p50/p95 latency, commit failure rate, endorsement outcomes and network recovery only after a production test environment is deployed.

## Current validation evidence

- 45 dependency-free backend unit tests passed.
- Client JSX transpilation reported zero diagnostics; this is not a full Vite production build.
- Official-data verifier passed: 36 State/UT rows, 58 catalogue rows, two detailed Delhi award rows, zero named owner rows, blank default ledger, 41 manifest checksums and raw ABDB archive hash.
- Static security audit passed 14 source checks; separate static security verification passed 10 controls.
- Ten deterministic workflow policy scenarios returned expected outcomes.
- ML pipeline self-test ran on synthetic data and is not research evidence; real-government ML gate remains blocked.

## Blocked experiments

- API integration test cannot start because `bcryptjs` and app dependencies are not installed in this offline workspace; package declarations exist but live dependency install could not occur.
- Full npm/Vite build not completed.
- Fabric development/production network not deployed because Docker daemon is absent; Go module download blocked by network/DNS.
- RBIH/IPR live connector tests not performed; no approved institutional credentials or IPR API key were provided.
- No real authorised government fraud-labelled dataset is supplied; no real-world fraud model validation has occurred.

## Important boundaries

DILRMP/NGDRS are administrative/registration aggregates, not national owner-title records. ABDB is administrative geography, not a cadastral register. Acquisition award totals are not payment receipts, and award schedules are not current title. OCR/pattern checks cannot certify authenticity. Source-record matching is not statutory ownership adjudication. Fabric test-network source code is not proof of production availability. Synthetic ML metrics must not be reported as real-world model accuracy.

Any reported metric must be labelled as public aggregate reconciliation, deterministic unit-test result, synthetic pipeline self-test or live deployment benchmark. There is currently no live deployment benchmark or real fraud-model metric.
