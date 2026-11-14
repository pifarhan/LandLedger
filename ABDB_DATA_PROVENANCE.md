# Survey of India ABDB data provenance

**Official publisher:** Survey of India, Department of Science & Technology, Government of India  
**Official source page:** https://surveyofindia.gov.in/pages/administrative-boundary-data-base-abdb-  
**Archive:** `State_District_Subdistrict_PAN INDIA.rar`  
**SHA-256:** `b8325e5d9dd0f04a6663d775363fe38cd2f23bd9dbae3fb7118b4b6e0ce0bcb7`  
**Processed on:** 14-Nov-2026

The project extracts the State, District and Sub-District shapefile families from the supplied archive and derives an administrative hierarchy index. The raw archive is preserved under `server/data/abdb/raw/`, and the attribute-derived index is included under `server/data/abdb/`.

## Quality report

- Current State/UT master: 36.
- State boundary features assigned to the 36-State/UT master: 36.
- Disputed State boundary features kept separately: 4.
- District features: 808 total; 780 assignable; 28 disputed/unassigned.
- Sub-district features: 6,667 total; 6,578 complete/indexed; 89 missing required administrative attributes.
- State/UTs with indexed sub-district entries: 34. Arunachal Pradesh and Meghalaya have no usable sub-district rows in the supplied archive.
- The source has repeated sub-district composite keys; they are preserved with source feature IDs and noted in coverage metadata.
- Source LGD attributes are preserved independently from current master LGD codes.

## Legal and technical boundary

ABDB establishes administrative/geospatial context. It does not establish who legally owns a parcel, prove a title deed, disclose mutations, or establish encumbrances. It is not a cadastral parcel ownership register. The project therefore uses ABDB only to check whether a claimed State/District/Sub-District name matches the supplied administrative reference.

## Rebuild

1. Extract the original RAR into `server/data/abdb/extracted/` with a RAR5-capable tool (for example, `7z x "server/data/abdb/raw/State_District_Subdistrict_PAN INDIA.rar" -oserver/data/abdb/extracted`).
2. Install Python dependencies with `python -m pip install -r requirements-data.txt`.
3. Run `npm run abdb:build` from the repository root.
4. Re-run `npm run verify:official-data`.
5. Compare the generated quality counts and checksums with the committed provenance report.

The distributable project contains the raw 202.5 MB RAR and the compact derived JSON/CSV indexes; it does not include the 381.6 MB uncompressed shapefile copy to avoid packaging the same raw source twice.

The raw archive checksum is checked by `server/data/abdb/source-manifest.json`.
