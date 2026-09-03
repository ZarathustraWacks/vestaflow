export type BrokerActionKind='broker.complete'|'broker.skip'|'broker.pass';
export type ManagementActionKind='management.reroute'|'management.return'|'management.nurture'|'management.kill';
export type FlowEventKind=BrokerActionKind|ManagementActionKind;

export interface FlowEvent {
 id:string;
 kind:FlowEventKind;
 leadId:string;
 decisionSnapshotId:string;
 actorUserId:number|null;
 actorName:string;
 createdAt:string;
 recommendation:string;
 recommendationShown?:string;
 selectedAction?:string;
 reportedAction?:string;
 verificationStatus?:'reported'|'reported-note-readback'|'fub-event-verified'|'unverified';
 priority:string;
 outcome?:string;
 reason?:string;
 note?:string;
 returnAt?:string;
 parentEventId?:string;
 targetUserId?:number|null;
 targetUserName?:string;
 metadata?:Record<string,unknown>;
}

export interface FlowStorageStatus {
 mode:'durable-redis'|'temporary-memory'|'degraded-redis';
 durable:boolean;
 available:boolean;
 message:string;
}

export interface FlowItem {
 id:string;
 leadId:string;
 lead:any;
 effectiveOwnerId:number|null;
 effectiveOwnerName:string;
 priorityScore:number;
 priorityLabel:'Immediate'|'Today'|'This week'|'Monitor';
 recommendedAction:string;
 rationale:string;
 consequence:string;
 skipCount:number;
 lastEvent:FlowEvent|null;
 position?:number;
}

export interface ManagementException {
 passEvent:FlowEvent;
 lead:any;
 previousBroker:string;
 ageMinutes:number;
 recommendedBrokerId:number|null;
 recommendedBrokerName:string|null;
 recommendationReason:string;
 previousPasses:number;
}
