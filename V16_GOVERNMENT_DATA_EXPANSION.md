# LandLedger v16 — Government data expansion and acquisition/owner evidence workflow

Build date: 14-Nov-2026.

## What is now covered

1. **DILRMP aggregate owner count:** the official CLR State/UT dataset contains `totalLandOwners` per jurisdiction. The 36-row state coverage table sums to **510,604,000** aggregate owner-count records in the retrieved snapshot. These are aggregate numbers only; they are not owner names, phone numbers, or owner-to-parcel mappings. Zero values are retained as source-reported values and are not interpreted as proof that a jurisdiction has no landowners.
2. **State RoR portal directory:** LandLedger exposes official State/UT RoR portal links and the DILRMP directory status. A portal link does not imply an open API or permission for bulk extraction. Some portals may require a parcel reference, OTP, CAPTCHA, login, fee, or a formal request.
3. **LACRRIS acquisition dashboard:** latest indexed public dashboard values observed during the 14-Nov-2026 research build: 4,862 projects; 7,244 project segments; 1,885,809 hectares acquired; 127,987 project-displaced families; 27,401 project-affected families; ₹13,015,754,427 compensation; ₹2,306,761,502 rehabilitation/resettlement. The source says data is updated by State Governments/UT Administrations and DoLR and does not expose one national data-as-of timestamp. A currently accessible older cached rendering showed 4,838 projects and 1,885,757 hectares; this older cache is retained separately and not treated as a time series.
4. **LACRRIS detailed reports:** the public State/UT report selector lists all 36 jurisdictions. Its published report fields include project name, governing Act, land-requiring body, district, rural/urban classification, land extent, SIA/preliminary notification/publication/award/payment/possession timelines, family counts, compensation and R&R. This is a query-driven interactive report. There is no static nationwide case export represented in this ZIP; no missing-state row is coded as zero acquisition.
5. **West Bengal specific records:** official BanglarBhumi services expose RS-LR plot information, mutation status and related citizen workflows. The West Bengal UDMA “Know Your Property” procedure describes OTP-based login and searches by district/block/mouza plus khatian or plot number. Those are parcel lookups, not open bulk downloads.
6. **NGDRS:** kept separate as registration activity (26 reporting jurisdictions in the bundled snapshot), not treated as proof of ownership or title.
7. **Survey of India ABDB:** kept as administrative geography only, not cadastral plot geometry or ownership.

8. **All-India portal and acquisition expansion (v16):** the UI now lists 36 State/UT land-record source links, 36 LACRRIS report selector rows, 14 selected official acquisition notice/award metadata entries across seven jurisdictions, and DILRMP current/legacy map-digitisation source status. Source rows retain unknown fields as null; the detailed state report must be selected and imported before state-specific acquisition totals appear.
9. **Import and privacy controls:** authority/admin users can import selected official LACRRIS project rows and lawful parcel evidence. Project imports reject owner/contact personal fields; parcel owner names are stored as restricted personal data and withheld from normal API responses. The package still includes zero person-level owner rows.

## New application interfaces

Authenticated endpoints:

- `GET /api/government-data/summary`
- `GET /api/government-data/states?q=<state-or-code>`
- `GET /api/government-data/acquisition?state=<state-code-or-name>`
- `GET /api/government-data/parcels?stateCode=<code>&parcelIdentifier=<plot-or-khasra>` (owner names restricted to authority/admin)
- `GET /api/government-data/sources`

Data files:

- `server/data/state_land_data_coverage.json` — 36 State/UT owner aggregates, portal metadata and LACRRIS selector mapping.
- `server/data/land_acquisition_lacrris_snapshot.json` — national LACRRIS KPI snapshot and state/district/project report schema/links.
- `server/data/parcel_ownership_evidence.json` — intentionally empty evidence store; no personal owner rows were fabricated.
- `server/data/land_acquisition_cases.json` — intentionally empty case store; no case/award/compensation rows were fabricated.
- `server/data/government_data_source_registry.json` — source registry and ingestion policy.
- `server/data/state_record_portals.json/.csv` — all 36 State/UT official record portal/authority links.
- `server/data/land_acquisition_national.json`, `land_acquisition_state_coverage.csv`, and `land_acquisition_notices.json/.csv` — LACRRIS dashboard, report selectors and selected public acquisition notice references.
- `server/data/dilrmp_map_legacy_mis3.json` / `dilrmp_map_current_mis4.json` — separate legacy snapshot and current MIS 4.0 capture status.
- `server/data/schemas/*.schema.json` and `*_import_template.csv` — structured import contracts.

## Import official case/parcel data when a lawful export or source record exists

```bash
node server/scripts/import-verified-public-records.mjs acquisition ./your-lacrris-export.json
node server/scripts/import-verified-public-records.mjs parcel ./your-state-ror-evidence.json
```

The importer requires source URL, retrieval time and required fields, accepts only official `*.gov.in` / `*.nic.in` source domains, checks the access basis for parcel records, creates a SHA-256 evidence fingerprint and de-duplicates rows. It does not crawl websites, bypass OTP/CAPTCHA/login, or invent absent values. For a personal owner field, collect only the minimum legally public information and keep the access basis documented.

## Status rules (important)

- `aggregateLandOwners` is an aggregate count, not an identity register.
- `SOURCE_CAPTURED_UNVERIFIED` is not authority verification.
- `AUTHORITY_VERIFIED` must be set only by the competent authority after checking the issuing record.
- Absence of a case/parcel row means `UNKNOWN`, not “not acquired”.
- Project-level hectares cannot be assigned to individual plots without an official matching parcel identifier.
- A DILRMP RoR link or BhuNaksha customisation flag is not proof of a downloadable parcel API.
- SHA-256 proves integrity of captured bytes after hashing, not that the original document or title is genuine.

## State and acquisition coverage boundary

- The 36 CLR rows contain published aggregate land-owner metrics totalling 510,604,000 in the captured State/UT snapshot. This is not a deduplicated count of unique people and contains no names or parcel ownership links.
- The State portal directory has 36 official source/access URLs and zero verified open bulk owner APIs. Portal listing does not mean full State-wide online RoR coverage.
- LACRRIS State/UT selection covers 36 jurisdictions; state-level project/area/compensation numbers remain null until their selected report output is imported. National aggregate values are not allocated across States.
- The notice catalogue contains 14 selected metadata references across 7 jurisdictions. It is not a complete acquisition register; several linked PDFs still need extraction and parcel/award reconciliation.
- Current MIS 4.0 map report rows are not yet captured in this static build; the authority refresh connector is included. Legacy MIS 3.0 figures are kept separate.

## Live source links

- DILRMP State/UT CLR: https://dilrmp.gov.in/physicalProgressReports/clr/state-level
- DILRMP State/UT RoR directory: https://dilrmp.gov.in/dilrmpold/State-RoR-Web
- LACRRIS dashboard: https://larr.dolr.gov.in/faces/common/dashboard.xhtml
- LACRRIS State/UT report: https://larr.dolr.gov.in/faces/public/rptLandAcqProg2.xhtml
- LACRRIS district report: https://larr.dolr.gov.in/faces/public/rptLandAcqProg3.xhtml
- LACRRIS project report: https://larr.dolr.gov.in/faces/public/projectwise.xhtml
- BanglarBhumi: https://banglarbhumi.gov.in/
- West Bengal “Know Your Property” process: https://udma.wb.gov.in/page/cms/know_your_property_procedure_a353e3
- NGDRS: https://ngdrs.gov.in/NGDRS_Website/data-grid.php?lang=en
- Survey of India ABDB: https://surveyofindia.gov.in/pages/administrative-boundary-data-base-abdb-
