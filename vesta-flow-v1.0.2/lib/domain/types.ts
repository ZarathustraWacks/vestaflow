/** Canonical normalized contracts shared by connectors, spine, API, and UI. */
import type { LeadIntelligenceScore } from '@/lib/learning/types';
import type { CadenceStatus,LeadLane } from '@/lib/policy/vesta';
export type DataMode = 'demo' | 'live' | 'fallback';
export type RoutingCustody='awaiting-assignment'|'direct-service'|'data-repair'|'unknown';
export interface NormalizedUser { id:number; name:string; email:string; role:string; isActive:boolean; isOwner?:boolean; isRoutingManager?:boolean; raw?:unknown; }
export interface NormalizedTask { id:number|string; personId:number|string|null; assignedUserId:number|null; assignedUserName?:string; name:string; type:string; dueAt:string|null; isCompleted:boolean; raw?:unknown; }
export interface NormalizedAppointment { id:number|string; personIds:(number|string)[]; title:string; startAt:string|null; endAt:string|null; status:string; isCancelled:boolean; raw?:unknown; }
export interface TimelineEvent { id:string; type:string; title:string; occurredAt:string|null; detail:string; source:string; tone:'positive'|'warning'|'neutral'|'critical'; raw?:unknown; }
export interface GovernanceSignal { key:string; label:string; status:'pass'|'warn'|'fail'|'unknown'; points:number; maxPoints:number; explanation:string; }
export interface LeadDecision { type:string; label:string; urgency:'Immediate'|'Today'|'This week'|'Monitor'; rationale:string; consequence:string; matchedRule:string; evidenceQuality:'High'|'Medium'|'Low'; dataCompleteness:number; }
export interface OperationalClock {key:'route-acceptance'|'initial-acknowledgement'|'first-contact-attempt'|'meaningful-contact'|'appointment-confirmation'|'ongoing-cadence';label:string;status:'met'|'pending'|'breached'|'unknown'|'not-applicable';dueAt:string|null;clearedAt:string|null;clearingAction:string;policyStatus:'approved'|'proposed'|'ambiguous';}
export interface NormalizedLead {
  id:number|string; name:string; stage:string; source:string; businessSegment:'buyer-seller'|'rental'|'needs-classification'; businessSegmentReason:string; businessSegmentEvidence?:string[];
  leadLane:LeadLane; timeframeId:number|null; timeframeStatus:string|null;
  assignedUserId:number|null; assignedUserName:string; assignedUserRole:string|null;
  createdAt:string|null; updatedAt:string|null; lastActivityAt:string|null; lastCommunicationAt:string|null; lastCommunicationSource?:'fub-last-communication'|'fub-contacted'|'outbound-call'|'outbound-email'|'outbound-text'|'email'|'text'|null; nextTaskAt:string|null;
  nextAppointmentAt?:string|null; nextActionAt?:string|null; nextActionSource?:'task'|'appointment'|null; taskRepairRecommended?:boolean;
  routingManagerOwner?:boolean; routingCustody?:RoutingCustody|null; routingCustodyReason?:string|null;
  emails:string[]; phones:string[]; tags:string[]; price:number|null; collaborators:string[];
  ageBand:'Fresh'|'Developing'|'Aged'|'Old'|'Legacy'; engagementBand:'Active now'|'Recently active'|'Cooling'|'Dormant'|'Unknown';
  cadenceKey:string; cadenceLabel:string; cadenceStatus:CadenceStatus; cadenceDueAt:string|null; cadenceDaysLate:number|null; cadenceClearRequired:boolean; overdueTaskCount:number;
  handRaiseAt:string|null; responseSlaStatus:'met'|'breached'|'pending'|'not-applicable'|'unknown'; decisionSnapshotId:string;
  operationalClocks?:OperationalClock[];policyVersion?:string;evidenceWarnings?:string[];
  rentalConversion?:{enrolled:boolean;status:'current'|'due'|'overdue'|'not-enrolled';dueAt:string|null;basis:string};
  governanceScore:number; governanceSignals:GovernanceSignal[]; riskLevel:'Critical'|'High'|'Medium'|'Healthy'; riskReasons:string[]; recommendedAction:string; decision:LeadDecision;
  learningScore?:LeadIntelligenceScore;
  raw?:unknown;
}
export interface AgentRollup { id:number|null; name:string; role:string; leads:number; fresh:number; critical:number; noNext:number; stale:number; averageScore:number; }
