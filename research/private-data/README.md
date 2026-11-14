# Authorised fraud dataset (not bundled)

No national government fraud-labelled land dataset is included in this project. The trainer will only run when the competent authority supplies `records.csv` and `manifest.json` with explicit written approval for `FRAUD_DETECTION_RESEARCH`.

CSV columns: `case_group_hash,adjudicated_fraud,state_code` plus the ten binary screening features documented in `research/train-authorised-fraud-model.py`. `case_group_hash` must be SHA-256; do not provide owner names, phone, Aadhaar, PAN, addresses, raw parcel identifiers or documents. `adjudicated_fraud` must be based on a final court finding or competent-authority confirmed fraud, not an allegation, complaint, pending FIR, or model prediction.

Minimum quality gates: 200 records; at least 50 in each class; 100 distinct case/property groups; two independent labelers plus adjudicator; de-identification; source URL on HTTPS `gov.in`/`nic.in`; exact dataset SHA-256; written research permission. The evaluation uses a grouped 75/25 holdout to reduce case leakage and reports PR-AUC, ROC-AUC, F1, precision, recall, specificity and Brier score.

`manifest.example.json` is a template only, not authorisation and not a real dataset. Never put real records or credentials in a public ZIP or source repository.
