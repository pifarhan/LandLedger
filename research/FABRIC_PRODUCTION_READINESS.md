# Hyperledger Fabric production-readiness plan

## What is implemented in this release

- Fabric Gateway SDK adapter with separate application and authority identities.
- Chaincode authorization through certificate attributes (`application-service`, `authority`).
- Two-organisation development bootstrap and chaincode endorsement policy.
- Idempotent, hash-only source-evidence anchoring.
- HMAC-SHA-256 references for parcel, claimant, buyer, seller, title/address and storage references. Raw personally identifying values and free-text rejection reasons are not written to channel state.
- Minimum 32-byte HMAC secret guard and `.gitignore` coverage for generated env/secret files.

## What is not a production deployment

`fabric/network/bootstrap.sh` uses the Hyperledger Fabric Samples `test-network`. It is a local development/integration network, not a production topology and not a government-connected land registry. The current build environment did not have a Docker daemon and could not download Go chaincode dependencies, so live deployment/compile/TPS/latency was not completed.

## Required production topology

Before any production claim, each participating State/UT or institution must formally join the permissioned consortium. The production design should include:

1. **Ordering:** at least three Raft orderers across separate failure domains, production MSPs, TLS mutual authentication and a documented channel consortium/consensus governance process.
2. **Peers:** at least two peer organisations with multiple peers per organisation across zones; endorsement policy should require independent authority organisations, not merely two application peers controlled by the same operator.
3. **Identity:** organisation-owned Fabric CA or approved enterprise PKI; HSM/KMS protected signing keys; certificate expiry/revocation and MSP rotation runbooks; MFA and independent authority provisioning outside public signup.
4. **Data privacy:** no owner name, Aadhaar/PAN, address, mobile, raw plot number or deed text on a shared channel. Keep sensitive data in encrypted off-chain State-authorised storage or explicit private-data collections with member-only read/write policies and block-to-live retention. Put only a keyed digest and minimal non-personal state on channel.
5. **Governance:** consortium membership, chaincode upgrade approvals, dispute/correction/reversal policy, data-subject rights, legal basis, State custodianship and audit access agreements.
6. **Operations:** monitoring/alerts, Prometheus/Grafana or equivalent telemetry, log redaction, SIEM forwarding, backups, ledger snapshots, restore drills, RPO/RTO, node patching, capacity planning and incident response.
7. **Validation:** chaincode unit/integration tests, endorsement-failure tests, orderer outage tests, peer recovery, identity revocation, privacy verification, load tests under recorded hardware/network conditions and independent penetration testing.
8. **Legal boundary:** a successful chaincode transaction is not statutory registration/mutation or a court declaration of title. The competent land authority remains the legal source of record.

## Go-live checklist

- [ ] State/authority consortium agreement signed.
- [ ] Legal basis and data sharing/consent approved for each data field and operation.
- [ ] Production PKI/MSP/HSM/KMS configured.
- [ ] Three or more orderers deployed and fault-domain tested.
- [ ] Peer organisations and private data collections approved.
- [ ] External secrets manager configured; same HMAC key available to authorised replicas and backed up securely.
- [ ] HMAC rotation and re-key migration procedure rehearsed.
- [ ] Chaincode built with pinned dependencies and reviewed.
- [ ] Endorsement and lifecycle policies approved by each consortium member.
- [ ] Monitoring, backups, restore and incident response tested.
- [ ] Full application integration and performance benchmark report attached.
- [ ] Independent security review and legal review completed.

Do not label the current `test-network` bootstrap as production-ready or report Fabric TPS until the above checklist is executed on the target environment.
