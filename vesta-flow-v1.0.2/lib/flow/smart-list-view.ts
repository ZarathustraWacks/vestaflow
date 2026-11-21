/** Read-only display join. Membership is never treated as communication or a task. */
import type {SmartListSignal} from '@/lib/policy/smart-list-opportunities';
export type SmartListRow={id:string;name:string;stage:string;source:string;memberships:{id:string;label:string;observedAt:string}[];lastActivityAt:string|null;lastOutreachAt:string|null;tasks:{id:string;name:string;dueAt:string|null}[];recommendation:string;priority:string};
const at=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
export function buildSmartListRows(people:any[],tasks:any[],signals:SmartListSignal[],brokerId:number|null,now=Date.now()):SmartListRow[]{
 if(!Number.isSafeInteger(brokerId)||Number(brokerId)<1)return [];
 const memberships=new Map<string,Map<string,SmartListSignal>>();
 for(const s of signals){if(!s||String(s.ownerId)!==String(brokerId)||!/^\d+$/.test(s.personId)||!/^\d+$/.test(s.listId)||s.vestaId!=null&&String(s.vestaId)!==String(s.personId)||s.usage!=='additive-opportunity'||s.actualCredit!==0||s.changesCadence!==false||!at(s.observedAt)||Date.parse(s.observedAt)>now||!at(s.expiresAt)||Date.parse(s.expiresAt)<=now)continue;const m=memberships.get(s.personId)||new Map();const old=m.get(s.listId);if(!old||Date.parse(old.observedAt)<Date.parse(s.observedAt))m.set(s.listId,s);memberships.set(s.personId,m);}
 const taskIndex=new Map<string,any[]>();for(const task of tasks){if(Number(task.assignedUserId)!==brokerId||task.completed===true||task.isCompleted===true||['completed','complete','done'].includes(String(task.status||'').toLowerCase()))continue;const id=String(task.personId),list=taskIndex.get(id)||[];list.push(task);taskIndex.set(id,list);}
 const rows=new Map<string,SmartListRow>();
 for(const p of people){const id=String(p.id),items=memberships.get(id);if(Number(p.assignedUserId)!==brokerId||!items?.size)continue;
 rows.set(id,{id,name:p.name||'Unnamed contact',stage:p.stage||'Unknown',source:p.source||'Unknown',memberships:[...items.values()].map(s=>({id:s.listId,label:s.label||'Unnamed Smart List',observedAt:s.observedAt})).sort((a,b)=>a.label.localeCompare(b.label)),lastActivityAt:at(p.lastActivityAt),lastOutreachAt:at(p.brokerOutreachAt),tasks:(taskIndex.get(id)||[]).map(t=>({id:String(t.id),name:t.name||'Untitled task',dueAt:at(t.dueAt)})).sort((a,b)=>(Date.parse(a.dueAt||'')||Infinity)-(Date.parse(b.dueAt||'')||Infinity)),recommendation:p.decision?.label||p.recommendedAction||'Review in FUB',priority:p.decision?.urgency||'Monitor'});
 }
 return [...rows.values()];
}
export type SmartListFilters={search:string;list:string;stage:string;activity:string;overdue:boolean;sort:string;direction:'asc'|'desc'};
export function filterSmartListRows(rows:SmartListRow[],filters:SmartListFilters,now=Date.now()){
 const q=filters.search.trim().toLowerCase(),days=Number(filters.activity),sign=filters.direction==='asc'?1:-1;
 return rows.filter(r=>(!q||[r.name,r.source,r.stage,...r.memberships.map(m=>m.label),...r.tasks.map(t=>t.name)].join(' ').toLowerCase().includes(q))&&(!filters.list||r.memberships.some(m=>m.id===filters.list))&&(!filters.stage||r.stage===filters.stage)&&(!days||!!r.lastActivityAt&&Date.parse(r.lastActivityAt)>=now-days*86400000&&Date.parse(r.lastActivityAt)<=now)&&(!filters.overdue||r.tasks.some(t=>t.dueAt&&Date.parse(t.dueAt)<now))).sort((a,b)=>{
 const key=filters.sort;let x:any,y:any;
 if(['activity','outreach','due'].includes(key)){x=key==='activity'?a.lastActivityAt:key==='outreach'?a.lastOutreachAt:a.tasks[0]?.dueAt;y=key==='activity'?b.lastActivityAt:key==='outreach'?b.lastOutreachAt:b.tasks[0]?.dueAt;const ax=Date.parse(x||''),by=Date.parse(y||'');if(!Number.isFinite(ax))return Number.isFinite(by)?1:a.id.localeCompare(b.id);if(!Number.isFinite(by))return -1;return sign*(ax-by)||a.id.localeCompare(b.id);}
 x=key==='list'?a.memberships.map(m=>m.label).join(', '):key==='stage'?a.stage:key==='recommendation'?a.recommendation:a.name;y=key==='list'?b.memberships.map(m=>m.label).join(', '):key==='stage'?b.stage:key==='recommendation'?b.recommendation:b.name;
 return sign*String(x).localeCompare(String(y))||a.id.localeCompare(b.id);
 });
}
