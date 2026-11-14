import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

const registry = read('server/data/official-state-ut-registry.json');
const clr = read('server/data/dilrmp_state_level_current.json');
const historical = read('server/data/dilrmp_real_snapshot.json');
const abdb = read('server/data/abdb/abdb-hierarchy.json');

const codes = new Set(registry.states.map((record) => record.code));
const requiredMetrics = [
  'totalDistricts','totalTehsils','totalVillages','totalRor','rorComputerized',
  'rorComputerizedPercent','villagesClrCompleted','villagesClrCompletedPercent'
];
const schemaPass = clr.records.length === 36 &&
  new Set(clr.records.map((record) => record.stateCode)).size === 36 &&
  clr.records.every((record) => codes.has(record.stateCode) &&
    requiredMetrics.every((field) => record[field] !== undefined && record[field] !== null));
if (!schemaPass) throw new Error('DILRMP 36-State/UT aggregate data failed schema/coverage validation.');

const metricSums = {
  districts: clr.records.reduce((sum, row) => sum + Number(row.totalDistricts || 0), 0),
  tehsils: clr.records.reduce((sum, row) => sum + Number(row.totalTehsils || 0), 0),
  villages: clr.records.reduce((sum, row) => sum + Number(row.totalVillages || 0), 0),
  rorTotal: clr.records.reduce((sum, row) => sum + Number(row.totalRor || 0), 0),
  rorComputerized: clr.records.reduce((sum, row) => sum + Number(row.rorComputerized || 0), 0),
  villagesClrCompleted: clr.records.reduce((sum, row) => sum + Number(row.villagesClrCompleted || 0), 0),
  totalLandOwners: clr.records.reduce((sum, row) => sum + Number(row.totalLandOwners || 0), 0)
};
for (const [key, value] of Object.entries(metricSums)) {
  if (value !== Number(clr.nationalTotals[key])) {
    throw new Error(`DILRMP aggregate reconciliation failed for ${key}: rows=${value}; national=${clr.nationalTotals[key]}`);
  }
}

const { evaluateWorkflowCases } = require('../server/src/services/workflowPolicy.js');
const cases = evaluateWorkflowCases();
const positive = cases.filter((item) => item.expected === 'REJECT');
const tp = cases.filter((item) => item.expected === 'REJECT' && item.actual === 'REJECT').length;
const tn = cases.filter((item) => item.expected === 'ALLOW' && item.actual === 'ALLOW').length;
const fp = cases.filter((item) => item.expected === 'ALLOW' && item.actual === 'REJECT').length;
const fn = cases.filter((item) => item.expected === 'REJECT' && item.actual === 'ALLOW').length;
const precision = tp / (tp + fp || 1);
const recall = tp / (tp + fn || 1);
const f1 = 2 * precision * recall / (precision + recall || 1);
const accuracy = (tp + tn) / (cases.length || 1);
const fraud = require('../server/src/services/fraudRiskService.js').evaluate();

const result = {
  generatedAt: new Date().toISOString(),
  officialDataset: {
    records: clr.records.length,
    states: clr.records.map((record) => record.state),
    schemaPass,
    source: clr.source,
    retrievedAt: clr.retrievedAt,
    nationalTotals: clr.nationalTotals,
    reconciliation: metricSums
  },
  historicalVillageDataset: {
    records: (historical.records || []).length,
    states: [...new Set((historical.records || []).map((record) => record.state))],
    note: 'Historical source-derived village-level subset for Karnataka and West Bengal only; source status dates July/August 2024.'
  },
  administrativeBoundaryDataset: {
    officialStateUtCount: abdb.coverage.officialStateUtCount,
    assignedDistrictFeatures: abdb.coverage.assignedDistrictBoundaryFeatures,
    indexedSubDistrictFeatures: abdb.coverage.indexedSubDistrictFeatures,
    excludedDisputedDistrictFeatures: abdb.coverage.disputedOrUnassignedDistrictFeatures,
    incompleteSubDistrictFeatures: abdb.coverage.subDistrictFeaturesMissingRequiredAttributes,
    statesWithoutSubDistrictRows: abdb.coverage.statesWithoutIndexedSubDistricts
  },
  controlledWorkflowEvaluation: {
    cases: cases.length, truePositives: tp, trueNegatives: tn,
    falsePositives: fp, falseNegatives: fn, accuracy, precision, recall, f1,
    casesDetail: cases,
    note: 'These are deterministic policy/unit-test scenarios executed against the same workflowPolicy functions used by the API. They are not real-world transaction, fraud or land-title validation results.'
  },
  fraudRiskEvaluation: fraud,
  note: 'Official DILRMP metrics are genuine State/UT aggregates. The 14 village-level rows are historical. Workflow and fraud-risk scenarios are controlled tests, not government transaction records.'
};
console.log(JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(root, 'research/evaluation-result.json'), JSON.stringify(result, null, 2));
