// Explainable risk-screening engine for the academic prototype.
// The development corpus below is fully synthetic and rule-labelled. It is NOT
// a government fraud dataset and the resulting score is not a legal fraud decision.
function sigmoid(z) { return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z)))); }
function dot(a, b) { return a.reduce((sum, value, index) => sum + value * b[index], 0); }
function train(samples, labels, epochs = 1200, lr = 0.08, l2 = 0.02) {
  const weights = Array(samples[0].length).fill(0);
  let bias = 0;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradient = Array(weights.length).fill(0);
    let biasGradient = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const probability = sigmoid(dot(weights, samples[index]) + bias);
      const error = probability - labels[index];
      samples[index].forEach((value, feature) => { gradient[feature] += error * value; });
      biasGradient += error;
    }
    for (let feature = 0; feature < weights.length; feature += 1) {
      weights[feature] -= lr * ((gradient[feature] / samples.length) + l2 * weights[feature]);
    }
    bias -= lr * biasGradient / samples.length;
  }
  return { weights, bias };
}

function features(input = {}) {
  return [
    input.duplicateParcel ? 1 : 0,
    input.claimantNameMismatch ? 1 : 0,
    input.duplicateHash ? 1 : 0,
    input.suspiciousDocument ? 1 : 0,
    input.missingFields ? 1 : 0,
    input.transferWithoutApproval ? 1 : 0,
    input.parcelMismatch ? 1 : 0,
    input.documentConsistencyLow ? 1 : 0,
    input.multipleActiveOwners ? 1 : 0,
    input.identityMismatch ? 1 : 0
  ];
}

const featureWeights = [1.5, 1.8, 1.4, 1.2, 0.7, 1.6, 1.9, 1.5, 1.7, 1.4];
const syntheticCorpus = Array.from({ length: 1 << featureWeights.length }, (_, mask) => {
  const vector = featureWeights.map((_, feature) => (mask >> feature) & 1);
  const weightedRisk = vector.reduce((sum, value, feature) => sum + value * featureWeights[feature], 0);
  return { vector, label: weightedRisk >= 7.0 ? 1 : 0, source: 'synthetic_rule_label' };
});

// Deterministic stratified split: every fourth row within each label class
// is held out. No holdout row is used to fit the logistic coefficients.
const trainingRows = [];
const holdoutRows = [];
const classCounters = { 0: 0, 1: 0 };
for (const row of syntheticCorpus) {
  classCounters[row.label] += 1;
  (classCounters[row.label] % 4 === 0 ? holdoutRows : trainingRows).push(row);
}
const model = train(trainingRows.map((row) => row.vector), trainingRows.map((row) => row.label));

const ruleWeights = [0.16,0.18,0.14,0.12,0.07,0.15,0.18,0.15,0.17,0.14];
function ruleProbability(vector) {
  const weighted = vector.reduce((sum, value, index) => sum + value * ruleWeights[index], 0);
  return Math.min(0.99, weighted / 1.46);
}
function probabilityFor(vector) {
  return 0.65 * sigmoid(dot(model.weights, vector) + model.bias) + 0.35 * ruleProbability(vector);
}
function score(input) {
  const vector = features(input);
  const probability = probabilityFor(vector);
  return {
    probability: Number(probability.toFixed(4)),
    risk: probability >= 0.70 ? 'HIGH' : probability >= 0.40 ? 'MEDIUM' : 'LOW',
    model: 'explainable-ensemble-logistic+rules-v3-synthetic',
    features: vector,
    explanations: [
      'duplicateParcel','claimantNameMismatch','duplicateHash','suspiciousDocument','missingFields',
      'transferWithoutApproval','parcelMismatch','documentConsistencyLow','multipleActiveOwners','identityMismatch'
    ].filter((_, index) => vector[index])
  };
}
function metrics(rows) {
  const predictions = rows.map((row) => probabilityFor(row.vector) >= 0.5 ? 1 : 0);
  const truth = rows.map((row) => row.label);
  const tp = rows.filter((row, index) => truth[index] === 1 && predictions[index] === 1).length;
  const tn = rows.filter((row, index) => truth[index] === 0 && predictions[index] === 0).length;
  const fp = rows.filter((row, index) => truth[index] === 0 && predictions[index] === 1).length;
  const fn = rows.filter((row, index) => truth[index] === 1 && predictions[index] === 0).length;
  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = 2 * precision * recall / (precision + recall || 1);
  const accuracy = (tp + tn) / (rows.length || 1);
  return { cases: rows.length, tp, tn, fp, fn, accuracy, precision, recall, f1 };
}
function evaluate() {
  return {
    model: 'explainable-ensemble-logistic+rules-v3-synthetic',
    features: [
      'duplicateParcel','claimantNameMismatch','duplicateHash','suspiciousDocument',
      'missingFields','transferWithoutApproval','parcelMismatch','documentConsistencyLow',
      'multipleActiveOwners','identityMismatch'
    ],
    trainCases: trainingRows.length,
    testCases: holdoutRows.length,
    holdout: metrics(holdoutRows),
    note: 'Deterministic, synthetic, rule-labelled holdout evaluation only. It demonstrates reproducibility and model behaviour, not real-world fraud accuracy, government-verified ownership or legal adjudication.'
  };
}
module.exports = { score, evaluate, features };
