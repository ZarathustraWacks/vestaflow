# Learning Engine Implementation Boundary

Prototype 11 adds a complete trainable supervised-learning foundation while preserving the existing Vesta architecture.

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
- SQLite feedback/outcome persistence
- Next.js learning adapter and Learning Lab
- Transparent fallback behavior when the model service is absent

## Requires private data before use

No trained Vesta model is bundled. The historical account data must first be extracted and the label mapping approved. Model probabilities should remain advisory until held-out metrics, calibration, and brokerage lift are reviewed.
