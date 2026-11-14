# LandLedger v18 — Advanced Research-Gap Closure Register

Build date: 14 November 2026  
Release scope: source-backed academic prototype; not a statutory land registry.

## Executive result

This release adds materially stronger evidence-backed acquisition coverage, per-record import/verification controls, a privacy-minimised Fabric ledger anchor, and a legally gated fraud-model training pipeline. It does **not** claim to have completed nationwide person-level title data, obtained State/ULI credentials, obtained a licensed IPR API key, acquired an authorised real fraud-labelled dataset, or deployed a live production Fabric network.

## Gap-by-gap result

| Previously open gap | v18 implementation/evidence | What is genuinely solved | What remains open |
|---|---|---|---|
| Land acquisition data integration | 58 public notice/catalogue metadata rows; 19 GNCTD award PDFs indexed across Bamnoli and Bharthal; 2 award PDFs manually reviewed and structured into JSON/CSV and API data | Source-discovery, document extraction candidate path, staged acquisition schema, two detailed real official award imports | Not every State/project/case imported; not every award PDF extracted; national LACRRIS KPI is not spread across states; payment/possession not inferred |
| Owner-by-owner real records | RBIH Next-Gen single-parcel adapter; separate IPR exact-plot adapter; source-capture workflow; restricted owner display | Technical on-demand connector paths, server-side credentials, non-persistence of third-party results, import and authority review process | 0 named owner rows bundled; no RBIH onboarding/credentials or IPR API key; no authorised nationwide owner extract |
| Parcel/khasra/dag/plot title register | Official state portals, ABDB administrative hierarchy, selected khasra identifiers from two award schedules, source-document extraction and parcel evidence schema | State/UT lookup and exact parcel evidence architecture; acquisition schedule references retained with legal caveats | 0 complete nationwide RoR/title records; selected acquisition khasra references are not current title proof or a cadastral parcel database |
| Verified owner → parcel relationship | Server-side PDF/OCR inspection matches parcel key, source reference and holder text; reviewer identity, access basis, timestamp and SHA-256 persisted; client-supplied verification flag ignored | A source-captured record can be advanced to `AUTHORITY_VERIFIED_SOURCE_RECORD` after documented authority review; this is an evidence verification status | 0 pre-populated real owner/parcel links; authority verification is not a final legal title adjudication; no national State registry reconciliation |
| Real government fraud-labelled ML dataset | Strict authorised-data gate; de-identified feature schema; SHA-256 manifest; 2 labelers + adjudicator; grouped holdout; Logistic/RF/HistGradientBoost comparison; official case-law reference corpus | Training system and data-governance controls; synthetic pipeline self-test | No qualifying authorised dataset; real-government ML gate remains blocked; case-law allegations/procedural orders are explicitly prohibited as fraud labels |
| Live Hyperledger Fabric production network | Fabric Gateway adapter, application/authority certificates, chaincode source evidence transaction, HMAC-SHA-256 references for personal/parcel values, dev bootstrap and preflight | Privacy-minimised chaincode and deployment path are implemented | No live network deployed or benchmarked in this workspace; Docker daemon unavailable; Go dependency resolution blocked; test-network bootstrap is development only, not production |
| Real-world fraud ML validation | Reproducible synthetic self-test and controlled workflow tests; report labels these as synthetic/policy tests | Pipeline mechanics and deterministic policy behaviour validated | No real-world recall/precision/F1/false-positive rate can be reported without a qualifying dataset and temporal/state external holdout |

## Newly structured official acquisition records

Source authority: Land Acquisition Collector, District South West/South-West, Government of NCT of Delhi.

1. **Bamnoli, Award 1(07-08)** — Dwarka Phase II. Section 4 notification: 04-Nov-2004; Section 6: 31-Oct-2005; award: 06-Aug-2007. Award extent: 2,100 Bigha 06 Biswas; 640 Bigha 12 Biswas are covered by High Court status quo. The award total is INR 1,117,572,745. The 25 identifiers retained in this package are a subset of the status-quo schedule. The document states that possession/title cannot be changed for the affected land pending court direction. This is not a present-day title certificate.
2. **Bharthal, Award 26(02-03)** — Dwarka Phase II. Section 4 notification: 13-Dec-2000; Section 6: 07-Dec-2001; award: 22-Oct-2002. The document states a notified area of 2,904 Bigha 16 Biswas but records a discrepancy with field-book area and pending corrigendum for certain entries. Award total: INR 1,255,465,435.34. Nine selected identifiers are retained from a CWP/status-quo schedule. Overall possession is not inferred as complete.

Amounts above are **award amounts, not verified payments**. Bigha-Biswa is preserved as published; no cross-State hectare conversion is assumed. Claimant names were omitted from the package. Detailed rows and source page references are in `server/data/land_acquisition_awards_extracted.json` and `.csv`.

Official catalogue references:
- Bamnoli: https://revenue.delhi.gov.in/land-acquisition/7227
- Bharthal: https://revenue.delhi.gov.in/land-acquisition/7280

Official award PDFs:
- Bamnoli Award 1(07-08): https://revenue.delhi.gov.in/sites/default/files/revenue/land-acquisition-award/bamnoli-1_07-08.pdf
- Bharthal Award 26(02-03): https://revenue.delhi.gov.in/sites/default/files/revenue/land-acquisition-award/bharthal_26_02-03.pdf

## Owner/parcel verification semantics

The status `AUTHORITY_VERIFIED_SOURCE_RECORD` means that the competent reviewer has inspected the captured source record and the imported fields match that source. It does **not** assert that the applicant is the legally indefeasible owner, that all co-owners/charges/litigation have been found, or that a statutory mutation has been registered. SHA-256 proves post-capture integrity, not the truth of the original source.

## Fabric privacy change

The channel state now contains HMAC-SHA-256 references for claimant, buyer, seller, parcel, title/address and storage references. Raw owner names, buyer names, addresses, parcel IDs and free-text rejection reasons are not written to public channel state. The HMAC key is required in `FABRIC_REFERENCE_HMAC_SECRET`, generated by the development bootstrap and must be stored in a proper secret manager in a real deployment. HMAC key rotation requires a migration plan.

## ML data/label boundary

`research/legal-case-corpus.json` is a legal-design reference set, not a training corpus. The 2026 Supreme Court case *Sahil Abdulsattar Mansuri v. Safimahamad Fafirbhai Mansuri*, 2026 INSC 626, discusses forgery allegations/FSL material during an unfinished investigation and directs further investigation; it is explicitly marked `INVESTIGATION_DIRECTION_NO_FINAL_FRAUD_FINDING` and `PROHIBITED_AS_FRAUD_LABEL`.

The ML trainer refuses to run unless a government/competent-authority source, written research authorisation, PII removal, two independent labelers, adjudicator review, at least 200 records, at least 50 records per class, at least 100 distinct case/property groups and a verified SHA-256 manifest are present. The checked-in self-test uses synthetic labels only and must not appear as real-world accuracy in a paper.

## Reproducibility commands

```bash
cd server
node --test test/core.test.js test/data-integrity.test.js test/dilrmp-sync.test.js test/enrichment.test.js test/fabric-privacy.test.js test/federated-land-records.test.js test/government-data.test.js test/third-party-land-records.test.js test/workflow-integrity.test.js
node ../research/verify-official-data.mjs
node ../research/security-audit.mjs
node ../research/evaluate.mjs
python ../research/train-authorised-fraud-model.py --self-test
python ../research/train-authorised-fraud-model.py   # expected exit 2 until an authorised dataset is supplied
bash ../fabric/network/preflight.sh                 # expected non-zero until Docker and credentials exist
```

## Safe academic claim

LandLedger v18 integrates official land-administration aggregates and selected public acquisition award records, provides federated/on-demand parcel lookup adapters, implements authority-reviewed source-record matching and privacy-minimised ledger evidence anchors, and includes a strictly authorised fraud-ML training/evaluation pipeline. Controlled workflow tests and synthetic pipeline self-tests demonstrate reproducibility only. The package does not contain a complete national owner/title database, a real government fraud-labelled training set, or a deployed production Fabric network.
