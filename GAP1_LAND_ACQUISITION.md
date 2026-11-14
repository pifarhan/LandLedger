# Research Gap 1 — Land Acquisition Integration

## Implemented in `codex/gap-1-land-acquisition`

- Preserved the bundled LACRRIS snapshot and its checksum-verified national metrics as read-only reference data during runtime imports.
- Added `server/data/land_acquisition_imports.json` as a separate operational overlay for authority/admin-imported case rows.
- Kept the existing HTTPS government/NIC source checks, personal owner/contact field rejection, required stage evidence, source hashes, deduplication, and provenance log.
- Merged bundled and operational rows for acquisition search, state coverage, the enrichment dashboard, and the government-data acquisition API. Imports do not change national aggregate totals.
- Added a regression test proving an authority import leaves the bundled snapshot byte-for-byte unchanged and is visible in search and the operational overlay.

## Evidence and limits

The package retains 58 selected notice/catalogue references, 19 Delhi award PDF references, and two human-reviewed Delhi awards. No new government case rows were fabricated or fetched for this change. Public-source discovery remains available for allowlisted government indexes; candidate links require authority review before import.

This does not complete a nationwide acquisition register. State-specific project exports and case documents remain incomplete, and award/payment/possession stages require their own official source evidence. State/UT custodian authorization or approved credentials are required for restricted data or endpoints. The LACRRIS report is interactive and does not expose a universal cadastral parcel join key in the captured dataset.

## Validation

- Acquisition and government data tests: 15 passed.
- Official data verifier: passed, including the existing 41-file checksum manifest.
- Full backend test suite: 48 passed, 0 failed. The API test helper now serializes JSON request bodies correctly.
- Static security audit: 14/14 controls passed; security verification: 10/10 controls passed. These are source-level checks, not penetration tests.
- The server lockfile was synchronized with the already-declared Fabric dependencies so `npm ci` could install the complete server dependency set; no `package.json` version ranges changed.
- `npm ci` reported 6 dependency advisories (3 moderate, 2 high, 1 critical). A follow-up `npm audit` could not retrieve advisory details because `registry.npmjs.org` failed DNS resolution. No automated dependency upgrades were applied.
- No live government endpoint or credentialed integration was tested.
