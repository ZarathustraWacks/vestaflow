import { NormalizedLead, NormalizedTask, TimelineEvent } from '@/lib/domain/types';
const time=(x:any)=>x?.created||x?.createdAt||x?.start||x?.startAt||x?.date||x?.occurredAt||x?.timestamp||x?.dueDateTime||x?.due||x?.dueDate||null;
const validTime=(value:string|null)=>value&&Number.isFinite(new Date(value).getTime())?value:null;
export function buildTimeline(lead:NormalizedLead,tasks:NormalizedTask[],collections:Record<string,any[]>):TimelineEvent[]{
 const events:TimelineEvent[]=[];
 const add=(e:TimelineEvent)=>events.push(e);
 add({id:'created',type:'lead',title:'Lead entered Follow Up Boss',occurredAt:lead.createdAt,detail:`Source: ${lead.source}`,source:'person',tone:'neutral'});
 tasks.filter(t=>String(t.personId)===String(lead.id)).forEach(t=>add({id:`task-${t.id}`,type:'task',title:t.name,occurredAt:t.dueAt,detail:`${t.type} · ${t.isCompleted?'Completed':'Open'}`,source:'tasks',tone:t.isCompleted?'positive':(t.dueAt&&new Date(t.dueAt)<new Date()?'warning':'neutral'),raw:t.raw}));
 for(const [source,items] of Object.entries(collections))items.forEach((x:any,i)=>add({id:`${source}-${x.id??i}`,type:source,title:x.name||x.type||x.subject||source.replace(/([A-Z])/g,' $1'),occurredAt:time(x),detail:x.body||x.message||x.description||x.outcome||'',source,tone:'neutral',raw:x}));
 const unique=new Map<string,TimelineEvent>();for(const event of events){event.occurredAt=validTime(event.occurredAt);if(event.occurredAt)unique.set(`${event.source}:${event.id}`,event)}
 return [...unique.values()].sort((a,b)=>new Date(b.occurredAt!).getTime()-new Date(a.occurredAt!).getTime());
}
