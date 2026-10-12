/**
 * Defines which person stages may participate in live operating intelligence.
 *
 * Inactive records remain in the raw mirror and observation history for audit,
 * training, campaign selection, and Data Management review. They must not
 * influence active cadence, rerouting, scorecards, or broker-behavior reports.
 * Cold Leads is a campaign holding stage: current broker ownership is irrelevant
 * while the contact waits for a future AI campaign. Closed is deliberately not
 * suppressed because the approved SOP includes a past-client cadence.
 */
export type OperationalStageRecord={stage?:string|null};

const SUPPRESSED_OPERATIONAL_STAGES=new Set(['trash','deleted','archived','cold leads']);

export const normalizeOperationalStage=(value:unknown)=>String(value??'').trim().toLowerCase().replace(/\s+/g,' ');

export const isSuppressedOperationalStage=(stage:unknown)=>SUPPRESSED_OPERATIONAL_STAGES.has(normalizeOperationalStage(stage));

export const isOperationalLead=(lead:OperationalStageRecord)=>!isSuppressedOperationalStage(lead.stage);
