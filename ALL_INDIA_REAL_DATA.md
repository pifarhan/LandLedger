# All-India official public-data coverage — 14 November 2026

LandLedger contains 36 State/UT records for current DILRMP CLR aggregate indicators. It does **not** contain 36 State/UT parcel-owner databases.

## DILRMP aggregate CLR layer

- Publisher: Department of Land Resources, Government of India
- Source: https://dilrmp.gov.in/physicalProgressReports/clr/state-level
- Snapshot date: 14-Nov-2026
- Coverage: 28 States + 8 Union Territories = 36 unique jurisdiction rows
- Included metrics: districts, tehsils, villages, RoR totals and computerisation, cadastral-map linkage, village CLR completion, aggregate landholder reporting, gender aggregate metrics where reported, and service-capability flags.

The snapshot is reconciled to the published national Grand Total for districts, tehsils, villages, RoR, computerised RoR, village CLR completion and aggregate landholder count. The live refresher now requires all 36 rows and Grand Total reconciliation before it will replace the stored snapshot.

## Other official source layers

- NGDRS live State IGR dashboard: 26 reporting rows within the 36-jurisdiction master; 10 not reported in this live feed.
- NGDRS manual data-entry table: five old rows in a separate snapshot with each row's update date. This is not merged with live totals.
- Survey of India ABDB: State/District/Sub-District administrative boundary reference. 780 assignable district features and 6,578 complete sub-district rows from the supplied archive; disputed and incomplete rows are flagged.
- DILRMP village-level subset: 14 historical rows from Karnataka and West Bengal with 2024 status dates. This is not a current all-India village census.

## v16 expansion — owners, portals and land acquisition

- The current DILRMP CLR snapshot includes a State/UT `Total No. of Land Owners` aggregate field for 36/36 jurisdictions; the source snapshot totals 510,604,000 aggregate count entries. This must not be described as 510.6 million unique people: the data is aggregated by State/UT and does not provide named owners or a deduplicated person-to-parcel register. Gender-based counts are published for only the jurisdictions/districts where the source reports them.
- The official land-record/competent-authority directory now has 36/36 State/UT access URLs. The directory records source links, not bulk access. Bulk API rights are not verified for any jurisdiction.
- The LACRRIS national dashboard snapshot observed 14-Nov-2026 reports 4,862 projects, 7,244 project segments, 1,885,809 hectares, 127,987 project-displaced families, 27,401 project-affected families, ₹13,015,754,427 compensation and ₹2,306,761,502 R&R. Exact national as-of time is not printed in the captured result.
- The LACRRIS report selector lists all 36 jurisdictions; state-wise metrics remain null until a selected official report is imported. The 14 bundled notice/award metadata entries cover 7 jurisdictions and are selected references, not a complete all-India acquisition inventory.
- Current DILRMP MIS 4.0 map report schema and a refresh connector are included, but the full 36-row MIS 4.0 extract is not bundled. Legacy MIS 3.0 national map/ULPIN counts are separately labelled and must not be presented as current values.

## What is not included

No individual owner identities, parcel title/ownership rows, deed contents, mutation histories or encumbrance records are fabricated or bulk-scraped. State portal links are directory references; they do not imply a public bulk API or permission to extract personal property data.

## Research interpretation

Use DILRMP/NGDRS for aggregate administrative context and ABDB for geographic hierarchy. Use clearly marked self-submitted claims for application-workflow experiments. For owner-level validation or real fraud ML, obtain authorised, privacy-protected, labelled datasets through an appropriate government data-sharing process.
