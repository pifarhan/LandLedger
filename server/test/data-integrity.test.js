const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'server/data/official-state-ut-registry.json'), 'utf8'));
const clr = JSON.parse(fs.readFileSync(path.join(root, 'server/data/dilrmp_state_level_current.json'), 'utf8'));
const abdb = JSON.parse(fs.readFileSync(path.join(root, 'server/data/abdb/abdb-hierarchy.json'), 'utf8'));
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'server/data/ledger.json'), 'utf8'));

test('DILRMP current aggregate includes 36 unique State/UT rows', () => {
  assert.equal(registry.states.length, 36);
  assert.equal(clr.records.length, 36);
  assert.equal(new Set(registry.states.map((item) => item.code)).size, 36);
  assert.equal(new Set(clr.records.map((item) => item.stateCode)).size, 36);
  for (const record of clr.records) {
    assert.ok(registry.states.some((state) => state.code === record.stateCode));
    assert.equal(record.recordScope, 'state_ut_aggregate_only');
    assert.ok(record.capabilities);
    assert.equal(record.parcelOwnershipRecords.availability, 'not_included');
  }
});

test('DILRMP State/UT sums reconcile to the published national totals', () => {
  const sum = (field) => clr.records.reduce((total, row) => total + Number(row[field] || 0), 0);
  const nationalFields = {
    totalDistricts: 'districts', totalTehsils: 'tehsils', totalVillages: 'villages',
    totalRor: 'rorTotal', rorComputerized: 'rorComputerized',
    villagesClrCompleted: 'villagesClrCompleted', totalLandOwners: 'totalLandOwners'
  };
  for (const [field, nationalField] of Object.entries(nationalFields)) {
    assert.equal(sum(field), clr.nationalTotals[nationalField], `${field} must reconcile`);
  }
  assert.equal(clr.nationalTotals.statesUt, 36);
  assert.equal(clr.nationalTotals.districts, 783);
  assert.equal(clr.nationalTotals.tehsils, 6974);
  assert.equal(clr.nationalTotals.villages, 650819);
  assert.equal(clr.nationalTotals.rorTotal, 403404057);
  assert.equal(clr.nationalTotals.rorComputerized, 402113713);
});

test('ABDB hierarchy covers all 36 State/UT names and preserves known gaps', () => {
  assert.equal(abdb.states.length, 36);
  assert.equal(new Set(abdb.states.map((state) => state.code)).size, 36);
  assert.equal(abdb.coverage.stateBoundaryFeatures, 36);
  assert.equal(abdb.coverage.disputedOrUnmappedStateBoundaryFeatures, 4);
  assert.equal(abdb.coverage.assignedDistrictBoundaryFeatures, 780);
  assert.equal(abdb.coverage.disputedOrUnassignedDistrictFeatures, 28);
  assert.equal(abdb.coverage.indexedSubDistrictFeatures, 6578);
  assert.equal(abdb.coverage.subDistrictFeaturesMissingRequiredAttributes, 89);
  assert.deepEqual(abdb.coverage.statesWithoutIndexedSubDistricts.sort(), ['Arunachal Pradesh','Meghalaya']);
  assert.equal(abdb.coverage.subDistrictsWithUnmatchedDistrictBoundaryParent, 0);
  for (const state of abdb.states) {
    assert.equal(state.districtCount, state.districts.length);
    assert.equal(state.subDistrictCount, state.subDistricts.length);
  }
});

test('default application ledger contains no people or sample properties', () => {
  for (const key of ['users','properties','documents','transfers','events']) assert.deepEqual(ledger[key], []);
});

test('historical village extract is labelled and limited to its source jurisdictions', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'server/data/dilrmp_real_snapshot.json'), 'utf8'));
  assert.equal(data.records.length, 14);
  assert.deepEqual([...new Set(data.records.map((row) => row.state))].sort(), ['Karnataka','West Bengal']);
  assert.match(data.scope || '', /historical|Karnataka|West Bengal/i);
});


test('NGDRS live and manual reporting channels remain separate', () => {
  const live = JSON.parse(fs.readFileSync(path.join(root, 'server/data/ngdrs_registration_activity.json'), 'utf8'));
  const manual = JSON.parse(fs.readFileSync(path.join(root, 'server/data/ngdrs_data_entry_form_snapshot.json'), 'utf8'));
  assert.equal(live.records.length, 36);
  assert.equal(live.coverage.rowsReported, 26);
  assert.equal(manual.records.length, 5);
  assert.match(manual.scope, /separate/i);
  assert.match(manual.scope, /not merged/i);
});
