# LandLedger v17 — Final Build and Validation Report

**Build date:** 14 November 2026  
**Version:** v17 — Federated Owner/Parcel Lookup and Evidence Verification  
**Status:** Academic prototype release; not a statutory land registry.

## Executive decision

This release closes the *implementation-design* gap for owner/parcel discovery and source-record matching by adding two on-demand connectors, an authority-reviewed evidence workflow, provenance, record hashing and role-gated display. It does **not** deliver a populated national person-level owner/title database. The package intentionally contains zero person-level owner rows and zero parcel/title evidence rows because no lawful nationwide source export or live provider credentials were supplied.

The project is ready to demonstrate as a federated, source-backed academic prototype. It must not be described as a complete India-wide owner database, legal title verifier, or as having fully solved all research gaps in live deployment.

## Requested owner / parcel gaps

| Gap | Implemented in v17 | Data bundled | Status |
|---|---|---:|---|
| Owner-by-owner names | RBIH ULI asynchronous single-parcel adapter (12 documented NextGen State backends); optional IPR one-parcel lookup; authority/admin-only result display | 0 real owner rows | Connector capability implemented; national population not acquired |
| Plot/khasra/dag/title record | State portal directory; state-specific identifier metadata; IPR exact village-LGD + plot lookup; RBIH state query adapter; evidence schema/import | 0 complete national title rows | Selected parcel lookup pathway implemented; no all-India parcel register |
| Verified owner-to-parcel link | provenance, source record reference, lawful access basis, exact reviewed document upload, server-computed SHA-256, reviewer identity/time/method | 0 pre-verified links | Authority evidence-verification lifecycle implemented; no live records verified in release |

## External connector facts and constraints

### RBIH / ULI Next-Gen LRS

- RBIH public documentation identifies 12 State backends for its Next-Gen query interface.
- The adapter submits one parcel query and polls an asynchronous request ID.
- The service is disabled until an eligible institution completes onboarding and supplies the subscribed endpoint, client credentials/JWT and applicable consent reference.
- A separate RBIH LRS v3 guide lists 14 States; it is documented but is not misrepresented as the same protocol or a tested connector.

### India Property Register (IPR)

- IPR is an independent commercial aggregator, not a government registry.
- Its documentation claims plot data in 28/36 jurisdictions, but live per-State/layer coverage must be checked. It has 8 jurisdictions listed as not loaded in the referenced coverage information.
- The provider's marketing claim about total plot scale is not independently established and conflicts with an example stats response in its API documentation; v17 therefore does not use that headline number as evidence of coverage.
- Documentation lists ₹0.40 per successful API call. A village/plot match and a separate full-detail call may each be billable.
- The connector is single-parcel/on-demand only, disabled without `IPR_API_KEY`, does not persist the returned holder data and does not bulk-enumerate villages.
- Provider terms restrict bulk export, redistribution/resale, competing database construction and model training/evaluation without separate written licence.
- The response is not a certified copy or legal title adjudication. Verify the primary State source and identity through the competent authority.

## Official data retained

- DILRMP CLR aggregate snapshot: 36 State/UT rows.
- Snapshot totals: 783 districts, 6,974 tehsils, 650,819 villages, 403,404,057 total RoRs, 402,113,713 computerized RoRs, and 510,604,000 aggregate land-owner count as reported by the snapshot.
- These figures are published aggregates, not a list of unique named natural persons and not owner-to-parcel links. The aggregate owner total must not be used as a count of unique citizens without checking the source methodology.
- Survey of India ABDB hierarchy: 36 State/UT, 780 assigned district features, 6,578 indexed sub-district rows; disputed/unmatched or incomplete features remain flagged.
- NGDRS aggregate reporting and LACRRIS national snapshot are retained; state-wise acquisition case/parcel data is not inferred from national totals.
- Default demo ledger is blank: users 0, properties 0, documents 0, transfers 0, events 0.

## Verification executed

| Check | Result |
|---|---:|
| Focused dependency-free Node tests | 36 passed, 0 failed |
| Client JSX transpile diagnostics | 0 |
| `node --check` on app/services/research verifier | passed |
| Official-data schema/count/checksum verifier | passed; 37 file checksums plus raw ABDB archive checksum |
| Research evaluation script | passed; 10 deterministic workflow scenarios |
| Synthetic fraud holdout | 256 test cases; F1 0.9828 (synthetic rule-labelled data only) |
| Static security audit | 13 of 13 controls passed (static source review only) |
| Real-government fraud ML gate | correctly reports `realGovernmentMLReady: false` |

### Not run / not claimed

- Full API integration suite and production Vite build were not run because application npm dependencies are not installed in this build environment (`bcryptjs` and other app dependencies are unavailable).
- No live RBIH institutional credentials/consent or IPR API key were provided; live external API connectivity and returned records were not tested.
- No penetration test, independent legal review, biometric identity proofing, or live Hyperledger Fabric network benchmark was performed.
- No real owner identity, parcel title, mutation, encumbrance or acquisition parcel record is bundled as a fabricated substitute.

## Required steps before a live-data claim

1. Secure State/UT data-sharing authority or provider licence for each source and purpose.
2. Complete RBIH institutional onboarding, network allowlisting, client credentials and consent controls where applicable.
3. Obtain an IPR API key only if its commercial terms and fees are acceptable; use its coverage endpoint and one exact parcel lookup at a time.
4. Retrieve the underlying certified State RoR/parcel record and verify the person, parcel key, ownership share, mutation history and source date with the competent issuing authority.
5. Run the authority evidence upload/review endpoint and preserve the source document, source reference, retrieval time and server-generated hash.
6. Populate the dataset only from an authorized export or source record; maintain state-specific privacy, retention, correction and dispute workflows.
7. Run full dependency installation, production build, API integration tests, external security test and deployed-system benchmark before submission as a production deployment.

## Safe final presentation claim

> LandLedger v17 is a federated property-transaction management research prototype that integrates official State/UT land-administration aggregates, exposes credentialed on-demand parcel lookup adapters for selected jurisdictions, and implements an authority-reviewed source-record matching workflow with provenance and tamper-evident evidence hashes. Its evaluation uses controlled workflow scenarios and mocked connector tests. It does not claim a complete national person-level title database or statutory title adjudication.
