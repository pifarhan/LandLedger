# Owner-by-owner, parcel/title and owner-to-parcel research-gap closure (v17)

## Executive result

v17 upgrades the project from portal-directory/import-only coverage to two on-demand lookup connectors and an authority-reviewed evidence workflow:

1. **RBIH / ULI Next-Gen Land Records Service** — official, asynchronous, single-parcel queries for the 12 State government backends listed in RBIH's current public documentation. Access requires institutional onboarding, service subscription, IP whitelisting, client credentials/JWT and the applicable consent artefact. A separate RBIH LRS v3 guide documents 14-state integration coverage, but this project does not claim to implement that separate v3 protocol.
2. **India Property Register (IPR)** — optional commercial third-party aggregation API. Its documentation says its plot layer is loaded for 28 of 36 jurisdictions; coverage and freshness vary by State and record layer. It can resolve a village LGD code + plot number to a provider plot ID and then return holders as published, share, mutation/deed/charge/notice fields and source/read date when available. It is not a government API and its response is not a certified copy or proof of title.
3. **Authority-reviewed source evidence** — lawful official/authorised State record exports can be imported with source URL, source record reference, retrieval time, access basis and SHA-256. The reviewer must upload the exact reviewed source document; the server computes its SHA-256. The system labels the result `AUTHORITY_VERIFIED_SOURCE_RECORD` / `AUTHORITY_CONFIRMED_IN_SOURCE_RECORD`; it never labels the result a final legal title adjudication.

## The three requested gaps

| Requested gap | v17 implementation | What is actually in this ZIP | Honest closure status |
|---|---|---:|---|
| Named owner-by-owner records | RBIH and IPR on-demand query connectors; owner names from sources are authority/admin-only in the local evidence store | 0 imported person-level rows; no real provider credentials included | Lookup workflow implemented; nationwide owner population not acquired |
| All parcel/khasra/dag/plot title records | State RoR portal directory, source-specific identifier registry, single-parcel connectors, parcel evidence schema/import, ABDB administrative location validation | 0 nationally complete parcel/title rows | Parcel lookup capability for selected provider coverage; not a complete national title dataset |
| Verified owner-to-parcel relationship | Exact parcel/source-record fields, provenance, source document upload, server-computed hash, authority reviewer identity/time and verification history | 0 preloaded holder/parcel relationships | Verification lifecycle implemented; no live record has been authority-verified in the shipped blank dataset |

## Provider and jurisdiction limits

### RBIH / ULI Next-Gen

- Public docs list 12 state backends: Madhya Pradesh, Uttar Pradesh, Maharashtra, Odisha, Tripura, Andhra Pradesh, Tamil Nadu, Chhattisgarh, Rajasthan, Gujarat, Assam and Karnataka.
- Lookup is asynchronous: submit `/api/v1/land-records/query`, receive a `request_id`, then poll `/api/v1/land-records/requests/{id}`.
- State-specific primary identifiers are retained in `server/data/federated_land_records_registry.json`.
- This connector is disabled until an eligible institution obtains and configures its own credentials. No RBIH credential or consent artefact is bundled.
- A separate v3 guide lists 14-state lender API coverage and requires the `consent-id` header. That is documented as a separate interface and is not represented as a tested v17 connector.

### India Property Register

- Independent private provider, not the Government of India, a State revenue department or a statutory registry.
- Its documentation reports plot records for 28/36 jurisdictions and lists Arunachal Pradesh, Chandigarh, Ladakh, Meghalaya, Mizoram, Nagaland, Sikkim and Uttarakhand as not loaded in the cited coverage page.
- Each successful provider call is documented at ₹0.40. An LGD/plot search followed by a full detail lookup may use two billable calls.
- The connector is disabled until the operator supplies their own provider key in `IPR_API_KEY` on the server only.
- v17 performs only on-demand place/parcel lookup and full detail display. It does not bulk download, cache or persist IPR personal data. The provider terms prohibit bulk scraping, redistribution/resale, sublicensing, competing-database construction and AI training/evaluation without written licence.
- Provider coverage/count statements are provider claims and have not been independently audited by this project. Query `/coverage` or check provider documentation before relying on current state coverage.

## State custody and lawfulness

DILRMP 3.0 describes a federated National Land Stack. State/UT departments remain owners and custodians of their datasets; secure, standardised APIs are used for authorised sharing subject to applicable law, privacy and security requirements. Consequently, the 36 government portal links are not 36 open bulk APIs. A State-specific citizen lookup page, login, OTP, CAPTCHA, or a displayed holder name does not grant the project permission to scrape and republish all records.

## Run/configure the connectors

### RBIH ULI Next-Gen

Configure only after institutional approval and service onboarding:

```env
RBIH_LRS_ENABLED=true
RBIH_LRS_BASE_URL=https://<the-subscribed-rbih-endpoint>
RBIH_LRS_CLIENT_ID=<institution-client-id>
RBIH_LRS_BEARER_TOKEN=<short-lived-jwt>
RBIH_LRS_CONSENT_ID=<purpose-specific-consent-reference-if-issued>
RBIH_LRS_SCOPE=1
```

Never commit credentials. The authority/admin UI submits a single State/district/village/primary-identifier query and then polls for its result. The backend audits only the request ID, state, status and hashes; it does not log holder names into the application ledger.

### India Property Register

```env
IPR_API_KEY=<your-provider-api-key>
IPR_API_TIMEOUT_MS=15000
```

The key is used server-side only. The UI offers village/place search, selection of the numeric LGD village code, exact plot number lookup, and opening a selected provider plot ID. Do not enumerate a whole village or automate name searches. Check the provider coverage and wallet before using paid calls.

## Import and authority verification

Use `server/data/parcel_ownership_import_template.csv` only for lawful State-source records or authorised submissions. Provide an HTTPS government/NIC source URL, source record ID, source authority, retrieval timestamp, access basis and exact parcel identifier. Imported rows are forced to `SOURCE_CAPTURED_UNVERIFIED`; caller-supplied `verifiedByAuthorityId` and status labels are ignored.

The authority verification endpoint now requires the exact reviewed source document as a multipart file. The server computes SHA-256 from the uploaded bytes. This makes the evidence fingerprint reproducible; it does not prove the government signature or confer title. The authority review method/reference/source URL are preserved in the record and ledger.

## What is required to claim full nationwide coverage

A claim of complete person-level title coverage would require, for every State/UT, (a) a lawful data-sharing agreement or public/API licence, (b) authenticated current RoR and cadastral parcel data, (c) village/district/tehsil code mapping, (d) mutation and encumbrance history, (e) temporal versioning, (f) source-record document signatures or issuing-office verification, (g) personal-data security and purpose controls, and (h) State revenue authority confirmation of disputed/legacy/customary rights. v17 does not have these agreements or 36-state feeds; no engineering-only shortcut can substitute for them.

## Safe research claim

> v17 implements a federated and licensed on-demand land-record access layer, a source-provenance-aware parcel evidence import model, and an authority-reviewed source-record matching workflow. It integrates official State/UT aggregate data and administrative geography, documents provider-reported parcel lookup coverage, and experimentally validates connector behaviour using mocked API responses. It does not claim a complete all-India person-level title dataset or statutory title adjudication.
