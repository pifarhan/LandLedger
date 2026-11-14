# Data provenance and scope policy

## 1. DILRMP current CLR State/UT indicators

- **Files:** `server/data/dilrmp_state_level_current.json` and `.csv`
- **Publisher:** Department of Land Resources, Government of India
- **Source:** https://dilrmp.gov.in/physicalProgressReports/clr/state-level
- **Retrieved:** 14-Nov-2026
- **Coverage:** 36 State/UT aggregate rows
- **Purpose:** RoR totals/computerisation, village CLR completion, aggregate landholder reporting, gender-based ownership aggregates where reported, and State/UT service capability fields.

The 36 per-State/UT rows were transcribed from the official live report and reconciled to its national total for districts, tehsils, villages, RoRs, computerised RoRs, CLR-completed villages and aggregate landholder count. The national figures are also recorded in `dilrmp_national_snapshot.json`.

These figures are **administrative aggregates**, not individual landowner names or parcel/title/encumbrance records. A total landholder count is not a list of people and must not be presented as a list of owners.

## 2. Historical village-level subset

- **Files:** `dilrmp_real_snapshot.json/.csv`
- **Publisher:** Department of Land Resources, Government of India
- **Source example:** https://dilrmp.gov.in/dilrmpold/PhyscialComponent/CLR/village-level/5602
- **Coverage:** 14 source-derived village-level records in Karnataka and West Bengal, with source status dates in July/August 2024.

This subset is not a 36-State village census and is not claimed to be current 2026 village-level ownership data. The UI labels it as historical and separate from the current 36-row aggregate table.

## 3. Survey of India ABDB administrative hierarchy

- **Files:** `server/data/abdb/abdb-hierarchy.json`, `districts.csv`, `subdistricts.csv`
- **Publisher:** Survey of India, Government of India
- **Source:** https://surveyofindia.gov.in/pages/administrative-boundary-data-base-abdb-
- **Archive:** `State_District_Subdistrict_PAN INDIA.rar`
- **Archive SHA-256:** `b8325e5d9dd0f04a6663d775363fe38cd2f23bd9dbae3fb7118b4b6e0ce0bcb7`
- **Retrieved/processed:** 14-Nov-2026

The ABDB attributes support a State/District/Sub-District administrative index. It is not cadastral parcel geometry and does not identify legal owners. The derived file preserves ABDB source LGD codes separately from the current State/UT master codes.

The supplied archive contains 808 district features: 780 assigned features and 28 disputed/unassigned features. It contains 6,667 sub-district features: 6,578 rows with required attributes and 89 incomplete rows. Five disputed or unmapped State boundary features were initially observed; one was the short Andaman & Nicobar name and was normalised to the official State/UT master. Four actual disputed State boundary features remain separated. Arunachal Pradesh and Meghalaya have no usable sub-district records in this supplied archive. Duplicate source keys and quality exceptions are retained in the JSON.

ABDB feature totals do not exactly equal DILRMP's current reported administrative totals. We do not fill the difference with invented features.

## 4. NGDRS aggregate registration activity

- **Files:** `ngdrs_registration_activity.json/.csv`
- **Publisher:** Department of Land Resources / NGDRS, Government of India
- **Source:** https://ngdrs.gov.in/NGDRS_Website/data-grid.php?lang=en
- **Snapshot:** 13-Nov-2026; period 01-Jan-2017 through 12-Nov-2026
- **Coverage:** 26 dashboard-reported rows; remaining State/UT master entries are marked not reported.

These are aggregate registration activity values, not deed contents, party identities or proof of title. Values shown as zero in the source are retained as reported, not interpreted as proof of zero real-world activity.

## 5. NGDRS separate manual data-entry table

- **Files:** `ngdrs_data_entry_form_snapshot.json/.csv`
- **Publisher:** Department of Land Resources / NGDRS, Government of India
- **Source:** https://ngdrs.gov.in/NGDRS_Website/data-grid.php?lang=en
- **Page snapshot:** 10-Aug-2026; retrieved 13-Nov-2026
- **Coverage:** five rows: Kerala, Madhya Pradesh, Sikkim, Tamil Nadu and Uttar Pradesh.

Each row's own last-updated date is retained. These values are not merged into the 26-jurisdiction live State IGR feed. The 5-row manual-entry table is a separate, older reporting channel and does not alter the current NGDRS live national dashboard total.

## 6. State RoR directory / BhuNaksha flags

The 36-State/UT registry includes directory status/portal URLs from the dated DoLR RoR-on-Web report (08-May-2026) and membership flags from the NIC BhuNaksha customization list (retrieved 14-Nov-2026). A directory URL or customization-list entry does **not** prove live public parcel-level API access, bulk export permission or complete coverage.

## 6. Prohibited interpretations

- Do not derive personal owner identities or parcel-level title from aggregate counts.
- Do not scrape personal owner names from portals without a legal basis, source authorization and appropriate access controls.
- Do not call an account's self-declared name a verified legal owner.
- Do not equate ABDB geography with title/cadastral boundaries.
- Do not equate SHA-256 with source-document text consistency.
- Do not equate this application's approval/transfer workflow with statutory mutation or legal title transfer.


## 7. DILRMP aggregate owner counts and state portal coverage (v16)

- **File:** `server/data/state_land_data_coverage.json`
- **Publisher:** Department of Land Resources, Government of India
- **Sources:** https://dilrmp.gov.in/physicalProgressReports/clr/state-level and https://dilrmp.gov.in/dilrmpold/State-RoR-Web
- **Coverage:** 36 State/UT rows; State/UT aggregate land-owner counts sum to 510,604,000 in the source snapshot.
- **Portal links:** a dated DoLR State RoR directory link is retained where listed. The directory is lookup metadata, not a guarantee of open API, bulk download, or unrestricted personal-data access.

The aggregate owner field is not a list of named people, unique natural persons or verified plot-to-owner relationships. Source-reported zeros are retained as zeros but are not independently interpreted as proof that no landowners exist in the State/UT.

## 8. LACRRIS land acquisition snapshot and report links (v16)

- **File:** `server/data/land_acquisition_lacrris_snapshot.json`
- **Publisher:** Department of Land Resources, Government of India; the dashboard states that data is updated by respective State Governments/UT Administrations and DoLR.
- **Sources:** https://larr.dolr.gov.in/faces/common/dashboard.xhtml; State/UT report: https://larr.dolr.gov.in/faces/public/rptLandAcqProg2.xhtml; district report: https://larr.dolr.gov.in/faces/public/rptLandAcqProg3.xhtml; project report: https://larr.dolr.gov.in/faces/public/projectwise.xhtml
- **Retrieved:** 14-Nov-2026; dashboard does not display one national data-as-of date; values are a captured page snapshot and must be refreshed before operational or legal reliance.
- **Latest indexed dashboard observation stored in the v16 package:** 4,862 projects; 7,244 project segments; 1,885,809 hectares acquired; 127,987 project-displaced families; 27,401 project-affected families; ₹13,015,754,427 compensation; ₹2,306,761,502 R&R. A directly opened older cached rendering of the official page returned 4,838 projects and 1,885,757 hectares (plus the older family/compensation values); this is retained as an older cache observation, not merged as a time series. The newer indexed snapshot was crawled approximately two weeks before the build, but the source does not print an exact data-as-of date. The in-app refresh/check should be used before operational reliance.

The public State/UT report contains project name, Act, land-requiring body, district, rural/urban category, land extent, SIA/notification/publication/award/payment/possession timeline, affected/displaced family counts and compensation/R&R values. The state report uses interactive selectors; this package contains the national dashboard KPIs and links, not a bulk static export of every State/UT/project row. A State/UT not represented in the bundled case file is not labelled as zero acquisition.

The published report column set does not establish a universal parcel/khasra/dag/plot identifier. Project area totals cannot be joined to individual parcel records without source-supported parcel identifiers.

## 9. State land portal reference (v16)

`government_data_source_registry.json` adds official State RoR directory and specific West Bengal official service references. BanglarBhumi supports citizen-facing RS-LR Plot Information and mutation-related services; the West Bengal UDMA “Know Your Property” procedure describes OTP-based registration followed by district/block/mouza and khatian-or-plot search. These services are query workflows, not evidence of public bulk-download rights.

## 10. Evidence import / privacy and completeness policy (v16)

Case and parcel stores are intentionally empty by default. `server/scripts/import-verified-public-records.mjs` imports operator-supplied government-source JSON only after requiring key fields, source URL, retrieval timestamp and, for parcel records, a documented access basis and verification status. It accepts official `*.gov.in` / `*.nic.in` URLs, fingerprints each imported record, and de-duplicates. It does not crawl, bypass OTP/CAPTCHA/login or generate missing values. A record is not authority verified merely because it is visible on a public portal.


## 11. All-State/UT record portal and authority directory (v16)

- **File:** `server/data/state_record_portals.json`
- **Coverage:** 36 State/UT source/access URLs.
- **Use:** directs a user to the relevant State Revenue/Land Records service or competent authority. It is not a bulk extract.
- **Bulk access:** 0 verified open bulk APIs in this build. A visible portal is not an API permission, and login/OTP/CAPTCHA or fee gates are not bypassed.
- **Scope exceptions:** Meghalaya is explicitly limited by Autonomous District Council/customary tenure arrangements; Nagaland's RoR coverage is geographically limited, and Mon has a separate district portal; Mizoram's department describes the state's land-record coverage as limited/under development while e-Ram provides application services.

## 12. Selected state/district land-acquisition notice references (v18)

- **Files:** `server/data/land_acquisition_national.json`, `server/data/land_acquisition_notices.json`, `server/data/land_acquisition_awards_extracted.json` and `.csv`.
- **Coverage:** 58 selected notice/catalogue rows from 10 official source catalogues across 9 jurisdictions: Maharashtra, Odisha, Puducherry, Kerala, Tamil Nadu, Rajasthan, Punjab, NCT of Delhi and West Bengal.
- **Delhi source catalogues:** Bamnoli (8 award PDFs) and Bharthal (11 award PDFs), published by GNCTD Revenue Department: https://revenue.delhi.gov.in/land-acquisition/7227 and https://revenue.delhi.gov.in/land-acquisition/7280.
- **Detailed extracts:** two human-reviewed official PDFs: Bamnoli Award 1(07-08) and Bharthal Award 26(02-03). The Bamnoli document records 2,100 Bigha 06 Biswas total, including 640 Bigha 12 Biswas under High Court status quo, and an award amount INR 1,117,572,745. Bharthal records a Section 6 notified extent of 2,904 Bigha 16 Biswas but flags a discrepancy with field-book area, and an award amount INR 1,255,465,435.34. These are award amounts, not proof of payment. Selected parcel identifiers are from award/court schedules, not full cadastral/title records.
- **Limit:** selected catalogue records are not a complete acquisition register. Only two PDFs have detailed structured extraction. Missing area/compensation/payment/possession fields remain null; national LACRRIS totals are not allocated among States. Bigha-Biswa is retained as published and not converted across States.

## 13. DILRMP map digitisation / ULPIN (v16)

- **Current MIS 4.0 source:** https://www.dilrmp.gov.in/physicalProgressReports/map/state-level. The report schema includes cadastral maps/FMBs/Tippans, land parcels, georeferencing, map-to-RoR links and ULPIN columns. The complete 36-row current extract is not included in the static package; a live-refresh connector is supplied.
- **Legacy MIS 3.0 source:** https://www.dilrmp.gov.in/dilrmpold/MapULPIN/MapDiditizaionStateList. Its national snapshot is separately stored (287,570,549 land parcels; 104,246,021 georeferenced parcels; 84,370,218 ULPIN implemented). The captured page has no reliable data-as-of timestamp and must not be represented as current MIS 4.0.


## 14. Fraud case-law reference and training data gate (v18)

- **File:** `research/legal-case-corpus.json`.
- **Official reference:** *Sahil Abdulsattar Mansuri and Others v. Safimahamad Fafirbhai Mansuri and Others*, 2026 INSC 626, Supreme Court of India, 04-Jun-2026; official PDF: https://api.sci.gov.in/supremecourt/2025/50799/50799_2025_5_1502_71709_Judgement_04-Jun-2026.pdf.
- **Treatment:** the judgment discusses allegations and an FSL report in an unfinished investigation and directs the State to complete investigation/file a report. It does not make a final fraud finding. It is therefore marked `INVESTIGATION_DIRECTION_NO_FINAL_FRAUD_FINDING` and prohibited as a fraud-training label.
- **ML policy:** only final court findings or competent-authority-confirmed labels with written research authorisation, de-identification, two independent labelers and adjudicator review may enter the trainer. The real-government ML gate remains blocked unless the required dataset/manifest are supplied.

## 15. Fabric channel privacy anchors (v18)

The development chaincode now stores HMAC-SHA-256 references for parcel, claimant, buyer/seller, title/address, storage references and rejection text. Raw names, account identifiers, parcel numbers, addresses and free-text reasons are kept off the channel. The HMAC secret is environment-driven and excluded from Git via `.gitignore`. This is source-level privacy minimisation, not a deployed production Fabric network or a formal privacy/security certification.
