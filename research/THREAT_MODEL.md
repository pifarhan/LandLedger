# LandLedger Threat Model — v18

## Assets
- claimant-submitted record references and authorised off-chain source documents;
- parcel/owner/title metadata held under State-authorised access;
- source-document fingerprints, provenance and review decisions;
- buyer/seller/claimant workflow and authority action state;
- application audit events and Fabric HMAC/digest anchors;
- RBIH/IPR credentials and Fabric HMAC secret.

## Threats and controls

| Threat | Control | Residual risk |
|---|---|---|
| Unauthorised API action | JWT authentication, role middleware, current-claimant checks and public role restrictions | Credential compromise, session theft and deployment misconfiguration remain possible |
| Duplicate parcel claim | State/District/parcel-scoped collision checks and review status | Incomplete/incorrect source identifiers can cause false results |
| Conflicting claimant submissions | Multiple-active-claimant screening, duplicate file-hash signal and authority review | Application cannot determine legal title without the competent registry's source data |
| Document changed after receipt | Server-side SHA-256 fingerprint and audit-chain verification | Does not prove the original document was genuine |
| Inconsistent or suspicious document text | PDF text extraction, optional Tesseract OCR, deterministic patterns and mismatch signals | OCR errors, altered scans, forged seals/signatures and adversarial documents can evade heuristics |
| Bulk personal-data extraction | No village-wide owner enumeration; connector calls are exact-parcel; API credentials stay server-side; default response persistence off | A misconfigured operator or licensed provider could still disclose more data than permitted; monitor, rate-limit and audit all lookups |
| False owner→parcel verification | Source access basis, exact parcel/source reference/holder matching, authority reviewer identity/method and unverified-by-default lifecycle | Source itself may be stale, challenged, incomplete or not legally determinative; independent title review is necessary |
| Workflow bypass | Explicit pending/accepted/finalised status gates and application/authority identity separation | Requires full integration and security testing |
| Audit history altered | Recursive canonical hashing, Postgres chain-write lock and chain verification | Key compromise, privileged DB manipulation and recovery procedures remain operational risks |
| Fabric channel PII exposure | On-channel HMAC-SHA-256 references for claimant/buyer/seller/parcel/title/address/storage; HMAC'd rejection reasons; raw PII retained off-chain | HMAC-key compromise/rotation, low-entropy input correlation and side-channel metadata may still leak; protect key in KMS/HSM and use stable migration plans |
| Fabric identity misuse | Separate application-service and authority certificates with role attribute checks | Trust depends on CA issuance, MSP policy, key custody and organisation administration |
| Database/Fabric divergence | Source evidence hash anchors, explicit integration status and reconciliation documentation | No distributed atomic transaction/outbox is implemented; recovery reconciliation remains an operational requirement |

## Security boundary

This is an academic software prototype. Tests and static checks provide evidence of selected source-level controls; they are not a penetration test, independent audit, legal-title verification, document-authenticity certification or production government security certification. The development Fabric test-network is not a production consortium network.
