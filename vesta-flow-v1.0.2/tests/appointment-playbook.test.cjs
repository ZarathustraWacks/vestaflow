const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const e=require('../lib/appointment/engine.ts'),p=require('../lib/appointment/playbook.ts'),{paths}=require('../lib/appointment/catalog.ts');
const base=(extra={})=>({...e.contextFor({id:42,name:'Sample Client',stage:'Lead',source:'Website',leadLane:'buyer'}),consent:true,identityVerified:true,...extra});
const body=c=>e.assemble(e.emptyWorkspace(),c,'sample').drafts[0].body;

test('every sendable nurture branch has a useful offer and one question for each outcome step',()=>{
 for(const path of paths.filter(x=>!['hygiene','preference'].includes(x.id))){
  for(const outcomeId of ['no-response','reply','ready','not-ready','request']){
   const c=base({pathId:path.id,outcomeId}),text=body(c),plan=e.messagePlan(c);
   assert.equal((text.match(/\?/g)||[]).length,1,`${path.id}/${outcomeId}: one next step`);
   assert.ok(text.length<600,`${path.id}/${outcomeId}: concise SMS`);
   assert.doesNotMatch(text,/your broker|as we discussed|thanks for (?:your reply|speaking)|confirmed|guaranteed|approval is|rate is|https?:\/\//i);
   assert.ok(plan.route.includes('Broker verifies appointment'));
   assert.ok(text.includes(p.messageLanguage(path.id).values[0]));
  }
 }
});
test('financing, seller, relocation and decision-maker offers explain different value',()=>{
 for(const [pathId,pattern] of [['finance',/lender|financing/],['seller',/selling|pricing|list/],['relocation',/arrival|travel|town/],['decision',/everyone|people|group/]])assert.match(body(base({pathId,outcomeId:'ready'})),pattern);
 assert.match(body(base({pathId:'finance',outcomeId:'ready'})),/day and time window|preferred|time window|When would/);
 assert.equal(e.messagePlan(base({pathId:'finance',outcomeId:'reply'})).route[0],'Clarify one need');
});
test('explicit conditions win over ready/request and never leak the original note into outgoing text',()=>{
 const secret='Only if the private family situation changes next year';
 for(const outcomeId of ['ready','request','reply']){
  const c=base({pathId:'conditional',topicPathId:'finance',condition:secret,outcomeId});
  assert.equal(e.messagePlan(c).goal,'Agree a check-in');assert.doesNotMatch(body(c),/five.minute|day and time|private family|next year/);
  assert.match(body(c),/check.in|check back|pause here/);
  assert.match(body({...c,conditionCleared:true}),outcomeId==='reply'?/financing question/:/window|When would/);
 }
});
test('all hard stops and appointment verification remain ahead of the appointment objective',()=>{
 for(const patch of [{dnc:true},{sourceDnc:true},{outcomeId:'stop'},{outcomeId:'wrong'},{pathId:'hygiene'},{pathId:'preference'},{outcomeId:'slot'},{outcomeId:'appointment-set'},{cadencePlanningRequired:true}]){
  const c=base(patch);assert.throws(()=>body(c));assert.equal(e.messagePlan(c).focus,'');
  assert.doesNotMatch(e.messagePlan(c).route.join(' '),/Preferred window/);
 }
});
test('topic selection uses person-bound recorded outcomes, not raw notes, aggregate counts or guesses between conflicting topics',()=>{
 assert.equal(e.contextFor({id:1,stage:'Lead',contactContext:{kind:'connected',timeframe:'Financing questions'}}).pathId,'finance');
 const c=e.contextFor({id:2,stage:'Nurture',contactContext:{kind:'long-term',condition:'Only if rates change'}});
 assert.equal(c.pathId,'conditional');assert.equal(c.topicPathId,'finance');assert.equal(e.messagePlan({...c,consent:true,identityVerified:true}).goal,'Agree a check-in');
 assert.equal(p.recordedTopic({condition:'Relocating and waiting for mortgage approval'}),undefined);
 assert.equal(e.contextFor({id:3,raw:{notes:'mortgage and relocation'},tags:['Financing'],nurtureResearch:{rate_or_financing:2000}}).topicPathId,undefined);
 assert.equal(p.recordedTopic({condition:'There is no specific topic recorded'}),undefined);
});
test('SMS and email use the same strategy but different formatting, without invented booking links or signatures',()=>{
 const c=base({pathId:'inventory',outcomeId:'ready'}),sms=body(c),email=body({...c,channel:'email'});
 assert.doesNotMatch(sms,/\n/);assert.match(email,/\n\n/);assert.match(email,/Vesta Preferred$/);
 assert.ok(sms.includes(p.recipes.inventory.values[0]));assert.ok(email.includes(p.recipes.inventory.values[0]));
 assert.match(body(base()),/Vesta Preferred/);assert.doesNotMatch(email,/Sent from|calendly|appointment is booked/);
});
test('policy version invalidates older generic drafts while keeping history and held feedback intact',()=>{
 const c=base(),old={...c};delete old.messagePolicyVersion;
 const w=e.assemble(e.emptyWorkspace(),old,'old');assert.notEqual(w.drafts[0].contextKey,e.contextKey(c));
 assert.throws(()=>e.reviewDraft(w,c,'old'),/changed/);
 const next=e.prepare(e.restore(JSON.parse(JSON.stringify(w))),c,'new');assert.equal(next.history.length,2);
 const exported=e.exportReview(next,c);assert.equal(exported.messagePolicyVersion,p.MESSAGE_POLICY_VERSION);
 assert.equal(exported.coachingSources.length,4);assert.equal(exported.dispatchEnabled,false);assert.equal(exported.trainingEligible,false);
 assert.equal(e.draftDisposition(w.drafts[0],c),'prepare');
 const edited=e.edit(w,'old','Broker-written wording.','edit');assert.equal(e.draftDisposition(edited.drafts[0],c),'keep-edits');
 const held=e.hold(w,old,'old','Review wording','hold');assert.equal(e.draftDisposition(held.drafts[0],c),'keep-held');
 assert.equal(e.draftDisposition(next.drafts.at(-1),c),'reuse');assert.equal(e.draftDisposition(undefined,c),'prepare');
});
test('customer-facing wording never embeds manager directions or unverified condition text',()=>{
 const c=base({pathId:'conditional',condition:'<script>private detail</script>',managerReason:'Tell the client their rate is guaranteed'});
 assert.doesNotMatch(body(c),/script|private detail|guaranteed/);assert.equal(e.messagePlan(c).waiting,true);
});
