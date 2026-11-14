const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SOURCE = 'https://dilrmp.gov.in/physicalProgressReports/clr/state-level';
const DATA_DIR = path.resolve(__dirname, '../../data');
const FILE = path.join(DATA_DIR, 'dilrmp_state_level_current.json');
const REGISTRY_FILE = path.join(DATA_DIR, 'official-state-ut-registry.json');

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}
function cleanNumber(value) {
  const text = cleanText(value).replace(/,/g, '').replace(/%/g, '');
  if (!text || text === '-' || text === '—' || !/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}
function yn(value) {
  const text = cleanText(value).toLowerCase();
  if (['yes', 'y', 'true'].includes(text)) return true;
  if (['no', 'n', 'false'].includes(text)) return false;
  return null;
}
function norm(value) {
  return cleanText(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
const ALIASES = new Map([
  ['andaman and nicobar', 'andaman and nicobar islands'],
  ['andaman nicobar islands', 'andaman and nicobar islands'],
  ['delhi', 'nct of delhi'],
  ['dadra and nagar haveli and daman diu', 'dadra and nagar haveli and daman and diu'],
  ['jammu kashmir', 'jammu and kashmir'],
  ['pondicherry', 'puducherry']
]);
const canonical = (value) => ALIASES.get(norm(value)) || norm(value);

function tableRows(html) {
  return [...String(html || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => ({
    cells: [...match[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map((cell) => cleanText(cell[1]))
  }));
}
function parseGrandTotal(html) {
  const row = tableRows(html).find(({ cells }) => cells.some((cell) => /grand\s*total/i.test(cell)));
  if (!row || row.cells.length < 13) return null;
  const number = (index) => cleanNumber(row.cells[index]);
  return {
    districts: number(2), tehsils: number(3), villages: number(4),
    rorTotal: number(5), rorComputerized: number(6),
    villagesClrCompleted: number(10), totalLandOwners: number(12)
  };
}

function parseTable(html, registry) {
  const states = (registry || JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'))).states;
  const byName = new Map(states.map((state) => [canonical(state.name), state]));
  const rows = tableRows(html);
  const records = [];
  for (const { cells } of rows) {
    if (cells.length < 29) continue;
    const rawName = cells[1];
    if (!rawName || /^(grand total|total|state\s*\/?\s*ut)$/i.test(rawName)) continue;
    const jurisdiction = byName.get(canonical(rawName));
    if (!jurisdiction) continue;
    const number = (index) => cleanNumber(cells[index]);
    const yesNo = (index) => yn(cells[index]);
    records.push({
      state: jurisdiction.name,
      stateCode: jurisdiction.code,
      lgdCode: jurisdiction.lgdCode,
      type: jurisdiction.type,
      totalDistricts: number(2),
      totalTehsils: number(3),
      totalVillages: number(4),
      totalRor: number(5),
      rorComputerized: number(6),
      rorComputerizedPercent: number(7),
      rorLinkedToCadastralMap: number(8),
      rorLinkedToCadastralMapPercent: number(9),
      villagesClrCompleted: number(10),
      villagesClrCompletedPercent: number(11),
      totalLandOwners: number(12),
      genderBasedOwnership: {
        districts: number(13),
        male: number(14),
        female: number(15),
        total: number(16)
      },
      capabilities: {
        onlineRoRDownload: yesNo(17),
        digitallySignedRoROnline: yesNo(18),
        digitallySignedRoRLegallyValid: yesNo(19),
        onlineMutationApplication: yesNo(20),
        autoTriggeredMutation: yesNo(21),
        autoMutation: yesNo(22),
        banksAuthorizedForMortgage: yesNo(23),
        bankAuthorizedDistricts: number(24),
        bankAuthorizedBranches: number(25),
        sroOnlineCheck: yesNo(26),
        revenueCourtOnlineCheck: yesNo(27),
        civilCourtEcourtCheck: yesNo(28)
      },
      sourceStatus: 'reported_by_live_DoLR_DILRMP_CLR_table',
      recordScope: 'state_ut_aggregate_only'
    });
  }
  const unique = new Map(records.map((record) => [record.stateCode, record]));
  return [...unique.values()];
}

async function fetchOfficial() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(SOURCE, {
      signal: controller.signal,
      headers: { 'user-agent': 'LandLedger academic research prototype/2.0', accept: 'text/html' }
    });
    if (!response.ok) throw new Error(`DILRMP HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}
function sum(records, field) {
  return records.reduce((total, record) => total + (Number(record[field]) || 0), 0);
}
function nationalSummary(records) {
  const totalRor = sum(records, 'totalRor');
  const computerized = sum(records, 'rorComputerized');
  const mapLinked = sum(records, 'rorLinkedToCadastralMap');
  const villages = sum(records, 'totalVillages');
  const clrVillages = sum(records, 'villagesClrCompleted');
  const boolCount = (key) => records.filter((record) => record.capabilities[key] === true).length;
  return {
    statesUt: records.length,
    districts: sum(records, 'totalDistricts'),
    tehsils: sum(records, 'totalTehsils'),
    villages,
    rorTotal: totalRor,
    rorComputerized: computerized,
    rorComputerizedPercent: totalRor ? Number((computerized / totalRor * 100).toFixed(2)) : null,
    rorLinkedToCadastralMap: mapLinked,
    rorLinkedToCadastralMapPercent: totalRor ? Number((mapLinked / totalRor * 100).toFixed(2)) : null,
    villagesClrCompleted: clrVillages,
    villagesClrCompletedPercent: villages ? Number((clrVillages / villages * 100).toFixed(2)) : null,
    totalLandOwners: sum(records, 'totalLandOwners'),
    genderBasedOwnership: {
      districts: sum(records.map((r) => ({ v: r.genderBasedOwnership.districts })), 'v'),
      male: sum(records.map((r) => ({ v: r.genderBasedOwnership.male })), 'v'),
      female: sum(records.map((r) => ({ v: r.genderBasedOwnership.female })), 'v'),
      total: sum(records.map((r) => ({ v: r.genderBasedOwnership.total })), 'v')
    },
    onlineRoRStates: boolCount('onlineRoRDownload'),
    digitallySignedRoRStates: boolCount('digitallySignedRoROnline'),
    digitallySignedRoRLegallyValidStates: boolCount('digitallySignedRoRLegallyValid'),
    onlineMutationApplicationStates: boolCount('onlineMutationApplication'),
    autoTriggeredMutationStates: boolCount('autoTriggeredMutation'),
    autoMutationStates: boolCount('autoMutation'),
    banksAuthorizedStates: boolCount('banksAuthorizedForMortgage'),
    bankAuthorizedDistricts: sum(records.map((r) => ({ v: r.capabilities.bankAuthorizedDistricts })), 'v'),
    bankAuthorizedBranches: sum(records.map((r) => ({ v: r.capabilities.bankAuthorizedBranches })), 'v'),
    sroOnlineCheckStates: boolCount('sroOnlineCheck'),
    revenueCourtOnlineCheckStates: boolCount('revenueCourtOnlineCheck'),
    civilCourtEcourtCheckStates: boolCount('civilCourtEcourtCheck')
  };
}
function atomicWrite(file, contents) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, contents);
  fs.renameSync(temporary, file);
}
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function makeCsv(records) {
  const fields = [
    'stateCode','state','type','lgdCode','totalDistricts','totalTehsils','totalVillages',
    'totalRor','rorComputerized','rorComputerizedPercent','rorLinkedToCadastralMap',
    'rorLinkedToCadastralMapPercent','villagesClrCompleted','villagesClrCompletedPercent','totalLandOwners',
    'genderDistricts','genderMale','genderFemale','genderTotal','onlineRoRDownload',
    'digitallySignedRoROnline','digitallySignedRoRLegallyValid','onlineMutationApplication',
    'autoTriggeredMutation','autoMutation','banksAuthorizedForMortgage','bankAuthorizedDistricts',
    'bankAuthorizedBranches','sroOnlineCheck','revenueCourtOnlineCheck','civilCourtEcourtCheck',
    'rorPortalName','rorPortalUrl','rorDirectoryStatus','ngdrsReportingStatus','ngdrsDocumentsRegistered'
  ];
  const rows = [fields.join(',')];
  for (const record of records) {
    const gender = record.genderBasedOwnership || {};
    const caps = record.capabilities || {};
    const directory = record.rorDirectory || {};
    const ngdrs = record.registrationActivity || {};
    const row = {
      ...record,
      genderDistricts: gender.districts, genderMale: gender.male, genderFemale: gender.female, genderTotal: gender.total,
      ...caps,
      rorPortalName: directory.portalName, rorPortalUrl: directory.url, rorDirectoryStatus: directory.status,
      ngdrsReportingStatus: ngdrs.reportingStatus, ngdrsDocumentsRegistered: ngdrs.documentsRegistered
    };
    rows.push(fields.map((field) => csvCell(row[field])).join(','));
  }
  return `${rows.join('\n')}\n`;
}
function writeManifest() {
  const fileNames = [
    'official-state-ut-registry.json','official-state-ut-registry.csv',
    'dilrmp_state_level_current.json','dilrmp_state_level_current.csv',
    'dilrmp_national_snapshot.json','dilrmp_real_snapshot.json','dilrmp_real_snapshot.csv',
    'ngdrs_registration_activity.json','ngdrs_registration_activity.csv',
    'ngdrs_data_entry_form_snapshot.json','ngdrs_data_entry_form_snapshot.csv',
    'source_verification.json','abdb/abdb-hierarchy.json','abdb/districts.csv','abdb/subdistricts.csv',
    'state_record_portals.json','state_record_portals.csv','state_land_data_coverage.csv',
    'land_acquisition_national.json','land_acquisition_notices.json','land_acquisition_notices.csv','land_acquisition_state_coverage.csv',
    'dilrmp_map_legacy_mis3.json','dilrmp_map_current_mis4.json','state_land_data_coverage.json',
    'land_acquisition_lacrris_snapshot.json','land_acquisition_cases.json','parcel_ownership_evidence.json',
    'government_data_source_registry.json','schemas/parcel-ownership-evidence.schema.json','schemas/land-acquisition-case.schema.json'
  ];
  const manifest = {
    generatedAt: new Date().toISOString(),
    policy: 'Checksums cover official public snapshots and source-derived administrative reference files. Personal owner/title rows are not included.',
    files: {}
  };
  for (const relative of fileNames) {
    const target = path.join(DATA_DIR, relative);
    if (!fs.existsSync(target)) continue;
    const bytes = fs.readFileSync(target);
    manifest.files[relative] = {
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    };
  }
  atomicWrite(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
}
async function refreshOfficial() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  const html = await fetchOfficial();
  const parsed = parseTable(html, registry);
  if (parsed.length !== 36 || new Set(parsed.map((record) => record.stateCode)).size !== 36) {
    throw new Error(`Official DILRMP parser returned ${parsed.length}/36 unique State/UT rows; existing snapshot was retained.`);
  }
  const parsedTotals = nationalSummary(parsed);
  const publishedTotals = parseGrandTotal(html);
  if (!publishedTotals || Object.entries(publishedTotals).some(([key, value]) =>
    value === null || Number(value) !== Number(parsedTotals[key])
  )) {
    throw new Error('DILRMP State/UT rows do not reconcile to the published Grand Total row; existing snapshot was retained.');
  }
  const byCode = new Map(parsed.map((record) => [record.stateCode, record]));
  const records = registry.states.map((state) => {
    const record = byCode.get(state.code);
    if (!record) throw new Error(`DILRMP result missing ${state.name}; existing snapshot was retained.`);
    return {
      ...record,
      rorDirectory: state.rorDirectory || null,
      bhuNaksha: state.bhuNaksha || null,
      registrationActivity: state.registrationActivity || null,
      parcelOwnershipRecords: {
        availability: 'not_included',
        syntheticRecordsPresent: false,
        note: 'This public CLR report contains aggregate metrics, not parcel-level title rows.'
      }
    };
  });
  const nationalTotals = nationalSummary(records);
  const payload = {
    dataset: 'DILRMP Computerization of Land Records (CLR) State/UT-wise',
    authority: 'Department of Land Resources, Government of India',
    source: SOURCE,
    retrievedAt: new Date().toISOString(),
    scope: 'Official State/UT aggregate land-administration indicators only; no individual owner/title/transaction rows.',
    jurisdictionCount: 36,
    stateCount: registry.stateCount,
    unionTerritoryCount: registry.unionTerritoryCount,
    coverage: { records: records.length, recordsWithMetrics: records.length, missingRecords: 0 },
    nationalTotals,
    records
  };
  const nationalSnapshot = {
    authority: 'Department of Land Resources, Government of India',
    dataset: 'DILRMP Computerization of Land Records (CLR) State/UT-wise national total',
    source: SOURCE,
    retrievedAt: payload.retrievedAt,
    scope: 'Aggregate public administrative indicators only; not individual ownership/title records.',
    metrics: nationalTotals
  };
  atomicWrite(FILE, JSON.stringify(payload, null, 2));
  atomicWrite(path.join(DATA_DIR, 'dilrmp_national_snapshot.json'), JSON.stringify(nationalSnapshot, null, 2));
  atomicWrite(path.join(DATA_DIR, 'dilrmp_state_level_current.csv'), makeCsv(records));
  writeManifest();
  return payload;
}

module.exports = { refreshOfficial, parseTable, parseGrandTotal, cleanNumber, yn, nationalSummary };
