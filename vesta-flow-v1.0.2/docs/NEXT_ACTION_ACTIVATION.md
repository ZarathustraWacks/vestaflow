# Shared next-action release candidate

This release makes the shared next-action model operational for recent incoming/inquiry episodes and their saved follow-ups. Other Flow queues retain their existing completion behavior. Production activation requires approval.

## Behavior

- An explicit recent FUB inquiry can reopen an older record. Historical rental labels require broker confirmation, preserving the original source and tags.
- Unanswered outreach keeps the connection objective open. Double taps count distinct FUB call records for the current owner, never Done notes. Automatic timing requires complete targeted call history.
- After the initial double tap, the second double tap starts 15 minutes after the second actual call. Undefined later spacing requires an explicit broker-selected next time. The 10 individual-call limit prompts manager review, without automatic rerouting.
- A reported connected conversation changes the objective to the appointment obstacle/next step. Agreed timing, contact restrictions, manager holds and passes remain in force.
- Original incoming and first-call clocks are unchanged. Office reporting hours do not silently defer an actively working broker to another day.
- Flow advances a confirmed result immediately. A durable fenced claim freezes the submission before sending; ambiguous results allow only read-only recovery, preventing a second send. Source ledger events remain immutable and scoped by owner/contact/obligation.
- Cadence reads minimal saved receipts from the existing shared Source service in complete background pages. It does not read from the Flow Blueprint, issue FUB calls for this feed, or automatically reassign leads. Prepared reroute rules and their compiler revision remain unchanged.

## Activation order

1. Deploy Source candidate on top of its verified live stacked baseline d2ea2f90; do not replace it with the older main branch. Enable VESTA_NEXT_ACTION_EVIDENCE_ENABLED=true and let the ordinary publication incorporate saved timeline facts. No rescan is required.
2. Deploy Flow accelerator candidate on its existing accelerator branch; enable the same evidence flag. Its targeted refresh reuses the existing seven reads.
3. Deploy the two applications with NEXT_PUBLIC_VESTA_NEXT_ACTION_OPERATIONAL=false first. Set Cadence's nonsecret VESTA_NEXT_ACTION_LEDGER_NAMESPACE to the exact existing verified Flow ledger namespace; use Cadence's existing VESTA_LEARNING_API_URL/KEY for the shared Source connection. Do not activate the retained legacy Flow aliases.
4. Verify the saved receipt feed and real-contact inquiry projections read-only. Enable NEXT_PUBLIC_VESTA_NEXT_ACTION_OPERATIONAL=true for approved production app builds. Preserve existing preview and service features and automatic-deploy settings.
5. Check an actual displayed inquiry and existing completion receipt read-only. Never manufacture a live Done action for validation.

No new service, credential, database schema, recurring cost, automated sending channel or automatic reroute is introduced. Grig and Brad's forthcoming SOP remains a separate policy version; undefined thresholds stay unset.

## Recovery

Before this work: Flow63eda1d, Cadencef4ceada, Source d2ea2f90, Flow accelerator e8930ba; exact hashes/archives are recorded in the workspace pre-operational snapshot manifest. These are committed-code recovery snapshots, not database backups.

Disable the operational app flags to stop the new queue interpretation, or redeploy the exact saved app baselines. Disable the evidence flags and republish from existing saved Source data if the evidence reduction itself needs rollback; reconcile the existing accelerator cache from that publication. Cadence's delivery worker is unchanged. Preserve previously confirmed FUB notes and immutable action receipts; a code rollback does not erase performed actions.

## Validation

Flow: 240 tests; Cadence: 333 tests; Source ledger/transport: 17; Source evidence/publication: 6 plus 42 existing regression checks; Flow accelerator: 33. Production builds and synthetic Safari queue/form/advancement checks passed. Production changes and real FUB writes were not performed during preparation.
