const test = require('node:test');
const assert = require('node:assert/strict');
const { getGovernmentDataSummary, getStateLandCoverage, getAcquisitionData } = require('../src/services/governmentDataService');

test('government data registry reports owner aggregates separately from owner identity records', () => {
  const summary = getGovernmentDataSummary();
  assert.equal(summary.jurisdictionCount, 36);
  assert.equal(summary.aggregateLandOwners, 510604000);
  assert.equal(summary.acquisitionNationalTotals.projects, 4862);
  assert.equal(summary.acquisitionNationalTotals.areaAcquiredHectare, 1885809);
  assert.equal(summary.acquisitionDetailRowsBundled, 2);
  assert.equal(summary.acquisitionNoticeRows, 58);
  assert.equal(summary.statePortalCoverage, 36);
  assert.match(summary.limitations.ownerIdentity, /person-level/);
});

test('state coverage has 36 jurisdictions and exposes official portal metadata without inventing owner rows', () => {
  const result = getStateLandCoverage();
  assert.equal(result.count, 36);
  assert.ok(result.records.some((row) => row.stateCode === 'WB' && row.rorPortalUrl === 'http://www.banglarbhumi.gov.in'));
  assert.ok(result.records.every((row) => typeof row.aggregateLandOwners === 'number'));
});

test('acquisition state view never equates missing detail rows with zero acquisition', () => {
  const result = getAcquisitionData('WB');
  assert.equal(result.stateCode, 'WB');
  assert.equal(result.records.length, 0);
  assert.match(result.interpretation, /not zero acquisition/);
  assert.ok(result.reportUrl.includes('rptLandAcqProg2.xhtml'));
});


test('government data summary includes curated official Delhi award facts without calling them payment or title proof', () => {
  const summary = getGovernmentDataSummary();
  assert.deepEqual(summary.acquisitionDetailedStateCodes, ['DL']);
  assert.equal(summary.acquisitionOfficialAwardPdfRows, 19);
  assert.equal(summary.acquisitionHumanReviewedAwardExtractions, 2);
  assert.equal(summary.parcelEvidenceRows, 0);
  assert.equal(summary.ownerParcelRelationshipsCaptured, 0);
});
