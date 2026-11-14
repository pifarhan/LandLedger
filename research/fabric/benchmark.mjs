import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const serverDir = path.resolve(new URL('../..', import.meta.url).pathname);
process.chdir(serverDir);
const { submit, evaluate, status } = await import('../../server/src/services/fabricGatewayService.js');

const count = Number(process.env.FABRIC_BENCH_COUNT || 50);
const concurrency = Math.max(1, Number(process.env.FABRIC_BENCH_CONCURRENCY || 5));
const prefix = process.env.FABRIC_BENCH_PREFIX || `bench-${Date.now()}`;

const s = await status();
if (!s.connected) throw new Error(`Fabric is not connected: ${s.error || 'unknown error'}`);

const jobs = Array.from({ length: count }, (_, i) => async () => {
  const id = `${prefix}-${i + 1}`;
  const started = performance.now();
  await submit('CreateProperty', [
    id,
    `BENCH-${i + 1}`,
    `Benchmark Property ${i + 1}`,
    'DILRMP research benchmark',
    `benchmark-owner-${i + 1}`,
    `Benchmark Owner ${i + 1}`,
    'research-test',
    `sha256:${randomUUID()}`,
    `benchmark/${id}`,
    100 + i
  ]);
  return performance.now() - started;
});

const latencies = [];
let next = 0;
async function worker() {
  while (true) {
    const i = next++;
    if (i >= jobs.length) return;
    latencies.push(await jobs[i]());
  }
}

const wallStart = performance.now();
await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
const wallMs = performance.now() - wallStart;

const sorted = [...latencies].sort((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const result = {
  timestamp: new Date().toISOString(),
  network: s,
  count,
  concurrency,
  wallTimeMs: Number(wallMs.toFixed(2)),
  throughputTxPerSec: Number((count / (wallMs / 1000)).toFixed(3)),
  latencyMs: {
    min: Number(sorted[0].toFixed(2)),
    mean: Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)),
    p50: Number(percentile(0.50).toFixed(2)),
    p95: Number(percentile(0.95).toFixed(2)),
    max: Number(sorted.at(-1).toFixed(2))
  },
  integrityCheck: 'Each transaction writes a SHA-256-labelled document digest to the ledger; benchmark uses unique synthetic test records and is not a government transaction benchmark.'
};

const out = path.resolve(process.env.FABRIC_BENCH_OUTPUT || '../../research/fabric/benchmark-result.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
