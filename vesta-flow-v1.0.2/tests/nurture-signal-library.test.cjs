const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const e=require('../lib/appointment/nurture/engine.ts');
const NOW='2026-11-21T20:00:00Z',CUTOFF='2026-11-21T19:50:00Z';
function base(id='OUT-001'){
 const t=e.library.techniques.find(t=>t.id===id),fact=(value,kind='customer-statement')=>({personId:'42',sourceId:'fub:notes:1',kind,value,at:'2026-08-21T15:00:00Z',verified:true,customerSafe:true});
 const facts=Object.fromEntries(t.requiredFacts.map(k=>[k,fact('Verified sample')]));
 for(const m of e.library.messages.filter(m=>m.techniqueId===id))for(const k of m.requiredSlots)if(k!=='broker_name')facts[k]=fact(k==='resource_link'?'https://example.com/review':k.replaceAll('_',' '),m.slotKinds[k]);
 return {personId:'42',ownerId:'7',senderBrokerId:'7',firstName:'Jordan',brokerName:'Sample Broker',identityVerified:true,ownerVerified:true,sopVersion:'synthetic-reviewed-sop-v1',channel:'sms',channelPermitted:true,stageEligible:true,duplicateConflict:false,coverageComplete:true,cadenceDue:true,latestEvidenceAt:CUTOFF,evidenceCutoff:CUTOFF,pendingCustomerReply:false,signals:[{code:t.signalCode,personId:'42',sourceIds:['fub:notes:1'],observedAt:CUTOFF,eventAt:'2026-08-21T15:00:00Z',validUntil:'2026-11-22T20:00:00Z',status:'approaching',verified:true,reviewedApproachIds:t.approaches.map(a=>a.id)}],facts,conversations:[],history:[],now:NOW,timeZone:'America/Chicago'};
}
function sent(p,extra={}){return {personId:'42',contentId:p.contentId,techniqueId:p.techniqueId,approachId:p.approachId,phase:'opening',channel:'sms',body:p.body,at:'2026-11-21T19:00:00Z',signalKey:p.signalKey,kind:'sent',...extra};}
test('all original 60 techniques and 180 approaches have complete channel and followup coverage',()=>{
 assert.equal(e.library.techniques.length,60);assert.equal(e.library.messages.length,1080);assert.equal(new Set(e.library.messages.map(m=>m.id)).size,1080);assert.equal(new Set(e.library.messages.map(m=>m.contentId)).size,540);
 for(const t of e.library.techniques){assert.equal(t.approaches.length,3);assert.ok(t.requiredFacts.length);for(const a of t.approaches){assert.equal(a.messages.length,6);for(const ch of ['sms','email'])for(const ph of ['opening','follow-up','alternate-angle'])assert.equal(e.library.messages.filter(m=>m.approachId===a.id&&m.channel===ch&&m.phase===ph).length,1);}}
});
test('every approach renders and every followup has a verifiable prior-send precondition',()=>{
 for(const t of e.library.techniques)for(const a of t.approaches)for(const ch of ['sms','email']){
  const c={...base(t.id),channel:ch};const p=e.propose(c,{approachId:a.id});assert.equal(p.status,'broker-review',a.id+' '+ch);assert.ok(!p.body.includes('{{'));assert.equal((p.body.match(/\?/g)||[]).length,1,a.id);assert.ok(p.evidenceIds.length);
  assert.equal(e.propose(c,{approachId:a.id,phase:'follow-up'}).status,'hold');
  for(const phase of ['follow-up','alternate-angle']){const q=e.propose({...c,history:[sent(p)]},{approachId:a.id,phase});assert.equal(q.status,'broker-review',a.id+' '+phase);assert.notEqual(q.body,p.body);}
 }
});
test('an August hook requires a verified same-person, same-sender personal exchange',()=>{
 const c=base(),event={personId:'42',sourceId:'call:5',at:'2026-08-13T15:00:00Z',senderBrokerId:'7',participants:['7'],channel:'call',personal:true,connected:true,verified:true};
 assert.match(e.historyHook({...c,conversations:[event]}).text,/August 2026/);
 for(const bad of [{personId:'43'},{senderBrokerId:'8'},{participants:['8']},{connected:false},{personal:false},{verified:false},{at:'2027-08-13T15:00:00Z'}])assert.equal(e.historyHook({...c,conversations:[{...event,...bad}]}).text,'');
 assert.match(e.historyHook({...c,conversations:[{...event,channel:'chat'}]}).text,/messages/);
 assert.doesNotMatch(e.propose(c).body,/spoke|conversation from|exchanged messages/);
});
test('holds protect live context, consent, pauses, exclusions and conflicted signals',()=>{
 const c=base();for(const x of [{duplicateConflict:true},{identityVerified:false},{ownerVerified:false},{senderBrokerId:'9'},{coverageComplete:false},{cadenceDue:false},{channelPermitted:false},{stageEligible:false},{sopVersion:''},{pauseUntil:'2026-12-01T00:00:00Z'},{latestEvidenceAt:'2026-11-21T19:55:00Z'}])assert.equal(e.propose({...c,...x}).status,'hold');
 for(const status of ['withdrawn','contradicted'])assert.equal(e.propose({...c,signals:[{...c.signals[0],status}]}).status,'hold');
 assert.equal(e.propose({...c,signals:[{...c.signals[0],reviewedApproachIds:[]}]}).status,'hold');
});
test('unverified or wrong-person facts never become a promised attachment or property fact',()=>{
 for(const id of ['OUT-021','OUT-032','OUT-041']){const c=base(id),m=e.library.messages.find(m=>m.techniqueId===id&&m.phase==='opening'&&m.approachId.endsWith('-A')&&m.channel==='sms'),key=m.requiredSlots.find(k=>k!=='broker_name');for(const patch of [{verified:false},{customerSafe:false},{personId:'999'},{at:'2027-01-01T00:00:00Z'},{kind:'unreviewed-note'},{value:'{{invented}}'}])assert.equal(e.propose({...c,facts:{...c.facts,[key]:{...c.facts[key],...patch}}},{approachId:id+'-A'}).status,'hold',id+JSON.stringify(patch));}
});
test('sent content cannot be repeated by switching channel or changing the greeting',()=>{
 const c=base(),p=e.propose(c);const q=e.propose({...c,channel:'email',history:[sent(p)]},{approachId:p.approachId});assert.equal(q.status,'hold');
 assert.equal(e.propose({...c,history:[sent(p,{kind:'held'})]},{approachId:p.approachId,phase:'follow-up'}).status,'hold');
});
test('a pending customer question suppresses nurture and only a matching current inquiry can be drafted',()=>{
 const c=base();assert.equal(e.propose({...c,pendingCustomerReply:true,pendingCustomerReplyAt:CUTOFF}).status,'hold');
 const n=base('OUT-041');assert.equal(e.propose({...n,pendingCustomerReply:true,pendingCustomerReplyAt:CUTOFF}).status,'hold');
 const current={...n,pendingCustomerReply:true,pendingCustomerReplyAt:CUTOFF,signals:[{...n.signals[0],eventAt:CUTOFF}]};assert.equal(e.propose(current).status,'broker-review');
});
test('edited draft recheck detects evidence, owner and send-history changes',()=>{
 const c=base(),p=e.propose(c);assert.equal(e.recheck(p,c).ok,true);
 assert.equal(e.recheck(p,{...c,evidenceCutoff:NOW,latestEvidenceAt:NOW}).ok,false);
 assert.equal(e.recheck(p,{...c,history:[sent(p)]}).ok,false);
 const k=e.library.techniques[0].requiredFacts[0];assert.equal(e.recheck(p,{...c,facts:{...c.facts,[k]:{...c.facts[k],value:'Changed evidence'}}}).ok,false);
});
test('no built-in sends, forced intervals or claimed performance lift',()=>{
 assert.equal(e.library.liveConnected,false);const code=fs.readFileSync(require.resolve('../lib/appointment/nurture/engine.ts'),'utf8');assert.doesNotMatch(code,/fetch\(|setInterval\(|localStorage|process\.env|sendMessage\(/);
 for(const m of e.library.messages){assert.ok(m.core.length<600);assert.doesNotMatch(m.core,/last chance|guaranteed|you never replied|did not hear back|prices are rising/i);}
});
