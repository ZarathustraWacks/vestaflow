# Vesta Learning Engine — Prototype 11

This service is additive to the Vesta web application. It extracts historical Follow Up Boss data, creates leakage-safe prediction snapshots, trains a calibrated gradient-boosting champion and transformer challenger, serves lead scores, and captures human feedback/outcomes.

## Local pipeline

```bash
cd learning_engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export FUB_API_KEY='...'
./scripts/run_pipeline.sh
uvicorn vesta_learning.service:app --reload
```

Review `config/label_mapping.yml` with Vesta before training. The included defaults are discovery assumptions.

## Separate deployment

Deploy this directory to Render, Railway, AWS, or another Docker/Python host. Vercel hosts the Next.js web app; the model service requires a persistent volume for `models/registry` and `data/state`.
