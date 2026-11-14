# Paper-ready research positioning — LandLedger v18

## Proposed title

**A Federated, Authority-Reviewed and Privacy-Minimised Framework for Land Transaction Evidence Management in India**

## Abstract draft

This work presents LandLedger v18, an academic prototype for property-transaction workflow and land-record evidence management. The system combines official State/UT-level land-administration aggregates, administrative boundary references, registration activity indicators and selected public land-acquisition award documents. It introduces a source-first parcel-evidence lifecycle in which imported claims remain unverified until an authorised reviewer inspects the exact source document, parcel identifier and source reference. File fingerprints, provenance metadata and a privacy-minimised permissioned-ledger anchor support post-capture integrity and auditability. The design includes federated single-parcel lookup adapters for approved services and an authorised-data-gated fraud analytics pipeline with grouped evaluation and multiple model families. The current evaluation comprises deterministic workflow policy tests, dependency-free unit tests and a synthetic pipeline self-test. No complete nationwide person-level ownership register or qualifying government fraud-labelled dataset was available in the build environment; accordingly, the work does not claim nationwide legal title verification or real-world fraud detection accuracy. Results demonstrate reproducible prototype behaviour and identify the requirements for State-authorised data integration and production deployment.

## Contributions

1. 36-State/UT aggregate data integration with source provenance and explicit distinction between public aggregates and person-level title records.
2. Stage-aware acquisition record model separating notification, award, payment and possession; two detailed, human-reviewed GNCTD award extracts demonstrate the schema against source PDFs.
3. Exact parcel/source-reference/holder evidence matching with lawful access basis, authority review and a source-capture state machine.
4. Privacy-minimised Fabric on-channel evidence anchors using HMAC-SHA-256 references rather than raw claimant names, address or plot identifiers.
5. Strict fraud-ML governance gate requiring lawful purpose, de-identification, independent labels, adjudication, dataset hash and case-grouped evaluation.
6. Reproducible tests and data-quality caveats that prevent synthetic or aggregate information from being presented as real title evidence.

## Evaluation statements that are supported

- 45 dependency-free backend tests passed.
- Official-data verifier passed for 36 State/UT rows, two detailed acquisition awards, 58 notice/catalogue entries, blank person-level evidence store and 41 dataset checksums.
- Static security audit passed 14 source checks; a separate static security verification passed 10 checks.
- 10 controlled workflow cases produced the expected policy decision.
- The ML pipeline self-test ran on synthetic data only and is not research evidence.

## Claims that are not supported

Do not state that the system contains all Indian landowners, all title deeds or every parcel. Do not state that an award amount is paid compensation or that an award schedule is current title. Do not call a source-record match statutory ownership verification. Do not claim real-world fraud model accuracy or live Fabric TPS; there is no authorised labelled training set or deployed production Fabric network in this release.
