# Real Data Audit — LandLedger v18

## Public source-backed layers included

- DILRMP CLR aggregate snapshot: 36 State/UT rows, including published aggregate owner indicators.
- Survey of India ABDB State/District/Sub-District administrative hierarchy and raw source archive.
- NGDRS State IGR aggregate snapshots, live and manual channels kept separate.
- LACRRIS national acquisition dashboard snapshot and 36 State/UT report selectors.
- State/UT official RoR / land-record portal directory.
- 58 selected official notice/catalogue rows across nine jurisdictions, including 19 GNCTD Bamnoli/Bharthal award PDF listings.
- Two human-reviewed GNCTD award PDFs extracted into structured acquisition case records.
- Official Supreme Court case-law design reference, explicitly excluded from fraud labels because the judgment does not find fraud.

## Owner and parcel identity audit

| Data type | Rows in release | Meaning |
|---|---:|---|
| DILRMP aggregate land-owner counts | 36 State/UT aggregate rows | Administrative reported aggregate, not named persons or unique citizen identities |
| Named owner rows | 0 | No authorised nationwide person-level owner export supplied |
| Complete title/parcel records | 0 | No all-India cadastral/roR register bundled |
| Pre-verified owner-to-parcel relationships | 0 | Authority workflow exists, but no real pre-verified record supplied |
| On-demand RBIH connector | 12 documented Next-Gen state backends | Requires institution onboarding, credentials, endpoint/allowlisting and consent |
| On-demand IPR connector | Provider-reported plot lookup coverage for selected jurisdictions | Private third-party provider, paid key/terms, no bulk enumeration or default persistence |

## Acquisition data audit

- LACRRIS provides national dashboard KPIs and State/UT report selectors; its national total is not allocated to States.
- 58 selected official catalogue/notice metadata rows exist across nine jurisdictions.
- 19 Delhi award PDFs are indexed from official Bamnoli/Bharthal catalogues.
- Only two Delhi award PDFs have detailed human-reviewed extraction (award dates, published area, award total, selected khasra schedule references and court/status-quo/area-quality notes).
- Award amount is not proof of disbursement. Award/notification area is not proof of physical possession. Selected khasra references in an award are not current title certificates.

## Fraud ML and validation audit

- Real government fraud-labelled data bundled: 0 records.
- Real authorised model trained: no (`realGovernmentMLReady=false`).
- Synthetic ML self-test: pipeline mechanics only, `metricsAreResearchEvidence=false`.
- Real legal cases are kept as reference context only unless the final order establishes fraud and a competent authority authorises the de-identified research use. Allegations, pending investigation, FSL opinions in unfinished cases and procedural orders are prohibited labels.

## Fabric audit

- Chaincode, Gateway and development bootstrap are present.
- Channel state uses HMAC-SHA-256 references for claimant, buyer/seller, parcel, title/address and storage references; raw names, parcel IDs and free text are not on channel.
- No live Fabric deployment or benchmark occurred in the build environment. Docker daemon was unavailable and Go dependency download was blocked.

## Limitations

This release is an academic prototype, not a statutory land registry. State/UT custodianship and applicable law govern access to personal and title records. Portal links do not grant bulk access. `AUTHORITY_VERIFIED_SOURCE_RECORD` means reviewed source-field matching only, not statutory title adjudication. SHA-256 proves post-capture integrity, not the origin document's truth. No real-world fraud accuracy can be claimed without authorised, adjudicated data and external validation.
