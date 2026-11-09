import type {FlowEvent} from './types';

export function dailyGoal(events:FlowEvent[],brokerId:number,timeZone:string,now=new Date(),live=true){
 const format=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
 const day=format.format(now),seen=new Set<string>();
 for(const event of events){
  const at=new Date(event.createdAt),sync=event.metadata?.fubSync as {delivered?:boolean;simulated?:boolean}|undefined;
  if(event.kind!=='broker.complete'||event.actorUserId!==brokerId||!Number.isFinite(at.getTime())||at>now||format.format(at)!==day)continue;
  if(live&&(!sync?.delivered||sync.simulated))continue;
  seen.add(event.id);
 }
 return {completed:seen.size,target:20,day,timeZone};
}
