# LandLedger v18 — Advanced Land-Record and Property Transaction Research Prototype

> **Academic research prototype, not a government land registry.** This project combines public land-administration aggregates, selected government acquisition award extracts, federated single-parcel lookup connectors, authority-reviewed source evidence and a privacy-minimised permissioned-ledger integration. It does not claim to hold every Indian owner's identity or every legally current title record.

## v18 highlights

- 36-State/UT official DILRMP CLR aggregate snapshot and State/UT land-record portal directory.
- Survey of India ABDB administrative hierarchy; this is administrative geography, not cadastral parcel geometry or title.
- NGDRS aggregate registration reporting with separate live/manual snapshots.
- LACRRIS national acquisition dashboard snapshot and 36 State/UT report selector rows.
- 58 selected official acquisition notice/catalogue metadata entries; includes 19 GNCTD Delhi award PDF links from Bamnoli and Bharthal catalogues.
- Two detailed human-reviewed GNCTD award imports (Bamnoli Award 1(07-08), Bharthal Award 26(02-03)) with source pages, dates, award amount, selected parcel identifiers, status-quo/area discrepancy notes and possession/payment boundaries.
- RBIH ULI Next-Gen on-demand single-parcel connector (institution onboarding/credentials/consent required) and optional India Property Register paid single-plot lookup (private third-party API key/terms required).
- Source-document extraction and parcel evidence import; every imported row starts unverified and requires source-specific authority review.
- Real fraud-ML trainer with permission/de-identification/adjudication/label-count/group-split gates; no real government dataset is bundled.
- Hyperledger Fabric Gateway and chaincode; public channel state uses HMAC-SHA-256 references for owner/parcel/title/address/storage attributes, not raw names or plot IDs.
- Blank default transaction ledger; no fabricated people, properties, documents or transfers.

## Quick start

Requirements: Node.js 20+ and npm. Install packages separately because the root, API and client are separate workspaces.

```bash
cp .env.example .env
# Set a strong JWT_SECRET and database configuration.
npm install
npm install --prefix server
npm install --prefix client
npm run dev
```

Open `http://localhost:5173`; the API defaults to `http://localhost:5000/api`. The default local mock ledger is blank. Public signup cannot create authority/admin roles; provision an authority account through the controlled organisation setup.

## Main data files

| File | Included data | Boundary |
|---|---|---|
| `server/data/dilrmp_state_level_current.json/.csv` | 36 State/UT CLR aggregate rows, including published aggregate land-owner indicators | Not named owners, not a unique citizen count, not an owner-to-parcel mapping |
| `server/data/state_record_portals.json/.csv` | 36 official State/UT RoR/land-record portal/authority references | A portal URL is not bulk API access or a complete title feed |
| `server/data/abdb/abdb-hierarchy.json` | State/district/sub-district administrative hierarchy | Not cadastral plot geometry or title |
| `server/data/ngdrs_registration_activity.json/.csv` | National State/UT master, 26 reporting aggregate rows | Not deed contents or personal parties |
| `server/data/land_acquisition_national.json` | LACRRIS national dashboard snapshot, 36 report selectors and 2 detailed Delhi award imports | Not all State/UT cases; award amount is not proof of payment; no universal acquired-parcel join |
| `server/data/land_acquisition_notices.json` | 58 selected notice/catalogue entries, including 19 Delhi award PDF entries | Selected references, not an exhaustive nationwide case census |
| `server/data/land_acquisition_awards_extracted.json/.csv` | Two human-reviewed GNCTD award documents with selected schedule references | Not complete award schedules, not current title certificates, not payment proof |
| `server/data/land_acquisition_imports.json` | Runtime authority imports of source-backed acquisition case rows | Kept separate from checksum-verified bundled snapshots; does not modify national dashboard totals |
| `server/data/parcel_ownership_evidence.json` | Evidence store and schema | 0 named owner/parcel rows bundled; empty until lawful source-backed import |
| `server/data/manifest.json` and `CHECKSUMS.sha256` | SHA-256 integrity manifest for 41 selected public/reference data files plus raw ABDB RAR checksum | Integrity after capture, not source truth/legal authenticity |

## Owner and parcel lookup connectors

### RBIH / ULI Next-Gen Land Records Service

The adapter uses one exact parcel query and asynchronous request/poll flow. It requires eligible institution onboarding, approved endpoint and credentials, IP allowlisting and consent configuration. No credentials or owner data are shipped in the ZIP. A separate RBIH LRS v3 coverage guide is tracked separately from Next-Gen; do not treat the two interfaces as identical.

### India Property Register (IPR)

IPR is an independent commercial aggregator, not a government registry. It provides an optional on-demand village/plot lookup flow when `IPR_API_KEY` is configured. Calls may be billable and provider terms apply. The connector does not bulk-enumerate villages and does not persist responses by default. Provider coverage claims must be checked per State/layer; no third-party result should be presented as a certified State RoR or final title adjudication.

```env
# RBIH / ULI: enable only after institutional approval and onboarding
RBIH_LRS_ENABLED=false
RBIH_LRS_BASE_URL=
RBIH_LRS_CLIENT_ID=
RBIH_LRS_BEARER_TOKEN=
RBIH_LRS_CONSENT_ID=

# IPR: server-side secret only; paid on-demand requests
IPR_API_KEY=
```

## Source-record verification flow

1. Submit State/UT, district, village, exact plot/khasra/dag identifier and record reference.
2. Declare access basis: public record, authority export, consented submission or authorised API response.
3. Upload the exact source file. The server calculates SHA-256 and extracts PDF text/OCR candidates.
4. Machine matching requires the exact parcel key and source reference; holder text must match if machine text permits.
5. A competent reviewer must inspect the source and record the method/review note. Client-supplied `verifiedByAuthorityId` is ignored.
6. The result becomes `AUTHORITY_VERIFIED_SOURCE_RECORD`, which only means the stored fields match the reviewed source. It is not statutory title adjudication or mutation.

## Acquisition module

The LACRRIS national aggregate is preserved as an aggregate and is never divided across States. State report data stays null until a real selected report has been imported. The two detailed Delhi awards preserve Bigha-Biswa as published; no cross-State unit conversion is invented. Compensation is explicitly labelled award amount, not disbursed payment. Status-quo parcels remain distinct from possession-taken parcels. The API exposes selected State filtering, source links, extraction and evidence import routes.

## Fraud ML governance

Run the self-test:

```bash
python research/train-authorised-fraud-model.py --self-test
```

This uses synthetic data only and outputs `metricsAreResearchEvidence: false`. A real run requires `research/private-data/records.csv` and `manifest.json` with written government/competent-authority permission for fraud-detection research, de-identification, two independent labelers, adjudicator review, final-judgment/authority-confirmed labels, SHA-256, 200+ records, 50+ per class and 100+ distinct case groups. Until then `realGovernmentMLReady` must remain false. Allegations, FIRs, pending investigations, bail orders and synthetic examples are not ground-truth fraud labels.

## Hyperledger Fabric

The code includes separate application-service and authority identities, chaincode and a development bootstrap using Fabric Samples `test-network`. The channel stores HMAC-SHA-256 references and SHA-256 source digests, not raw owner names, address, buyer name, plot number or free-text rejection reason. `FABRIC_REFERENCE_HMAC_SECRET` must be a securely stored 32-byte minimum secret; do not commit it. See `research/FABRIC_PRODUCTION_READINESS.md` for a production topology and go-live checklist.

The included `test-network` bootstrap is **development only**. This release has not deployed a production Fabric network or measured live TPS/latency. Production requires a State/authority consortium, orderers/peers/PKI/HSM, governance, operations, security review and a target environment.

## Validation

Detailed results are in `V18_FINAL_BUILD.md` and `TEST_REPORT.md`. Reproducible commands are in `V18_ADVANCED_GAP_CLOSURE.md`. This packaging environment supports dependency-free tests and source checks but does not have npm app dependencies or a Docker daemon; API integration, full Vite build and live Fabric deployment remain external prerequisites.

## Core legal/data boundary

- A person appearing in a RoR or award document is not automatically a current legally indefeasible title holder.
- A registered deed or self-submitted record does not itself prove every current ownership/charge/litigation fact.
- SHA-256 proves post-capture file integrity; it does not certify original authenticity.
- ABDB is administrative boundary data, not cadastral title data.
- A workflow approval is an application decision, not statutory mutation or court adjudication.
- Real title data remains under State/UT custodianship and applicable legal/privacy/access controls.

## Project documentation

- `V18_FINAL_BUILD.md` — build and validation report.
- `V18_ADVANCED_GAP_CLOSURE.md` — gap-by-gap status, acquisition details and safe claims.
- `GAP_CLOSURE_REPORT.md` — research gap mapping.
- `PAPER_READY.md` — defensible academic contribution language.
- `DATA_PROVENANCE.md` and `REAL_DATA_AUDIT.md` — public data sources and scope boundaries.
- `FEDERATED_OWNER_PARCEL_INTEGRATION.md` — RBIH/IPR connector setup and access boundaries.
- `research/FABRIC_PRODUCTION_READINESS.md` — production Fabric requirements.
- `research/private-data/README.md` — authorised fraud dataset requirements.
