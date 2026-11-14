const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseTable, parseGrandTotal, nationalSummary } = require('../src/services/dilrmpStateSync');

const root = path.resolve(__dirname, '../..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'server/data/official-state-ut-registry.json'), 'utf8'));
const source = JSON.parse(fs.readFileSync(path.join(root, 'server/data/dilrmp_state_level_current.json'), 'utf8'));

function htmlCell(value) {
  return `<td>${value === null || value === undefined ? '' : value}</td>`;
}
function makeTable() {
  const rows = [];
  for (let index = 0; index < source.records.length; index += 1) {
    const r = source.records[index];
    const c = r.capabilities;
    const g = r.genderBasedOwnership;
    const values = [
      index + 1, r.state, r.totalDistricts, r.totalTehsils, r.totalVillages,
      r.totalRor, r.rorComputerized, r.rorComputerizedPercent,
      r.rorLinkedToCadastralMap, r.rorLinkedToCadastralMapPercent,
      r.villagesClrCompleted, r.villagesClrCompletedPercent, r.totalLandOwners,
      g.districts, g.male, g.female, g.total,
      c.onlineRoRDownload ? 'Yes' : 'No',
      c.digitallySignedRoROnline ? 'Yes' : 'No',
      c.digitallySignedRoRLegallyValid ? 'Yes' : 'No',
      c.onlineMutationApplication ? 'Yes' : 'No',
      c.autoTriggeredMutation ? 'Yes' : 'No',
      c.autoMutation ? 'Yes' : 'No',
      c.banksAuthorizedForMortgage ? 'Yes' : 'No',
      c.bankAuthorizedDistricts, c.bankAuthorizedBranches,
      c.sroOnlineCheck ? 'Yes' : 'No',
      c.revenueCourtOnlineCheck ? 'Yes' : 'No',
      c.civilCourtEcourtCheck ? 'Yes' : 'No'
    ];
    rows.push(`<tr>${values.map(htmlCell).join('')}</tr>`);
  }
  const n=source.nationalTotals;
  const totals=[
    '', 'Grand Total', n.districts, n.tehsils, n.villages, n.rorTotal,
    n.rorComputerized, n.rorComputerizedPercent, n.rorLinkedToCadastralMap,
    n.rorLinkedToCadastralMapPercent, n.villagesClrCompleted,
    n.villagesClrCompletedPercent, n.totalLandOwners
  ];
  rows.push(`<tr>${totals.map(htmlCell).join('')}</tr>`);
  return `<table>${rows.join('')}</table>`;
}

test('DILRMP parser reads 36 unique State/UT rows and reconciles national grand totals', () => {
  const html=makeTable();
  const records=parseTable(html,registry);
  assert.equal(records.length,36);
  assert.equal(new Set(records.map((r)=>r.stateCode)).size,36);
  const parsedGrand=parseGrandTotal(html);
  assert.deepEqual(parsedGrand,{
    districts:source.nationalTotals.districts,
    tehsils:source.nationalTotals.tehsils,
    villages:source.nationalTotals.villages,
    rorTotal:source.nationalTotals.rorTotal,
    rorComputerized:source.nationalTotals.rorComputerized,
    villagesClrCompleted:source.nationalTotals.villagesClrCompleted,
    totalLandOwners:source.nationalTotals.totalLandOwners
  });
  const summary=nationalSummary(records);
  assert.equal(summary.districts,parsedGrand.districts);
  assert.equal(summary.tehsils,parsedGrand.tehsils);
  assert.equal(summary.villages,parsedGrand.villages);
  assert.equal(summary.rorTotal,parsedGrand.rorTotal);
  assert.equal(summary.rorComputerized,parsedGrand.rorComputerized);
  assert.equal(summary.villagesClrCompleted,parsedGrand.villagesClrCompleted);
  assert.equal(summary.totalLandOwners,parsedGrand.totalLandOwners);
});

test('DILRMP parser refuses a snapshot with no published Grand Total row', () => {
  assert.equal(parseGrandTotal('<table><tr><td>1</td><td>West Bengal</td></tr></table>'),null);
});
