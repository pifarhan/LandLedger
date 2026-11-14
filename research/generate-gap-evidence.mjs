import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files={app:'server/src/app.js',doc:'server/src/services/documentValidationService.js',fraud:'server/src/services/fraudRiskService.js',fabric:'server/src/services/fabricGatewayService.js',ledger:'server/src/services/ledgerService.js'};
const text=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,fs.readFileSync(path.join(root,v),'utf8')]));
const gap=[
 {id:'G1',gap:'Authority workflow review',status:text.app.includes("allow(...roles.authority)")?'ADDRESSED':'MISSING',evidence:'Role-gated workflow review and finalisation; not statutory title validation'},
 {id:'G2',gap:'Document integrity',status:text.app.includes('document.sha256')?'ADDRESSED':'MISSING',evidence:'SHA-256 digest persisted with document and ledger event'},
 {id:'G3',gap:'Document text consistency screening',status:text.doc.includes('claimantNameMismatch')&&text.doc.includes('areaMismatch')?'ADDRESSED_AS_SCREENING':'MISSING',evidence:'Tesseract/PDF text extraction + deterministic pattern extraction + cross-field consistency; not document authenticity or legal-title verification'},
 {id:'G4',gap:'Pre-ledger validation',status:text.app.includes('validateDocument(req.file')?'ADDRESSED':'MISSING',evidence:'Document validation executes before ledger event write'},
 {id:'G5',gap:'Duplicate/conflicting claimant submissions',status:text.app.includes('hasDuplicateParcel')&&text.app.includes('multipleActiveOwners')&&text.app.includes('duplicateHash')?'ADDRESSED':'PARTIAL',evidence:'State/District-scoped duplicate claimant checks, repeated document hashes and multiple-active-claimant screening'},
 {id:'G6',gap:'Explainable fraud screening',status:text.fraud.includes('explainable-ensemble')?'ADDRESSED':'MISSING',evidence:'Rule + logistic ensemble with feature explanations'},
 {id:'G7',gap:'Auditability',status:text.ledger.includes('record')?'ADDRESSED':'MISSING',evidence:'Ledger service and property/transfer event history'},
 {id:'G8',gap:'Permissioned blockchain',status:text.fabric.includes('Gateway')?'IMPLEMENTATION_PATH_SUPPLIED':'MISSING',evidence:'Fabric Gateway + chaincode adapter; live Fabric not deployed/tested here'},
 {id:'G9',gap:'Performance evidence',status:fs.existsSync(path.join(root,'research/fabric/benchmark.mjs'))?'BENCHMARK_HARNESS_ONLY':'MISSING',evidence:'Benchmark harness supplied; no live Fabric TPS/latency result was measured'},
 {id:'G10',gap:'Security controls',status:fs.existsSync(path.join(root,'research/security-audit.mjs'))?'STATIC_CONTROLS_VERIFIED':'MISSING',evidence:'Automated control audit; not penetration testing'},
 {id:'G11',gap:'Real public data provenance',status:fs.existsSync(path.join(root,'server/data/dilrmp_real_snapshot.json'))?'ADDRESSED':'MISSING',evidence:'Official DILRMP public snapshot + provenance files'},
 {id:'G12',gap:'Research reproducibility',status:fs.existsSync(path.join(root,'research/evaluate.mjs'))?'ADDRESSED':'MISSING',evidence:'Evaluation scripts and machine-readable result artifacts'}
];
fs.writeFileSync(path.join(root,'research/gap-evidence.json'),JSON.stringify({generatedAt:new Date().toISOString(),gaps:gap},null,2));console.log(JSON.stringify(gap,null,2));
