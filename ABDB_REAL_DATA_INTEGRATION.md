# ABDB real-data integration

## Data path

`Survey of India ABDB archive -> shapefile attribute extraction -> normalized State/District/Sub-District index -> authenticated API -> claimant-location validation`

The current build extracts the supplied RAR and bundles:
- `server/data/abdb/abdb-hierarchy.json`
- `server/data/abdb/districts.csv`
- `server/data/abdb/subdistricts.csv`
- original raw RAR under `server/data/abdb/raw/`

## Implemented APIs

- `GET /api/abdb/status`: source checksum, hierarchy status, and quality metrics.
- `GET /api/abdb/states`: all 36 State/UT master entries.
- `GET /api/abdb/districts?state=<code|LGD|name>`: State-specific district features.
- `GET /api/abdb/subdistricts?state=<code|LGD|name>&district=<name>`: paginated sub-district features.
- `POST /api/abdb/validate`: checks submitted State/District/Sub-District labels against the index.

Property registration requires a State/UT and district. A matched admin location is marked `MATCHED_TO_ABDB`; an unmatched location remains a claim and is marked `NOT_MATCHED_REVIEW_REQUIRED`. This is only administrative location matching, not a title verification.

## Data quality decisions

Disputed state/district features and records with missing required attributes are not silently converted into official locations. Unmatched and duplicate source IDs are retained in quality metadata. The 780 ABDB district features do not exactly equal DILRMP's reported 783 administrative districts. The gap remains visible.

## Future integration

Village-level ABDB boundaries and official state cadastral parcel datasets may be integrated as separate geometry layers after source authorization, schema validation, and licensing review. No private owner-name export is implied by these sources.
