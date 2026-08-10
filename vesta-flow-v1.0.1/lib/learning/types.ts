export type LearningModelMode = 'transformer'|'baseline'|'heuristic'|'unavailable';
export interface OutcomeProbability { label:string; probability:number; horizonDays:number; }
export interface LeadIntelligenceScore {
  score:number;
  confidence:number;
  mode:LearningModelMode;
  modelVersion:string;
  generatedAt:string;
  outcomes:{contact7d:number;appointment30d:number;client90d:number;closing180d:number;attrition30d:number;reactivation30d:number};
  recommendedAction:'call'|'text'|'nurture'|'assign'|'broker-review'|'archive'|'continue';
  positiveEvidence:string[];
  negativeEvidence:string[];
}
export interface LearningStatus {enabled:boolean;reachable:boolean;modelVersion:string|null;mode:LearningModelMode;message:string;}
