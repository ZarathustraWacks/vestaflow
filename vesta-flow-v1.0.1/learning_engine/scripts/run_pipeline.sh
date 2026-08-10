#!/usr/bin/env bash
set -euo pipefail
python -m vesta_learning.extract_history --out data/raw --reset
python -m vesta_learning.dataset --raw data/raw --config config/label_mapping.yml --out data/processed/training.jsonl --report data/processed/quality.json
python -m vesta_learning.baseline --data data/processed/training.jsonl --out models/registry/baseline-v1
python -m vesta_learning.train --data data/processed/training.jsonl --out models/registry/transformer-v1 --epochs "${EPOCHS:-12}"
echo 'Training complete. Review data quality and held-out evaluation before an explicit model promotion.'
