#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [ -x "$ROOT/.fabric-samples/test-network/network.sh" ]; then
  cd "$ROOT/.fabric-samples/test-network"
  ./network.sh down
else
  echo "Fabric test-network is not installed."
fi
