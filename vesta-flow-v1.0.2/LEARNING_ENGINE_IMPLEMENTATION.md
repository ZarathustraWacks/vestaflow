# Learning Engine Implementation Boundary

Vesta 1.1 adds a deployable supervised-learning foundation while preserving the existing Vesta architecture. Render is a shadow observer until a human explicitly promotes a validated model and enables a consumer flag.

## Implemented

- Historical Follow Up Boss extraction with retry and cursor pagination
- Vesta-editable label mapping
- Conservative prediction-time snapshots designed to avoid future-data leakage
- Data-quality reporting
- Grouped train/validation splits by lead identity
- Calibrated gradient-boosting champion
- Multi-task temporal transformer challenger
- Per-output temperature calibration
- Champion model registry and promotion command
- FastAPI scoring, metrics, health, and feedback endpoints
- Postgres production persistence with SQLite retained for local development
- Immutable source observations plus current-entity projections
- Versioned normalized snapshots, datasets, SOP policies, models, predictions,
  broker decisions, verified outcomes, and missed-opportunity cases
- S3-compatible model and dataset artifact storage
- Source-traced SOP policy candidates with explicit human approval
- Choice-set logging and conservative action-effect/off-policy evaluation tools
- Normalized Vercel shadow snapshots and rule/model-origin opportunity scans
- Render Blueprint jobs for extraction, snapshots, training, and scheduling
- Next.js learning adapter and Learning Lab
- Transparent fallback behavior when the model service is absent

## Requires private data before use

No trained Vesta model is bundled. The historical account data must first be extracted and the label mapping and SOP policy approved. Model probabilities remain advisory until connector parity, grouped holdout metrics, calibration, cohort fairness, and brokerage lift are reviewed. Broker identity is excluded from predictive features, and the action-learning utilities use only verified downstream outcomes.
