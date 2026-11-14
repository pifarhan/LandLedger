import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
function has(cmd, args=['--version']) { try { execFileSync(cmd,args,{stdio:'ignore'}); return true; } catch { return false; } }
const result={
  generatedAt:new Date().toISOString(),
  prerequisites:{docker:has('docker'),git:has('git'),go:has('go'),node:has('node')},
  ready:false,
  reason:'',
  benchmarkCommand:'FABRIC_BENCH_COUNT=100 FABRIC_BENCH_CONCURRENCY=10 node research/fabric/benchmark.mjs'
};
result.ready=result.prerequisites.docker && result.prerequisites.git && result.prerequisites.go && result.prerequisites.node;
if(!result.ready) result.reason='Live Fabric benchmark requires Docker plus the repository Fabric network dependencies. No benchmark numbers are generated when prerequisites are missing.';
else result.reason='Prerequisites detected. Start the Fabric network and run the benchmark command; the generated JSON is the only source for paper TPS/latency values.';
fs.writeFileSync(path.join(root,'research/fabric/live-benchmark-preflight.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
process.exit(result.ready?0:2);
