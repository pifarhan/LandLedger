const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fabricReference } = require('../src/services/ledgerService');

const oldSecret = process.env.FABRIC_REFERENCE_HMAC_SECRET;

test('Fabric personal/parcel references require a strong server-side HMAC key', () => {
  delete process.env.FABRIC_REFERENCE_HMAC_SECRET;
  assert.throws(() => fabricReference('WB|301|302|Dag-14', 'parcel'), /at least 32 bytes/);
  process.env.FABRIC_REFERENCE_HMAC_SECRET = 'short';
  assert.throws(() => fabricReference('WB|301|302|Dag-14', 'parcel'), /at least 32 bytes/);
});

test('Fabric reference HMAC is deterministic, key-dependent and not plaintext', () => {
  process.env.FABRIC_REFERENCE_HMAC_SECRET = 'A'.repeat(64);
  const first = fabricReference('claimant-internal-id-123', 'claimant');
  const same = fabricReference('claimant-internal-id-123', 'claimant');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, same);
  assert.notEqual(first, 'claimant-internal-id-123');
  process.env.FABRIC_REFERENCE_HMAC_SECRET = 'B'.repeat(64);
  const rotated = fabricReference('claimant-internal-id-123', 'claimant');
  assert.notEqual(first, rotated);
});

test('Fabric chaincode public state has no raw owner, buyer, address or parcel identifiers', () => {
  const chaincode = fs.readFileSync(path.join(__dirname, '../../fabric/chaincode/landrecords/landrecords.go'), 'utf8');
  for (const forbidden of [
    '`json:"claimantName"`', '`json:"buyerName"`', '`json:"parcelNumber"`',
    '`json:"address"`', '`json:"claimantId"`', '`json:"buyerId"`', '`json:"sellerId"`',
    '`json:"rejectionReason,omitempty"`'
  ]) assert.equal(chaincode.includes(forbidden), false, `Unexpected plaintext field in chaincode: ${forbidden}`);
  for (const required of [
    '`json:"claimantReferenceHmac"`', '`json:"parcelReferenceHmac"`',
    '`json:"buyerReferenceHmac"`', '`json:"sourceDocumentSha256"`'
  ]) assert.equal(chaincode.includes(required), true, `Missing privacy-safe field: ${required}`);
});

if (oldSecret === undefined) delete process.env.FABRIC_REFERENCE_HMAC_SECRET;
else process.env.FABRIC_REFERENCE_HMAC_SECRET = oldSecret;
