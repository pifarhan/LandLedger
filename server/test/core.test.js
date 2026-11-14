const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { documentMetadata, required, number } = require('../src/utils');
const { validateDocument } = require('../src/services/documentValidationService');
const { score, evaluate, features } = require('../src/services/fraudRiskService');

function file(text, name='title.txt', mime='text/plain') {
  const buffer = Buffer.from(text, 'utf8');
  return { originalname:name, mimetype:mime, size:buffer.length, buffer, filename:name };
}

test('utility validation and document hashing are correct', () => {
  assert.equal(required('  TEST-1  ', 'Parcel'), 'TEST-1');
  assert.equal(number('150', 'Area'), 150);
  assert.throws(() => number('0', 'Area'));
  const f = file('hello world');
  const meta = documentMetadata(f);
  assert.equal(meta.sha256, crypto.createHash('sha256').update(f.buffer).digest('hex'));
  assert.equal(meta.sha256.length, 64);
});

test('document intelligence passes a consistent document', () => {
  const f = file('Survey No: TEST-100\nOwner: Test Claimant\nArea: 150 sq m\nAddress: 12 Main Road');
  const r = validateDocument(f, { parcelNumber:'TEST-100', ownerName:'Test Claimant', areaSqm:150, address:'12 Main Road' });
  assert.equal(r.decision, 'PASS');
  assert.equal(r.checks.parcelMismatch, false);
  assert.equal(r.checks.claimantNameMismatch, false);
  assert.equal(r.checks.areaMismatch, false);
  assert.equal(r.sha256.length, 64);
});

test('document intelligence sends inconsistent documents to authority review', () => {
  const f = file('Survey No: WRONG-9\nOwner: Completely Different Person\nArea: 900 sq m\nAddress: 12 Main Road\nFORGED');
  const r = validateDocument(f, { parcelNumber:'TEST-100', ownerName:'Test Claimant', areaSqm:150, address:'12 Main Road' });
  assert.equal(r.decision, 'REVIEW');
  assert.equal(r.checks.parcelMismatch, true);
  assert.equal(r.checks.claimantNameMismatch, true);
  assert.equal(r.checks.areaMismatch, true);
  assert.equal(r.checks.suspiciousTerms, true);
  assert.ok(r.warnings.length >= 3);
});

test('fraud-risk engine is explainable and distinguishes clean vs risky cases', () => {
  const clean = score({});
  const risky = score({ duplicateParcel:true, claimantNameMismatch:true, duplicateHash:true, suspiciousDocument:true, parcelMismatch:true, identityMismatch:true });
  assert.equal(clean.risk, 'LOW');
  assert.ok(risky.probability > clean.probability);
  assert.equal(risky.risk, 'HIGH');
  assert.ok(risky.explanations.includes('duplicateParcel'));
  assert.equal(features({ duplicateParcel:true }).length, 10);
});

test('fraud-risk evaluation is reproducible and reports standard metrics', () => {
  const result = evaluate();
  assert.equal(result.model, 'explainable-ensemble-logistic+rules-v3-synthetic');
  assert.ok(result.trainCases > 0 && result.testCases > 0);
  for (const key of ['accuracy','precision','recall','f1']) assert.ok(Number.isFinite(result.holdout[key]));
  assert.ok(result.holdout.f1 >= 0 && result.holdout.f1 <= 1);
});

console.log('CORE_TESTS: PASS');
