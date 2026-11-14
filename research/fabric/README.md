# Live Hyperledger Fabric Benchmark

This benchmark is designed to remove the previous limitation that live Fabric latency/throughput had not been measured.

## Run

1. Install Docker Desktop and Git.
2. From the project root:

```bash
./fabric/network/bootstrap.sh
```

3. The bootstrap script creates `server/.env.fabric` with the official Fabric test-network certificate/key paths.
4. Start the API in Fabric mode:

```bash
cd server
cp .env.fabric .env
npm install
FABRIC_MODE=fabric npm start
```

5. In another terminal:

```bash
cd research/fabric
FABRIC_BENCH_COUNT=100 FABRIC_BENCH_CONCURRENCY=5 node benchmark.mjs
```

The result is written to `research/fabric/benchmark-result.json`.

## What it measures

- successful Fabric transaction submission count
- wall-clock benchmark duration
- throughput (transactions/second)
- min/mean/p50/p95/max transaction latency
- Fabric connection/channel/chaincode identity

The benchmark records **actual runtime results**. Never replace these numbers with estimates in the paper.

## Research boundary

Benchmark transactions are synthetic technical test transactions. They measure the blockchain implementation, not government registry performance and not legal title accuracy.
