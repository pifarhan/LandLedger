# LandLedger v18 — Research Gap Closure Report

## Research position

v18 materially advances the academic prototype with selected human-reviewed government acquisition awards, a source-backed parcel evidence verification pipeline, federated single-parcel connectors, stricter fraud-model data governance and privacy-minimised Fabric references. It does not honestly close gaps that depend on unavailable State/UT registries, licensed/credentialed endpoints, authorised fraud labels or a live production network.

## Gap-to-implementation map

| Research gap | v18 implementation | Evidence | Status |
|---|---|---|---|
| Authority-in-the-loop workflow | RBAC, pending-claim review, buyer acceptance, authority finalisation | `server/src/app.js`, `workflowPolicy.js`, tests | Implemented in prototype; not government title adjudication |
| Document integrity | SHA-256, provenance and audit binding | `server/src/utils.js`, source-document extractor | Implemented; no original-truth guarantee |
| OCR/document checks | PDF text extraction, optional Tesseract, deterministic candidate extraction and exact-field matching | `sourceDocumentExtractionService.js`, tests | Implemented screening; not forensic forgery detection or trained NER |
| Duplicate/conflicting claim screening | State/district-scoped duplicate parcel, duplicate digest and claimant mismatch | workflow and enrichment tests | Implemented policy screening; not legal conflict resolution |
| Land acquisition | 58 selected notice/catalogue entries; 19 Delhi award PDF references; 2 detailed GNCTD award extracts; source discovery, staged extraction/import/review, and separate runtime import overlay | `land_acquisition_notices.json`, `land_acquisition_awards_extracted.json`, `land_acquisition_national.json`, `land_acquisition_imports.json`, acquisition API and UI | Partially solved; not all States/cases; runtime imports do not change national dashboard totals; custodian-supplied reports and human review remain required |
| Owner-by-owner records | RBIH and IPR on-demand single-plot adapters; access basis; source capture; authority-only owner view | connector services, routes, tests | Connector/workflow solved; 0 named owner records bundled |
| Parcel/title records | 36 State portal directory, exact plot lookup connectors, ABDB administrative hierarchy, source evidence schema | `state_record_portals.json`, `federatedLandRecordsRegistry`, `thirdPartyLandRecordsService` | Access architecture solved; no nationwide cadastral/title dataset |
| Owner-to-parcel verification | Server-inspected source document, exact parcel/source reference/holder match, reviewer trail and HMAC/hash anchors | `governmentEnrichmentService.js`, `sourceDocumentExtractionService.js`, tests | Verification workflow implemented; 0 preverified owner-parcel links bundled; not legal title adjudication |
| Real government fraud-labelled ML | Authorised trainer with label policy, de-identification, grouped holdout, multiple models and dataset hash checks | `train-authorised-fraud-model.py`, `private-data/README.md` | Training pipeline implemented; no qualifying real dataset, no real model trained |
| Real-world ML validation | Synthetic self-test, controlled evaluation, real-data gate | `research/evaluation-result.json`, `real-government-ml-gate.json` | Not solved; real data validation blocked |
| Hyperledger Fabric | Gateway, two roles, chaincode, hash-only source evidence, HMAC private references and development bootstrap | `fabric/`, `ledgerService.js`, HMAC tests | Privacy-safe chaincode/dev deployment path implemented; live production network and benchmark not completed |
| Security | Auth/RBAC, upload signatures, HMAC references, audit controls and source checks | `security-audit-result.json`, `security-verification-result.json` | Static controls pass; no independent penetration test |

## Real public acquisition material newly included

The GNCTD Revenue Department publishes separate award catalogues for Bamnoli and Bharthal:
- Bamnoli catalogue: https://revenue.delhi.gov.in/land-acquisition/7227
- Bharthal catalogue: https://revenue.delhi.gov.in/land-acquisition/7280

Two award PDFs were manually reviewed and structured. Bamnoli Award 1(07-08) records 2,100 Bigha 06 Biswas, including 640 Bigha 12 Biswas subject to High Court status quo, with award total INR 1,117,572,745. Bharthal Award 26(02-03) states a notified extent of 2,904 Bigha 16 Biswas but flags field-book/notification discrepancy; its award total is INR 1,255,465,435.34. These are award amounts, not payment receipts. Parcel identifiers are selected court-status/award schedules, not a current title record. The data files keep Bigha-Biswa as published and do not convert across States.

## State data and legal boundary

The DILRMP CLR count is a State/UT aggregate, not named owners or owner-to-parcel links. State/UT custodianship and compliant federated sharing apply; a portal link or public individual lookup does not imply permission for national bulk extraction. The parcel evidence store deliberately remains empty until source-authorised capture.

The official Supreme Court case-law reference *Sahil Abdulsattar Mansuri v. Safimahamad Fafirbhai Mansuri*, 2026 INSC 626, is included as a design reference only. It describes forgery allegations/FSL material in an unfinished investigation and orders further investigation; it is prohibited as a fraud training label.

## Safe academic contribution statement

> LandLedger v18 is an authority-workflow-oriented property transaction research prototype that integrates official land-administration aggregates and selected government acquisition award extracts, provides federated single-parcel lookup pathways, implements source-record evidence matching with provenance and privacy-minimised cryptographic anchors, and supplies a strictly authorised fraud-analytics training pipeline. Its current experiments comprise controlled workflow tests and synthetic pipeline self-tests; it does not claim a complete all-India title register or real-world fraud accuracy.
