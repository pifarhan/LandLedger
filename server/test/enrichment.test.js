const test = require('node:test');
const assert = require('node:assert/strict');
const { getEnrichmentDashboard, csvToObjects, officialUrl } = require('../src/services/governmentEnrichmentService');
const { parseMapTable } = require('../src/services/dilrmpMapSync');
const sourceDocuments = require('../src/services/sourceDocumentExtractionService');
const discovery = require('../src/services/acquisitionDiscoveryService');
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.resolve(__dirname, '../data');

test('enrichment dashboard provides 36 jurisdictions and separates aggregates from person-level rows', () => {
  const dashboard = getEnrichmentDashboard();
  assert.equal(dashboard.jurisdictionCount, 36);
  assert.equal(dashboard.portalDirectory.jurisdictions, 36);
  assert.equal(dashboard.portalDirectory.individualOwnerRowsBundled, 0);
  assert.equal(dashboard.ownerAggregates.stateRows.length, 36);
  assert.equal(dashboard.acquisition.coverageByState.length, 36);
  assert.ok(dashboard.ownerAggregates.aggregateLandOwnerCount > 0);
  assert.ok(dashboard.ownerAggregates.meaning.includes('Not a list'));
});

test('LACRRIS national snapshot is not spread into State/UT values and current notice catalogue has 58 entries', () => {
  const dashboard = getEnrichmentDashboard();
  assert.equal(dashboard.acquisition.metrics.projects, 4862);
  assert.equal(dashboard.acquisition.metrics.areaAcquiredHectare, 1885809);
  assert.equal(dashboard.acquisition.coverageByState.length, 36);
  assert.ok(dashboard.acquisition.coverageByState.every((row) => row.projectCount === null && row.areaAcquiredHectare === null));
  assert.equal(dashboard.acquisition.notices.length, 58);
});


test('Delhi GNCTD award catalogues contribute 19 official award PDFs and preserve detailed case distinctions', () => {
  const notices = JSON.parse(fs.readFileSync(path.join(DATA, 'land_acquisition_notices.json'), 'utf8'));
  const delhi = notices.records.filter((row) => row.stateCode === 'DL');
  assert.equal(delhi.length, 19);
  assert.equal(delhi.filter((row) => row.village === 'Bamnoli').length, 8);
  assert.equal(delhi.filter((row) => row.village === 'Bharthal').length, 11);
  const extracted = JSON.parse(fs.readFileSync(path.join(DATA, 'land_acquisition_awards_extracted.json'), 'utf8'));
  assert.equal(extracted.records.length, 2);
  const bam = extracted.records.find((row) => row.village === 'Bamnoli');
  assert.equal(bam.compensationBreakdown.grandTotalInr, 1117572745);
  assert.equal(bam.statusQuoAreaAsPublished, '640 Bigha 12 Biswas');
  assert.equal(bam.possessionStatus, 'NOT_TAKEN_FOR_STATUS_QUO_SCHEDULE');
  assert.equal(bam.parcelIdentifiersInStatusQuoSchedule.length, 25);
  const bhar = extracted.records.find((row) => row.village === 'Bharthal');
  assert.equal(bhar.compensationAmountInr, 1255465435.34);
  assert.match(bhar.dataQuality, /AREA_DISCREPANCY_FLAGGED/);
});

test('acquisition discovery reads award table row metadata when official PDF anchors say Download', () => {
  const source = { id: 'delhi-awards', stateCode: 'DL', state: 'NCT of Delhi', district: 'South West Delhi', authority: 'GNCTD Revenue', allowedHost: 'revenue.delhi.gov.in' };
  const html = '<table><tr><td>1</td><td>BAMNOLI</td><td>AWARD-1(07-08)</td><td><a href="/files/bamnoli.pdf">Download</a></td></tr></table>';
  const found = discovery.extractCandidates(html, 'https://revenue.delhi.gov.in/land-acquisition/7227', source);
  assert.equal(found.length, 1);
  assert.match(found[0].title, /AWARD-1/);
  assert.match(found[0].candidateUrl, /bamnoli.pdf$/);
});

test('official import URL policy accepts only HTTPS government/NIC domains', () => {
  assert.equal(officialUrl('https://revenue.odisha.gov.in/en/communication/land-acquisition'), true);
  assert.equal(officialUrl('http://meebhoomi.ap.gov.in'), false);
  assert.equal(officialUrl('https://example.com/land'), false);
});

test('CSV parser supports quoted commas and escaped quotes', () => {
  const rows = csvToObjects('stateCode,projectName,district\nMH,"Road, Phase 2",Pune\nOD,"Canal ""A""",Puri\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].projectName, 'Road, Phase 2');
  assert.equal(rows[1].projectName, 'Canal "A"');
});

test('MIS 4.0 map parser maps a raw source table to unique official State/UT codes', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(DATA, 'official-state-ut-registry.json'), 'utf8'));
  const html = `<table>${registry.states.map((state, i) => `<tr><td>${i + 1}</td><td>${state.name.toUpperCase()}</td>${Array.from({ length: 31 }, (_, n) => `<td>${n + 1}</td>`).join('')}</tr>`).join('')}</table>`;
  const result = parseMapTable(html, registry);
  assert.equal(result.records.length, 36);
  assert.equal(new Set(result.records.map((row) => row.stateCode)).size, 36);
  assert.ok(result.records.every((row) => row.sourceRowCells.length >= 8));
});

test('acquisition discovery extracts notice candidates and enforces a strict official-host allowlist', () => {
  const source = { id: 'egazette-test', stateCode: 'WB', state: 'West Bengal', district: 'Jalpaiguri', authority: 'eGazette', allowedHost: 'egazette.gov.in' };
  const html = `<a href="/files/land-acquisition-award-2026.pdf">Land Acquisition Award No. 12/2026 Survey No. 42/3, 12-11-2026</a><a href="https://example.com/fake.pdf">Land acquisition fake</a>`;
  const candidates = discovery.extractCandidates(html, 'https://egazette.gov.in/updates', source);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].reviewStatus, 'DISCOVERED_REQUIRES_AUTHORITY_REVIEW');
  assert.ok(candidates[0].parcelIdentifierCandidates.length > 0);
  assert.throws(() => discovery.assertAllowedSource({ ...source, url: 'https://example.com/land', allowedHost: 'example.com' }), /allowlist|official host/);
});

test('source-document extraction computes SHA-256 and inspects parcel, source reference and holder match', () => {
  const text = Buffer.from('ROR Record TEST-RECORD-001 for Parcel LR-101 lists Example Owner as owner. Date: 12/11/2026.');
  const extracted = sourceDocuments.extractText({ buffer: text, filename: 'record.txt', mimeType: 'text/plain' });
  assert.match(extracted.sha256, /^[a-f0-9]{64}$/);
  const inspection = sourceDocuments.inspectParcelSource({ extracted, record: {
    parcelIdentifier: 'LR-101', sourceRecordId: 'TEST-RECORD-001', ownerNames: ['Example Owner'], holders: []
  }, verificationReference: 'ROR-1' });
  assert.equal(inspection.parcelMatch, true);
  assert.equal(inspection.sourceReferenceMatch, true);
  assert.equal(inspection.holderMatchCount, 1);
});

test('isolated import pipeline requires real server-side source inspection before authority verification', (t) => {
  const { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'landledger-v18-import-test-'));
  t.after(() => rmSync(tempRoot, { recursive: true, force: true }));
  const serviceDir = path.join(tempRoot, 'server/src/services');
  const dataDir = path.join(tempRoot, 'server/data');
  mkdirSync(serviceDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  for (const name of ['official-state-ut-registry.json','land_acquisition_national.json','parcel_ownership_evidence.json']) {
    copyFileSync(path.join(DATA, name), path.join(dataDir, name));
  }
  copyFileSync(path.join(__dirname, '../src/services/governmentEnrichmentService.js'), path.join(serviceDir, 'governmentEnrichmentService.js'));
  const isolated = require(path.join(serviceDir, 'governmentEnrichmentService.js'));
  const parcel = isolated.importParcelEvidence([{
    stateCode: 'WB', district: 'Nadia', village: 'Sample Mouza', parcelIdentifier: 'LR-101',
    sourceRecordId: 'TEST-RECORD-001', sourceUrl: 'https://banglarbhumi.gov.in/',
    accessBasis: 'PUBLIC_RECORD', ownerNames: ['Example Owner'], verifiedByAuthorityId: 'untrusted-input'
  }], { importedBy: 'test-authority' });
  assert.equal(parcel.inserted, 1);
  assert.equal(parcel.records[0].ownerNameCount, 1);
  assert.equal(Object.hasOwn(parcel.records[0], 'ownerNames'), false);
  const storedEvidence = JSON.parse(readFileSync(path.join(dataDir, 'parcel_ownership_evidence.json'), 'utf8'));
  assert.equal(storedEvidence.records[0].verificationStatus, 'SOURCE_CAPTURED_UNVERIFIED');
  assert.equal(storedEvidence.records[0].verifiedByAuthorityId, null);
  assert.throws(() => isolated.verifyParcelEvidence(parcel.records[0].recordKey, {
    verificationMethod: 'OFFICIAL_SOURCE_RECORD_REVIEW', verificationReference: 'ROR-1',
    verificationSourceUrl: 'https://banglarbhumi.gov.in/', reviewedDocumentSha256: 'a'.repeat(64)
  }, 'authority-1'), /Server-side source-document extraction/);

  const reviewedBytes = Buffer.from('ROR Record TEST-RECORD-001 for Parcel LR-101 lists Example Owner as owner. Date: 12/11/2026.');
  const extracted = sourceDocuments.extractText({ buffer: reviewedBytes, filename: 'official-record.txt', mimeType: 'text/plain' });
  const row = storedEvidence.records[0];
  const inspection = sourceDocuments.inspectParcelSource({ extracted, record: row, verificationReference: 'ROR-1' });
  const verified = isolated.verifyParcelEvidence(parcel.records[0].recordKey, {
    verificationMethod: 'OFFICIAL_SOURCE_RECORD_REVIEW', verificationReference: 'ROR-1',
    verificationSourceUrl: 'https://banglarbhumi.gov.in/', reviewedDocumentSha256: extracted.sha256,
    documentInspection: inspection
  }, 'authority-1');
  assert.equal(verified.verificationStatus, 'AUTHORITY_VERIFIED_SOURCE_RECORD');
  assert.equal(verified.ownerParcelMatchStatus, 'AUTHORITY_CONFIRMED_TEXT_MATCH');
  assert.equal(verified.legalTitleStatus, 'NOT_A_LEGAL_TITLE_ADJUDICATION');
  assert.equal(verified.sourceVerification.verificationDocumentSha256, extracted.sha256);

  const badText = Buffer.from('ROR Record TEST-RECORD-001 for Parcel LR-102 lists Example Owner as owner.');
  const badExtracted = sourceDocuments.extractText({ buffer: badText, filename: 'wrong-record.txt', mimeType: 'text/plain' });
  const badInspection = sourceDocuments.inspectParcelSource({ extracted: badExtracted, record: storedEvidence.records[0], verificationReference: 'ROR-1' });
  assert.equal(badInspection.parcelMatch, false);
});

test('acquisition imports preserve parcel identifiers and require evidence for each claimed milestone', (t) => {
  const { mkdtempSync, mkdirSync, copyFileSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'landledger-v18-acq-test-'));
  t.after(() => rmSync(tempRoot, { recursive: true, force: true }));
  const serviceDir = path.join(tempRoot, 'server/src/services');
  const dataDir = path.join(tempRoot, 'server/data');
  mkdirSync(serviceDir, { recursive: true }); mkdirSync(dataDir, { recursive: true });
  for (const name of ['official-state-ut-registry.json','land_acquisition_national.json','parcel_ownership_evidence.json']) copyFileSync(path.join(DATA, name), path.join(dataDir, name));
  copyFileSync(path.join(__dirname, '../src/services/governmentEnrichmentService.js'), path.join(serviceDir, 'governmentEnrichmentService.js'));
  const isolated = require(path.join(serviceDir, 'governmentEnrichmentService.js'));
  const base = { stateCode: 'WB', district: 'Jalpaiguri', projectName: 'Railway line', sourceAuthority: 'eGazette', sourceReference: 'CASE-WB-1', officialCaseId: 'CASE-WB-1', sourceUrl: 'https://egazette.gov.in/archives/notice.pdf', parcelIdentifiers: ['Survey No. 42/3'] };
  assert.throws(() => isolated.importAcquisitionRecords([{ ...base, acquisitionStage: 'AWARD_ISSUED' }]), /stageEvidenceReference/);
  const result = isolated.importAcquisitionRecords([{ ...base, acquisitionStage: 'NOTIFIED', stageEvidenceReference: 'GAZ-WB-2026-1', stageEvidenceUrl: base.sourceUrl, stageEvidenceDate: '2026-11-13' }]);
  assert.equal(result.inserted, 1);
  assert.deepEqual(result.records[0].parcelIdentifiers, ['Survey No. 42/3']);
  assert.equal(result.records[0].recordStatus, 'IMPORTED_PUBLIC_SOURCE_UNVERIFIED');
});
