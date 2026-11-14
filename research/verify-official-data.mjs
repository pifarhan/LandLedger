import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dataRoot = path.join(root, 'server/data');
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataRoot, name), 'utf8'));
const registry = read('official-state-ut-registry.json');
const clr = read('dilrmp_state_level_current.json');
const ngdrs = read('ngdrs_registration_activity.json');
const ngdrsManual = read('ngdrs_data_entry_form_snapshot.json');
const abdb = read('abdb/abdb-hierarchy.json');
const ledger = read('ledger.json');
const stateLandCoverage = read('state_land_data_coverage.json');
const acquisition = read('land_acquisition_lacrris_snapshot.json');
const acquisitionCases = read('land_acquisition_cases.json');
const parcelEvidence = read('parcel_ownership_evidence.json');
const sourceRegistry = read('government_data_source_registry.json');
const portals = read('state_record_portals.json');
const acquisitionExpanded = read('land_acquisition_national.json');
const acquisitionNotices = read('land_acquisition_notices.json');
const legacyMap = read('dilrmp_map_legacy_mis3.json');
const currentMap = read('dilrmp_map_current_mis4.json');
const federatedRegistry = read('federated_land_records_registry.json');
const mis4Snapshot = read('dilrmp_mis4_20261113.json');
const fail = (message) => { throw new Error(message); };

if (registry.states.length !== 36) fail(`State/UT registry has ${registry.states.length}, expected 36.`);
if (new Set(registry.states.map((row) => row.code)).size !== 36) fail('State/UT registry contains duplicate state codes.');
if (new Set(registry.states.map((row) => String(row.lgdCode))).size !== 36) fail('State/UT registry contains duplicate LGD codes.');
if (clr.records.length !== 36 || new Set(clr.records.map((row) => row.stateCode)).size !== 36) {
  fail('Current DILRMP CLR snapshot is not a 36-State/UT unique dataset.');
}
const requiredFields = [
  'stateCode','state','lgdCode','totalDistricts','totalTehsils','totalVillages',
  'totalRor','rorComputerized','rorComputerizedPercent','villagesClrCompleted',
  'villagesClrCompletedPercent','capabilities'
];
for (const row of clr.records) {
  if (!requiredFields.every((field) => row[field] !== undefined && row[field] !== null)) fail(`Missing current CLR fields for ${row.state}.`);
  if (!registry.states.some((state) => state.code === row.stateCode)) fail(`Unknown State/UT code in CLR: ${row.stateCode}.`);
}
const sum = (field) => clr.records.reduce((total, row) => total + Number(row[field] || 0), 0);
const checks = [
  ['totalDistricts','districts'],
  ['totalTehsils','tehsils'],
  ['totalVillages','villages'],
  ['totalRor','rorTotal'],
  ['rorComputerized','rorComputerized'],
  ['villagesClrCompleted','villagesClrCompleted'],
  ['totalLandOwners','totalLandOwners']
];
for (const [field, national] of checks) {
  if (sum(field) !== Number(clr.nationalTotals[national])) {
    fail(`CLR national reconciliation failed for ${field}: ${sum(field)} vs ${clr.nationalTotals[national]}.`);
  }
}
if (abdb.states.length !== 36 || abdb.coverage.officialStateUtCount !== 36) fail('ABDB hierarchy does not expose all 36 State/UT master records.');
if (abdb.coverage.assignedDistrictBoundaryFeatures !== 780) fail('Unexpected ABDB assigned district feature count.');
if (abdb.coverage.indexedSubDistrictFeatures !== 6578) fail('Unexpected ABDB sub-district feature count.');
if (abdb.coverage.subDistrictFeaturesMissingRequiredAttributes !== 89) fail('Unexpected ABDB incomplete sub-district count.');
if ((ngdrs.records || []).length !== 36) fail('NGDRS snapshot must retain 36 State/UT master entries.');
if (ngdrs.coverage?.rowsReported !== 26) fail('NGDRS reported-row coverage differs from the source snapshot.');
if (ngdrsManual.records.length !== 5 || ngdrsManual.coverage?.records !== 5) fail('Separate NGDRS manual-feed snapshot should contain five rows.');
if (/merged|live feed/i.test(ngdrsManual.scope) === false) fail('NGDRS manual feed must describe its separate/historical scope.');
const historical = read('dilrmp_real_snapshot.json');
if (historical.records.length !== 14) fail('Historical DILRMP subset record count changed unexpectedly.');
if (historical.coverage?.scope !== 'historical_village_level_subset_not_all_india') fail('Historical subset is not marked as historical/non-all-India.');
if (stateLandCoverage.records.length !== 36 || new Set(stateLandCoverage.records.map((row) => row.stateCode)).size !== 36) fail('State land data coverage must contain 36 unique State/UT rows.');
if (portals.records.length !== 36 || new Set(portals.records.map((row) => row.stateCode)).size !== 36 || portals.coverage?.urls !== 36) fail('State/UT official record directory must contain 36 unique portal/source URLs.');
if (portals.coverage?.openBulkApisVerified !== 0 || portals.coverage?.individualOwnerRowsBundled !== 0) fail('Do not claim unverified bulk owner APIs or bundle personal owner rows.');
if (acquisitionExpanded.coverageByState?.length !== 36 || acquisitionExpanded.metrics?.projects !== 4862 || acquisitionExpanded.metrics?.areaAcquiredHectare !== 1885809) fail('LACRRIS expansion does not match the 36-State/UT selector and latest captured national dashboard snapshot.');
if (acquisitionNotices.records?.length !== 58 || !acquisitionNotices.records.some((row) => row.recordId === 'DL-BAMNOLI-AWARD-107-08')) fail('Official acquisition notice catalogue must retain the expanded selected metadata including Delhi award PDFs.');
const detailedAwards = read('land_acquisition_awards_extracted.json');
if (detailedAwards.records?.length !== 2 || detailedAwards.records.some((row) => row.sourceReadStatus !== 'HUMAN_REVIEWED_FROM_OFFICIAL_PDF')) fail('Selected Delhi awards are not represented by two source-reviewed records.');
if (acquisitionExpanded.records?.length !== 2 || !acquisitionExpanded.records.every((row) => row.stateCode === 'DL' && row.acquisitionStage === 'AWARD_ISSUED')) fail('Two source-backed Delhi acquisition records are missing from the API dataset.');
if (parcelEvidence.records.length !== 0) fail('Owner-by-owner parcel evidence must remain empty until source-authorised collection.');
if (legacyMap.scope?.includes('Legacy MIS 3.0') !== true || currentMap.status !== 'NOT_YET_CAPTURED' || currentMap.records.length !== 0) fail('Legacy/current DILRMP map data must remain separately labelled until current MIS 4.0 rows are captured.');
if (federatedRegistry.records?.length !== 36 || federatedRegistry.nextGenLrsSupportedCount !== 12 || federatedRegistry.uliLrsV3GuideStateCount !== 14) fail('Federated land-record capability registry must contain 36 State/UT rows, 12 Next-Gen states and 14 separate v3-guide states.');
if (mis4Snapshot.administrativeCoverage?.statesAndUnionTerritories !== 36 || mis4Snapshot.parcelGeospatialProgress?.villagesWithUlpIn == null) fail('DILRMP MIS 4.0 dashboard snapshot is incomplete.');
if (!sourceRegistry.sources?.some((source) => source.id === 'india_property_register_api' && /independent private provider/i.test(source.publisher))) fail('India Property Register must be identified explicitly as a third-party private provider.');
if (parcelEvidence.records.length !== 0) fail('No owner-by-owner parcel evidence should be bundled without source-backed lawful collection.');
if (stateLandCoverage.records.reduce((sum, row) => sum + Number(row.aggregateLandOwners || 0), 0) !== Number(clr.nationalTotals.totalLandOwners)) fail('State land-owner aggregates do not reconcile to the DILRMP national total.');
if (acquisition.coverage?.jurisdictionsSelectableOnOfficialStateReport !== 36) fail('LACRRIS state report selector coverage must retain 36 State/UTs.');
if (!(acquisition.nationalTotals?.projects > 0) || !(acquisition.nationalTotals?.areaAcquiredHectares > 0)) fail('LACRRIS dashboard snapshot must include source-reported national metrics.');
if (!Array.isArray(acquisitionCases.records) || !Array.isArray(parcelEvidence.records)) fail('Evidence stores must contain records arrays.');
if (!sourceRegistry.sources?.some((source) => source.id === 'lacrris_dashboard')) fail('LACRRIS source missing from government data registry.');
for (const key of ['users','properties','documents','transfers','events']) {
  if (!Array.isArray(ledger[key]) || ledger[key].length !== 0) fail(`Default ledger contains non-empty ${key}; it must not ship with demo fixtures.`);
}

const archiveManifest = read('abdb/raw/manifest.json');
const rawArchivePath = path.join(dataRoot, 'abdb/raw/State_District_Subdistrict_PAN INDIA.rar');
if (!fs.existsSync(rawArchivePath)) fail('Raw Survey of India ABDB RAR is missing.');
if (fs.statSync(rawArchivePath).size !== Number(archiveManifest.bytes)) fail('Raw Survey of India ABDB archive byte count does not match its source manifest.');
const rawArchiveHash = crypto.createHash('sha256');
await new Promise((resolve, reject) => {
  const stream = fs.createReadStream(rawArchivePath);
  stream.on('data', (chunk) => rawArchiveHash.update(chunk));
  stream.on('error', reject);
  stream.on('end', resolve);
});
if (rawArchiveHash.digest('hex') !== archiveManifest.sha256) fail('Raw Survey of India ABDB archive SHA-256 does not match its source manifest.');

const manifest = read('manifest.json');
const failures = [];
for (const [relative, entry] of Object.entries(manifest.files || {})) {
  const file = path.join(dataRoot, relative);
  if (!fs.existsSync(file)) { failures.push(`${relative}: missing`); continue; }
  const bytes = fs.readFileSync(file);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== entry.bytes || sha !== entry.sha256) failures.push(`${relative}: checksum mismatch`);
}
if (failures.length) fail(`Official data checksum failures:\n${failures.join('\n')}`);

const report = {
  status: 'PASS',
  verifiedAt: new Date().toISOString(),
  stateUtCount: registry.states.length,
  dilrmpRows: clr.records.length,
  dilrmpNationalTotals: clr.nationalTotals,
  abdbCoverage: abdb.coverage,
  ngdrsCoverage: ngdrs.coverage,
  ngdrsManualCoverage: ngdrsManual.coverage,
  historicalVillageSubset: historical.coverage,
  stateLandCoverage: { rows: stateLandCoverage.records.length, aggregateLandOwners: clr.nationalTotals.totalLandOwners },
  lacrris: { nationalTotals: acquisition.nationalTotals, stateOptions: acquisition.coverage.jurisdictionsSelectableOnOfficialStateReport, importedCaseRows: acquisitionCases.records.length, selectedOfficialAwardRows: detailedAwards.records.length, importedAcquisitionRows: acquisitionExpanded.records.length, noticeRows: acquisitionNotices.records.length, portalRows: portals.records.length, aggregateLandOwners: clr.nationalTotals.totalLandOwners, parcelEvidenceRows: parcelEvidence.records.length, currentMis4Status: currentMap.status },
  defaultLedger: { users:0, properties:0, documents:0, transfers:0, events:0 },
  checksumFilesVerified: Object.keys(manifest.files || {}).length,
  rawAbdbArchiveSha256Verified: true,
  caveat: 'This verifies internal schema, counts and checksums plus mocked connector test fixtures only. It does not verify live API credentials/connectivity, independently audit private provider coverage, certify legal title, landowner identities or the correctness of source records.'
};
console.log(JSON.stringify(report, null, 2));
