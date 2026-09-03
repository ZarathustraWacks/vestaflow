# Vesta Flow v1.2.0

Vesta Flow is the broker-facing action application built on the Vesta 11.0.8
Follow Up Boss connector, normalization, policy, governance, and learning spine.

V1.0.1 isolates action-storage failures from the intelligence spine. Broker
choices and live lead intelligence continue to load if Redis is unavailable,
while action controls become explicitly read-only so nothing appears recorded
when it is not. Broker choices are also recovered from lead owner records when
the Follow Up Boss users collection is incomplete.

V1.0.2 presents the three highest-priority actions so the broker can choose
which one to work next. Marking an item Done writes an idempotent outcome note
to the contact's Follow Up Boss timeline before the item is completed locally.

V1.2.0 consumes the same versioned governance source snapshot as Vesta Manager,
adds appointment-aware task selection, separate operating clocks, structured
broker-action telemetry, and direct FUB customer links. The duplicated Render
Blueprint has been removed: only the separate Vesta Render repository should
deploy the persistent learning backend.

## Broker experience

- Select a broker for the no-login demonstration.
- Work one intelligence-ranked lead at a time.
- Record structured outcomes.
- Skip temporarily with a reason and return time.
- Pass a lead with a required reason and optional notes.
- Drill into timeline, evidence, appointments, listing process, governance, and
  prior Vesta Flow actions without losing the current place.
- Completed actions stay out of the queue until the decision snapshot changes.

## Management escalation

A pass immediately removes the lead from that broker's queue and creates an
unresolved management exception. Management can:

- reroute it to an active broker;
- return it to the original broker;
- move it to nurture with a return date; or
- kill it with a required final disposition.

V1 records these decisions in the Vesta Flow ledger. It deliberately does not
write assignments, stages, notes, or dispositions back to Follow Up Boss until
OAuth and account-specific field mappings are approved.

## Required Vercel variables

Use the same Follow Up Boss and learning-service variables as Vesta 11.0.8.

```env
FUB_API_KEY=
FUB_DEMO_MODE=false
FUB_SYSTEM_NAME=
FUB_SYSTEM_KEY=
VESTA_LEARNING_API_URL=
VESTA_LEARNING_API_KEY=
```

## Durable action recording

For a shared Vercel deployment, configure an Upstash-compatible Redis REST
database:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
VESTA_FLOW_STORAGE_KEY=vesta:flow:v1:events
VESTA_FUB_WRITEBACK_ENABLED=true
```

Without Redis, the app enters clearly labeled demonstration-storage mode. Its
in-memory events can disappear whenever the serverless function restarts and
must not be used operationally.

Both Upstash variables must come from the same database. A partial, invalid, or
unreachable Redis configuration now produces an explicit read-only warning; it
can no longer suppress the broker selector or produce a false caught-up state.

## Management alerts

Passes, skips of immediate items, and the third skip of the same decision
snapshot can call a management webhook:

```env
VESTA_MANAGEMENT_ALERT_WEBHOOK=
VESTA_MANAGEMENT_ALERT_TOKEN=
```

The webhook receives the immutable action event plus a compact lead and
intelligence summary. Alert delivery failure does not delete the management
exception from the durable queue.

## Authentication boundary

V1 intentionally has no login. The broker selector exists for demonstrations,
not authorization. Do not expose an operational deployment publicly. Follow Up
Boss OAuth and server-enforced user identity should replace the selector before
production use.

## Safe deployment order

1. Deploy this Vercel application with every `VESTA_RENDER_*` flag set to
   `false` and `VESTA_EMAIL_MODE=shadow`.
2. Add Upstash and verify Flow's action ledger is durable.
3. Deploy the separate canonical Vesta Render 13.0 repository. Flow contains no
   embedded Python learner and must never be used to create a second backend.
4. Set `VESTA_SHADOW_EXPORT_URL` on the Render snapshot job to
   `https://YOUR-VERCEL-HOST/api/learning/shadow-export`. Use the same long,
   random `VESTA_SHADOW_EXPORT_SECRET` in Vercel and Render.
   Keep `VESTA_RENDER_LEARNING_API_URL` and
   `VESTA_RENDER_LEARNING_API_KEY` separate from any legacy learning service.
5. Configure the critical dispatcher URL as
   `https://YOUR-VERCEL-HOST/api/automation/critical-actions` and use the same
   `VESTA_CRITICAL_ACTION_SECRET` on both hosts.
6. Leave Render advisory flags off while connector parity, labels, calibration,
   and shadow comparisons are reviewed. Promotion is manual only.
7. Test email delivery with `VESTA_EMAIL_MODE=test` and
   `VESTA_EMAIL_TEST_RECIPIENTS`. Only then set production recipients and switch
   to `VESTA_EMAIL_MODE=production`.

The email engine deliberately runs from the existing Vesta/FUB spine; a Render
model outage cannot stop or alter a digest. Render only supplies the scheduler.

## Critical-action email rules

- After 9:00 a.m. Central on business days, the system sends unresolved broker
  passes created during the prior business day's noon–5:00 p.m. Central window.
- After 2:30 p.m. Central, it sends critical leads created or raised from
  9:00 a.m.–1:00 p.m. Central whose four-hour contact deadline has elapsed.
- Immediately before inclusion, each contact is re-read from Follow Up Boss.
  New communication or changed ownership suppresses stale alerts.
- Durable date-and-policy run keys prevent duplicate sends and permit catch-up
  after a delayed scheduler. Dates in `VESTA_BUSINESS_CLOSURES` are skipped.
- `shadow` creates auditable run results without sending. `test` sends only to
  test recipients. `production` requires durable Upstash storage.

Gmail uses OAuth refresh-token credentials with send-only scope. The sender
address must be the prepared Gmail mailbox (or an alias that mailbox may send
as). No Gmail credentials are placed on Render; they stay in Vercel.
