const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { login, authenticate, allow, publicUser } = require('./services/authService');
const { overview } = require('./services/analyticsService');
const { loadRealData, loadStateLevelData, summary: realDataSummary, search: searchRealData, fieldMapping: realDataFieldMapping } = require('./services/realDataService');
const { refreshOfficial } = require('./services/dilrmpStateSync');
const { refreshOfficial: refreshMapDigitization, readCurrent: readCurrentMapDigitization } = require('./services/dilrmpMapSync');
const enrichmentService = require('./services/governmentEnrichmentService');
const federatedLandRecordsService = require('./services/federatedLandRecordsService');
const thirdPartyLandRecordsService = require('./services/thirdPartyLandRecordsService');
const acquisitionDiscoveryService = require('./services/acquisitionDiscoveryService');
const sourceDocumentExtractionService = require('./services/sourceDocumentExtractionService');
const { getGovernmentDataSummary, getStateLandCoverage, getAcquisitionData, getParcelEvidence, getSourceRegistry } = require('./services/governmentDataService');
const { record } = require('./services/ledgerService');
const { AppError } = require('./errors');
const { required, number, documentMetadata } = require('./utils');
const { validateDocument } = require('./services/documentValidationService');
const { score: fraudRisk } = require('./services/fraudRiskService');
const { hasDuplicateParcel, canProposeTransfer, canAcceptTransfer, canFinalizeTransfer } = require('./services/workflowPolicy');

const roles = { authority: ['authority', 'admin'], propertyWriter: ['owner', 'seller', 'authority', 'admin'] };

const ABDB_FILE = path.resolve(__dirname, '../data/abdb/abdb-hierarchy.json');
let abdbCache = null;
function loadAbdbHierarchy() {
  if (!abdbCache) {
    if (!fs.existsSync(ABDB_FILE)) throw new AppError('ABDB hierarchy index is not available.', 503, 'ABDB_NOT_INDEXED');
    abdbCache = JSON.parse(fs.readFileSync(ABDB_FILE, 'utf8'));
  }
  return abdbCache;
}
function adminNorm(value) {
  return String(value || '').trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function resolveAbdbState(hierarchy, query) {
  const needle = adminNorm(query);
  if (!needle) return null;
  return hierarchy.states.find((state) =>
    state.code.toLowerCase() === needle ||
    String(state.lgdCode) === needle ||
    adminNorm(state.name) === needle
  ) || null;
}
function publicAbdbState(state) {
  return {
    code: state.code, name: state.name, type: state.type, lgdCode: state.lgdCode,
    stateBoundaryFeatureCount: (state.stateBoundaryFeatures || []).length,
    districtCount: state.districtCount, subDistrictCount: state.subDistrictCount,
    unmatchedSubDistrictParentCount: state.unmatchedSubDistrictParentCount
  };
}

function canSeeProperty(property, user) {
  return ['authority', 'admin'].includes(user.role) || property.status === 'APPROVED' || property.ownerId === String(user.sub) || property.createdBy === String(user.sub);
}

async function propertyView(store, property) {
  if (!property) return null;
  return {
    ...property,
    claimantName: property.ownerName,
    claimantVerificationStatus: property.claimantVerificationStatus || 'NOT_VERIFIED',
    legalTitleStatus: property.legalTitleStatus || 'NOT_VERIFIED_BY_STATUTORY_REGISTRY',
    documents: await store.documentsForProperty(property.id)
  };
}

function createApp({ store, options }) {
  const app = express();
  const writeLedger = (event) => record(store, event, options);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 20, fieldSize: 64 * 1024 },
    fileFilter: (_req, file, callback) => {
      const extension = path.extname(file.originalname || '').toLowerCase();
      const allowed = new Map([
        ['.pdf', ['application/pdf']],
        ['.png', ['image/png']],
        ['.jpg', ['image/jpeg']],
        ['.jpeg', ['image/jpeg']],
        ['.txt', ['text/plain']],
        ['.csv', ['text/csv', 'application/csv', 'text/plain']],
        ['.json', ['application/json', 'text/json']]
      ]);
      const types = allowed.get(extension);
      if (!types || !types.includes(String(file.mimetype || '').toLowerCase())) {
        return callback(new AppError('Unsupported document type. Upload a valid PDF, PNG, JPEG, TXT, CSV or JSON file.', 415, 'UNSUPPORTED_DOCUMENT_TYPE'));
      }
      callback(null, true);
    }
  });
  fs.mkdirSync(options.uploadDir, { recursive: true, mode: 0o700 });
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const allowedOrigins = options.corsOrigins || [];
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || (!allowedOrigins.length && process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
        return callback(null, true);
      }
      return callback(new AppError('This origin is not allowed by the API CORS policy.', 403, 'CORS_ORIGIN_DENIED'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600
  }));
  app.use(express.json({ limit: '1mb', strict: true }));

  const authAttempts = new Map();
  function authRateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const existing = authAttempts.get(key);
    const windowMs = 15 * 60 * 1000;
    const current = !existing || now - existing.startedAt >= windowMs
      ? { startedAt: now, count: 0 }
      : existing;
    current.count += 1;
    authAttempts.set(key, current);
    if (authAttempts.size > 10000) {
      for (const [ip, entry] of authAttempts) if (now - entry.startedAt >= windowMs) authAttempts.delete(ip);
    }
    res.setHeader('RateLimit-Limit', '10');
    res.setHeader('RateLimit-Remaining', String(Math.max(0, 10 - current.count)));
    if (current.count > 10) {
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - current.startedAt)) / 1000)));
      return res.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Too many sign-in or registration attempts. Try again later.' } });
    }
    next();
  }
  app.use('/api/auth/login', authRateLimit);
  app.use('/api/auth/register', authRateLimit);

  function checkDocumentSignature(file) {
    if (!file?.buffer?.length) throw new AppError('The uploaded document is empty.', 400, 'EMPTY_DOCUMENT');
    const extension = path.extname(file.originalname || '').toLowerCase();
    const bytes = file.buffer;
    const signatures = {
      '.pdf': bytes.subarray(0, 5).toString('ascii') === '%PDF-',
      '.png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      '.jpg': bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      '.jpeg': bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    };
    if (Object.prototype.hasOwnProperty.call(signatures, extension) && !signatures[extension]) {
      throw new AppError('The file content does not match its extension. The document was rejected.', 415, 'DOCUMENT_SIGNATURE_MISMATCH');
    }
    if (['.txt', '.csv', '.json'].includes(extension) && bytes.includes(0)) {
      throw new AppError('Text documents must not contain binary null bytes.', 415, 'INVALID_TEXT_DOCUMENT');
    }
  }

  app.get('/api/health', async (_req, res) => res.json({ status: 'ok', mode: options.databaseMode, fabricMode: options.fabricMode, prototype: true }));
  app.get('/api/abdb/status', authenticate(options.jwtSecret), async (_req, res, next) => {
    try {
      const base = path.join(__dirname, '../data/abdb');
      const raw = path.join(base, 'raw', 'State_District_Subdistrict_PAN INDIA.rar');
      const hierarchy = loadAbdbHierarchy();
      res.json({
        source: hierarchy.dataset,
        authority: hierarchy.authority,
        officialPage: hierarchy.source,
        archivePresent: fs.existsSync(raw),
        archiveBytes: fs.existsSync(raw) ? fs.statSync(raw).size : 0,
        archiveSha256: hierarchy.archive?.sha256,
        hierarchyIndexed: true,
        hierarchyRecords: hierarchy.coverage.indexedSubDistrictFeatures,
        coverage: hierarchy.coverage,
        titleDisclaimer: hierarchy.scope
      });
    } catch (error) { next(error); }
  });
  app.get('/api/abdb/states', authenticate(options.jwtSecret), async (_req, res, next) => {
    try {
      const hierarchy = loadAbdbHierarchy();
      res.json({ source: hierarchy.dataset, count: hierarchy.states.length, states: hierarchy.states.map(publicAbdbState) });
    } catch (error) { next(error); }
  });
  app.get('/api/abdb/districts', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const hierarchy = loadAbdbHierarchy();
      const state = resolveAbdbState(hierarchy, req.query.state);
      if (!state) throw new AppError('Provide a valid State/UT name, code or LGD code.', 400, 'INVALID_STATE');
      res.json({
        source: hierarchy.dataset, state: publicAbdbState(state),
        count: state.districts.length,
        districts: state.districts.map(({ stateCode, stateName, officialStateLgdCode, sourceStateLgdCode, districtName, sourceDistrictLgdCode, sourceFeatureId, shapeArea, shapeLength }) =>
          ({ stateCode, stateName, officialStateLgdCode, sourceStateLgdCode, districtName, sourceDistrictLgdCode, sourceFeatureId, shapeArea, shapeLength }))
      });
    } catch (error) { next(error); }
  });
  app.get('/api/abdb/subdistricts', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const hierarchy = loadAbdbHierarchy();
      const state = resolveAbdbState(hierarchy, req.query.state);
      if (!state) throw new AppError('Provide a valid State/UT name, code or LGD code.', 400, 'INVALID_STATE');
      const districtQuery = String(req.query.district || '').trim();
      const districtCodeQuery = String(req.query.districtLgdCode || '').trim();
      const districtKey = adminNorm(districtQuery);
      const matches = state.subDistricts.filter((record) =>
        (!districtKey || adminNorm(record.districtName) === districtKey) &&
        (!districtCodeQuery || String(record.sourceDistrictLgdCode || '') === districtCodeQuery)
      );
      const limit = Math.min(Math.max(Number(req.query.limit || 500), 1), 2000);
      const offset = Math.max(Number(req.query.offset || 0), 0);
      res.json({
        source: hierarchy.dataset, state: publicAbdbState(state),
        count: matches.length, offset, limit, records: matches.slice(offset, offset + limit)
      });
    } catch (error) { next(error); }
  });
  app.post('/api/abdb/validate', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const hierarchy = loadAbdbHierarchy();
      const records = Array.isArray(req.body.records) ? req.body.records : [req.body];
      const results = records.map((record) => {
        const state = resolveAbdbState(hierarchy, record.state || record.stateCode || record.lgdCode);
        const district = String(record.district || '').trim();
        const subDistrict = String(record.subDistrict || record.tehsil || record.taluk || '').trim();
        const match = state && district && subDistrict
          ? state.subDistricts.find((entry) => adminNorm(entry.districtName) === adminNorm(district) && adminNorm(entry.subDistrictName) === adminNorm(subDistrict))
          : null;
        return { ...record, abdbHierarchyMatch: Boolean(match), matchMethod: match?.parentMatchMethod || null,
          sourceDistrictLgdCode: match?.sourceDistrictLgdCode || null,
          sourceSubDistrictLgdCode: match?.sourceSubDistrictLgdCode || null };
      });
      res.json({
        source: hierarchy.dataset, count: results.length,
        matched: results.filter((record) => record.abdbHierarchyMatch).length,
        unmatched: results.filter((record) => !record.abdbHierarchyMatch).length,
        scope: hierarchy.scope, results
      });
    } catch (error) { next(error); }
  });
  app.get('/api/data-sources', authenticate(options.jwtSecret), async (_req, res, next) => { try { const data = loadRealData(); res.json({ source: { ...realDataSummary(data), fieldMapping: realDataFieldMapping() }, disclaimer: data.scope }); } catch (error) { next(error); } });
  app.get('/api/government-data/summary', authenticate(options.jwtSecret), async (_req, res, next) => { try { res.json(getGovernmentDataSummary()); } catch (error) { next(error); } });
  app.get('/api/government-data/states', authenticate(options.jwtSecret), async (req, res, next) => { try { res.json(getStateLandCoverage(req.query.q)); } catch (error) { next(error); } });
  app.get('/api/government-data/acquisition', authenticate(options.jwtSecret), async (req, res, next) => { try { const result = getAcquisitionData(req.query.state); if (!result) return res.status(404).json({ error: { code: 'STATE_NOT_FOUND', message: 'State/UT code or name was not found.' } }); res.json(result); } catch (error) { next(error); } });
  app.get('/api/government-data/parcels', authenticate(options.jwtSecret), async (req, res, next) => { try { const includeOwnerNames = ['authority','admin'].includes(req.auth.role); res.json(getParcelEvidence(req.query, includeOwnerNames)); } catch (error) { next(error); } });
  app.get('/api/federated-land-records/status', authenticate(options.jwtSecret), async (_req, res, next) => { try { res.json(federatedLandRecordsService.getStatus()); } catch (error) { next(error); } });
  app.get('/api/third-party-land-records/status', authenticate(options.jwtSecret), async (_req, res, next) => { try { res.json(thirdPartyLandRecordsService.getStatus()); } catch (error) { next(error); } });
  app.get('/api/third-party-land-records/coverage', authenticate(options.jwtSecret), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority/admin role required for third-party land-record coverage requests.', 403, 'FORBIDDEN'); const result = await thirdPartyLandRecordsService.getCoverage(req.query.stateLgd); await writeLedger({ entityType: 'EXTERNAL_LOOKUP', entityId: `IPR_COVERAGE_${result.stateLgd}`, action: 'THIRD_PARTY_LAND_RECORD_COVERAGE_CHECKED', actorId: req.auth.sub, payload: { provider: 'India Property Register', stateLgd: result.stateLgd, responseSha256: crypto.createHash('sha256').update(JSON.stringify(result.coverage)).digest('hex') } }); res.json(result); } catch (error) { next(error.status ? new AppError(error.message, error.status, error.code || 'IPR_COVERAGE_FAILED') : new AppError(error.message, 503, 'IPR_COVERAGE_FAILED')); } });
  app.get('/api/third-party-land-records/places', authenticate(options.jwtSecret), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority/admin role required for third-party personal land-record lookup.', 403, 'FORBIDDEN'); const result = await thirdPartyLandRecordsService.searchPlaces(req.query.q); await writeLedger({ entityType: 'EXTERNAL_LOOKUP', entityId: `IPR_PLACE_${crypto.createHash('sha256').update(String(req.query.q || '')).digest('hex').slice(0,16)}`, action: 'THIRD_PARTY_LAND_RECORD_PLACE_SEARCH', actorId: req.auth.sub, payload: { provider: 'India Property Register', querySha256: crypto.createHash('sha256').update(String(req.query.q || '')).digest('hex'), resultCount: result.villages.length + result.districts.length + result.states.length } }); res.json(result); } catch (error) { next(error.status ? new AppError(error.message, error.status, error.code || 'IPR_LOOKUP_FAILED') : new AppError(error.message, 503, 'IPR_LOOKUP_FAILED')); } });
  app.get('/api/third-party-land-records/plots', authenticate(options.jwtSecret), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority/admin role required for third-party personal land-record lookup.', 403, 'FORBIDDEN'); const result = await thirdPartyLandRecordsService.findPlot(req.query.villageLgd, req.query.plot); await writeLedger({ entityType: 'EXTERNAL_LOOKUP', entityId: `IPR_PLOT_SEARCH_${crypto.createHash('sha256').update(`${req.query.villageLgd}:${req.query.plot}`).digest('hex').slice(0,16)}`, action: 'THIRD_PARTY_LAND_RECORD_PLOT_SEARCH', actorId: req.auth.sub, payload: { provider: 'India Property Register', villageLgd: Number(req.query.villageLgd), plotQuerySha256: crypto.createHash('sha256').update(String(req.query.plot || '')).digest('hex'), matches: result.matches.length, related: result.related.length } }); res.json(result); } catch (error) { next(error.status ? new AppError(error.message, error.status, error.code || 'IPR_LOOKUP_FAILED') : new AppError(error.message, 503, 'IPR_LOOKUP_FAILED')); } });
  app.get('/api/third-party-land-records/plots/:iprId', authenticate(options.jwtSecret), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority/admin role required to retrieve recorded-holder information.', 403, 'FORBIDDEN'); const result = await thirdPartyLandRecordsService.getPlot(req.params.iprId); await writeLedger({ entityType: 'EXTERNAL_LOOKUP', entityId: `IPR_DETAIL_${result.iprId}`, action: 'THIRD_PARTY_LAND_RECORD_PLOT_DETAIL_VIEWED', actorId: req.auth.sub, payload: { provider: 'India Property Register', iprId: result.iprId, responseSha256: crypto.createHash('sha256').update(JSON.stringify(result.record)).digest('hex'), ownerFieldPresent: Array.isArray(result.record?.holders) && result.record.holders.length > 0, readOn: result.readOn } }); res.json(result); } catch (error) { next(error.status ? new AppError(error.message, error.status, error.code || 'IPR_LOOKUP_FAILED') : new AppError(error.message, 503, 'IPR_LOOKUP_FAILED')); } });
  app.post('/api/federated-land-records/query', authenticate(options.jwtSecret), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority/admin role required for consent-based government parcel lookups.', 403, 'FORBIDDEN'); const result = await federatedLandRecordsService.submitQuery({ ...req.body, actorId: req.auth.sub }); await writeLedger({ entityType: 'PARCEL_LOOKUP', entityId: result.requestId, action: 'AUTHORISED_FEDERATED_PARCEL_LOOKUP_SUBMITTED', actorId: req.auth.sub, payload: { provider: result.provider, stateCode: result.stateCode, district: String(req.body?.district || '').slice(0, 120), consentReferenceSha256: crypto.createHash('sha256').update(result.consentReference).digest('hex'), requestId: result.requestId } }); res.status(202).json({ ok: true, ...result }); } catch (error) { next(error.status ? new AppError(error.message, error.status, error.code || 'FEDERATED_LOOKUP_FAILED') : new AppError(error.message, 503, 'FEDERATED_LOOKUP_FAILED')); } });
  app.get('/api/federated-land-records/requests/:requestId', authenticate(options.jwtSecret), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority/admin role required to retrieve parcel-holder information.', 403, 'FORBIDDEN'); const result = await federatedLandRecordsService.pollRequest(req.params.requestId, { consentReference: req.query.consentReference }); if (['COMPLETED','FAILED'].includes(result.status)) await writeLedger({ entityType: 'PARCEL_LOOKUP', entityId: result.requestId, action: `AUTHORISED_FEDERATED_PARCEL_LOOKUP_${result.status}`, actorId: req.auth.sub, payload: { status: result.status, resultPresent: Boolean(result.result), resultSha256: result.result ? crypto.createHash('sha256').update(JSON.stringify(result.result)).digest('hex') : null } }); res.json(result); } catch (error) { next(error.status ? new AppError(error.message, error.status, error.code || 'FEDERATED_LOOKUP_FAILED') : new AppError(error.message, 503, 'FEDERATED_LOOKUP_FAILED')); } });
  app.get('/api/government-data/sources', authenticate(options.jwtSecret), async (_req, res, next) => { try { res.json(getSourceRegistry()); } catch (error) { next(error); } });
  app.get('/api/data-enrichment', authenticate(options.jwtSecret), async (req, res, next) => { try { const data = enrichmentService.getEnrichmentDashboard(req.query.q || ''); data.mapDigitization.currentSnapshot = readCurrentMapDigitization(); res.json(data); } catch (error) { next(error); } });
  app.get('/api/land-acquisition/records', authenticate(options.jwtSecret), async (req, res, next) => { try { const records = enrichmentService.searchAcquisitionRecords(req.query); res.json({ count: records.length, records }); } catch (error) { next(new AppError(error.message, 400, 'ACQUISITION_SEARCH_FAILED')); } });
  app.get('/api/land-acquisition/sources', authenticate(options.jwtSecret), async (_req, res) => res.json(acquisitionDiscoveryService.listSources()));
  app.get('/api/land-acquisition/discovered', authenticate(options.jwtSecret), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority/admin role required to view discovered acquisition candidates.', 403, 'FORBIDDEN'); res.json(acquisitionDiscoveryService.listCandidates()); } catch (error) { next(error); } });
  app.post('/api/land-acquisition/discover', authenticate(options.jwtSecret), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority/admin role required for official-source discovery.', 403, 'FORBIDDEN'); const result = await acquisitionDiscoveryService.discover({ sourceIds: req.body?.sourceIds }); await writeLedger({ entityType: 'DATASET', entityId: 'LAND_ACQUISITION_DISCOVERY', action: 'OFFICIAL_ACQUISITION_SOURCE_DISCOVERY_RUN', actorId: req.auth.sub, payload: { sourceCount: result.sourceCount, fetchedCount: result.fetchedCount, candidateCount: result.candidateCount } }); res.json({ ok: true, ...result }); } catch (error) { next(error.status ? error : new AppError(error.message, 400, 'ACQUISITION_DISCOVERY_FAILED')); } });
  app.post('/api/land-acquisition/extract', authenticate(options.jwtSecret), upload.single('sourceDocument'), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority/admin role required to extract acquisition source documents.', 403, 'FORBIDDEN'); if (!req.file) throw new AppError('Upload an official acquisition source document.', 400, 'SOURCE_DOCUMENT_REQUIRED'); const sourceUrl = String(req.body?.sourceUrl || '').trim(); if (!enrichmentService.officialUrl(sourceUrl)) throw new AppError('sourceUrl must be an HTTPS government/NIC URL.', 400, 'INVALID_SOURCE_URL'); const extracted = sourceDocumentExtractionService.extractText({ buffer: req.file.buffer, filename: req.file.originalname, mimeType: req.file.mimetype }); const candidates = sourceDocumentExtractionService.extractAcquisitionCandidates(extracted); await writeLedger({ entityType: 'SOURCE_DOCUMENT', entityId: candidates.sourceSha256, action: 'OFFICIAL_ACQUISITION_DOCUMENT_EXTRACTED', actorId: req.auth.sub, payload: { sourceUrl, sha256: candidates.sourceSha256, extractionMethod: candidates.extractionMethod, candidateCount: candidates.acquisitionReferences.length + candidates.parcelIdentifiers.length + candidates.areaCandidates.length } }); res.json({ ok: true, sourceUrl, ...candidates, notice: 'Extraction candidates are not facts until an authority checks them against the complete official order/award.' }); } catch (error) { next(error.status ? error : new AppError(error.message, 400, 'ACQUISITION_EXTRACTION_FAILED')); } });
  app.post('/api/land-acquisition/import', authenticate(options.jwtSecret), upload.single('file'), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority or admin role required for official dataset imports.', 403, 'FORBIDDEN'); const records = enrichmentService.parseImportPayload(req.body, req.file); const sourceSha256 = req.file ? crypto.createHash('sha256').update(req.file.buffer).digest('hex') : null; const result = enrichmentService.importAcquisitionRecords(records, { sourceSha256, importedBy: req.auth.sub }); await writeLedger({ entityType: 'DATASET', entityId: 'LAND_ACQUISITION', action: 'OFFICIAL_ACQUISITION_DATA_IMPORTED', actorId: req.auth.sub, payload: { received: records.length, inserted: result.inserted, duplicates: result.duplicates, sourceSha256 } }); res.status(201).json({ ok: true, ...result, notice: 'Imported project rows remain source-captured and are not merged into national dashboard totals.' }); } catch (error) { next(error.status ? error : new AppError(error.message, 400, 'ACQUISITION_IMPORT_FAILED')); } });
  app.post('/api/parcel-evidence/import', authenticate(options.jwtSecret), upload.single('file'), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority or admin role required for parcel evidence imports.', 403, 'FORBIDDEN'); const records = enrichmentService.parseImportPayload(req.body, req.file); const sourceSha256 = req.file ? crypto.createHash('sha256').update(req.file.buffer).digest('hex') : null; const result = enrichmentService.importParcelEvidence(records, { sourceSha256, importedBy: req.auth.sub }); await writeLedger({ entityType: 'DATASET', entityId: 'PARCEL_EVIDENCE', action: 'SOURCE_BACKED_PARCEL_EVIDENCE_IMPORTED', actorId: req.auth.sub, payload: { received: records.length, inserted: result.inserted, duplicates: result.duplicates, sourceSha256 } }); res.status(201).json({ ok: true, ...result, notice: 'Owner names, when present, are restricted personal data. Imported rows remain unverified until competent-authority verification.' }); } catch (error) { next(error.status ? error : new AppError(error.message, 400, 'PARCEL_IMPORT_FAILED')); } });
  app.post('/api/parcel-evidence/:recordKey/verify', authenticate(options.jwtSecret), upload.single('sourceDocument'), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority/admin role required to verify source-record evidence.', 403, 'FORBIDDEN'); if (!req.file) throw new AppError('Upload the exact reviewed official source document (PDF/image/text) so the server can compute SHA-256 and inspect its contents.', 400, 'SOURCE_DOCUMENT_REQUIRED'); const extracted = sourceDocumentExtractionService.extractText({ buffer: req.file.buffer, filename: req.file.originalname, mimeType: req.file.mimetype }); const evidenceRows = require('./services/governmentDataService').getParcelEvidence({}, true).records; const row = evidenceRows.find((item) => item.recordKey === req.params.recordKey); if (!row) throw new AppError('Parcel evidence record was not found.', 404, 'PARCEL_EVIDENCE_NOT_FOUND'); const inspection = sourceDocumentExtractionService.inspectParcelSource({ extracted, record: row, verificationReference: req.body?.verificationReference }); const reviewedDocumentSha256 = extracted.sha256; const result = enrichmentService.verifyParcelEvidence(req.params.recordKey, { ...(req.body || {}), reviewedDocumentSha256, documentInspection: inspection }, req.auth.sub); await writeLedger({ entityType: 'PARCEL_EVIDENCE', entityId: crypto.createHash('sha256').update(req.params.recordKey).digest('hex'), action: 'AUTHORITY_VERIFIED_SOURCE_RECORD_MATCH', actorId: req.auth.sub, payload: { verificationMethod: result.sourceVerification.verificationMethod, verificationClass: result.sourceVerification.verificationClass, verificationMethod: result.sourceVerification.verificationMethod, verificationReferenceSha256: crypto.createHash('sha256').update(result.sourceVerification.verificationReference).digest('hex'), recordKeySha256: crypto.createHash('sha256').update(req.params.recordKey).digest('hex'), sourceDocumentSha256: reviewedDocumentSha256, stateCode: result.stateCode, ownerNameCount: result.ownerNameCount, legalTitleStatus: result.legalTitleStatus } }); res.json({ ok: true, record: result, documentInspection: { extractionMethod: inspection.extractionMethod, textLength: inspection.textLength, parcelMatch: inspection.parcelMatch, sourceReferenceMatch: inspection.sourceReferenceMatch, holderCount: inspection.holderCount, holderMatchCount: inspection.holderMatchCount }, notice: 'The authority has verified the source record by text/OCR matching or by a separately recorded visual review. This is not a legal title adjudication or mutation.' }); } catch (error) { next(error.status ? new AppError(error.message, error.status, error.code || 'PARCEL_VERIFICATION_FAILED') : new AppError(error.message, 400, 'PARCEL_VERIFICATION_FAILED')); } });
  app.post('/api/map-digitization/refresh', authenticate(options.jwtSecret), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) throw new AppError('Authority role required to refresh official data.', 403, 'FORBIDDEN'); const data = await refreshMapDigitization(); res.json({ ok: true, ...data }); } catch (error) { next(new AppError(error.message, 503, 'MAP_DIGITIZATION_REFRESH_FAILED')); } });
  app.get('/api/real-data', authenticate(options.jwtSecret), async (req, res, next) => { try { const data = loadRealData(); const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200); const offset = Math.max(Number(req.query.offset || 0), 0); res.json({ source: realDataSummary(data), records: data.records.slice(offset, offset + limit) }); } catch (error) { next(error); } });
  app.get('/api/real-data/search', authenticate(options.jwtSecret), async (req, res, next) => { try { const data = loadRealData(); const matches = searchRealData(data, req.query); res.json({ source: realDataSummary(data), fieldMapping: realDataFieldMapping(), count: matches.length, records: matches.slice(0, 200) }); } catch (error) { next(error); } });
  app.get('/api/real-data/state-level', authenticate(options.jwtSecret), async (_req, res, next) => { try { const data = loadStateLevelData(); res.json(data); } catch (error) { next(error); } });
  app.post('/api/real-data/state-level/refresh', authenticate(options.jwtSecret), async (req, res, next) => { try { if (!['authority','admin'].includes(req.auth.role)) return res.status(403).json({ error: 'Authority role required' }); const data = await refreshOfficial(); res.json({ ok: true, ...data }); } catch (error) { next(error); } });

  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const requestedRole = String(req.body?.role || 'owner').trim().toLowerCase();
      const allowedPublicRoles = ['owner', 'buyer', 'seller'];
      if (name.length < 2 || name.length > 120) throw new AppError('Name must contain 2–120 characters.', 400, 'INVALID_NAME');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError('Enter a valid email address.', 400, 'INVALID_EMAIL');
      if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        throw new AppError('Password must be at least 12 characters and include upper-case, lower-case and numeric characters.', 400, 'WEAK_PASSWORD');
      }
      if (!allowedPublicRoles.includes(requestedRole)) throw new AppError('Public registration cannot create authority or admin accounts.', 403, 'ROLE_NOT_ALLOWED');
      if (await store.findUserByEmail(email)) throw new AppError('An account with this email already exists.', 409, 'ACCOUNT_EXISTS');
      const passwordHash = await bcrypt.hash(password, 12);
      try {
        await store.createUser({ name, email, role: requestedRole, passwordHash, identityVerificationStatus: 'NOT_VERIFIED' });
      } catch (error) {
        if (error.code === '23505') throw new AppError('An account with this email already exists.', 409, 'ACCOUNT_EXISTS');
        throw error;
      }
      res.status(201).json({ ...await login(store, email, password, options.jwtSecret),
        notice: 'Account created. Identity and any claimed property rights remain unverified until an authorised process confirms them.' });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try { res.json(await login(store, req.body.email, req.body.password, options.jwtSecret)); } catch (error) { next(error); }
  });

  app.get('/api/auth/me', authenticate(options.jwtSecret), async (req, res, next) => {
    try { const user = await store.findUser(req.auth.sub); if (!user) throw new AppError('User account was not found.', 401); res.json({ user: publicUser(user) }); } catch (error) { next(error); }
  });

  app.get('/api/properties', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const properties = (await store.listProperties()).filter((item) => canSeeProperty(item, req.auth));
      const result = await Promise.all(properties.map((item) => propertyView(store, item)));
      res.json({ properties: result });
    } catch (error) { next(error); }
  });
  app.get('/api/properties/:id', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const property = await store.getProperty(req.params.id);
      if (!property) throw new AppError('Property not found.', 404, 'NOT_FOUND');
      if (!canSeeProperty(property, req.auth)) throw new AppError('You do not have access to this property.', 403, 'FORBIDDEN');
      res.json({ property: await propertyView(store, property) });
    } catch (error) { next(error); }
  });
  app.post('/api/properties', authenticate(options.jwtSecret), allow(...roles.propertyWriter), upload.single('document'), async (req, res, next) => {
    try {
      const currentUser = await store.findUser(req.auth.sub);
      if (!currentUser) throw new AppError('The authenticated account no longer exists.', 401, 'ACCOUNT_NOT_FOUND');
      const parcelNumber = required(req.body.parcelNumber, 'Parcel number');
      const title = required(req.body.title, 'Property title');
      const address = required(req.body.address, 'Address');
      const areaSqm = number(req.body.areaSqm, 'Area');
      const landType = required(req.body.landType, 'Land type');
      const hierarchy = loadAbdbHierarchy();
      const state = resolveAbdbState(hierarchy, required(req.body.stateCode, 'State / UT'));
      if (!state) throw new AppError('Select a valid State/UT from the official hierarchy.', 400, 'INVALID_STATE');
      const districtName = required(req.body.districtName, 'District');
      const districtSourceLgdCode = String(req.body.districtSourceLgdCode || '').trim() || null;
      const district = state.districts.find((entry) =>
        (districtSourceLgdCode && String(entry.sourceDistrictLgdCode || '') === districtSourceLgdCode) || adminNorm(entry.districtName) === adminNorm(districtName)
      ) || null;
      const subDistrictName = String(req.body.subDistrictName || '').trim() || null;
      const subDistrictSourceLgdCode = String(req.body.subDistrictSourceLgdCode || '').trim() || null;
      const subDistrict = subDistrictName ? state.subDistricts.find((entry) =>
        adminNorm(entry.districtName) === adminNorm(districtName) &&
        ((subDistrictSourceLgdCode && String(entry.sourceSubDistrictLgdCode) === subDistrictSourceLgdCode) || adminNorm(entry.subDistrictName) === adminNorm(subDistrictName))
      ) : null;
      const adminBoundaryVerification = district && (!subDistrictName || subDistrict) ? 'MATCHED_TO_ABDB' : 'NOT_MATCHED_REVIEW_REQUIRED';
      const existingProperties = await store.listProperties();
      const duplicateParcel = hasDuplicateParcel({
        stateCode: state.code, districtName, districtSourceLgdCode: district?.sourceDistrictLgdCode || districtSourceLgdCode, parcelNumber
      }, existingProperties);
      let document = null; let validation = null; let uploadMetadata = null;
      let duplicateHash = false;
      if (req.file) {
        checkDocumentSignature(req.file);
        uploadMetadata = documentMetadata(req.file);
        duplicateHash = (await store.listDocuments()).some((item) => item.sha256 === uploadMetadata.sha256);
        validation = validateDocument(req.file, { parcelNumber, ownerName: currentUser.name, address, areaSqm });
        if (validation.decision === 'REVIEW' && validation.checks.parcelMismatch) throw new AppError('Document validation requires authority review because the extracted parcel identifier conflicts with the submitted parcel number.', 422, 'DOCUMENT_VALIDATION_FAILED');
      }
      const risk = fraudRisk({
        duplicateParcel,
        claimantNameMismatch: Boolean(validation?.checks?.claimantNameMismatch),
        duplicateHash,
        suspiciousDocument: Boolean(validation?.checks?.suspiciousTerms),
        missingFields: validation ? !validation.checks.readableText : false,
        transferWithoutApproval: false,
        parcelMismatch: Boolean(validation?.checks?.parcelMismatch),
        documentConsistencyLow: Boolean(validation && validation.consistencyScore < 0.70),
        multipleActiveOwners: existingProperties.some((item) =>
          item.status === 'APPROVED' && item.stateCode === state.code &&
          adminNorm(item.districtSourceLgdCode || item.districtName) === adminNorm(district?.sourceDistrictLgdCode || districtName) &&
          item.parcelNumber?.trim().toUpperCase() === parcelNumber.trim().toUpperCase() &&
          item.ownerId !== currentUser.id
        )
      });
      const property = await store.createProperty({ parcelNumber, title, address, areaSqm, landType, ownerId: currentUser.id, ownerName: currentUser.name, createdBy: currentUser.id, status: duplicateParcel ? 'PENDING' : (['authority', 'admin'].includes(req.auth.role) && req.body.status === 'APPROVED' ? 'APPROVED' : 'PENDING'), fraudRisk: risk, recordOrigin: 'USER_SUBMITTED_UNVERIFIED', claimantVerificationStatus: 'NOT_VERIFIED', legalTitleStatus: 'NOT_VERIFIED_BY_STATUTORY_REGISTRY', authorityReviewScope: 'WORKFLOW_REVIEW_ONLY', stateCode: state.code, stateName: state.name, districtName, districtSourceLgdCode: district?.sourceDistrictLgdCode || districtSourceLgdCode, subDistrictName: subDistrict?.subDistrictName || subDistrictName, subDistrictSourceLgdCode: subDistrict?.sourceSubDistrictLgdCode || subDistrictSourceLgdCode, adminBoundaryVerification, adminBoundarySource: 'Survey of India ABDB' });
      if (req.file) {
        const metadata = uploadMetadata || documentMetadata(req.file); metadata.storageKey = `${Date.now()}-${crypto.randomUUID()}-${metadata.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        fs.writeFileSync(path.join(options.uploadDir, metadata.storageKey), req.file.buffer, { mode: 0o600, flag: 'wx' });
        document = await store.createDocument({ ...metadata, propertyId: property.id, uploadedBy: currentUser.id, validationStatus: validation.decision, validation });
      }
      await writeLedger({ entityType: 'PROPERTY', entityId: property.id, action: 'PROPERTY_REGISTERED', actorId: currentUser.id, payload: { parcelNumber: property.parcelNumber, stateCode: property.stateCode, stateName: property.stateName, districtName: property.districtName, districtSourceLgdCode: property.districtSourceLgdCode, subDistrictName: property.subDistrictName, subDistrictSourceLgdCode: property.subDistrictSourceLgdCode, adminBoundaryVerification: property.adminBoundaryVerification, recordOrigin: property.recordOrigin, claimantVerificationStatus: property.claimantVerificationStatus, titleStatus: property.legalTitleStatus, ownerId: property.ownerId, claimantId: property.ownerId, claimantName: property.ownerName, landType: property.landType, areaSqm: property.areaSqm, status: property.status, documentHash: document?.sha256 || null, storageKey: document?.storageKey || null, documentValidation: document?.validation || null, fraudRisk: property.fraudRisk || null } });
      res.status(201).json({ property: await propertyView(store, property), message: adminBoundaryVerification === 'MATCHED_TO_ABDB' ? 'Claim submitted. Administrative location matched to the ABDB reference; claimant identity and legal title remain unverified.' : 'Claim submitted. The State/District location could not be fully matched to ABDB and requires manual authority review.' });
    } catch (error) { next(error); }
  });
  app.post('/api/properties/:id/documents', authenticate(options.jwtSecret), allow(...roles.propertyWriter), upload.single('document'), async (req, res, next) => {
    try {
      if (!req.file) throw new AppError('A document file is required.');
      checkDocumentSignature(req.file);
      const property = await store.getProperty(req.params.id);
      if (!property) throw new AppError('Property not found.', 404, 'NOT_FOUND');
      if (!roles.authority.includes(req.auth.role) && property.ownerId !== String(req.auth.sub)) throw new AppError('Only the current claimant can add a document.', 403, 'FORBIDDEN');
      const validation = validateDocument(req.file, { parcelNumber: property.parcelNumber, ownerName: property.ownerName, address: property.address, areaSqm: property.areaSqm });
      if (validation.decision === 'REVIEW' && validation.checks.parcelMismatch) throw new AppError('Document validation requires authority review because the extracted parcel identifier conflicts with the property record.', 422, 'DOCUMENT_VALIDATION_FAILED');
      const metadata = documentMetadata(req.file); metadata.storageKey = `${Date.now()}-${crypto.randomUUID()}-${metadata.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      fs.writeFileSync(path.join(options.uploadDir, metadata.storageKey), req.file.buffer, { mode: 0o600, flag: 'wx' });
      const document = await store.createDocument({ ...metadata, propertyId: property.id, uploadedBy: req.auth.sub, validationStatus: validation.decision, validation });
      await writeLedger({ entityType: 'DOCUMENT', entityId: document.id, action: 'DOCUMENT_VALIDATED_AND_HASHED', actorId: req.auth.sub, payload: { propertyId: property.id, sha256: document.sha256, storageKey: document.storageKey, validationStatus: validation.decision, semanticScore: validation.semanticScore, entities: validation.entities, checks: validation.checks } });
      res.status(201).json({ document });
    } catch (error) { next(error); }
  });
  app.get('/api/properties/:id/history', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const property = await store.getProperty(req.params.id);
      if (!property) throw new AppError('Property not found.', 404, 'NOT_FOUND');
      if (!canSeeProperty(property, req.auth)) throw new AppError('You do not have access to this history.', 403, 'FORBIDDEN');
      const events = await store.eventsFor('PROPERTY', property.id);
      const transfers = (await store.listTransfers()).filter((item) => item.propertyId === property.id);
      const transferEvents = (await Promise.all(transfers.map((item) => store.eventsFor('TRANSFER', item.id)))).flat();
      res.json({ property: await propertyView(store, property), history: [...events, ...transferEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) });
    } catch (error) { next(error); }
  });
  app.post('/api/properties/:id/review', authenticate(options.jwtSecret), allow(...roles.authority), async (req, res, next) => {
    try {
      const property = await store.getProperty(req.params.id);
      if (!property) throw new AppError('Property not found.', 404, 'NOT_FOUND');
      if (property.status !== 'PENDING') throw new AppError('Only pending claims can receive an authority workflow decision.', 409, 'CLAIM_ALREADY_REVIEWED');
      const decision = required(req.body.decision, 'Review decision').toUpperCase();
      if (!['APPROVED', 'REJECTED'].includes(decision)) throw new AppError('Review decision must be APPROVED or REJECTED.');
      const updated = await store.updateProperty(property.id, { status: decision, approvedBy: req.auth.sub, rejectionReason: decision === 'REJECTED' ? (req.body.reason || 'Authority workflow review rejected.') : null, authorityReviewScope: 'WORKFLOW_REVIEW_ONLY', legalTitleStatus: 'NOT_VERIFIED_BY_STATUTORY_REGISTRY' });
      await writeLedger({ entityType: 'PROPERTY', entityId: property.id, action: `PROPERTY_${decision}`, actorId: req.auth.sub, payload: { previousStatus: property.status, decision, reason: req.body.reason || null } });
      res.json({ property: await propertyView(store, updated), message: decision === 'APPROVED' ? 'Application workflow review approved. This does not establish legal title or verify the original government land record.' : 'Application workflow review rejected.' });
    } catch (error) { next(error); }
  });
  app.get('/api/documents/:id/download', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const document = await store.getDocument(req.params.id); if (!document) throw new AppError('Document not found.', 404, 'NOT_FOUND');
      const property = await store.getProperty(document.propertyId); if (!canSeeProperty(property, req.auth)) throw new AppError('You do not have access to this document.', 403, 'FORBIDDEN');
      const file = path.join(options.uploadDir, document.storageKey); if (!fs.existsSync(file)) throw new AppError('The off-chain file is unavailable.', 404, 'FILE_NOT_FOUND');
      res.type(document.mimeType).download(file, document.fileName);
    } catch (error) { next(error); }
  });

  app.get('/api/transfers', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const transfers = await store.listTransfers();
      const visible = roles.authority.includes(req.auth.role) ? transfers : transfers.filter((item) => item.sellerId === String(req.auth.sub) || item.buyerId === String(req.auth.sub));
      const properties = await store.listProperties(); const users = await store.listUsers();
      res.json({ transfers: visible.map((transfer) => ({ ...transfer, property: properties.find((item) => item.id === transfer.propertyId), seller: publicUser(users.find((item) => item.id === transfer.sellerId)), buyer: publicUser(users.find((item) => item.id === transfer.buyerId)) })) });
    } catch (error) { next(error); }
  });
  app.post('/api/transfers', authenticate(options.jwtSecret), allow('owner', 'seller'), async (req, res, next) => {
    try {
      const property = await store.getProperty(required(req.body.propertyId, 'Property'));
      if (!property) throw new AppError('Property not found.', 404, 'NOT_FOUND');
      const proposalCheck = canProposeTransfer({ property, userId: req.auth.sub, transfers: await store.listTransfers() });
      if (!proposalCheck.allowed) throw new AppError(`Workflow transfer not permitted: ${proposalCheck.reason}.`, 409, proposalCheck.reason);
      const buyer = await store.findUserByEmail(required(req.body.buyerEmail, 'Buyer email'));
      if (!buyer || !['buyer', 'owner'].includes(buyer.role)) throw new AppError('Select a registered buyer account.');
      if (buyer.id === property.ownerId) throw new AppError('The buyer must be different from the current application claimant.');
      const open = (await store.listTransfers()).find((item) => item.propertyId === property.id && ['PROPOSED', 'ACCEPTED'].includes(item.status));
      if (open) throw new AppError('An open transfer already exists for this property.', 409, 'TRANSFER_EXISTS');
      const docs = await store.documentsForProperty(property.id);
      const risk = fraudRisk({ duplicateParcel: false, ownerMismatch: property.ownerId !== String(req.auth.sub), duplicateHash: docs.length !== new Set(docs.map(d => d.sha256)).size, suspiciousDocument: docs.some(d => d.validation?.checks?.suspiciousTerms), missingFields: docs.some(d => d.validation?.decision === 'REVIEW'), transferWithoutApproval: property.status !== 'APPROVED' });
      const transfer = await store.createTransfer({ propertyId: property.id, sellerId: req.auth.sub, buyerId: buyer.id, notes: (req.body.notes || '').trim(), fraudRisk: risk });
      await writeLedger({ entityType: 'TRANSFER', entityId: transfer.id, action: 'TRANSFER_PROPOSED', actorId: req.auth.sub, payload: { propertyId: property.id, sellerId: req.auth.sub, buyerId: buyer.id, buyerName: buyer.name, fraudRisk: risk } });
      res.status(201).json({ transfer, message: 'Transfer proposal sent to buyer.' });
    } catch (error) { next(error); }
  });
  app.post('/api/transfers/:id/accept', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const transfer = await store.getTransfer(req.params.id); if (!transfer) throw new AppError('Transfer not found.', 404, 'NOT_FOUND');
      const acceptanceCheck = canAcceptTransfer({ transfer, userId: req.auth.sub });
      if (!acceptanceCheck.allowed) throw new AppError(`Transfer acceptance not permitted: ${acceptanceCheck.reason}.`, 409, acceptanceCheck.reason);
      const updated = await store.updateTransfer(transfer.id, { status: 'ACCEPTED', acceptedAt: new Date().toISOString() });
      await writeLedger({ entityType: 'TRANSFER', entityId: transfer.id, action: 'TRANSFER_ACCEPTED', actorId: req.auth.sub, payload: { propertyId: transfer.propertyId, buyerId: req.auth.sub } });
      res.json({ transfer: updated, message: 'Transfer accepted and queued for authority workflow review.' });
    } catch (error) { next(error); }
  });
  app.post('/api/transfers/:id/finalize', authenticate(options.jwtSecret), allow(...roles.authority), async (req, res, next) => {
    try {
      const transfer = await store.getTransfer(req.params.id); if (!transfer) throw new AppError('Transfer not found.', 404, 'NOT_FOUND');
      const property = await store.getProperty(transfer.propertyId);
      const finalizationCheck = canFinalizeTransfer({ transfer, property });
      if (!finalizationCheck.allowed) throw new AppError(`Workflow finalisation not permitted: ${finalizationCheck.reason}.`, 409, finalizationCheck.reason);
      const buyer = await store.findUser(transfer.buyerId);
      if (!buyer) throw new AppError('The designated buyer account no longer exists.', 409, 'BUYER_ACCOUNT_NOT_FOUND');
      const finalizedAt = new Date().toISOString();
      const updatedProperty = await store.updateProperty(property.id, { ownerId: buyer.id, ownerName: buyer.name });
      const updatedTransfer = await store.updateTransfer(transfer.id, { status: 'FINALIZED', authorityId: req.auth.sub, finalizedAt });
      await writeLedger({ entityType: 'TRANSFER', entityId: transfer.id, action: 'TRANSFER_FINALIZED', actorId: req.auth.sub, payload: { propertyId: property.id, priorClaimantId: transfer.sellerId, newClaimantId: buyer.id, finalizedAt } });
      await writeLedger({ entityType: 'PROPERTY', entityId: property.id, action: 'CLAIMANT_REFERENCE_UPDATED', actorId: req.auth.sub, payload: { transferId: transfer.id, priorClaimantId: transfer.sellerId, newClaimantId: buyer.id } });
      res.json({ transfer: updatedTransfer, property: await propertyView(store, updatedProperty), message: 'The application workflow claimant reference was updated after authority review. This prototype does not perform a statutory land-title transfer.' });
    } catch (error) { next(error); }
  });
  app.post('/api/transfers/:id/reject', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const transfer = await store.getTransfer(req.params.id); if (!transfer) throw new AppError('Transfer not found.', 404, 'NOT_FOUND');
      const allowed = roles.authority.includes(req.auth.role) || transfer.buyerId === String(req.auth.sub);
      if (!allowed) throw new AppError('You cannot reject this transfer.', 403, 'FORBIDDEN');
      if (!['PROPOSED', 'ACCEPTED'].includes(transfer.status)) throw new AppError('This transfer has already been resolved.', 409, 'INVALID_TRANSFER_STATE');
      const updated = await store.updateTransfer(transfer.id, { status: 'REJECTED', rejectionReason: req.body.reason || 'Rejected by participant.' });
      await writeLedger({ entityType: 'TRANSFER', entityId: transfer.id, action: 'TRANSFER_REJECTED', actorId: req.auth.sub, payload: { reason: updated.rejectionReason } });
      res.json({ transfer: updated });
    } catch (error) { next(error); }
  });

  app.get('/api/analytics/overview', authenticate(options.jwtSecret), allow(...roles.authority), async (req, res, next) => { try { res.json(await overview(store)); } catch (error) { next(error); } });
  app.get('/api/ledger/verify', authenticate(options.jwtSecret), allow(...roles.authority), async (req, res, next) => { try { res.json(await store.verifyLedger()); } catch (error) { next(error); } });
  app.get('/api/fabric/status', authenticate(options.jwtSecret), allow(...roles.authority), async (_req, res, next) => { try { res.json(await require('./services/ledgerService').connectionStatus(options)); } catch (error) { next(error); } });
  app.get('/api/research/evaluation', authenticate(options.jwtSecret), async (_req, res, next) => { try { const fs = require('fs'); const path = require('path'); const file = path.join(__dirname, '../../research/evaluation-result.json'); const base = JSON.parse(fs.readFileSync(file, 'utf8')); const fraud = require('./services/fraudRiskService').evaluate(); const security = fs.existsSync(path.join(__dirname, '../../research/security-audit-result.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, '../../research/security-audit-result.json'), 'utf8')) : null; const gaps = fs.existsSync(path.join(__dirname, '../../research/gap-evidence.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, '../../research/gap-evidence.json'), 'utf8')) : null; res.json({ ...base, fraudRiskEvaluation: fraud, securityAudit: security, gapEvidence: gaps }); } catch (error) { next(error); } });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: { code: error.code, message: 'Document upload failed. Maximum size is 10 MB.' } });
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: { code: error.code || 'INTERNAL_ERROR', message: status >= 500 ? 'An unexpected server error occurred.' : error.message } });
  });
  return app;
}

module.exports = { createApp };
