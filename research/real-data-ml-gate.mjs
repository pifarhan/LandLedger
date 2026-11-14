import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const manifest={
  generatedAt:new Date().toISOString(),
  trainingPolicy:'Train only on records for which the competent authority has explicitly supplied a fraud/validity label and permitted research use.',
  currentDILRMPStatus:'DILRMP public snapshot is administrative aggregate/progress data; it is not a labelled individual fraud dataset.',
  realGovernmentMLReady:false,
  reason:'No authorised labelled individual property/transaction fraud dataset is present. The system therefore refuses to fabricate a real-government fraud accuracy score.',
  acceptedInputs:['authorised_anonymised_records.csv','label column: FRAUD/VALID','data-use authorisation metadata'],
  outputWhenAvailable:['train/test split by property or case identifier','precision','recall','F1','ROC-AUC','confusion matrix','model card','dataset provenance hash']
};
fs.writeFileSync(path.join(root,'research/real-government-ml-gate.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
