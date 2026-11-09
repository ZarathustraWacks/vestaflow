# Relationship follow-up in the existing Flow workspace

The existing navigation and Done/Skip/Pass controls remain in place. These additions affect Flow only; they do not change Cadence, shared SOP intervals, Render services or credentials.

- New buyer leads without established contact receive the strongest queue boost when first outreach is missing or their follow-up cadence is due. No activity history is required. An outbound attempt clears its response timer and follows the existing cadence; it does not establish successful contact. A paired reply, explicit FUB contacted flag or an established-contact stage resolves the new-contact focus.
- Important-tag contacts receive an additional priority boost when actionable. Customers includes an Important filter for relationships whose next action is not yet due.
- Closed contacts remain in Customers / Past clients. A stale 90-day cadence alone no longer places them in the action queue. Explicitly due tasks, recent unanswered requests and imminent appointments can bring them back. Management holds and temporary skips still apply.
- Untagged Nurture contacts remain planning reminders. Conflicting approved nurture tags prompt review; Flow does not choose or modify tags. The existing approved monthly/weekly intervals remain unchanged. Note-backed Done events hold until the next approved interval, rather than permanently suppressing later follow-up.

## Bulk follow-up

In Customers, choose one broker, filter contacts (for example Past clients), select up to 50, and choose Schedule selected in FUB. Set a title, action, date/time and optional short planning note, review the source-confirmed contact names/assignments, then confirm.

FUB receives one open task per contact assigned to that broker. The short planning note is part of the task name, not a timeline communication. This neither sends messages nor records outreach, changes cadence tags/stages or completes existing tasks. Verified tasks appear in My tasks immediately while the existing accelerator refresh catches up. Opening My tasks also refreshes source data.

Each contact is checked again at execution for current assignment and operational eligibility. Only authenticated managers or the assigned broker can schedule. Existing live-write and verified durable-ledger gates must be enabled; demo mode cannot write. A durable claim is fenced before the single provider POST. An interrupted POST is not automatically retried or released. A retry of the same schedule checks the exact FUB marker/readback before any new POST. Partial results count only verified source tasks and retain the same schedule identity for retries. If the source result remains uncertain, review the contact in FUB before starting a different schedule.

Existing FUB tasks also continue through the established task delivery pipeline. This change does not inspect or alter FUB action plans/automation; a particular contact's weekly automation is not inferred from a monthly tag.

## Validation

Synthetic behavior tests exercise no-activity buyers, attempts versus established contact, Important priority, Closed due-action exceptions, missing/conflicting nurture tags and preserved suppression. Mocked FUB/ledger tests exercise authorization, changed ownership, bounded selection, explicit confirmation, per-contact payloads, duplicate recovery, interrupted POSTs and readback/receipt failures. No real contacts or tasks are mutated by tests.
