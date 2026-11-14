# LandLedger v18 — Test Report

Build date: 14 November 2026

## Results

| Test/control | Result | Scope |
|---|---:|---|
| Dependency-free backend test suites | 45 passed / 0 failed | Core, data-integrity, DILRMP sync, acquisition enrichment, Fabric privacy, RBIH, government data, IPR, workflow |
| JSX transpile | 0 diagnostics | React entry file syntax/transpile, not full Vite bundle |
| Backend/research JS syntax checks | Passed | Syntax only |
| Fabric shell scripts | Passed `bash -n` | Script syntax only |
| Official data verifier | PASS | 36 State/UT rows, ABDB coverage, LACRRIS snapshot, 58 notices, 2 detailed awards, empty owner evidence, blank ledger, 41 checksums, ABDB archive SHA-256 |
| Static security audit | 14/14 source checks | Not penetration test |
| Secondary security verification | 10/10 checks | Automated source patterns, not certification |
| Controlled workflow evaluation | 10/10 deterministic cases | Policy test cases, not real transactions |
| ML self-test | Passed | 600 synthetic records; not research evidence or real-world validation |
| Real-government ML gate | BLOCKED as expected | No authorised labelled dataset supplied |

## Environment-blocked checks

- `server/test/api.integration.test.js` could not start because `bcryptjs` is declared in `server/package.json` but dependencies are not installed in this workspace. Network/DNS is unavailable to install dependencies. This is an environment/dependency block, not a passing API integration result.
- Full npm/Vite production build was not run because application dependencies are not installed.
- Docker daemon is unavailable; Fabric test-network could not be deployed.
- Go chaincode test/build attempted but dependency download from `proxy.golang.org` failed due unavailable network/DNS. The chaincode was run through `gofmt` and static source checks only.
- No live RBIH credentials/onboarding or IPR API key were provided; live data retrieval was not tested.

## Data truth and scope

The official-data verifier checks schema, row counts, reconciliations and file checksums. It does not independently certify land-title truth, individual identities, payment, possession, legal effect, provider-reported third-party coverage or live API responses.

The synthetic ML result is marked `SYNTHETIC_TEST_ONLY`; the real-government model gate stays false. The two Delhi award extracts are human-reviewed public-source acquisition documents, not owner/title certificates or complete nationwide acquisition coverage.
