# LandLedger v16 — India-wide public-data enrichment

Build date: 14 November 2026  
Project type: academic prototype / research reproducibility package  
Primary boundary: LandLedger is not a statutory land registry and does not determine legal title.

## 1. Data layers added

### DILRMP CLR — State/UT land-owner aggregates

- The current DILRMP CLR state-level source is represented for all 36 States/UTs.
- Its published `Total No. of Land Owners` is preserved as a State/UT aggregate. Gender-based male/female/total counts are retained where the source reports them.
- The DILRMP aggregate is not a list of named individuals, not a deduplicated unique-person count, and not a person-to-parcel ownership relation.
- Missing source values are not inferred from other columns. A source-reported zero remains a source-reported value; it is not an independent proof that no owners exist.

### State/UT official record access directory

- `server/data/state_record_portals.json/.csv` lists 36 State/UT government or competent-authority access references.
- The directory supplements the older DoLR RoR-on-Web directory with newer official portals for Arunachal Pradesh, Haryana, Kerala, Ladakh, Madhya Pradesh, Meghalaya authority context, Mizoram, Nagaland, Rajasthan, Sikkim, Dadra & Nagar Haveli and Daman & Diu, and Uttar Pradesh.
- 36/36 jurisdictions now have an official source/access URL in the directory. This does **not** mean 36 complete online title registers exist.
- Bulk API/export permission is marked `NOT_VERIFIED` for every jurisdiction. No owner-by-owner names are scraped or bundled.
- Meghalaya is an explicit authority-reference exception: the State government describes land administration through Autonomous District Councils and no uniform State-wide RoR. The Garo Hills Council portal is limited to that Council area.
- Mizoram's official department describes the State as having limited/non-uniform land-record coverage while e-Ram provides application services. Nagaland's ROR portal is useful for the areas recorded, but the Directorate describes the survey/record system as limited to Dimapur, towns, administrative headquarters, government lands and surveyed pockets; customary tenure continues to matter.

### LACRRIS — national land-acquisition dashboard

The later publicly indexed LACRRIS dashboard snapshot observed on 14-Nov-2026 reports:

| Metric | Value |
|---|---:|
| Projects | 4,862 |
| Project segments | 7,244 |
| Area acquired | 1,885,809 hectares |
| Project displaced families | 127,987 |
| Project affected families | 27,401 |
| Compensation | INR 13,015,754,427 |
| Rehabilitation and resettlement | INR 2,306,761,502 |

The live dashboard does not expose a single national `as-of` timestamp in the captured page. An older cached page rendering exposed 4,838 projects and 1,885,757 hectares. These two observations are kept as provenance context, not as a time series. Recheck the live dashboard before operational/legal reliance.

### LACRRIS State/UT report coverage

- All 36 State/UT options are represented in `land_acquisition_national.json`.
- The public report is interactive and requires a State/UT selection, with optional district/project filters.
- State-specific project counts, acquired hectares and compensation remain `null` until the relevant selected report is retrieved and imported. `null` means not ingested; it does not mean zero acquisition.
- The importer does not add project-level rows to national dashboard totals because the detailed report can include project segments and overlaps. This avoids double counting.

### State/district acquisition notices and award references

The package includes 9 official government source catalogues and 14 selected metadata entries covering Maharashtra, Odisha, Puducherry, Kerala, Tamil Nadu, Rajasthan and Punjab:

- Maharashtra: Pune and Gadchiroli district announcements plus Nashik final-award catalogue entries.
- Odisha: Revenue Department land-acquisition communication index, including Astaranga Port Special LA Cell order.
- Puducherry: SIA and award-enquiry notice entries; the raw area string `00-47-00 (H.A.Ca)` is preserved without an unsupported unit conversion.
- Kerala: Revenue Department GO index records include 84.906 ha in Kannur, 1.99 ha in Ernakulam, and 63.11 Ares (0.6311 ha) in Malappuram. These are notification/extension/sanction titles, not a parcel-wise possession dataset.
- Tamil Nadu: Extraordinary Gazette land-acquisition notice index; district/area/compensation are not visible in the index snippet.
- Rajasthan: RIICO's official JPMIA order states 1,086.4494 ha acquired for the Jodhpur-Pali-Marwar Industrial Area and that the award was declared 02-Jan-2026. The owner/parcel schedule is not bundled.
- Punjab: GMADA public notice catalogue provides village-level linked notice PDFs; numeric areas and compensation are left blank until the official PDFs are extracted.

These 14 entries are not a complete national acquisition register. Areas are not summed across notices because entries can be notices, amendments, award extensions or related project segments.

### DILRMP map digitisation / ULPIN

- Current MIS 4.0 State/UT map-digitisation report schema is linked and a runtime refresh connector is included. The source uses multi-row grouped headers, so the connector preserves raw cells and avoids guessing column semantics.
- The current MIS 4.0 source page could not be captured as a complete 36-row static extract during packaging; it is marked `NOT_YET_CAPTURED` until the authority refresh succeeds.
- Legacy MIS 3.0 map/ULPIN data is retained in a separate file. Its national snapshot reports 287,570,549 land parcels, 104,246,021 geo-referenced parcels and 84,370,218 ULPIN assignments. Its data-as-of date is not visible in the captured source, so it must not be combined with MIS 4.0.
- A fully inspected legacy West Bengal district report shows 22 district rows and 33,280,640 land parcels, 263,390 geo-referenced parcels and 249,200 ULPIN assignments. This is legacy MIS 3.0, not current MIS 4.0.
- Administrative boundary hierarchy data from Survey of India ABDB remains a separate geography layer; it is not cadastral parcel boundary or title data.

## 2. Import APIs and controls

All endpoints require an authenticated session. Imports/refresh require `authority` or `admin` role.

| Endpoint | Purpose |
|---|---|
| `GET /api/data-enrichment` | Combined portal directory, DILRMP owner aggregates, LACRRIS snapshot/notice references and map-digitisation context |
| `GET /api/land-acquisition/records?state=WB&district=...` | Search imported LACRRIS/state acquisition rows |
| `POST /api/land-acquisition/import` | Import selected official State/UT LACRRIS CSV/JSON rows |
| `POST /api/parcel-evidence/import` | Import authorised parcel-level source evidence |
| `POST /api/map-digitization/refresh` | Attempt live capture of the current DILRMP MIS 4.0 map report |

Acquisition import requires State/UT, project name, district, source authority, source reference and an HTTPS `.gov.in` / `.nic.in` source URL. Rows are content-hashed, deduplicated, and marked `IMPORTED_PUBLIC_SOURCE_UNVERIFIED`. Personal owner/contact/identity fields are rejected from project-level acquisition imports.

Parcel evidence import requires State/UT, district, village/mouza, parcel identifier, source record ID, HTTPS official source URL and one of `PUBLIC_RECORD`, `AUTHORITY_EXPORT` or `CONSENTED_SUBMISSION`. If owner names are present, the row is marked `RESTRICTED_PERSONAL_DATA`; names are omitted from normal import response and are visible only through the authority/admin parcel evidence route. A captured source record is not a statutory title determination.

The import audit ledger records the actor, row counts and uploaded-file SHA-256; it does not copy owner names into ledger event payloads.

## 3. Reproducibility and acceptance criteria

- 36 unique State/UT registry entries.
- 36 DILRMP CLR State/UT aggregate rows.
- 36 State/UT land-record access references; 36/36 URLs present; 0 verified open bulk owner APIs.
- 36 LACRRIS State/UT report selector coverage entries; state-specific numeric values remain null until import.
- 9 official acquisition notice/award source catalogues; 14 metadata entries across 7 jurisdictions.
- No bundled owner-by-owner personal data.
- No default demo users or sample properties; the default ledger is empty.
- Unit tests cover 36-jurisdiction enrichment, LACRRIS null handling, CSV quoting, official URL policy and map report State/UT parsing.

Run:

```bash
npm test
npm run verify:official-data
npm run research:evaluate
npm run build
```

## 4. Explicit remaining work

1. Capture all 36 current LACRRIS State/UT report result sets and reconcile project segments before loading state-level numbers.
2. Obtain state-approved APIs, bulk exports or agreements for owner/parcel title data. Public portal links do not grant scraping or bulk-use rights.
3. Retrieve each linked acquisition PDF and extract award schedule, land extent, compensation and possession/release evidence with document-level hashes and review.
4. Obtain a current all-State/UT MIS 4.0 map-digitisation extract with its data-as-of date; replace legacy context when validated.
5. Match acquisition records to parcel identifiers only where the official document actually publishes a plot/khasra/dag/parcel key.

No missing owner, award, parcel or compensation value is filled with synthetic data.
