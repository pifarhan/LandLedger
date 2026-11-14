# Survey of India ABDB — Integrated Source Layer

This release bundles the official Survey of India **State/District/Sub-District PAN INDIA** ABDB archive supplied for this project and integrates it into the LandLedger provenance/validation layer.

## Official source
- Landing page: https://surveyofindia.gov.in/pages/administrative-boundary-data-base-abdb-
- Archive: https://surveyofindia.gov.in/documents/State_District_Subdistrict_PAN%20INDIA.rar

## Bundled source
`server/data/abdb/raw/State_District_Subdistrict_PAN INDIA.rar`

SHA-256:
`b8325e5d9dd0f04a6663d775363fe38cd2f23bd9dbae3fb7118b4e6e0ce0bcb7`

The archive contains the official State Boundary, District Boundary and Sub-district Boundary shapefile families and their companion files.

## Build the searchable hierarchy index
1. Extract the bundled RAR with WinRAR/7-Zip on Windows.
2. Put the extracted directory at:
   `server/data/abdb/extracted/`
3. Install Python dependency:
   `pip install pyshp`
4. Run from `server/`:
   `npm run abdb:build --prefix server`

This produces:
`server/data/abdb/abdb-hierarchy.json`

The builder reads the `.shp` attribute tables and normalizes the administrative hierarchy:
`State/UT -> District -> Sub-District`.

## API
After building the index:
- `GET /api/abdb/status` — source/ingestion status
- `POST /api/abdb/validate` — validates supplied State/District/Sub-District combinations against the official index

Example request body:
```json
{
  "state": "West Bengal",
  "district": "Purba Bardhaman",
  "subDistrict": "Ausgram-I"
}
```

## Research boundary
ABDB is authoritative for **administrative/geospatial boundaries**, not for individual ownership, title, mutation or legal rights. The application therefore never converts an ABDB match into an ownership claim.

## Data provenance
The raw government archive is preserved so that the exact source used by the experiment can be SHA-256 verified. Any derived hierarchy JSON is a transformation artifact and must not be represented as the original government dataset.
