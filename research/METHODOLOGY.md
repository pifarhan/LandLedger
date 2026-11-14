# Research methodology

## Phase 1 — Public-data acquisition

The external reference dataset is collected from the Department of Land Resources' DILRMP public reports. State/district/village hierarchy and published CLR fields are preserved without inventing owner identities.

## Phase 2 — Data normalization

The application normalizes state, district, tehsil and village labels and numeric counters while retaining the original source values. A provenance record identifies the authority, URL, retrieval date and dataset scope.

## Phase 3 — Authority-centric transaction model

A property transaction is represented as a state machine: registration → authority approval → transfer proposal → buyer acceptance → authority finalization. Only authorized roles can advance the relevant states.

## Phase 4 — Integrity and conflict controls

Each uploaded property document is fingerprinted using SHA-256. Rule checks identify duplicate parcel identifiers, repeated document digests and conflicting ownership assertions. The blockchain/ledger stores auditable events and fingerprints rather than claiming legal title itself.

## Phase 5 — Evaluation

Two evaluation layers are reported separately:

- **Official-data validation:** schema completeness, source provenance, record counts and consistency checks.
- **Controlled workflow evaluation:** labelled positive/negative scenarios for conflict and workflow rules, precision/recall/F1, integrity detection, successful/rejected transfers and ledger latency.

This separation prevents controlled synthetic transactions from being misrepresented as government transaction records.
