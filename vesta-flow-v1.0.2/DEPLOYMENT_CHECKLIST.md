# Vesta 1.1 deployment checklist

This release is intentionally staged. Do not enable advisory scoring or
production email during the first deploy.

## 1. Vercel — preserve the working system

Keep the current Follow Up Boss, Flow, Upstash, and legacy-learning variables.
Add these new values:

```env
# Separate Render connection; do not replace the legacy learning URL.
VESTA_RENDER_LEARNING_API_URL=https://YOUR-RENDER-LEARN-HOST
VESTA_RENDER_LEARNING_API_KEY=LONG_RANDOM_RENDER_API_KEY

# All remain off through shadow validation.
VESTA_RENDER_LEARN_ENABLED=false
VESTA_RENDER_MANAGER_ADVISORY_ENABLED=false
VESTA_RENDER_FLOW_ADVISORY_ENABLED=false
VESTA_RENDER_FLOW_TELEMETRY_ENABLED=false
VESTA_RENDER_TIMEOUT_MS=1500

# Protected normalized-snapshot export to Render.
VESTA_SHADOW_EXPORT_SECRET=LONG_RANDOM_EXPORT_SECRET

# Critical-action engine starts without delivery.
VESTA_CRITICAL_ACTION_SECRET=LONG_RANDOM_AUTOMATION_SECRET
VESTA_OPERATING_TIMEZONE=America/Chicago
VESTA_BUSINESS_CLOSURES=2026-09-07,2026-11-26,2026-12-25
VESTA_BUSINESS_HOLIDAYS=2026-09-07,2026-11-26,2026-12-25
VESTA_EMAIL_MODE=shadow
VESTA_EMAIL_ALLOW_MANUAL=false
VESTA_EMAIL_STORAGE_KEY=vesta:critical-email:v1
FUB_WEB_BASE_URL=https://app.followupboss.com/2/people/view
```

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` must be configured
before either `test` or `production` email mode. The automation will refuse to
send without durable duplicate-prevention storage.

## 2. Separate Render repository

Deploy the **Vesta Render 13.0.0** GitHub package and create its Blueprint from
that repository's `render.yaml`. This Flow repository intentionally has no
Blueprint or embedded learner. The Render repository provisions:

- `vesta-learn-api` — shadow FastAPI service;
- `vesta-learn-postgres` — persistent registry and evidence store;
- `vesta-shadow-fub-sync` — hourly raw, checksum-idempotent FUB mirror;
- `vesta-shadow-opportunity-cycle` — normalized snapshot import, conservative
  verified-outcome linkage, and missed-opportunity scan;
- `vesta-shadow-training` — weekly baseline candidate training; and
- `vesta-critical-action-dispatcher` — DST-safe calls to Vercel's independent
  email engine.

Enter each `sync: false` secret on the service that requests it. Important
values are:

```env
# Render API service
VESTA_LEARNING_API_KEY=LONG_RANDOM_RENDER_API_KEY
FUB_API_KEY=...
FUB_SYSTEM_NAME=...
FUB_SYSTEM_KEY=...
OBJECT_STORAGE_BUCKET=...
OBJECT_STORAGE_ENDPOINT=...
OBJECT_STORAGE_ACCESS_KEY=...
OBJECT_STORAGE_SECRET_KEY=...

# Normalized snapshot cron
VESTA_SHADOW_EXPORT_URL=https://YOUR-VERCEL-HOST/api/learning/shadow-export
VESTA_SHADOW_EXPORT_SECRET=LONG_RANDOM_EXPORT_SECRET

# Critical dispatcher cron
VESTA_CRITICAL_ACTION_URL=https://YOUR-VERCEL-HOST/api/automation/critical-actions
VESTA_CRITICAL_ACTION_SECRET=LONG_RANDOM_AUTOMATION_SECRET
```

The API's `/health` endpoint is public but contains only version/readiness
metadata. Lead, model, policy, decision, outcome, and opportunity endpoints
require the Render API key.

## 3. Shadow acceptance gates

Before enabling any Render consumer:

- Every required FUB collection run is complete, with page totals reviewed.
- Normalized Vercel snapshots arrive hourly with collection lineage.
- The SOP policy candidate is reviewed, diffed, and explicitly approved.
- Dataset quality has positive and negative examples for every outcome.
- Train/validation splitting remains grouped by lead, with no future leakage.
- Calibration, precision/recall, cohort behavior, and false-positive cases are
  reviewed against the existing Raven decisions.
- Broker identity remains excluded from prediction features.
- A candidate model is explicitly promoted; training alone never promotes it.
- Failure and timeout tests prove Manager, Learn, Flow, and email fall back to
  their existing behavior.

Enable `VESTA_RENDER_FLOW_TELEMETRY_ENABLED=true` first. It is non-authoritative
and failure-isolated. Advisory flags come later, one consumer at a time.

## 4. Gmail test and production

In Google Cloud, enable the Gmail API and create OAuth credentials for the
prepared sending mailbox. Obtain a refresh token authorized only for
`https://www.googleapis.com/auth/gmail.send` and set these values in Vercel:

```env
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_SENDER_ADDRESS=prepared-mailbox@example.com
VESTA_EMAIL_TEST_RECIPIENTS=internal-test-recipient@example.com
VESTA_EMAIL_RECIPIENTS=management-recipient@example.com
```

Then:

1. Leave `VESTA_EMAIL_MODE=shadow` for at least one full business day and
   inspect the protected endpoint's run results.
2. Set `VESTA_EMAIL_MODE=test`; verify both digest windows, links, owners,
   suppressions, and that repeat scheduler calls do not resend.
3. Confirm the business-closure calendar and recipient list.
4. Set `VESTA_EMAIL_MODE=production`.

Do not enable `VESTA_EMAIL_ALLOW_MANUAL` in production. It exists only for a
controlled test call and still uses the durable daily run key.

## 5. Rollback

- Render advice: set every `VESTA_RENDER_*_ENABLED` flag to `false`. Existing
  Raven/FUB behavior continues.
- Email: set `VESTA_EMAIL_MODE=shadow`. Candidate generation continues without
  sending.
- Render service: remove `VESTA_RENDER_LEARNING_API_URL`; Manager, Learn, and
  Flow continue on the pre-existing spine.
- Never delete Postgres or object storage during rollback; retain evidence,
  decisions, outcomes, policies, datasets, and model lineage for audit.
