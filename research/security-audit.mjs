import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root,'server/src/app.js'),'utf8');
const workflow = fs.readFileSync(path.join(root,'server/src/services/workflowPolicy.js'),'utf8');
const fabric = fs.readFileSync(path.join(root,'fabric/chaincode/landrecords/landrecords.go'),'utf8');
const checks=[
 ['AUTH-01','JWT authentication on protected API routes',app.includes("authenticate(options.jwtSecret)"),'Protected transaction and data routes use JWT middleware.'],
 ['AUTH-02','Role enforcement for authority workflow actions',app.includes("allow(...roles.authority)"),'Approval, finalization, analytics and ledger verification require authority/admin role.'],
 ['AUTH-03','Current claimant required before transfer proposal',workflow.includes("String(property.ownerId) !== String(userId)"),'Workflow policy checks the authenticated account against the current claimant reference.'],
 ['AUTH-04','Approved-claim state gate before transfer',workflow.includes("property.status !== 'APPROVED'"),'Only workflow-reviewed claims can enter a transfer workflow.'],
 ['AUTH-05','Public registration cannot create authority/admin accounts',app.includes("allowedPublicRoles = ['owner', 'buyer', 'seller']"),'Authority roles are excluded from public signup.'],
 ['DOC-01','SHA-256 document fingerprint',app.includes('documentMetadata(req.file)'),'A source file digest is persisted for integrity tracking.'],
 ['DOC-02','Pre-ledger document screening',app.includes('validateDocument(req.file'),'Document validation runs before event submission.'],
 ['DOC-03','Upload content-signature checks',app.includes('checkDocumentSignature(req.file)'),'File extension/MIME allowlist plus PDF/image signature and text binary checks.'],
 ['LED-01','Ledger integrity verification endpoint',app.includes("/api/ledger/verify"),'Application ledger hash chain can be verified by authority users.'],
 ['LED-02','Recursive canonical JSON hashing',fs.readFileSync(path.join(root,'server/src/store/mockStore.js'),'utf8').includes('Object.keys(value).sort()'),'Nested payload objects are included in deterministic hash serialization.'],
 ['FAB-01','Fabric application-service identity gate',fabric.includes('role != "application-service"'),'Claim submissions and buyer workflow transactions require an application-service certificate.'],
 ['FAB-02','Fabric authority-only review gate',fabric.includes('role != "authority"'),'Approval and finalization require a separate authority certificate.'],
 ['FAB-03','Fabric on-channel personal-data minimisation',!['json:"claimantName"','json:"buyerName"','json:"parcelNumber"','json:"address"','json:"claimantId"','json:"buyerId"','json:"sellerId"'].some((field)=>fabric.includes(field)),'Public channel state stores keyed references instead of raw owner names, parcel identifiers, addresses or account IDs.'],
 ['FAB-04','Strong HMAC key required for Fabric references',fs.readFileSync(path.join(root,'server/src/services/ledgerService.js'),'utf8').includes('FABRIC_REFERENCE_HMAC_SECRET') && fabric.includes('validHMAC256'),'Application requires a 32-byte HMAC secret and chaincode validates HMAC references.']
];
const result={generatedAt:new Date().toISOString(),checks:checks.map(([id,control,passed,evidence])=>({id,control,passed,evidence})),passRate:checks.filter(x=>x[2]).length/checks.length,note:'Static source-control audit only. It is not dynamic security testing, penetration testing, identity proofing, or certification of deployed Fabric credentials.'};
fs.writeFileSync(path.join(root,'research/security-audit-result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
