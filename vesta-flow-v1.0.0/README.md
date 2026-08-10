# Vesta Flow v1

Vesta Flow is the broker-facing action application built on the Vesta 11.0.8
Follow Up Boss connector, normalization, policy, governance, and learning spine.

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
```

Without Redis, the app enters clearly labeled demonstration-storage mode. Its
in-memory events can disappear whenever the serverless function restarts and
must not be used operationally.

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
