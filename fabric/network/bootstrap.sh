#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SAMPLES="$ROOT/.fabric-samples"
BRANCH="release-2.5"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing prerequisite: $1" >&2; exit 1; }; }
need docker
need git
need openssl

docker info >/dev/null 2>&1 || { echo "Docker daemon is not available. Start Docker Desktop/Engine and retry." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose plugin is required." >&2; exit 1; }

if [ ! -d "$SAMPLES/.git" ]; then
  git clone --depth 1 --branch "$BRANCH" https://github.com/hyperledger/fabric-samples.git "$SAMPLES"
else
  CURRENT="$(git -C "$SAMPLES" branch --show-current)"
  if [ "$CURRENT" != "$BRANCH" ]; then
    echo "Existing fabric-samples checkout is on '$CURRENT'; expected '$BRANCH'. Remove .fabric-samples or checkout $BRANCH." >&2
    exit 1
  fi
fi
export PATH="$SAMPLES/bin:$PATH"
TEST_NETWORK="$SAMPLES/test-network"
export FABRIC_CFG_PATH="$SAMPLES/config"

"$TEST_NETWORK/network.sh" down || true
"$TEST_NETWORK/network.sh" up createChannel -c landchannel -ca
"$TEST_NETWORK/network.sh" deployCC \
  -ccn landrecords \
  -ccp "$ROOT/fabric/chaincode/landrecords" \
  -ccl go \
  -c landchannel \
  -ccep "AND('Org1MSP.peer','Org2MSP.peer')"

ORG1_CA="$TEST_NETWORK/organizations/fabric-ca/org1"
ORG2_CA="$TEST_NETWORK/organizations/fabric-ca/org2"
ORG1="$TEST_NETWORK/organizations/peerOrganizations/org1.example.com"
ORG2="$TEST_NETWORK/organizations/peerOrganizations/org2.example.com"
ORG1_ADMIN_HOME="$TEST_NETWORK/.landledger-ca-admin-org1"
ORG2_ADMIN_HOME="$TEST_NETWORK/.landledger-ca-admin-org2"
APP_HOME="$ORG1/users/LandLedgerApp@org1.example.com"
AUTH_HOME="$ORG2/users/LandLedgerAuthority@org2.example.com"
APP_SECRET="$(openssl rand -hex 24)"
AUTH_SECRET="$(openssl rand -hex 24)"

# Enrol CA administrators, then register purpose-separated identities with
# explicit X.509 attributes consumed by the chaincode access-control checks.
export FABRIC_CA_CLIENT_HOME="$ORG1_ADMIN_HOME"
fabric-ca-client enroll -u https://admin:adminpw@localhost:7054 --caname ca-org1 --tls.certfiles "$ORG1_CA/ca-cert.pem"
fabric-ca-client register --caname ca-org1 --id.name landledger-app --id.secret "$APP_SECRET" --id.type client --id.attrs 'role=application-service:ecert' --tls.certfiles "$ORG1_CA/ca-cert.pem"

export FABRIC_CA_CLIENT_HOME="$ORG2_ADMIN_HOME"
fabric-ca-client enroll -u https://admin:adminpw@localhost:8054 --caname ca-org2 --tls.certfiles "$ORG2_CA/ca-cert.pem"
fabric-ca-client register --caname ca-org2 --id.name landledger-authority --id.secret "$AUTH_SECRET" --id.type client --id.attrs 'role=authority:ecert' --tls.certfiles "$ORG2_CA/ca-cert.pem"

export FABRIC_CA_CLIENT_HOME="$APP_HOME"
fabric-ca-client enroll -u "https://landledger-app:$APP_SECRET@localhost:7054" --caname ca-org1 --enrollment.attrs 'role' --tls.certfiles "$ORG1_CA/ca-cert.pem"
export FABRIC_CA_CLIENT_HOME="$AUTH_HOME"
fabric-ca-client enroll -u "https://landledger-authority:$AUTH_SECRET@localhost:8054" --caname ca-org2 --enrollment.attrs 'role' --tls.certfiles "$ORG2_CA/ca-cert.pem"

JWT_SECRET="$(openssl rand -hex 32)"
# Preserve the keyed-reference secret across a repeated bootstrap of the same
# local ledger/network; changing it without a migration would break lookups.
EXISTING_HMAC_SECRET=""
if [ -f "$ROOT/server/.env.fabric" ]; then
  EXISTING_HMAC_SECRET="$(grep -E '^FABRIC_REFERENCE_HMAC_SECRET=' "$ROOT/server/.env.fabric" | cut -d= -f2- | tail -1 || true)"
fi
FABRIC_REFERENCE_HMAC_SECRET="${EXISTING_HMAC_SECRET:-$(openssl rand -hex 32)}"
if [ "${#FABRIC_REFERENCE_HMAC_SECRET}" -lt 32 ]; then echo "Existing Fabric HMAC secret is too short; refuse to replace it automatically." >&2; exit 1; fi
cat > "$ROOT/server/.env.fabric" <<ENV
PORT=5000
DATABASE_MODE=mock
JWT_SECRET=$JWT_SECRET
FABRIC_REFERENCE_HMAC_SECRET=$FABRIC_REFERENCE_HMAC_SECRET
FABRIC_MODE=fabric
FABRIC_CHANNEL=landchannel
FABRIC_CHAINCODE=landrecords
FABRIC_MSP_ID=Org1MSP
FABRIC_AUTHORITY_MSP_ID=Org2MSP
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_TLS_SERVER_NAME=peer0.org1.example.com
FABRIC_IDENTITY_CERT=$APP_HOME/msp/signcerts/cert.pem
FABRIC_IDENTITY_KEY_DIR=$APP_HOME/msp/keystore
FABRIC_AUTHORITY_IDENTITY_CERT=$AUTH_HOME/msp/signcerts/cert.pem
FABRIC_AUTHORITY_IDENTITY_KEY_DIR=$AUTH_HOME/msp/keystore
FABRIC_TLS_CERT=$ORG1/peers/peer0.org1.example.com/tls/ca.crt
ENV
chmod 600 "$ROOT/server/.env.fabric"

echo "Two-organisation Fabric 2.5 development/test network is deployed."
echo "Application identity: Org1MSP / role=application-service"
echo "Authority identity: Org2MSP / role=authority"
echo "Endorsement policy: AND(Org1MSP.peer, Org2MSP.peer)"
echo "Configuration written to server/.env.fabric (mode 600). Do not treat test-network as production."
echo "Run: cd server && cp .env.fabric .env && npm ci && npm start"
