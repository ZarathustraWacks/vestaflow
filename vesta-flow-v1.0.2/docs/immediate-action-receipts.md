# Immediate action receipts

After FUB confirms a Done sync and the existing Render PostgreSQL ledger commits its action, Flow applies that exact broker/contact receipt to the visible queue. It then refreshes shared intelligence in the background. Failed or unverified saves keep the form and lead visible. An older refresh cannot restore a held action or replace a more recently selected broker.

The receipt uses the existing suppression policy: real new intent, the next approved nurture interval, and later management decisions can reopen an obligation. Planning-only outcomes do not hide an uncontacted buyer. Customers remain visible; Needs action respects the completion hold without manufacturing communication timestamps. Daily progress unions receipt IDs to avoid counting a confirmed action twice.

Concurrent brokers append individual immutable ledger events. This change does not replace a shared queue snapshot. PostgreSQL already serializes namespace position allocation in the append transaction and rejects conflicting event IDs. The new authenticated `after` read uses those committed positions and the existing index; no schema migration is needed. Vercel builds a complete per-process history once, coalesces simultaneous readers, then requests only later positions. Failed pagination publishes nothing. Cold starts still require a complete initial read. During a rolling release against an older Render version, it falls back to reading every original history page.

## Release and recovery

1. Deploy the additive shared Source ledger reader first; confirm authenticated cursor reads and unchanged legacy reads.
2. Deploy Flow. Verify normal queue loading without completing a real contact solely for testing.
3. Roll back Flow independently if necessary. The Source addition can stay deployed because existing endpoint behavior is preserved. No stored action is deleted or rewritten by rollback.

## Validation

- 201 Flow tests passed, including confirmed receipts, failed storage, stale snapshots, newer intent, newer management returns, ownership changes, daily goal deduplication and more than 500 historical actions.
- 11 backend contract tests passed, including concurrent appends from 38 distinct brokers and existing retry/rollback tests. These ran against the SQLite test harness, not a production PostgreSQL load test.
- Synthetic Safari check: next lead and daily goal advanced while refresh was deliberately blocked; late response could not switch the selected broker back; returning to the original broker preserved the completion; failed save preserved the lead and form.
- Production build passed. Test fixtures use synthetic contacts and were removed before commit. No test wrote to FUB or changed production data.
