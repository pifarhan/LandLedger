const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DATA_DIR = path.resolve(__dirname, '../../data');

const FILES = {
  registry: 'official-state-ut-registry.json',
  clr: 'dilrmp_state_level_current.json',
  portals: 'state_record_portals.json',
  acquisition: 'land_acquisition_national.json',
  acquisitionImports: 'land_acquisition_imports.json',
  notices: 'land_acquisition_notices.json',
  legacyMap: 'dilrmp_map_legacy_mis3.json',
  parcelEvidence: 'parcel_ownership_evidence.json'
};

function readJson(name) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) throw new Error(`Required data file is missing: ${name}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function readAcquisitionDataset() {
  const snapshot = readJson(FILES.acquisition);
  const operational = fs.existsSync(path.join(DATA_DIR, FILES.acquisitionImports))
    ? readJson(FILES.acquisitionImports)
    : { records: [], importLog: [] };
  const records = [...(snapshot.records || []), ...(operational.records || [])];
  const coverageByState = (snapshot.coverageByState || []).map((state) => {
    const rows = records.filter((row) => row.stateCode === state.stateCode);
    return {
      ...state,
      importedRecordCount: rows.length,
      parcelIdentifiedRecordCount: rows.filter((row) => (row.parcelIdentifiers || []).length).length,
      ...(rows.length ? { status: 'partial_import_official_rows' } : {})
    };
  });
  return { ...snapshot, records, coverageByState, importLog: operational.importLog || [] };
}
function atomicWrite(name, value) {
  const file = path.join(DATA_DIR, name);
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}
function cleanString(value, max = 500) {
  const result = String(value ?? '').trim();
  if (result.length > max) throw new Error(`A text field exceeds ${max} characters.`);
  return result;
}
function normalise(value) {
  return String(value || '').trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function stateByCode(value, registry = readJson(FILES.registry)) {
  const needle = normalise(value);
  return registry.states.find((state) => normalise(state.code) === needle || normalise(state.name) === needle || String(state.lgdCode) === needle) || null;
}
function officialUrl(value) {
  let parsed;
  try { parsed = new URL(String(value)); } catch { return false; }
  const host = parsed.hostname.toLowerCase();
  return parsed.protocol === 'https:' && (host === 'gov.in' || host.endsWith('.gov.in') || host === 'nic.in' || host.endsWith('.nic.in'));
}
function csvToObjects(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); if (row.some((v) => v.trim())) rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('CSV contains an unmatched quote.');
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); if (row.some((v) => v.trim())) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map((header) => header.trim());
  if (!headers.length || headers.some((header) => !header)) throw new Error('CSV must have non-empty column headers.');
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}
function parseImportPayload(payload, file) {
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload)) return payload;
  if (file?.buffer) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const text = file.buffer.toString('utf8');
    if (ext === '.csv') return csvToObjects(text);
    if (ext === '.json') {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : parsed.records;
    }
  }
  if (payload && typeof payload === 'object' && Object.keys(payload).length) return [payload];
  throw new Error('Provide a records array or upload a CSV/JSON file.');
}
function numericOrNull(value, field) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${field} must be a non-negative number.`);
  return parsed;
}
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function forbiddenPersonalKeys(record) {
  const forbidden = /^(owner(name|names|id|identifier|address|phone|mobile|email)?|landowner(name|names|id|address|phone|mobile|email)?|claimant(name|id|address|phone|mobile|email)?|aadhaar(number)?|uid|pan(number)?|phone(number)?|mobile(number)?|email|dateofbirth|dob)$/i;
  return Object.keys(record).filter((key) => forbidden.test(key.replace(/[_\s-]/g, '')) && record[key] != null && String(record[key]).trim() !== '');
}

function getEnrichmentDashboard(query = '') {
  const registry = readJson(FILES.registry);
  const portals = readJson(FILES.portals);
  const acquisition = readAcquisitionDataset();
  const notices = readJson(FILES.notices);
  const legacyMap = readJson(FILES.legacyMap);
  const clr = readJson(FILES.clr);
  const needle = normalise(query);
  const statePortals = portals.records.filter((row) => !needle || [row.state, row.stateCode, row.portalName, row.authority].some((v) => normalise(v).includes(needle)));
  const ownerAggregate = (clr.records || []).reduce((sum, row) => sum + (Number.isFinite(Number(row.totalLandOwners)) ? Number(row.totalLandOwners) : 0), 0);
  return {
    generatedAt: '2026-11-14',
    jurisdictionCount: registry.states.length,
    portalDirectory: {
      ...portals.coverage,
      rows: statePortals,
      policy: portals.policy,
      limitedScopePortals: portals.limitedScopePortals
    },
    ownerAggregates: {
      source: 'DILRMP CLR State/UT report',
      aggregateLandOwnerCount: ownerAggregate,
      stateRows: (clr.records || []).map((row) => ({ stateCode: row.stateCode, state: row.state, totalLandOwners: row.totalLandOwners, genderBasedOwnership: row.genderBasedOwnership, metricLabel: row.totalLandOwnersMetricLabel })),
      meaning: 'Government-reported State/UT aggregate counts only. Not a list of named people, unique persons, parcels or person-to-parcel title links.'
    },
    acquisition: {
      ...acquisition,
      stateRows: acquisition.coverageByState,
      noticeSources: notices.sources,
      notices: notices.records,
      noticePolicy: notices.policy
    },
    mapDigitization: {
      currentSource: 'https://www.dilrmp.gov.in/physicalProgressReports/map/state-level',
      currentStatus: 'MIS4 report schema verified; full State/UT row extract is not part of this static package. Runtime refresh connector can attempt retrieval.',
      legacySnapshot: legacyMap,
      warning: 'MIS 3.0 legacy metrics are historical and must not be combined with MIS 4.0 current metrics.'
    }
  };
}

function searchAcquisitionRecords(filters = {}) {
  const data = readAcquisitionDataset();
  const needle = normalise(filters.q);
  const state = stateByCode(filters.state || filters.stateCode);
  if ((filters.state || filters.stateCode) && !state) throw new Error('Unknown State/UT. Use a valid State/UT code or name.');
  return (data.records || []).filter((row) =>
    (!state || row.stateCode === state.code) &&
    (!filters.district || normalise(row.district).includes(normalise(filters.district))) &&
    (!needle || [row.projectName, row.district, row.officialCaseId, row.sourceReference].some((v) => normalise(v).includes(needle)))
  );
}

function importAcquisitionRecords(inputRecords, { sourceSha256 = null, importedBy = 'authority' } = {}) {
  if (!Array.isArray(inputRecords) || inputRecords.length < 1 || inputRecords.length > 2000) throw new Error('Import must contain between 1 and 2,000 acquisition rows.');
  const registry = readJson(FILES.registry);
  const data = readJson(FILES.acquisition);
  const operational = fs.existsSync(path.join(DATA_DIR, FILES.acquisitionImports))
    ? readJson(FILES.acquisitionImports)
    : { dataset: 'land_acquisition_authority_imports', generatedOn: null, records: [], importLog: [] };
  const existing = [...(data.records || []), ...(operational.records || [])];
  const seen = new Set(existing.map((row) => row.recordKey));
  const imported = [], duplicates = [];
  const allowedStages = new Set(['UNKNOWN','SIA','PRELIMINARY_NOTIFIED','NOTIFIED','INTENTION_TO_ACQUIRE_PUBLISHED','DECLARATION_PUBLISHED','AWARD_ENQUIRY','AWARD_ISSUED','COMPENSATION_PAID','POSSESSION_TAKEN','WITHDRAWN','RELEASED','COMPENSATION_REDETERMINATION']);
  for (const raw of inputRecords) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Every acquisition row must be a JSON object.');
    const personal = forbiddenPersonalKeys(raw);
    if (personal.length) throw new Error(`Acquisition project imports cannot contain personal owner/contact fields: ${personal.join(', ')}.`);
    const state = stateByCode(raw.stateCode || raw.state || raw.lgdCode, registry);
    if (!state) throw new Error(`Unknown State/UT for acquisition row: ${raw.stateCode || raw.state || raw.lgdCode || '(empty)'}.`);
    const projectName = cleanString(raw.projectName || raw.project || raw.name, 240);
    const district = cleanString(raw.district || raw.districtName, 160);
    const sourceUrl = cleanString(raw.sourceUrl || raw.source_url, 1000);
    const sourceAuthority = cleanString(raw.sourceAuthority || raw.authority, 240);
    const sourceReference = cleanString(raw.sourceReference || raw.officialCaseId || raw.caseId || raw.recordId, 240);
    if (!projectName || !district || !sourceAuthority || !sourceReference || !officialUrl(sourceUrl)) {
      throw new Error('Each row needs State/UT, project, district, source authority, source reference and an HTTPS government/NIC source URL.');
    }
    const sourceDocumentUrl = cleanString(raw.sourceDocumentUrl || raw.documentUrl, 1000) || null;
    if (sourceDocumentUrl && !officialUrl(sourceDocumentUrl)) throw new Error('sourceDocumentUrl must be an HTTPS government/NIC URL.');
    const acquisitionStage = cleanString(raw.acquisitionStage || raw.stage || 'UNKNOWN', 60).toUpperCase();
    if (!allowedStages.has(acquisitionStage)) throw new Error(`Unsupported acquisitionStage: ${acquisitionStage}.`);
    const stageEvidenceReference = cleanString(raw.stageEvidenceReference || raw.statusEvidenceReference, 240);
    const stageEvidenceUrl = cleanString(raw.stageEvidenceUrl || raw.statusEvidenceUrl || sourceDocumentUrl, 1000);
    const stageEvidenceDate = cleanString(raw.stageEvidenceDate || raw.statusEvidenceDate || raw.awardDate || raw.publicationDate || raw.notificationDate, 40) || null;
    if (acquisitionStage !== 'UNKNOWN' && (!stageEvidenceReference || !officialUrl(stageEvidenceUrl))) {
      throw new Error('A non-UNKNOWN acquisitionStage requires an official stageEvidenceReference and HTTPS government/NIC stageEvidenceUrl.');
    }
    let parcelIdentifiers = raw.parcelIdentifiers ?? raw.surveyNumbers ?? raw.khasraNumbers ?? raw.dagNumbers ?? [];
    if (typeof parcelIdentifiers === 'string') parcelIdentifiers = parcelIdentifiers.split(/[;|]/).map((value) => value.trim()).filter(Boolean);
    if (!Array.isArray(parcelIdentifiers) || parcelIdentifiers.length > 500) throw new Error('parcelIdentifiers must be an array or semicolon-separated string with at most 500 identifiers.');
    parcelIdentifiers = [...new Set(parcelIdentifiers.map((value) => cleanString(value, 120)).filter(Boolean))];
    const compensationBreakdown = raw.compensationBreakdown && typeof raw.compensationBreakdown === 'object' && !Array.isArray(raw.compensationBreakdown)
      ? Object.fromEntries(Object.entries(raw.compensationBreakdown).slice(0, 20).map(([key, value]) => [cleanString(key, 80), numericOrNull(value, `compensationBreakdown.${key}`)]))
      : null;
    const sourceDocumentEvidence = Array.isArray(raw.sourceDocumentEvidence)
      ? raw.sourceDocumentEvidence.slice(0, 20).map((item) => ({
          page: Number.isInteger(Number(item?.page)) ? Number(item.page) : null,
          fields: Array.isArray(item?.fields) ? item.fields.slice(0, 20).map((field) => cleanString(field, 240)) : []
        }))
      : [];
    const body = {
      stateCode: state.code, state: state.name, district, projectName,
      underAct: cleanString(raw.underAct || raw.act, 160) || null,
      landRequiringBody: cleanString(raw.landRequiringBody, 240) || null,
      ruralOrUrban: cleanString(raw.ruralOrUrban, 40) || null,
      landExtentHectare: numericOrNull(raw.landExtentHectare ?? raw.areaHectares ?? raw.area, 'landExtentHectare'),
      landExtentAsPublished: cleanString(raw.landExtentAsPublished, 240) || null,
      landExtentUnitAsPublished: cleanString(raw.landExtentUnitAsPublished || raw.areaUnit, 60) || null,
      parcelIdentifiers,
      parcelIdentifierCoverage: cleanString(raw.parcelIdentifierCoverage, 120) || (parcelIdentifiers.length ? 'SOURCE_EXTRACTED_SUBSET' : 'NONE'),
      acquisitionStage,
      stageEvidence: acquisitionStage === 'UNKNOWN' ? null : { reference: stageEvidenceReference, url: stageEvidenceUrl, date: stageEvidenceDate, recordedBy: importedBy },
      notificationDate: cleanString(raw.notificationDate || raw.preliminaryNotificationDate, 40) || null,
      section4NotificationDate: cleanString(raw.section4NotificationDate, 40) || null,
      section6NotificationDate: cleanString(raw.section6NotificationDate, 40) || null,
      section4NotificationReference: cleanString(raw.section4NotificationReference, 240) || null,
      section6NotificationReference: cleanString(raw.section6NotificationReference, 240) || null,
      publicationDate: cleanString(raw.publicationDate, 40) || null,
      awardDate: cleanString(raw.awardDate, 40) || null,
      paymentDate: cleanString(raw.paymentDate, 40) || null,
      possessionDate: cleanString(raw.possessionDate, 40) || null,
      compensationStatus: cleanString(raw.compensationStatus, 100) || (raw.compensationAmountInr != null ? 'AWARD_AMOUNT_PUBLISHED_PAYMENT_NOT_VERIFIED' : 'NOT_PUBLISHED'),
      compensationBreakdown,
      possessionStatusNote: cleanString(raw.possessionStatusNote, 800) || null,
      titleStatusNote: cleanString(raw.titleStatusNote, 800) || null,
      sourceDataQualityNotes: cleanString(raw.sourceDataQualityNotes, 1200) || null,
      sourceDocumentEvidence,
      projectDisplacedFamilies: numericOrNull(raw.projectDisplacedFamilies, 'projectDisplacedFamilies'),
      projectAffectedFamilies: numericOrNull(raw.projectAffectedFamilies, 'projectAffectedFamilies'),
      compensationAmountInr: numericOrNull(raw.compensationAmountInr ?? raw.compensationINR, 'compensationAmountInr'),
      rehabilitationResettlementAmountInr: numericOrNull(raw.rehabilitationResettlementAmountInr ?? raw.rehabilitationResettlementINR, 'rehabilitationResettlementAmountInr'),
      officialCaseId: cleanString(raw.officialCaseId || raw.caseId, 240) || null,
      sourceAuthority, sourceReference, sourceUrl,
      sourceDocumentUrl,
      retrievalDate: new Date().toISOString(), importedBy,
      importedSourceSha256: sourceSha256,
      recordStatus: 'IMPORTED_PUBLIC_SOURCE_UNVERIFIED',
      interpretation: 'Acquisition stage and parcel identifiers are copied from the cited record only; no later milestone is inferred.'
    };
    const recordKey = body.officialCaseId ? `${state.code}:${body.officialCaseId}` : `${state.code}:${digest(body)}`;
    if (seen.has(recordKey)) { duplicates.push({ stateCode: state.code, sourceReference }); continue; }
    seen.add(recordKey);
    imported.push({ ...body, recordKey, recordSha256: digest(body) });
  }
  operational.records = [...(operational.records || []), ...imported];
  operational.generatedOn = new Date().toISOString();
  operational.importLog = [...(operational.importLog || []), { importedAt: new Date().toISOString(), importedBy, receivedRows: inputRecords.length, insertedRows: imported.length, duplicateRows: duplicates.length, sourceSha256 }].slice(-200);
  operational.scope = 'Authority-imported source records are stored separately from the checksum-verified bundled LACRRIS snapshot. These rows do not alter or apportion national totals.';
  atomicWrite(FILES.acquisitionImports, operational);
  return { inserted: imported.length, duplicates: duplicates.length, records: imported, duplicateRows: duplicates };
}

function rejectSensitiveHolderText(value) {
  const text = String(value || '');
  if (/[A-Z]{5}\d{4}[A-Z]/i.test(text) || /\b\d{12}\b/.test(text) || /\b\d{10}\b/.test(text) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) {
    throw new Error('Do not import Aadhaar, PAN, phone or email identifiers into holder name fields.');
  }
}

function importParcelEvidence(inputRecords, { sourceSha256 = null, importedBy = 'authority' } = {}) {
  if (!Array.isArray(inputRecords) || inputRecords.length < 1 || inputRecords.length > 500) throw new Error('Import must contain between 1 and 500 parcel-evidence rows.');
  const registry = readJson(FILES.registry);
  const evidence = readJson(FILES.parcelEvidence);
  const records = Array.isArray(evidence.records) ? evidence.records : [];
  const seen = new Set(records.map((row) => row.recordKey || `${row.stateCode}:${row.sourceRecordId}`));
  const inserted = [], duplicates = [];
  const rightTypes = new Set(['OWNER','CO_OWNER','RECORDED_TENANT','LEASEHOLDER','MORTGAGEE','OTHER_RECORDED_INTEREST']);
  for (const raw of inputRecords) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Every parcel row must be a JSON object.');
    const state = stateByCode(raw.stateCode || raw.state, registry);
    if (!state) throw new Error(`Unknown State/UT for parcel row: ${raw.stateCode || raw.state || '(empty)'}.`);
    const district = cleanString(raw.district, 160);
    const village = cleanString(raw.villageOrMouza || raw.village || raw.mouza, 160);
    const parcel = cleanString(raw.parcelIdentifier || raw.khasra || raw.plotNumber || raw.dagNumber, 120);
    const sourceRecordId = cleanString(raw.sourceRecordId || raw.recordId || raw.khatianOrRecordNumber, 160);
    const sourceUrl = cleanString(raw.sourceUrl, 1000);
    const accessBasis = cleanString(raw.accessBasis, 80).toUpperCase();
    if (!district || !village || !parcel || !sourceRecordId || !officialUrl(sourceUrl)) {
      throw new Error('Each parcel row needs district, village/mouza, parcel identifier, source record ID and an HTTPS government/NIC source URL.');
    }
    if (!['PUBLIC_RECORD', 'AUTHORITY_EXPORT', 'CONSENTED_SUBMISSION', 'AUTHORISED_API', 'CONSENTED_API_LOOKUP'].includes(accessBasis)) {
      throw new Error('Unsupported accessBasis.');
    }
    const accessEvidenceNote = cleanString(raw.accessEvidenceNote || raw.accessBasisNote, 500) || null;
    if (['AUTHORISED_API','CONSENTED_API_LOOKUP','CONSENTED_SUBMISSION'].includes(accessBasis) && (!accessEvidenceNote || accessEvidenceNote.length < 12)) {
      throw new Error('Consented/API imports require an accessEvidenceNote identifying the permission or consent basis.');
    }
    let holders = Array.isArray(raw.holders) ? raw.holders : [];
    if (!holders.length && raw.ownerNames) {
      const names = Array.isArray(raw.ownerNames) ? raw.ownerNames : [raw.ownerNames];
      holders = names.map((name) => ({ name, rightType: 'OWNER' }));
    }
    if (holders.length > 100) throw new Error('A single parcel evidence row cannot contain more than 100 recorded holders/interests.');
    holders = holders.map((holder) => {
      if (!holder || typeof holder !== 'object' || Array.isArray(holder)) throw new Error('Each holder must be an object with name and rightType.');
      const name = cleanString(holder.name || holder.holderName, 160);
      rejectSensitiveHolderText(name);
      const rightType = cleanString(holder.rightType || holder.relationship || 'OWNER', 50).toUpperCase();
      if (!name || !rightTypes.has(rightType)) throw new Error('Each holder requires a name and a supported rightType.');
      const share = cleanString(holder.share ?? holder.sharePercent ?? '', 40) || null;
      if (share && !/^(?:\d{1,3}(?:\.\d{1,4})?%?|\d{1,4}\s*\/\s*\d{1,4}|as recorded)$/i.test(share)) throw new Error('Holder share must be a percentage, fraction or "as recorded".');
      return { name, rightType, share, sourceReference: cleanString(holder.sourceReference || raw.sourceRecordId, 160) };
    });
    const ownerNames = holders.filter((holder) => ['OWNER','CO_OWNER'].includes(holder.rightType)).map((holder) => holder.name);
    const contentHash = cleanString(raw.contentSha256 || raw.evidenceSha256, 128) || sourceSha256 || null;
    if (contentHash && !/^[a-f0-9]{64}$/i.test(contentHash)) throw new Error('contentSha256 must be a 64-character SHA-256 hexadecimal digest.');
    const content = {
      stateCode: state.code, stateName: state.name, district,
      tehsilOrBlock: cleanString(raw.tehsilOrBlock || raw.tehsil, 160) || null,
      villageOrMouza: village, parcelIdentifier: parcel,
      parcelIdentifierType: cleanString(raw.parcelIdentifierType || raw.identifierType || 'STATE_DEFINED', 40).toUpperCase(),
      khatianOrRecordNumber: cleanString(raw.khatianOrRecordNumber, 160) || null,
      holders, ownerNames,
      area: cleanString(raw.area, 60) || null, areaUnit: cleanString(raw.areaUnit, 30) || null,
      recordDate: cleanString(raw.recordDate, 40) || null,
      sourceRecordId, sourceAuthority: cleanString(raw.sourceAuthority || raw.issuingAuthority, 240) || null,
      sourceUrl, sourceDocumentUrl: cleanString(raw.sourceDocumentUrl || raw.documentUrl, 1000) || null,
      retrievalDate: new Date().toISOString(), retrievedAt: cleanString(raw.retrievedAt, 60) || new Date().toISOString(),
      accessBasis, accessEvidenceNote,
      verificationStatus: 'SOURCE_CAPTURED_UNVERIFIED', verifiedByAuthorityId: null, verifiedAt: null,
      ownerParcelMatchStatus: ownerNames.length ? 'SOURCE_CAPTURED_UNVERIFIED' : 'NO_HOLDER_RELATIONSHIP_CAPTURED',
      sourceVerification: null, contentSha256: contentHash,
      privacyClassification: ownerNames.length ? 'RESTRICTED_PERSONAL_DATA' : 'PUBLIC_PROPERTY_METADATA',
      importedBy, legalTitleStatus: 'NOT_A_LEGAL_TITLE_ADJUDICATION',
      legalBoundary: 'Source-captured evidence only; an RoR/holding entry is not a conclusive title adjudication or mutation.'
    };
    if (content.sourceDocumentUrl && !officialUrl(content.sourceDocumentUrl)) throw new Error('sourceDocumentUrl must be an HTTPS government/NIC URL.');
    const recordKey = `${state.code}:${normalise(district)}:${normalise(village)}:${normalise(parcel)}:${sourceRecordId}`;
    if (seen.has(recordKey)) { duplicates.push(recordKey); continue; }
    seen.add(recordKey);
    inserted.push({ ...content, recordKey });
  }
  evidence.records = [...records, ...inserted];
  evidence.generatedOn = new Date().toISOString();
  evidence.scope = 'Source-backed parcel evidence imported by authority/admin. Holder names are restricted personal data. A relationship becomes authority-verified only after server-side extraction matches the parcel identifier, source record reference and each holder name, or an explicit documented authority visual review where OCR/text extraction is unavailable. Verification is not a legal title adjudication.';
  evidence.importLog = [...(evidence.importLog || []), { importedAt: new Date().toISOString(), importedBy, receivedRows: inputRecords.length, insertedRows: inserted.length, duplicateRows: duplicates.length, sourceSha256 }].slice(-200);
  atomicWrite(FILES.parcelEvidence, evidence);
  return { inserted: inserted.length, duplicates: duplicates.length, records: inserted.map(({ ownerNames: _ownerNames, holders: _holders, ...row }) => ({ ...row, holderCount: _holders.length, ownerNameCount: _ownerNames.length })) };
}

function verifyParcelEvidence(recordKey, input, authorityId) {
  const key = cleanString(recordKey, 500);
  const data = readJson(FILES.parcelEvidence);
  const record = (data.records || []).find((row) => row.recordKey === key);
  if (!record) throw new Error('Parcel evidence record was not found.');
  if (!authorityId) throw new Error('A verified authority identity is required.');
  const methods = new Set(['OFFICIAL_SOURCE_RECORD_REVIEW','DIGITALLY_SIGNED_ROR_REVIEW','AUTHORISED_API_RESPONSE_REVIEW','ISSUING_OFFICE_CERTIFICATE_REVIEW']);
  const verificationMethod = cleanString(input?.verificationMethod, 80).toUpperCase();
  const verificationReference = cleanString(input?.verificationReference || input?.sourceRecordReference, 240);
  const verificationSourceUrl = cleanString(input?.verificationSourceUrl || input?.sourceDocumentUrl, 1000);
  const verificationDocumentSha256 = cleanString(input?.reviewedDocumentSha256, 64).toLowerCase();
  const reviewerNote = cleanString(input?.reviewerNote, 500) || null;
  const inspection = input?.documentInspection;
  if (!methods.has(verificationMethod)) throw new Error('Choose a supported official source-record verification method.');
  if (!verificationReference || !officialUrl(verificationSourceUrl) || !/^[a-f0-9]{64}$/.test(verificationDocumentSha256)) {
    throw new Error('Verification requires a source record reference, HTTPS government/NIC source URL and server-computed SHA-256.');
  }
  if (record.sourceUrl) {
    const original = new URL(record.sourceUrl), reviewed = new URL(verificationSourceUrl);
    if (original.hostname !== reviewed.hostname && !reviewed.hostname.endsWith(`.${original.hostname}`) && !original.hostname.endsWith(`.${reviewed.hostname}`)) {
      throw new Error('The reviewed document must come from the same official host as the imported source record.');
    }
  }
  if (record.verificationStatus === 'REJECTED') throw new Error('A rejected source record cannot be marked verified.');
  if (!inspection || inspection.sha256 !== verificationDocumentSha256) throw new Error('Server-side source-document extraction/inspection is required; client-supplied match flags are not accepted.');
  const hasText = Boolean(inspection.textPresent);
  let verificationClass;
  let ownerParcelMatchStatus;
  if (hasText) {
    if (!inspection.parcelMatch) throw new Error('The source document does not contain the exact normalised parcel identifier; verification refused.');
    if (!inspection.sourceReferenceMatch) throw new Error('The source document does not contain the source record/verification reference; verification refused.');
    if (inspection.holderMismatchCount > 0) throw new Error('One or more source-listed owner/co-owner names do not match the reviewed document; verification refused.');
    if ((record.ownerNames || []).length > 0 && inspection.holderMatchCount !== record.ownerNames.length) throw new Error('Every owner/co-owner must match the source document before the owner-to-parcel relationship can be verified.');
    verificationClass = 'MACHINE_TEXT_MATCHED_AND_AUTHORITY_CONFIRMED';
    ownerParcelMatchStatus = (record.ownerNames || []).length ? 'AUTHORITY_CONFIRMED_TEXT_MATCH' : 'NO_HOLDER_RELATIONSHIP_CAPTURED';
  } else {
    const manualConfirmed = input?.manualVisualInspectionConfirmed === true || String(input?.manualVisualInspectionConfirmed).toLowerCase() === 'true';
    if (!manualConfirmed || !reviewerNote || reviewerNote.length < 40) {
      throw new Error('No readable text was extracted. A competent authority must explicitly confirm manual visual inspection and provide a reviewer note of at least 40 characters.');
    }
    verificationClass = 'AUTHORITY_ATTESTED_VISUAL_REVIEW';
    ownerParcelMatchStatus = (record.ownerNames || []).length ? 'AUTHORITY_CONFIRMED_VISUAL_REVIEW' : 'NO_HOLDER_RELATIONSHIP_CAPTURED';
  }
  const event = {
    verificationMethod, verificationClass, verificationReference, verificationSourceUrl,
    verificationDocumentSha256, reviewerNote,
    extractionMethod: inspection.extractionMethod || 'UNKNOWN',
    extractedTextLength: Number(inspection.textLength || 0),
    matchedParcelIdentifier: Boolean(inspection.parcelMatch),
    matchedSourceRecordReference: Boolean(inspection.sourceReferenceMatch),
    matchedHolderCount: Number(inspection.holderMatchCount || 0),
    totalHolderCount: Number(inspection.holderCount || (record.ownerNames || []).length),
    verifiedByAuthorityId: String(authorityId), verifiedAt: new Date().toISOString()
  };
  record.verificationStatus = 'AUTHORITY_VERIFIED_SOURCE_RECORD';
  record.verifiedByAuthorityId = String(authorityId);
  record.verifiedAt = event.verifiedAt;
  record.ownerParcelMatchStatus = ownerParcelMatchStatus;
  record.sourceVerification = event;
  record.legalTitleStatus = 'NOT_A_LEGAL_TITLE_ADJUDICATION';
  record.verificationHistory = [...(record.verificationHistory || []), event].slice(-20);
  record.recordSha256 = digest({ ...record, recordSha256: undefined });
  atomicWrite(FILES.parcelEvidence, data);
  const { ownerNames, holders, ...safeRecord } = record;
  return { ...safeRecord, holderCount: holders?.length || ownerNames?.length || 0, ownerNameCount: ownerNames?.length || 0 };
}

module.exports = {
  getEnrichmentDashboard, searchAcquisitionRecords, importAcquisitionRecords,
  importParcelEvidence, verifyParcelEvidence, parseImportPayload, csvToObjects, officialUrl
};
