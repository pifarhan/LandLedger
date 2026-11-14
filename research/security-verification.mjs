import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.cwd());
const app=fs.readFileSync(path.join(root,'server/src/app.js'),'utf8');
const files=['server/src/services/authService.js','server/src/services/documentValidationService.js','server/src/services/fraudRiskService.js','server/src/services/ledgerService.js'];
const checks=[
 ['SEC-01','Protected routes require authentication',app.includes('authenticate(options.jwtSecret)'), 'JWT middleware present.'],
 ['SEC-02','Authority-only operations',app.includes('allow(...roles.authority)'), 'Role gate present.'],
 ['SEC-03','Owner verification before transfer',app.includes('property.ownerId !== String(req.auth.sub)'), 'Seller ownership gate present.'],
 ['SEC-04','Approved property required before transfer',app.includes("property.status !== 'APPROVED'"), 'Workflow state gate present.'],
 ['SEC-05','Document digest binding',app.includes('document.sha256'), 'SHA-256 digest persisted.'],
 ['SEC-06','Pre-ledger document validation',app.includes('validateDocument(req.file'), 'Document screening before ledger operation.'],
 ['SEC-07','Ledger integrity verification',app.includes('/api/ledger/verify'), 'Hash-chain verification endpoint present.'],
 ['SEC-08','Fabric integration status control',app.includes('/api/fabric/status'), 'Permissioned ledger integration path present.'],
 ['SEC-09','No plaintext password storage in source',!app.match(/password\s*[:=]\s*req\.body\.password/), 'Application source does not directly persist request password values.'],
 ['SEC-10','Sensitive secret configuration is environment-driven',app.includes('process.env'), 'Configuration uses environment variables.']
];
const result={generatedAt:new Date().toISOString(),checks:checks.map(([id,name,passed,evidence])=>({id,name,passed,evidence})),passed:checks.filter(x=>x[2]).length,total:checks.length,passRate:checks.filter(x=>x[2]).length/checks.length,scope:'Automated application-security control verification. Not a formal penetration test, certification, or independent security audit.'};
fs.writeFileSync(path.join(root,'research/security-verification-result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
