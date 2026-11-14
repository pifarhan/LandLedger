const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MockStore } = require('../src/store/mockStore');
const {
  hasDuplicateParcel, canProposeTransfer, canAcceptTransfer, canFinalizeTransfer
} = require('../src/services/workflowPolicy');

test('duplicate parcel detection is scoped to State/UT and district', () => {
  const westBengal = { id:'1', stateCode:'WB', districtName:'Bardhaman', districtSourceLgdCode:'301', parcelNumber:'DAG-1' };
  assert.equal(hasDuplicateParcel(westBengal, [{ ...westBengal, id:'2' }]), true);
  assert.equal(hasDuplicateParcel(westBengal, [{ ...westBengal, id:'3', stateCode:'KA' }]), false);
  assert.equal(hasDuplicateParcel(westBengal, [{ ...westBengal, id:'4', districtSourceLgdCode:'302', districtName:'Hooghly' }]), false);
});

test('workflow transitions enforce actor and status checks', () => {
  const property = { id:'P-1', ownerId:'U-1', status:'APPROVED' };
  assert.equal(canProposeTransfer({ property, userId:'U-1' }).allowed, true);
  assert.equal(canProposeTransfer({ property, userId:'U-2' }).reason, 'NOT_CURRENT_CLAIMANT');
  assert.equal(canProposeTransfer({ property:{...property,status:'PENDING'}, userId:'U-1' }).reason, 'PROPERTY_NOT_WORKFLOW_APPROVED');
  assert.equal(canProposeTransfer({ property, userId:'U-1', transfers:[{propertyId:'P-1',status:'PROPOSED'}] }).reason, 'OPEN_TRANSFER_EXISTS');
  assert.equal(canAcceptTransfer({ transfer:{status:'PROPOSED',buyerId:'U-2'}, userId:'U-2' }).allowed, true);
  assert.equal(canAcceptTransfer({ transfer:{status:'PROPOSED',buyerId:'U-2'}, userId:'U-3' }).allowed, false);
  assert.equal(canFinalizeTransfer({ transfer:{status:'ACCEPTED',sellerId:'U-1'}, property }).allowed, true);
  assert.equal(canFinalizeTransfer({ transfer:{status:'PROPOSED',sellerId:'U-1'}, property }).reason, 'TRANSFER_NOT_ACCEPTED');
  assert.equal(canFinalizeTransfer({ transfer:{status:'ACCEPTED',sellerId:'U-1'}, property:{...property,ownerId:'U-2'} }).reason, 'CLAIMANT_REFERENCE_MISMATCH');
});

test('nested payload fields are covered by the mock-ledger hash chain', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'landledger-hash-'));
  const file = path.join(directory, 'ledger.json');
  try {
    const store = await new MockStore(file).init();
    await store.appendEvent({
      entityType:'PROPERTY', entityId:'P-1', action:'CLAIM_SUBMITTED', actorId:'U-1',
      payload:{ claimant:{identity:{name:'Claimant A',documents:['a','b']}}, location:{state:'WB',district:'Bardhaman'} }
    });
    assert.equal((await store.verifyLedger()).valid, true);
    store.data.events[0].payload.claimant.identity.name = 'Tampered Name';
    store.save();
    const verification = await store.verifyLedger();
    assert.equal(verification.valid, false);
    assert.equal(verification.failedBlock, '1');
  } finally {
    fs.rmSync(directory, { recursive:true, force:true });
  }
});

test('mock store rejects duplicate emails just like PostgreSQL', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'landledger-users-'));
  try {
    const store = await new MockStore(path.join(directory,'ledger.json')).init();
    await store.createUser({ email:'one@example.test', name:'Test', role:'owner', passwordHash:'hash' });
    await assert.rejects(() => store.createUser({ email:'ONE@example.test', name:'Test 2', role:'owner', passwordHash:'hash' }), (error) => error.code === '23505');
  } finally {
    fs.rmSync(directory, { recursive:true, force:true });
  }
});
