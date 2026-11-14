#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fail=0
for cmd in docker git go node npm; do
  if command -v "$cmd" >/dev/null 2>&1; then printf 'PASS command %-8s %s\n' "$cmd" "$(command -v "$cmd")"; else printf 'FAIL command %-8s missing\n' "$cmd"; fail=1; fi
done
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then echo 'PASS Docker daemon'; else echo 'FAIL Docker daemon unavailable'; fail=1; fi
if [ -d "$ROOT/.fabric-samples/test-network" ]; then echo 'PASS fabric-samples test-network checkout'; else echo 'INFO fabric-samples not cloned yet'; fi
if [ -f "$ROOT/server/.env.fabric" ]; then
  secret_value="$(grep -E '^FABRIC_REFERENCE_HMAC_SECRET=' "$ROOT/server/.env.fabric" | cut -d= -f2- | tail -1 || true)"
  if [ "${#secret_value}" -ge 32 ]; then echo 'PASS FABRIC_REFERENCE_HMAC_SECRET (length >=32)'; else echo 'FAIL FABRIC_REFERENCE_HMAC_SECRET missing/too short'; fail=1; fi
  for var in FABRIC_IDENTITY_CERT FABRIC_IDENTITY_KEY_DIR FABRIC_AUTHORITY_IDENTITY_CERT FABRIC_AUTHORITY_IDENTITY_KEY_DIR FABRIC_TLS_CERT; do
    value="$(grep -E "^${var}=" "$ROOT/server/.env.fabric" | cut -d= -f2- | tail -1 || true)"
    if [ -n "$value" ] && [ -e "$value" ]; then echo "PASS $var"; else echo "FAIL $var missing or path unavailable"; fail=1; fi
  done
else echo 'INFO server/.env.fabric not generated; run fabric/network/bootstrap.sh after prerequisites are ready'; fi
exit "$fail"
