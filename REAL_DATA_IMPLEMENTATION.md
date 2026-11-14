# Real-data implementation — LandLedger v18

## What is present now

- Official DILRMP CLR State/UT aggregate snapshot: 36 State/UT rows, including aggregate land-owner counts and other progress indicators. These are not person-level owner identities.
- Survey of India ABDB administrative hierarchy for State/District/Sub-District reference. It is not a cadastral parcel/title dataset.
- NGDRS registration activity aggregate snapshots, with live/manual feeds kept separate.
- LACRRIS national acquisition dashboard snapshot and 36 State/UT report selector references.
- Selected official acquisition notice catalogue metadata, including 19 GNCTD award PDFs for Bamnoli and Bharthal.
- Two detailed, manually reviewed official Delhi award records, stored in `server/data/land_acquisition_awards_extracted.json/.csv` and integrated into `land_acquisition_national.json`.
- Official State RoR portal directory for all 36 State/UT jurisdictions.
- RBIH ULI Next-Gen on-demand single-parcel adapter (requires approved institution onboarding, endpoint, credentials and consent).
- Optional commercial IPR exact-plot lookup connector (requires paid API key and provider terms).
- Source record import, source PDF/OCR extraction, SHA-256, lawful access basis and authority-review workflow.

## What is not present

- No complete named owner-by-owner data for every State/UT.
- No complete nationwide list of every khasra/dag/plot and current title/encumbrance.
- No pre-populated, authority-certified person→parcel relationship rows.
- No complete all-State case-level acquisition/payment/possession dataset.
- No qualifying authorised government fraud-labelled ML dataset.
- No live deployed production Fabric network.

## Why missing data are not invented

A government portal URL or a publicly viewable individual record does not grant a bulk-download/API licence. State/UT custodianship, purpose limitation, privacy, data-sharing agreements and credentialed access apply. The application therefore supports exact-plot on-demand lookup and source-authorised import. All evidence starts unverified. `AUTHORITY_VERIFIED_SOURCE_RECORD` records that a reviewer matched supplied fields against the captured source record; it is not a court or statutory title adjudication.

## Delhi award examples

The Department of Revenue, Government of NCT of Delhi lists award PDFs in official catalogues:
- Bamnoli: https://revenue.delhi.gov.in/land-acquisition/7227
- Bharthal: https://revenue.delhi.gov.in/land-acquisition/7280

Two selected PDFs were manually reviewed. Bamnoli Award 1(07-08) records 2,100 Bigha 06 Biswas with 640 Bigha 12 Biswas under High Court status quo and an award total INR 1,117,572,745. Bharthal Award 26(02-03) states 2,904 Bigha 16 Biswas notified but flags area discrepancy with the field book and an award total INR 1,255,465,435.34. These are award amounts, not verified payments. The parcel IDs included are selected entries from award/court schedules, not current title records. Bigha-Biswa is preserved without assuming a pan-India conversion.

## How to lawfully populate owner/parcel data

1. Obtain the competent State/UT custodian's documented legal basis and data-sharing permission, or use the applicable institutionally authorised ULI API.
2. If using IPR, obtain and review API terms/licence and API key; default integration is exact-plot, one-record lookup, not bulk village enumeration.
3. Retrieve the certified RoR/title/parcel source and source record reference; capture retrieval timestamp, State, district, village, parcel identifier and access basis.
4. Import to the authority evidence workflow. The server calculates the source-document SHA-256 and checks exact parcel/source reference/holder text where machine-readable.
5. A competent reviewer inspects the source, resolves co-owner/share/encumbrance/appeal/mutation questions and records the review method.
6. Keep raw identity information off the public Fabric channel; use HMAC references and role-restricted off-chain records.

## ML data policy

The real fraud training pipeline will not use allegations, FIRs, pending cases, synthetic data or procedural court orders as fraud labels. It requires written research authorisation, a de-identified official dataset, final court/competent-authority labels, two labelers plus adjudicator review, minimum dataset size/class/group thresholds and a verified SHA-256 manifest. Until those inputs are supplied, the real-government model gate must remain false.
