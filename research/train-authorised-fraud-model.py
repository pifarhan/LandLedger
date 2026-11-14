#!/usr/bin/env python3
"""Train fraud-screening models only on authorised, de-identified, case-grouped labels.

Expected files (never bundled): research/private-data/records.csv and manifest.json.
The --self-test option uses generated synthetic data to test the pipeline only; it
never creates a model artifact or changes the real-government readiness gate.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, math, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / "research" / "private-data"
DATASET = PRIVATE / "records.csv"
MANIFEST = PRIVATE / "manifest.json"
OUT = ROOT / "research" / "trained-model"
GATE = ROOT / "research" / "real-government-ml-gate.json"
FEATURES = [
    "duplicate_parcel", "duplicate_hash", "claimant_name_mismatch",
    "document_hash_mismatch", "source_record_mismatch", "rapid_resale",
    "missing_mutation_link", "conflicting_encumbrance", "area_title_mismatch",
    "boundary_mismatch",
]
REQUIRED_MANIFEST = ["source_authority", "source_url", "authorization_reference", "approved_purpose",
                     "deidentified", "pii_removed", "label_basis", "labeler_count", "adjudicator_reviewed",
                     "dataset_sha256", "data_owner_contact", "collection_period"]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def official_url(value: str) -> bool:
    p = urlparse(value or "")
    host = (p.hostname or "").lower()
    return p.scheme == "https" and (host == "gov.in" or host.endswith(".gov.in") or host == "nic.in" or host.endswith(".nic.in"))


def validate_dataset(csv_path: Path, manifest_path: Path):
    if not csv_path.exists() or not manifest_path.exists():
        raise ValueError("No authorised dataset is supplied. Place records.csv and manifest.json in research/private-data/.")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    missing = [k for k in REQUIRED_MANIFEST if k not in manifest or manifest[k] in (None, "")]
    if missing:
        raise ValueError("Dataset manifest missing: " + ", ".join(missing))
    if not official_url(manifest["source_url"]):
        raise ValueError("Source URL must be an HTTPS government/NIC endpoint.")
    if manifest["approved_purpose"] != "FRAUD_DETECTION_RESEARCH":
        raise ValueError("The data-use authorisation must explicitly permit FRAUD_DETECTION_RESEARCH.")
    if manifest["deidentified"] is not True or manifest["pii_removed"] is not True:
        raise ValueError("Only de-identified, PII-removed records may be used for model training.")
    if manifest["adjudicator_reviewed"] is not True or int(manifest["labeler_count"]) < 2:
        raise ValueError("Labels require two independent labelers and an adjudicator review.")
    if manifest["label_basis"] not in {"FINAL_COURT_FINDING", "AUTHORITY_CONFIRMED_FRAUD"}:
        raise ValueError("Use only final judicial findings or formally authority-confirmed labels; allegations are not labels.")
    if manifest["dataset_sha256"].lower() != sha256(csv_path):
        raise ValueError("Dataset SHA-256 does not match the authorised manifest.")

    rows = []
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        expected = {"case_group_hash", "adjudicated_fraud", "state_code", *FEATURES}
        if not reader.fieldnames or not expected.issubset(set(reader.fieldnames)):
            raise ValueError("CSV must contain case_group_hash, adjudicated_fraud, state_code and all documented binary features.")
        forbidden = {"owner_name", "holder_name", "aadhaar", "pan", "phone", "email", "address", "plot_number", "khasra_number"}
        if forbidden.intersection(x.lower() for x in reader.fieldnames):
            raise ValueError("Raw personal identifiers or parcel identifiers must not be training columns.")
        for i, row in enumerate(reader, start=2):
            group = (row.get("case_group_hash") or "").strip()
            if not re.fullmatch(r"[a-fA-F0-9]{64}", group):
                raise ValueError(f"Row {i}: case_group_hash must be a SHA-256 digest.")
            label = row.get("adjudicated_fraud", "").strip()
            if label not in {"0", "1"}:
                raise ValueError(f"Row {i}: adjudicated_fraud must be 0 or 1.")
            clean = {"case_group_hash": group.lower(), "adjudicated_fraud": int(label), "state_code": (row.get("state_code") or "").strip().upper()}
            for feature in FEATURES:
                v = row.get(feature, "").strip()
                if v not in {"0", "1"}:
                    raise ValueError(f"Row {i}: {feature} must be binary 0 or 1.")
                clean[feature] = int(v)
            rows.append(clean)
    if len(rows) < 200:
        raise ValueError("At least 200 authorised records are required before evaluation.")
    class_counts = {0: sum(r["adjudicated_fraud"] == 0 for r in rows), 1: sum(r["adjudicated_fraud"] == 1 for r in rows)}
    if min(class_counts.values()) < 50:
        raise ValueError("At least 50 independently labelled records in each class are required.")
    if len({r["case_group_hash"] for r in rows}) < 100:
        raise ValueError("At least 100 distinct property/case groups are required to limit leakage.")
    return rows, manifest, class_counts


def score_metrics(y, probs):
    from sklearn.metrics import (accuracy_score, average_precision_score, brier_score_loss,
        confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score)
    import numpy as np
    preds = (np.asarray(probs) >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, preds, labels=[0, 1]).ravel()
    return {
        "accuracy": round(float(accuracy_score(y, preds)), 4),
        "precision": round(float(precision_score(y, preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y, preds, zero_division=0)), 4),
        "f1": round(float(f1_score(y, preds, zero_division=0)), 4),
        "rocAuc": round(float(roc_auc_score(y, probs)), 4),
        "prAuc": round(float(average_precision_score(y, probs)), 4),
        "brierScore": round(float(brier_score_loss(y, probs)), 4),
        "confusionMatrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "specificity": round(float(tn / (tn + fp)) if tn + fp else 0.0, 4),
    }


def train_evaluate(rows, seed=20261114):
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import GroupShuffleSplit
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    X = np.asarray([[r[k] for k in FEATURES] for r in rows], dtype=float)
    y = np.asarray([r["adjudicated_fraud"] for r in rows], dtype=int)
    groups = np.asarray([r["case_group_hash"] for r in rows])
    split = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=seed)
    train_idx, test_idx = next(split.split(X, y, groups))
    if len(set(y[train_idx])) < 2 or len(set(y[test_idx])) < 2:
        raise ValueError("Grouped holdout has only one class; obtain more independent case groups before training.")
    models = {
        "logistic_regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced", random_state=seed)),
        "random_forest": RandomForestClassifier(n_estimators=400, max_depth=8, min_samples_leaf=3, class_weight="balanced_subsample", random_state=seed, n_jobs=-1),
        "hist_gradient_boosting": HistGradientBoostingClassifier(max_iter=200, learning_rate=0.06, max_leaf_nodes=15, l2_regularization=1.0, random_state=seed),
    }
    results, fitted = {}, {}
    for name, model in models.items():
        model.fit(X[train_idx], y[train_idx])
        probs = model.predict_proba(X[test_idx])[:, 1]
        results[name] = score_metrics(y[test_idx], probs)
        fitted[name] = model
    selected = max(results, key=lambda name: (results[name]["prAuc"], results[name]["f1"]))
    return {
        "models": results, "selectedModel": selected, "trainRows": int(len(train_idx)), "testRows": int(len(test_idx)),
        "trainGroups": int(len(set(groups[train_idx]))), "testGroups": int(len(set(groups[test_idx]))),
        "featureNames": FEATURES, "seed": seed,
    }, fitted[selected]


def run_self_test():
    import numpy as np
    rng = np.random.default_rng(7)
    rows = []
    for i in range(600):
        features = rng.integers(0, 2, len(FEATURES)).tolist()
        risk = sum(features[:5]) + sum(features[5:]) * 0.45
        label = int(risk >= 4.0)
        rows.append({"case_group_hash": hashlib.sha256(f"synthetic-case-{i}".encode()).hexdigest(),
                     "adjudicated_fraud": label, "state_code": "TEST", **dict(zip(FEATURES, features))})
    report, _ = train_evaluate(rows)
    print(json.dumps({"status": "PIPELINE_SELF_TEST_PASSED", "dataClass": "SYNTHETIC_TEST_ONLY", "metricsAreResearchEvidence": False, "report": report}, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        run_self_test()
        return 0
    try:
        rows, manifest, class_counts = validate_dataset(DATASET, MANIFEST)
        report, model = train_evaluate(rows)
        OUT.mkdir(parents=True, exist_ok=True)
        import joblib
        model_path = OUT / "selected-model.joblib"
        joblib.dump(model, model_path)
        card = {
            "generatedAt": datetime.now(timezone.utc).isoformat(), "status": "TRAINED_ON_AUTHORISED_DEIDENTIFIED_DATA",
            "sourceAuthority": manifest["source_authority"], "sourceUrl": manifest["source_url"],
            "authorizationReference": manifest["authorization_reference"], "datasetSha256": manifest["dataset_sha256"],
            "labelBasis": manifest["label_basis"], "classCounts": class_counts,
            "evaluation": report, "featureNames": FEATURES,
            "limitations": ["Holdout is grouped by case/property hash; performance is specific to the authorised source and collection period.",
                            "Not proof of title or fraud; human/authority review remains mandatory.",
                            "Threshold calibration and external temporal/state holdout should be performed before deployment."],
            "modelFile": str(model_path.relative_to(ROOT)),
        }
        (OUT / "model-card.json").write_text(json.dumps(card, indent=2) + "\n", encoding="utf-8")
        gate = {"generatedAt": card["generatedAt"], "realGovernmentMLReady": True,
                "datasetSha256": manifest["dataset_sha256"], "status": "AUTHORISED_DATA_TRAINING_COMPLETE",
                "evaluation": report, "modelCard": str((OUT / "model-card.json").relative_to(ROOT))}
        GATE.write_text(json.dumps(gate, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(gate, indent=2))
        return 0
    except Exception as exc:
        gate = {"generatedAt": datetime.now(timezone.utc).isoformat(), "realGovernmentMLReady": False,
                "status": "BLOCKED_NO_QUALIFYING_AUTHORISED_DATASET", "reason": str(exc),
                "requiredInputFiles": ["research/private-data/records.csv", "research/private-data/manifest.json"],
                "trainingPolicy": "Only final court findings or competent-authority confirmed fraud labels with written research authorisation, de-identification, independent labelers and adjudicator review are accepted. Allegations and synthetic cases are not labels."}
        GATE.write_text(json.dumps(gate, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(gate, indent=2))
        return 2

if __name__ == "__main__":
    sys.exit(main())
