const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {planNextAction}=require('../lib/next-action/engine.ts'),policy=require('../lib/next-action/policy.json');
const now=Date.parse('2026-11-20T18:00:00Z'),raise=new Date(now-3600000).toISOString(),attempt=new Date(now-3000000).toISOString();
const lead=extra=>({id:'111635',assignedUserId:7,name:'Synthetic reactivation',stage:'Nurture',source:'Old source',leadLane:'buyer',businessSegment:'buyer-seller',tags:['Longterm Nurture Once/Week'],createdAt:'2024-04-01T00:00:00Z',handRaiseAt:raise,brokerOutreachAt:null,twoWayEngagementAt:null,cadenceStatus:'current',...extra});
const plan=(p,extra={})=>planNextAction(p,policy,{now,...extra});
const calls=n=>Array.from({length:n},(_,i)=>({id:String(i),personId:'111635',ownerId:7,at:new Date(now-3600000+i*1000).toISOString(),outbound:true,verified:true}));
const done=(outcome='Outbound call — no answer',extra={})=>({id:'e',leadId:'111635',actorUserId:7,kind:'broker.complete',createdAt:attempt,outcome,metadata:{fubSync:{delivered:true,simulated:false}},...extra});
test('Margaret-shaped historical rental labels surface a classification conflict instead of disappearing',()=>{
 const p=lead({source:'Apartments.com',leadLane:'renter',tags:['Renter','Longterm Nurture Once/Week']}),before=JSON.stringify(p),a=plan(p);assert.equal(a.state,'classification-review');assert.ok(a.conflicts.some(c=>c.code==='renewed-intent-classification'));assert.equal(JSON.stringify(p),before);assert.equal(a.writesFub,false);assert.equal(a.changesCadence,false);
});
test('an unanswered attempt keeps the connection objective open despite weekly completion hold',()=>{
 const a=plan(lead({brokerOutreachAt:attempt,flowActionHeld:true}),{events:[done()]});assert.equal(a.state,'connecting');assert.ok(a.conflicts.some(c=>c.code==='attempt-is-not-connection'));assert.ok(a.conflicts.some(c=>c.code==='attempt-held-by-nurture'));assert.equal(a.dueAt,null);assert.match(a.afterOutcome['No answer'],/open/);
});
test('outbound activity, old conversation and inbound-only evidence do not prove current connection',()=>{
 for(const extra of [{brokerOutreachAt:attempt,lastCommunicationAt:attempt},{twoWayEngagementAt:'2026-10-01T00:00:00Z',brokerOutreachAt:attempt},{customerResponseAt:attempt},{lastActivityAt:attempt},{raw:{callDuration:300},brokerOutreachAt:attempt}])assert.equal(plan(lead(extra)).state,'connecting');
});
test('actual new conversation changes the objective; reported outcomes retain their evidence authority',()=>{
 assert.equal(plan(lead({twoWayEngagementAt:attempt})).state,'appointment-path');
 const a=plan(lead({twoWayEngagementAt:'2026-10-01T00:00:00Z'}),{events:[done('Connected conversation')]});assert.equal(a.state,'appointment-path');assert.equal(a.evidence.find(e=>e.kind==='connection').authority,'reported-outcome');
 assert.equal(plan(lead(),{events:[done('Connected conversation',{actorUserId:8})]}).state,'connecting');
 assert.equal(plan(lead(),{events:[done('Connected conversation',{metadata:{fubSync:{delivered:true,simulated:true}}})]}).state,'connecting');
});
test('a subsequent customer inquiry reopens connection without changing original incoming clock',()=>{
 const p=lead({twoWayEngagementAt:'2026-11-20T16:00:00Z',operationalClocks:[{key:'first-contact-attempt',policyStatus:'approved',dueAt:'2024-04-01T00:05:00Z'}]});const a=plan(p);assert.equal(a.state,'connecting');assert.equal(a.dueAt,null);assert.equal(p.createdAt,'2024-04-01T00:00:00Z');assert.match(a.dueBasis,/unchanged/);
});
test('double taps count verified distinct individual calls for this owner and current episode only',()=>{
 assert.match(plan(lead({brokerOutreachAt:attempt}),{calls:calls(1),officeOpen:true}).label,/second call/);
 const c=calls(2),a=plan(lead(),{calls:[...c,c[0],{...c[0],id:'foreign',ownerId:8},{...c[0],id:'future',at:new Date(now+1).toISOString()}],officeOpen:true});assert.match(a.label,/second double tap/);assert.equal(Date.parse(a.dueAt),Date.parse(c[1].at)+15*60000);
 assert.equal(plan(lead(),{calls:calls(10),officeOpen:true}).state,'manager-review');assert.equal(plan(lead(),{calls:calls(10)}).automaticReroute,false);
});
test('unknown later pacing and working hours do not manufacture deadlines',()=>{
 assert.equal(plan(lead(),{calls:calls(4),officeOpen:true}).dueAt,null);
 assert.equal(plan(lead(),{calls:calls(2)}).dueAt,null);
 const a=plan(lead(),{calls:calls(2),officeOpen:false,nextWorkingAt:'2026-11-23T15:00:00Z'});assert.match(a.label,/next working/);assert.equal(a.dueAt,'2026-11-23T15:00:00Z');
});
test('contact restrictions, recruiting, pass and explicit holds take precedence',()=>{
 assert.equal(plan(lead({doNotContact:true})).state,'excluded');assert.equal(plan(lead({stage:'Recruiting'})).state,'excluded');
 assert.equal(plan(lead(),{events:[done('',{kind:'broker.pass'})]}).state,'manager-review');
 const returnAt=new Date(now+3600000).toISOString();const a=plan(lead(),{events:[done('',{kind:'broker.skip',returnAt})]});assert.equal(a.state,'waiting');assert.equal(a.dueAt,returnAt);
 assert.equal(plan(lead(),{events:[done('',{kind:'management.kill',actorUserId:99,authority:'ledger'})]}).state,'excluded');
});
test('appointments and contracts progress their own objectives rather than acquiring another appointment',()=>{
 assert.equal(plan(lead({nextAppointmentAt:new Date(now+3600000).toISOString()})).state,'appointment-set');assert.equal(plan(lead({stage:'Under Contract'})).state,'transaction');
 const a=plan(lead(),{events:[done('Appointment scheduled')]});assert.equal(a.state,'appointment-set');assert.match(a.label,/date/);
});
test('customer conditions and agreed timing are respected; old conditions do not overwrite new intent',()=>{
 const next=new Date(now+86400000).toISOString();assert.equal(plan(lead({agreedFollowUpAt:next})).dueAt,next);
 const a=plan(lead({twoWayEngagementAt:attempt,contactContext:{kind:'connected',at:attempt,condition:'Only if plans change next year'}}));assert.match(a.label,/condition/);assert.equal(a.dueAt,null);
 const b=plan(lead({twoWayEngagementAt:attempt,contactContext:{kind:'long-term',at:'2026-09-01T00:00:00Z',condition:'Maybe next year'}}));assert.doesNotMatch(b.label,/condition/);
});
test('bad policy, future data and invalid captured episode fail conservatively; legacy clock copy is flagged',()=>{
 assert.equal(planNextAction(lead(),{...policy,automaticReroute:true},{now}).state,'evidence-review');
 assert.notEqual(plan(lead({handRaiseAt:new Date(now+1000).toISOString()})).state,'connecting');
 assert.notEqual(plan(lead({handRaiseAt:'2025-01-01T00:00:00Z'}),{episodeOpenedAt:'bad'}).state,'connecting');
 assert.ok(plan(lead({decision:{rationale:'Inside four-business-hour follow-up'}})).conflicts.some(c=>c.code==='legacy-first-response-wording'));
});

test('only an existing approved connection deadline can trigger connection-overdue review',()=>{
 const clock={key:'meaningful-contact',policyStatus:'approved',status:'breached',dueAt:attempt};
 assert.equal(plan(lead({operationalClocks:[clock]})).state,'connection-overdue');
 assert.equal(plan(lead({operationalClocks:[{...clock,policyStatus:'proposed'}]})).state,'connecting');
 assert.equal(plan(lead({operationalClocks:[{...clock,dueAt:new Date(now+1000).toISOString()}]})).state,'connecting');
 assert.equal(plan(lead({phones:[]})).state,'evidence-review');
});

test('a Smart List can prompt evidence review but never invent an inquiry timestamp',()=>{
 const item={personId:'111635',ownerId:'7',signal:'recent-activity',observedAt:raise,expiresAt:new Date(now+1000).toISOString(),usage:'additive-opportunity',actualCredit:0,changesCadence:false};
 const p=lead({handRaiseAt:null,smartListEvidence:{contractVersion:'vesta-smart-list-opportunities-v1',items:[item]}}),a=plan(p);assert.equal(a.state,'evidence-review');assert.equal(a.evidence.some(e=>e.kind==='customer-intent'),false);assert.equal(a.dueAt,null);
 assert.equal(plan(lead({handRaiseAt:null,smartListEvidence:{contractVersion:'vesta-smart-list-opportunities-v1',items:[{...item,ownerId:'8'}]}})).state,'waiting');
});

test('fresh initial incoming uses its existing first-call clock; imports do not become new incoming',()=>{
 const due=new Date(now-1800000).toISOString(),p=lead({stage:'Lead',ageBand:'Fresh',handRaiseAt:null,createdAt:raise,tags:[],operationalClocks:[{key:'first-contact-attempt',policyStatus:'approved',dueAt:due}]});
 const a=plan(p);assert.equal(a.state,'connecting');assert.match(a.label,/first contact/);assert.equal(a.dueAt,due);assert.equal(a.evidence[0].kind,'original-incoming');assert.equal(p.createdAt,raise);
 assert.equal(plan({...p,tags:['Import']}).state,'waiting');
});
test('compact Flow facts preserve the same first-call and restriction proposals without raw record bodies',()=>{
 const {projectNextActionFacts}=require('../lib/next-action/engine.ts');
 const p=lead({stage:'Lead',ageBand:'Fresh',handRaiseAt:null,createdAt:raise,tags:[],raw:{doNotContact:true,privateBody:'must not be copied'},operationalClocks:[{key:'first-contact-attempt',policyStatus:'approved',status:'pending',dueAt:attempt},{key:'other-clock',privateBody:'must not be copied'}]});
 const fields=projectNextActionFacts(p,done());assert.equal(fields.raw,undefined);assert.equal(fields.operationalClocks.length,1);assert.equal(fields.doNotContact,true);assert.equal(fields.createdAt,raise);assert.deepEqual(plan({...p,raw:undefined,...fields}),plan(p));
});
