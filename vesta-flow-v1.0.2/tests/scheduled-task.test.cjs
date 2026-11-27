const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;
Module._resolveFilename=function(r,p,m,o){return resolve.call(this,r.startsWith('@/')?path.join(root,r.slice(2)):r,p,m,o)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {normalizePersonBase,normalizeTask}=require('../lib/fub/normalize.ts');
const {enrichLead}=require('../lib/spine/governance.ts');
const {buildFlowQueue}=require('../lib/flow/engine.ts');
const {scheduledTaskHold}=require('../lib/policy/scheduled-task.ts');
const now=Date.now(),iso=days=>new Date(now+days*86400000).toISOString(),users=new Map([[50,{id:50,name:'Broker',role:'Agent'}]]);
function person(extra={}){return normalizePersonBase({id:42,name:'Synthetic task case',assignedUserId:50,stage:'Showing Homes',source:'Website',created:iso(-100),updated:iso(-1),lastInquiry:iso(-20),lastOutgoingText:iso(-4),lastCommunication:iso(-4),twoWayEngagementAt:iso(-4),lastActivity:iso(-4),tags:['Buyer'],...extra},users);}
function task(extra={}){return normalizeTask({id:9,personId:42,assignedUserId:50,name:'Follow Up - listing review',dueDateTime:iso(3),created:iso(-10),updated:iso(-.1),isCompleted:false,...extra},users);}
function planned(extra={},taskExtra={}){return enrichLead(person(extra),[task(taskExtra)]);}
test('scheduled owner task replaces routine cadence in the decision and removes action/message queue entry',()=>{
 const lead=planned();assert.equal(lead.cadenceStatus,'overdue');assert.equal(lead.overdueTaskCount,0);
 assert.equal(lead.decision.matchedRule,'task.scheduled-follow-up');assert.match(lead.decision.label,/listing review/);
 assert.equal(lead.nextTaskOwnerId,50);assert.equal(lead.recommendedAction,lead.decision.label);
 assert.deepEqual(buildFlowQueue([lead],[],50),[]);
});
test('late completed response remains a historical breach without an unfinished hand-raise instruction',()=>{
 const lead=planned();assert.equal(lead.operationalResponseSlaStatus,'breached');
 assert.ok(lead.operationalClocks.find(c=>c.key==='first-contact-attempt').clearedAt);
 assert.notEqual(lead.decision.label,'Respond to hand raise');
 const noTask=enrichLead(person(),[]);assert.notEqual(noTask.decision.label,'Respond to hand raise');
});
test('new customer activity or targeted inquiry interrupts the task hold',()=>{
 for(const extra of [{handRaiseAt:iso(-.01)},{customerResponseAt:iso(-.01)},{nextActionEvidence:{contractVersion:'vesta-next-action-evidence-v1',cutoff:iso(-.001),inquiry:{personId:'42',at:iso(-.01)}}}]){
 const lead={...planned(),...extra};assert.equal(scheduledTaskHold(lead,now),null);
 assert.equal(buildFlowQueue([lead],[],50).length,1);
 }
});
test('never-contacted, wrong-owner, overdue and unverified schedules cannot hide action',()=>{
 const base=planned();
 for(const extra of [{stage:'Lead',crmStage:'Lead',twoWayEngagementAt:null,contactContext:null,lastCommunicationAt:null,raw:{}},{nextTaskOwnerId:7},{overdueTaskCount:1},{nextTaskPlannedAt:null},{nextTaskAt:iso(-1)},{contextConflict:true}])assert.equal(scheduledTaskHold({...base,...extra},now),null);
});
test('completed tasks resolve themselves and cannot defer the remaining cadence',()=>{
 const lead=planned({}, {isCompleted:true});assert.equal(lead.nextTaskName,null);assert.equal(scheduledTaskHold(lead,now),null);assert.equal(buildFlowQueue([lead],[],50).length,1);
});
test('due tasks reappear and date-only tasks become actionable on their local due date',()=>{
 const lead=planned();assert.equal(scheduledTaskHold(lead,Date.parse(lead.nextTaskAt)+1),null);
 const day=new Date(now);day.setHours(0,0,0,0);const dateOnly=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
 assert.equal(scheduledTaskHold({...lead,nextTaskAt:dateOnly},now),null);
});
test('older task plan cannot cover more recent customer activity; scheduling adds no communication credit',()=>{
 const lead=planned({}, {updated:iso(-5)});assert.equal(lead.lastCommunicationAt,person().lastCommunicationAt);
 assert.equal(scheduledTaskHold({...lead,customerResponseAt:iso(-4)},now),null);
});

test('an upcoming appointment cannot be masked by a later task',()=>{const lead=planned();assert.equal(scheduledTaskHold({...lead,nextAppointmentAt:iso(1)},now),null);});
