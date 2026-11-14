# LandLedger v16 — final build report

Build date: 14 November 2026

## What changed

- Added official State/UT land-record portal/authority directory: 36/36 jurisdictions, JSON and CSV exports; added CSV exports for state owner aggregates, State/UT acquisition status and acquisition notices.
- Preserved DILRMP CLR aggregate land-owner values and gender-based aggregate indicators for all 36 State/UT rows. These are aggregate source figures, not named owners, unique-person counts or parcel-title relationships.
- Added LACRRIS national acquisition snapshot and all 36 State/UT report selector rows. Added a 14-row official notice/award catalogue covering 7 jurisdictions, with numeric area/compensation only where captured in the public source.
- Added current MIS 4.0 map-digitisation source link and an authority/admin refresh connector. Kept legacy MIS 3.0 map/ULPIN data in a separate file; it is not presented as current data.
- Added source provenance, null-not-zero semantics, SHA-256 dataset manifest/checksums, authenticated import routes, CSV exports, deduplication and role-based restricted handling for owner names.
- Removed no new rows from the blank initial ledger; demo account/property/document/transfer/event fixtures remain absent.

## Data present

| Layer | Coverage in this package |
|---|---|
| DILRMP CLR | 36 State/UT aggregate rows; snapshot aggregate land-owner count 510,604,000 |
| State RoR/authority directory | 36 official source/access URLs; 0 verified open bulk owner APIs |
| LACRRIS | National snapshot; 36 State/UT report selectors; state-specific case/area/compensation values remain null until an actual selected report is imported |
| Acquisition notices | 14 selected metadata entries across 7 jurisdictions; not a complete national inventory |
| DILRMP map digitisation | Current MIS 4.0 source schema and refresh connector; complete 36-row capture not bundled |
| Legacy map/ULPIN | Separate MIS 3.0 snapshot; historical, as-of date not visible |
| Person-level parcel evidence | 0 rows bundled; authority/admin import path available for lawful source-backed data |
| Default transaction ledger | 0 users, properties, documents, transfers and events |

## Validation performed

- Targeted Node test suite: 9 passed, 0 failed (`server/test/enrichment.test.js`, `server/test/government-data.test.js`).
- Official data verifier: PASS; 36 State/UT registry and CLR rows, 36 portal links, 36 acquisition selectors, 14 acquisition notice rows, empty parcel evidence, blank ledger, 33 manifest file checksums, raw ABDB RAR SHA-256.
- Research evaluation ran successfully, including the controlled workflow cases and clearly labelled synthetic fraud-risk holdout.
- Static security source audit ran successfully; it is not a penetration test.
- `node --check` passed for modified backend and research JS files; TypeScript JSX transpilation passed for the React entry file.

## Not claimed / remaining external dependencies

- There is no single nationwide open owner-by-owner title/parcel dataset in this build. Each State/UT has its own legal records, access rules and coverage. Portal links do not grant bulk export permission. Meghalaya, Mizoram and Nagaland have explicit non-uniform/limited coverage caveats.
- The project contains no named private owner rows. The owner evidence store remains empty until lawfully published records, authorised exports or consented evidence are supplied. Owner names, if lawfully imported, are restricted to authority/admin API responses and remain source-captured-unverified.
- LACRRIS State/UT figures are not invented from the national totals. The public selector requires a State/UT query; missing detail remains null, not zero. The 14 notice rows are examples/catalogue references, not a complete nationwide acquisition inventory.
- Current MIS 4.0 map data is not a completed static 36-State extract in this package; the refresh connector may capture it on a running server with network access.
- Full npm/Vite/API integration tests were not run in the packaging environment because npm dependencies (`express`, `vite`, etc.) are not installed. Install the root, server and client dependencies, then run the commands in README.
- LandLedger remains an academic prototype, not a government registry. A workflow approval is not statutory title transfer. SHA-256 detects post-capture changes, not original-document truth.
