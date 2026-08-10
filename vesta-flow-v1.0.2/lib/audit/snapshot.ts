import { NormalizedLead } from '@/lib/domain/types';
export const POLICY_VERSION='vesta-sop-2026-07-v1';
export function decisionSnapshot(lead:NormalizedLead){return Object.freeze({id:lead.decisionSnapshotId,policyVersion:POLICY_VERSION,sourceUpdatedAt:lead.updatedAt,leadId:String(lead.id),facts:Object.freeze({lane:lead.leadLane,stage:lead.stage,ownerId:lead.assignedUserId,cadenceStatus:lead.cadenceStatus,responseSlaStatus:lead.responseSlaStatus,overdueTaskCount:lead.overdueTaskCount}),governanceScore:lead.governanceScore,decision:Object.freeze({...lead.decision})});}
