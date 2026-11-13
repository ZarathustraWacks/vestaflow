const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const e=require('../lib/appointment/engine.ts'),{paths,outcomes}=require('../lib/appointment/catalog.ts');
const now=new Date('2026-11-12T20:00:00Z'),later=new Date('2026-11-12T20:01:00Z');
const ctx=(extra={})=>({...e.contextFor({id:'42',name:'Synthetic Person',stage:'Nurture',source:'Website',decisionSnapshotId:'s1'}),consent:true,identityVerified:true,...extra});
const generate=(c=ctx(),w=e.emptyWorkspace(),id='d1')=>e.assemble(w,c,id,now);
test('all17 nurture report categories are represented with wait and exclusion branches',()=>{
 assert.equal(new Set(paths.map(p=>p.category)).size,17);assert.equal(paths.length,18);
 for(const p of paths){if(['preference','hygiene'].includes(p.id))assert.ok(e.gate(ctx({pathId:p.id})));else assert.ok(generate(ctx({pathId:p.id})).drafts[0].body.length>40)}
});
test('every outcome has a defined next step without forcing stop or invalid into appointments',()=>{
 for(const o of outcomes)assert.ok(e.step(ctx({outcomeId:o.id})));
 assert.equal(e.step(ctx({outcomeId:'stop'})),'Stop outreach');assert.equal(e.step(ctx({outcomeId:'wrong'})),'Review required');
});
test('new and restored contexts default to unconfirmed identity and channel permission',()=>{assert.ok(e.gate(e.contextFor({id:'42'})));assert.equal(e.contextFor({id:'42'}).consent,false)});
test('dnc,source-dnc,recruiting,Zenlist dupes,invalid and missing consent block generation',()=>{
 for(const patch of [{dnc:true},{sourceDnc:true,dnc:false},{stage:' Recruiting '},{source:'Zenlist'},{outcomeId:'wrong'},{consent:false},{identityVerified:false},{pathId:'hygiene'}])assert.throws(()=>generate(ctx(patch)));
});
test('future conditional intent stays on permission path despite an appointment-oriented outcome',()=>{
 const c=ctx({condition:'Only if plans change next year',outcomeId:'ready'}),w=generate(c);
 assert.equal(e.step(c),'Permission / wait');assert.match(w.drafts[0].body,/later check-in|when we check in|check back|pause here/);
 assert.equal(c.condition,'Only if plans change next year');assert.notEqual(e.step({...c,conditionCleared:true}),'Permission / wait');
});
test('no-response attempt does not assert a conversation, booking or verified contact',()=>{
 const c=ctx(),w=generate(c),contract=e.exportReview(w,c);
 assert.equal(contract.brokerCredit,false);assert.equal(contract.timerEffect,'none');assert.equal(contract.appointmentSetVerified,false);
 assert.doesNotMatch(w.drafts[0].body,/appointment is booked|confirmed your|thanks for your reply/i);
});
test('all384 distinct combinations exhaust into review without repeated or nonce wording',()=>{
 const c=ctx();let w=e.emptyWorkspace();const bodies=new Set();
 for(let i=0;i<384;i++){w=generate(c,w,'d'+i);const text=e.normalize(w.drafts.at(-1).body);assert.equal(bodies.has(text),false);bodies.add(text)}
 assert.throws(()=>generate(c,w,'exhausted'),/exhausted/);assert.equal(bodies.size,384);
});
test('saved/reloaded history blocks repeats and is not silently reset',()=>{
 const c=ctx(),first=generate(c),restored=e.restore(JSON.parse(JSON.stringify(first))),next=generate(c,restored,'d2');
 assert.notEqual(first.drafts[0].body,next.drafts[1].body);assert.throws(()=>e.restore({version:1,history:'bad'}),/history/);
});
test('successive drafts vary the message substance rather than only a closing or nonce',()=>{
 const c=ctx(),first=generate(c),next=generate(c,first,'d2');
 const core=body=>body.split('. ').slice(1,-1).join('. ');
 assert.notEqual(core(first.drafts[0].body),core(next.drafts[1].body));
});
test('draft can be freely edited and edit removes approval',()=>{
 const c=ctx(),w=e.approve(generate(c),c,'d1'),edited=e.edit(w,'d1','A broker-written question.', 'edit1',later);
 assert.equal(edited.drafts[0].body,'A broker-written question.');assert.equal(edited.drafts[0].status,'draft');assert.equal(edited.drafts[0].approvedKey,null);assert.equal(edited.drafts[0].revision,2);
 assert.throws(()=>e.simulate(edited,c,'d1',true,'delivery',later),/approve/);
});
test('edited duplicate from a different decision cannot be approved',()=>{
 const c=ctx(),first=generate(c),second=generate(c,first,'d2'),edited=e.edit(second,'d2',first.drafts[0].body,'edit1',later);
 assert.throws(()=>e.approve(edited,c,'d2'),/already proposed/);
});
test('changed contact,permission,manager reason,snapshot or path invalidates approval',()=>{
 const c=ctx(),w=e.approve(generate(c),c,'d1');
 for(const patch of [{leadId:'43'},{consent:false},{managerReason:'Retain broker based on fit'},{snapshotId:'s2'},{pathId:'seller'},{channel:'email'}])assert.throws(()=>e.simulate(w,{...c,...patch},'d1',true,'send',later));
});
test('a newer draft invalidates an older approved draft for the same contact',()=>{
 const c=ctx(),w=generate(c,e.approve(generate(c),c,'d1'),'d2');assert.throws(()=>e.simulate(w,c,'d1',true,'send',later),/fresh draft/);
});
test('failed simulated delivery never accepts a downstream appointment',()=>{
 const c=ctx(),w=e.simulate(e.approve(generate(c),c,'d1'),c,'d1',false,'failed',later);
 assert.throws(()=>e.recordResult(w,'d1','appointment_set','r1','test-1',later),/successful/);
});
test('an appointment needs a specific originating action and synthetic evidence reference',()=>{
 const c=ctx(),w=e.simulate(e.approve(generate(c),c,'d1'),c,'d1',true,'sent',later);
 assert.throws(()=>e.recordResult(w,'wrong','appointment_set','r1','test-1',later));
 assert.throws(()=>e.recordResult(w,'d1','appointment_set','r1','',later),/reference/);
 const result=e.recordResult(w,'d1','appointment_set','r1','test-1',later),contract=e.exportReview(result,c);
 assert.equal(contract.outcomes[0].decision_id,'d1');assert.equal(contract.outcomes[0].payload.simulation,true);assert.equal(contract.trainingEligible,false);
 assert.throws(()=>e.recordResult(result,'d1','appointment_set','r2','test-2',later),/already recorded/);
});
test('delivery/result time cannot precede its source action',()=>{
 const c=ctx(),early=new Date('2026-11-12T19:00:00Z'),w=e.approve(generate(c),c,'d1');
 assert.throws(()=>e.simulate(w,c,'d1',true,'sent',early),/precede/);
 const delivered=e.simulate(w,c,'d1',true,'sent',later);assert.throws(()=>e.recordResult(delivered,'d1','customer_response','reply','',now));
});
test('preferred slot and appointment evidence require independent verification, never another push',()=>{
 for(const outcomeId of ['slot','appointment-set'])assert.throws(()=>generate(ctx({outcomeId})),/verify|Verify|Confirm/);
});
test('decision export retains each contact snapshot instead of applying the currently selected one',()=>{
 const c=ctx(),w=generate(ctx({leadId:'43',snapshotId:'s2'}),generate(c),'d2'),contract=e.exportReview(w,c);
 assert.deepEqual(contract.decisions.map(d=>d.snapshot_id),['s1','s2']);assert.deepEqual(contract.decisions.map(d=>d.lead_id),['42','43']);
});
test('live dispatch is unconditionally unavailable',()=>{assert.throws(()=>e.dispatch(),/not configured/)});
test('Hold saves exact edited/original wording,reason and context without sending or approving training',()=>{
 const c=ctx(),w=generate(c),edited=e.edit(w,'d1','My broker-written alternative.','edit1',later),held=e.hold(edited,c,'d1','Too pushy; ask about timing first.','hold1',later);
 assert.equal(held.drafts[0].status,'held');assert.equal(held.held[0].originalBody,w.drafts[0].body);assert.equal(held.held[0].editedBody,'My broker-written alternative.');
 assert.equal(held.held[0].trainingEligible,false);assert.equal(held.held[0].sent,false);assert.equal(held.held[0].reviewStatus,'pending');assert.equal(held.results.length,0);
 assert.equal(e.exportReview(held,c).trainingCandidates[0].decisionId,'d1');assert.throws(()=>e.approve(held,c,'d1'));
});
test('Hold requires reason,correct contact,unsent draft and valid chronology',()=>{
 const c=ctx(),w=generate(c);assert.throws(()=>e.hold(w,c,'d1','','h1',later),/reason/);assert.throws(()=>e.hold(w,{...c,leadId:'43'},'d1','Review','h1',later));
 assert.throws(()=>e.hold(w,c,'d1','Review','h1',new Date('2026-11-12T19:00:00Z')),/precede/);
 const sent=e.simulate(e.approve(w,c,'d1'),c,'d1',true,'s1',later);assert.throws(()=>e.hold(sent,c,'d1','Review','h1',later),/unsent/);
});
test('held drafts remain in duplicate prevention and malformed candidate storage fails closed',()=>{
 const c=ctx(),w=generate(c),held=e.hold(w,c,'d1','Review','h1',later),next=generate(c,held,'d2');assert.notEqual(next.drafts[1].body,w.drafts[0].body);
 assert.throws(()=>e.restore({...held,held:[null]}),/review/);
 const old={...w};delete old.held;assert.deepEqual(e.restore(old).held,[]);
});
test('engine and UI do not invoke FUB writeback,queue actions or external messaging transport',()=>{
 for(const file of ['lib/appointment/engine.ts','components/AppointmentMessages.tsx']){
  const source=fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8');assert.doesNotMatch(source,/fetch\(|appendFlowEvent|writeback|\/api\/flow\/actions|setInterval\(/);
 }
});

test('preparation autofills a draft without fabricating identity review or channel consent',()=>{
 const c=e.contextFor({id:42,name:'Sample Buyer',stage:'Lead',leadLane:'buyer',source:'Website'}),w=e.prepare(e.emptyWorkspace(),c,'auto1',now);
 assert.ok(w.drafts[0].body);assert.equal(c.consent,false);assert.equal(c.identityVerified,false);assert.equal(w.drafts[0].contextKey,e.contextKey(c));
 const reviewed=e.reviewDraft(w,c,'auto1');assert.equal(reviewed.drafts[0].status,'approved');assert.throws(()=>e.simulate(reviewed,c,'auto1',true,'send',later),/Confirm/);
 for(const patch of [{source:'Zenlist'},{dnc:true},{pathId:'hygiene'},{outcomeId:'stop'}])assert.throws(()=>e.prepare(e.emptyWorkspace(),{...c,...patch},'blocked',now));
});
test('recorded intent and cadence stage autofill conservative nurture wording',()=>{
 const c=e.contextFor({id:42,name:'Sample Seller',stage:'Lead',cadenceStage:'Nurture',leadLane:'seller',contactContext:{kind:'long-term',condition:'Only if plans change next year'}});
 assert.equal(c.pathId,'conditional');assert.equal(c.outcomeId,'not-ready');assert.match(e.prepare(e.emptyWorkspace(),c,'auto2',now).drafts[0].body,/later check-in|when we check in|check back|pause here/);
 assert.equal(e.contextFor({id:43,stage:'Nurture',leadLane:'buyer'}).pathId,'timing');
 assert.equal(e.contextFor({id:44,leadLane:'buyer',contactContext:{kind:'attempted'}}).outcomeId,'no-response');
 assert.equal(e.contextFor({id:45,contextConflict:true}).pathId,'hygiene');
});
test('email fallback respects do-not-text without granting email permission',()=>{
 const c=e.contextFor({id:42,phones:['555'],emails:['sample@example.test'],raw:{doNotText:true}});
 assert.equal(c.channel,'email');assert.equal(c.dnc,false);assert.equal(c.consent,false);
 assert.equal(e.contextFor({id:43,raw:{doNotText:true,doNotEmail:true}}).dnc,true);
});
const {messagingQueue,hasRecordedConversation}=require('../lib/appointment/priority.ts');
const queued=(id,extra={},item={})=>({leadId:String(id),effectiveOwnerId:30,priorityScore:100,priorityLabel:'Today',position:id,relationship:{},lead:{id,name:'Synthetic '+id,stage:'Lead',source:'Website',leadLane:'buyer',cadenceStatus:'overdue',...extra},...item});
test('equal or missing creation times prioritize no recorded conversation, then cadence urgency',()=>{
 const items=[queued(1,{documentedContactAt:now.toISOString(),cadenceDaysLate:30},{priorityLabel:'Immediate'}),queued(2,{cadenceStatus:'due'}),queued(3,{cadenceDaysLate:2}),queued(4,{cadenceDaysLate:6})];
 assert.deepEqual(messagingQueue(items,30,now.getTime()).map(x=>x.id),['4','3','2','1']);
 assert.equal(hasRecordedConversation({brokerOutreachAt:now.toISOString(),lastCommunicationAt:now.toISOString(),contactContext:{kind:'attempted'}}),false);
 assert.equal(hasRecordedConversation({contactContext:{contactEstablished:true}}),true);
 assert.deepEqual(messagingQueue([queued(1,{documentedContactAt:now.toISOString()}),queued(2,{customerResponseAt:now.toISOString()}),queued(3)],30,now.getTime()).map(x=>x.id),['3','2','1']);
});
test('message list cannot resurrect suppressed roster leads, future followups, duplicate sources or other brokers',()=>{
 const items=[queued(1),queued(2,{source:'Zenlist'}),queued(3,{stage:'Recruiting'}),queued(4,{leadLane:'renter'}),queued(5,{}, {effectiveOwnerId:31}),queued(6,{cadenceStatus:'current',brokerOutreachAt:now.toISOString()}),queued(7,{nextActionAt:later.toISOString()}),queued(8,{contextConflict:true}),queued(9,{raw:{doNotContact:true}})];
 assert.deepEqual(messagingQueue(items,30,now.getTime()).map(x=>x.id),['1']);assert.deepEqual(messagingQueue(items,null),[]);
 const routed=queued(10,{assignedUserId:31},{effectiveOwnerId:30});assert.equal(messagingQueue([routed],30).length,1);
 assert.equal(messagingQueue([queued(11,{cadenceStatus:'current'},{relationship:{recentRequest:true}})],30).length,1);
});

test('newest original creation sorts first regardless of activity updates, with invalid dates last',()=>{
 const items=[queued(1,{createdAt:'2026-11-10T12:00:00Z',updatedAt:now.toISOString()}),queued(2,{createdAt:'2026-11-12T12:00:00Z',documentedContactAt:now.toISOString()}),queued(3,{createdAt:'2026-11-11T12:00:00Z'}),queued(4,{createdAt:'invalid'}),queued(5,{createdAt:'2099-01-01T00:00:00Z'})];
 assert.deepEqual(messagingQueue(items,30,now.getTime()).map(x=>x.id),['2','3','1','4','5']);
});

test('unmapped nurture is held for planning and an existing appointment cannot get a generic acquisition draft',()=>{
 const unknown=e.contextFor({id:42,stage:'Nurture',leadLane:'seller',cadenceStatus:'unknown'});
 assert.equal(unknown.pathId,'timing');assert.equal(unknown.cadencePlanningRequired,true);assert.throws(()=>e.prepare(e.emptyWorkspace(),unknown,'plan',now),/follow-up plan/i);
 const booked=e.contextFor({id:43,stage:'Appointment Set',leadLane:'buyer'});
 const fresh=e.contextFor({id:44,stage:'Nurture',cadenceStatus:'unknown',handRaiseAt:'2026-01-01T00:00:00Z',customerResponseAt:new Date(Date.now()-60000).toISOString(),brokerOutreachAt:'2026-01-01T00:00:00Z'});assert.equal(fresh.cadencePlanningRequired,undefined);
 assert.equal(booked.outcomeId,'appointment-set');assert.throws(()=>e.prepare(e.emptyWorkspace(),booked,'booked',now),/appointment/);
 const planning=queued(42,{stage:'Nurture',cadenceStatus:'unknown'});
 assert.deepEqual(messagingQueue([planning],30,now.getTime()),[]);
});
