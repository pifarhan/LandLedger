const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data');
function readJson(fileName) {
  const file = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(file)) throw new Error(`Required public dataset is missing: ${fileName}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadRealData(file = path.join(DATA_DIR, 'dilrmp_real_snapshot.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function loadStateLevelData(file = path.join(DATA_DIR, 'dilrmp_state_level_current.json')) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const registry = readJson('official-state-ut-registry.json');
  const ngdrs = readJson('ngdrs_registration_activity.json');
  const ngdrsDataEntry = readJson('ngdrs_data_entry_form_snapshot.json');
  return {
    ...data,
    ngdrsCoverage: ngdrs.coverage,
    ngdrsDataEntry,
    ngdrsNationalTotals: ngdrs.nationalTotals,
    registryVersion: registry.datasetVersion,
    dataSources: {
      dilrmp: data.source,
      ngdrs: ngdrs.source,
      stateRegistry: registry.sources?.find((source) => source.id === 'dolr_state_master')?.url || null
    }
  };
}

function summary(dataset) {
  const records = dataset.records || [];
  const states = [...new Set(records.map((r) => r.state))];
  const totalRor = records.reduce((sum, r) => sum + Number(r.totalRor || 0), 0);
  const totalHolders = records.reduce((sum, r) => sum + Number(r.landOwnersHolders || 0), 0);
  const signed = records.reduce((sum, r) => sum + Number(r.digitallySignedRor || 0), 0);
  let national = null;
  try { national = readJson('dilrmp_national_snapshot.json'); } catch {}
  return {
    dataset: dataset.dataset,
    authority: dataset.authority,
    source: dataset.source,
    retrievedAt: dataset.retrievedAt,
    recordCount: records.length,
    states,
    totalRor,
    totalHolders,
    digitallySignedRor: signed,
    national,
    disclaimer: dataset.scope || 'Historical source-derived village-level subset; not parcel ownership/title data.'
  };
}

function search(dataset, filters = {}) {
  const norm = (v) => String(v || '').trim().toLowerCase();
  const state = norm(filters.state);
  const district = norm(filters.district);
  const village = norm(filters.village);
  return (dataset.records || []).filter((r) =>
    (!state || norm(r.state).includes(state)) &&
    (!district || norm(r.district).includes(district)) &&
    (!village || norm(r.village).includes(village))
  );
}

function fieldMapping() {
  return {
    state: 'administrative State/UT name',
    district: 'district/revenue area',
    tehsil: 'tehsil/taluk/sub-district',
    village: 'village name in the historical source subset',
    totalRor: 'count of reported Records of Rights (RoR); aggregate',
    landOwnersHolders: 'reported aggregate land-holder count where supplied by source',
    rorDataEntry: 'RoR data-entry status',
    mutationWorkflow: 'mutation workflow status',
    digitallySignedRor: 'reported digitally signed RoR count',
    statusEntryDate: 'source status/entry date'
  };
}

module.exports = { loadRealData, loadStateLevelData, summary, search, fieldMapping };
