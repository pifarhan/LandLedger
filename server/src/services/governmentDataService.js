const fs = require('fs');
const path = require('path');
const DATA_DIR = path.resolve(__dirname, '../../data');
function read(name) { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); }
function norm(value) { return String(value || '').trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function getGovernmentDataSummary() {
  const registry = read('government_data_source_registry.json');
  const coverage = read('state_land_data_coverage.json');
  const acquisition = read('land_acquisition_national.json');
  const notices = read('land_acquisition_notices.json');
  const portals = read('state_record_portals.json');
  const acquisitionCases = read('land_acquisition_cases.json');
  const parcelEvidence = read('parcel_ownership_evidence.json');
  const federated = read('federated_land_records_registry.json');
  const mis4 = read('dilrmp_mis4_20261113.json');
  const owners = coverage.records.reduce((sum, row) => sum + (Number.isFinite(Number(row.aggregateLandOwners)) ? Number(row.aggregateLandOwners) : 0), 0);
  return {
    generatedOn: coverage.generatedOn,
    jurisdictionCount: coverage.jurisdictionCount,
    aggregateLandOwners: owners,
    aggregateLandOwnersScope: 'DILRMP State/UT aggregate counts, not person-level names or owner-to-parcel links',
    statePortalCoverage: portals.coverage.urls,
    statePortalDirectoryRecords: portals.records.length,
    bulkApiAccessVerified: portals.coverage.openBulkApisVerified,
    acquisitionNationalTotals: acquisition.metrics,
    acquisitionReportJurisdictions: acquisition.coverageByState.length,
    acquisitionDetailRowsBundled: acquisition.records.length,
    acquisitionDetailedStateCodes: [...new Set((acquisition.records || []).map((row) => row.stateCode))],
    acquisitionNoticeRows: notices.records.length,
    acquisitionOfficialAwardPdfRows: notices.records.filter((row) => row.stateCode === 'DL' && row.sourceDocumentUrl).length,
    acquisitionHumanReviewedAwardExtractions: (read('land_acquisition_awards_extracted.json').records || []).length,
    acquisitionDiscoveredCandidates: (read('land_acquisition_discovered.json').candidates || []).length,
    parcelEvidenceRows: parcelEvidence.records.length,
    authorityVerifiedParcelEvidenceRows: parcelEvidence.records.filter((row) => row.verificationStatus === 'AUTHORITY_VERIFIED_SOURCE_RECORD').length,
    ownerParcelRelationshipsCaptured: parcelEvidence.records.filter((row) => (row.ownerNames || []).length > 0 || (row.holders || []).some((holder) => ['OWNER','CO_OWNER'].includes(holder.rightType))).length,
    rbihNextGenSupportedStates: federated.nextGenLrsSupportedCount,
    rbihLrsV3GuideStates: federated.uliLrsV3GuideStateCount,
    currentMis4Snapshot: { asOf: mis4.dashboardAsOf, villagesWithULPIN: mis4.parcelGeospatialProgress?.villagesWithUlpIn ?? null, villagesGeoReferenced: mis4.parcelGeospatialProgress?.villagesGeoreferenced ?? null, mapsDigitised: mis4.recordDigitisation?.cadastralMapsDigitised ?? null },
    sourceCount: registry.sources.length + (read('source_verification.json').sources || []).length,
    sources: registry.sources,
    limitations: {
      ownerIdentity: 'DILRMP supplies State/UT aggregate land-owner counts. Official State/UT portals support jurisdiction-specific lookup, but no nationwide person-level title list or verified open bulk-owner API has been established.',
      parcelTitle: 'A State RoR portal link is not a verified bulk title API. Individual records require lawful source capture, provenance and competent-authority verification.',
      acquisition: 'LACRRIS national dashboard KPIs are available. Two detailed Delhi award records have been extracted from official GNCTD PDFs and 19 Delhi award PDFs are indexed. State/UT/project/district rows outside those selected documents still require source-backed imports; null or absent rows are not zero acquisition.',
      acquiredParcel: 'The published LACRRIS schema does not supply a universal cadastral parcel join key. Acquired/not-acquired parcel status remains unknown until a parcel-specific order/award/possession/release record is matched.',
      liveOwnerLookup: 'RBIH ULI Next-Gen provides an authorised single-parcel query for 12 documented State backends; India Property Register is an independent paid provider whose documentation reports plot layers for 28/36 jurisdictions. Neither connector is configured unless the operator supplies approved credentials, and neither gives a complete nationwide title register.'
    }
  };
}
function getStateLandCoverage(query = '') {
  const coverage = read('state_land_data_coverage.json');
  const needle = norm(query);
  const records = coverage.records.filter((r) => !needle || [r.state, r.stateCode, String(r.lgdCode), r.rorPortalName].some((v) => norm(v).includes(needle)));
  return { dataset: coverage.dataset, generatedOn: coverage.generatedOn, count: records.length, records };
}
function getAcquisitionData(stateCode) {
  const acquisition = read('land_acquisition_national.json');
  const notices = read('land_acquisition_notices.json');
  if (!stateCode) return { dataset: acquisition.dataset, nationalTotals: acquisition.metrics, coverage: acquisition.coverageByState, records: acquisition.records, notices: notices.records, reportUrl: acquisition.stateReport.url, scope: acquisition.scope };
  const state = acquisition.coverageByState.find((r) => norm(r.stateCode) === norm(stateCode) || norm(r.state) === norm(stateCode));
  if (!state) return null;
  return {
    dataset: acquisition.dataset,
    nationalTotals: acquisition.metrics,
    state: state.state,
    stateCode: state.stateCode,
    reportUrl: state.reportUrl,
    detailStatus: state.status,
    records: acquisition.records.filter((r) => norm(r.stateCode) === norm(state.stateCode)),
    notices: notices.records.filter((r) => norm(r.stateCode) === norm(state.stateCode)),
    interpretation: 'State-specific details are shown only when source-backed rows have been imported. A null value means not ingested, not zero acquisition.'
  };
}
function getParcelEvidence(filters = {}, includeOwnerNames = false) {
  const data = read('parcel_ownership_evidence.json');
  const state = norm(filters.state || filters.stateCode);
  const parcel = norm(filters.parcelIdentifier || filters.plot || filters.khasra);
  const district = norm(filters.district);
  const matching = data.records.filter((r) =>
    (!state || norm(r.stateCode) === state || norm(r.stateName) === state) &&
    (!parcel || norm(r.parcelIdentifier).includes(parcel)) &&
    (!district || norm(r.district).includes(district))
  );
  const total = matching.length;
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 100, 1), 100);
  const offset = Math.max(Number.parseInt(filters.offset, 10) || 0, 0);
  const records = matching.slice(offset, offset + limit).map((r) => {
    if (includeOwnerNames) return r;
    const { ownerNames, holders, ...safe } = r;
    return { ...safe, holderCount: holders?.length || ownerNames?.length || 0, ownerIdentity: (ownerNames?.length || holders?.length) ? 'RESTRICTED_TO_AUTHORITY_ROLE' : 'NOT_PRESENT' };
  });
  return { dataset: data.dataset, count: records.length, total, limit, offset, nextOffset: offset + records.length < total ? offset + records.length : null, records, note: 'Evidence records are not legal title until the competent authority verifies them.' };
}
function getSourceRegistry() {
  const base = read('government_data_source_registry.json');
  const verified = read('source_verification.json');
  return { ...base, supplementarySources: verified.sources || [], verifiedAt: verified.verifiedAt };
}
module.exports = { getGovernmentDataSummary, getStateLandCoverage, getAcquisitionData, getParcelEvidence, getSourceRegistry };
