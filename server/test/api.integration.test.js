const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');
const { MockStore } = require('../src/store/mockStore');
const { createApp } = require('../src/app');

async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'land-ledger-'));
  const store = await new MockStore(path.join(root, 'ledger.json')).init();
  const makeUser = async (name, email, role, password) => store.createUser({ name, email, role, passwordHash: await bcrypt.hash(password, 4) });
  const accounts = {
    authority: await makeUser('Authority', 'authority@test.local', 'authority', 'Authority@123'),
    owner: await makeUser('Owner', 'owner@test.local', 'owner', 'Owner@123'),
    buyer: await makeUser('Buyer', 'buyer@test.local', 'buyer', 'Buyer@123')
  };
  const app = createApp({ store, options: { jwtSecret: 'test-secret', uploadDir: path.join(root, 'uploads'), databaseMode: 'mock', fabricMode: 'mock' } });
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (method, url, { token, body, form } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload = body;
    if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    if (form) payload = form;
    const response = await fetch(base + url, { method, headers, body: payload });
    const text = await response.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    return { status: response.status, body: parsed };
  };
  const login = async (email, password) => (await request('POST', '/api/auth/login', { body: { email, password } })).body.token;
  return { store, accounts, request, login, close: () => new Promise(resolve => server.close(resolve)) };
}

test('enforces role authorization, hashes documents, and finalizes a validated transfer', async t => {
  const ctx = await setup(); t.after(() => ctx.close());
  const { request, login } = ctx;
  const ownerToken = await login('owner@test.local', 'Owner@123');
  const buyerToken = await login('buyer@test.local', 'Buyer@123');
  const authorityToken = await login('authority@test.local', 'Authority@123');
  assert.ok(ownerToken && buyerToken && authorityToken);

  const form = new FormData();
  form.set('parcelNumber', 'TEST-100');
  form.set('title', 'Test Parcel');
  form.set('address', 'Test Address');
  form.set('areaSqm', '150');
  form.set('landType', 'Residential');
  form.set('stateCode', 'WB');
  form.set('stateName', 'West Bengal');
  form.set('districtName', 'KOLKATA');
  form.set('districtSourceLgdCode', '342');
  form.set('document', new Blob([Buffer.from('official-demo-title')], { type: 'text/plain' }), 'title.txt');
  const created = await request('POST', '/api/properties', { token: ownerToken, form });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.property.status, 'PENDING');
  assert.equal(created.body.property.documents[0].sha256.length, 64);
  const propertyId = created.body.property.id;

  const forbidden = await request('POST', `/api/properties/${propertyId}/review`, { token: buyerToken, body: { decision: 'APPROVED' } });
  assert.equal(forbidden.status, 403);
  const review = await request('POST', `/api/properties/${propertyId}/review`, { token: authorityToken, body: { decision: 'APPROVED' } });
  assert.equal(review.status, 200);
  const transfer = await request('POST', '/api/transfers', { token: ownerToken, body: { propertyId, buyerEmail: 'buyer@test.local', notes: 'Academic test transfer' } });
  assert.equal(transfer.status, 201);
  const accepted = await request('POST', `/api/transfers/${transfer.body.transfer.id}/accept`, { token: buyerToken, body: {} });
  assert.equal(accepted.status, 200);
  const finalized = await request('POST', `/api/transfers/${transfer.body.transfer.id}/finalize`, { token: authorityToken, body: {} });
  assert.equal(finalized.status, 200);
  assert.equal(finalized.body.property.ownerName, 'Buyer');
  const integrity = await request('GET', '/api/ledger/verify', { token: authorityToken });
  assert.equal(integrity.status, 200);
  assert.equal(integrity.body.valid, true);
});

test('authority analytics flags duplicate parcels without exposing it as a verified conflict', async t => {
  const ctx = await setup(); t.after(() => ctx.close());
  const { store, accounts, login, request } = ctx;
  await store.createProperty({ parcelNumber: 'DUP-1', title: 'First', address: 'One', areaSqm: 10, landType: 'Residential', ownerId: accounts.owner.id, ownerName: accounts.owner.name, createdBy: accounts.owner.id, status: 'APPROVED' });
  await store.createProperty({ parcelNumber: 'DUP-1', title: 'Claim', address: 'One', areaSqm: 10, landType: 'Residential', ownerId: accounts.buyer.id, ownerName: accounts.buyer.name, createdBy: accounts.buyer.id, status: 'PENDING' });
  const token = await login('authority@test.local', 'Authority@123');
  const response = await request('GET', '/api/analytics/overview', { token });
  assert.equal(response.status, 200);
  assert.equal(response.body.conflicts.duplicateParcels.length, 1);
  assert.equal(response.body.conflicts.conflictingOwnership.length, 0);
});


test('public registration cannot create authority/admin accounts and demo login is removed', async t => {
  const ctx = await setup(); t.after(() => ctx.close());
  const { request } = ctx;
  const blocked = await request('POST', '/api/auth/register', {
    body: { name: 'Public Test', email: 'public@test.local', password: 'SecurePassword123', role: 'authority' }
  });
  assert.equal(blocked.status, 403);
  const created = await request('POST', '/api/auth/register', {
    body: { name: 'Public Test', email: 'public@test.local', password: 'SecurePassword123', role: 'owner' }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.role, 'owner');
  assert.equal(created.body.user.identityVerificationStatus, 'NOT_VERIFIED');
  const demo = await request('POST', '/api/auth/demo-login', { body: { role: 'owner' } });
  assert.equal(demo.status, 404);
});
