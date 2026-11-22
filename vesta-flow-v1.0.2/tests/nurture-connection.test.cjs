const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},resolveJsonModule:true}).outputText,f);
const a=require('../lib/appointment/nurture/connection.ts'),n=require('../lib/appointment/nurture/engine.ts'),e=require('../lib/appointment/engine.ts'),ed=require('../lib/appointment/editor.ts');
const now=new Date('2026-11-21T20:00:00Z'),availability=Object.fromEntries(['notes','calls','textMessages'].map(k=>[k,{ok:true}]));
const lead={id:'42',name:'Synthetic Buyer',assignedUserId:7,assignedUserName:'Synthetic Broker',createdAt:'2026-01-01T00:00:00Z',stage:'Lead',source:'Website',cadenceStatus:'due',leadLane:'buyer',decisionSnapshotId:'s1'};
const packet=(collections={})=>a.nurturePacket(lead,collections,availability,true),input=(p=packet())=>({leadId:'42',name:'Synthetic',channel:'sms',packet:p,drafts:[],history:[],now});
const selection=(id,p=packet())=>({techniqueId:id,approachId:id+'-A',phase:'opening',sourceId:p.sources.at(-1).id,values:{},reviewed:true,reviewedAt:now.toISOString()});
test('all non-property scenarios and their opening approaches can produce evidence-reviewed drafts',()=>{
 let count=0;for(const t of n.library.techniques)for(const approach of t.approaches){const s={...selection(t.id),approachId:approach.id};for(const key of a.requiredFields(s,'sms'))s.values[key]='Broker verified supporting fact';const p=a.connectedProposal({...input(),selection:s});if(a.propertyTechniqueBlocked(s,'sms')){assert.equal(p.reason,'property-insertion-disabled');continue;}assert.equal(p.status,'broker-review',approach.id+JSON.stringify(p));assert.ok(!p.body.includes('{{'));assert.equal(p.sent,false);count++;}assert.ok(count>130);
});
test('automatic drafting neither invents familiarity nor repeats a core after refresh or channel switch',()=>{
 let c={...e.contextFor({...lead,nurturePreparation:packet()}),consent:true,identityVerified:true},w=e.prepare(e.emptyWorkspace(),c,'one',now);assert.equal(w.drafts[0].nurture.techniqueId,'OUT-059');assert.doesNotMatch(w.drafts[0].body,/we spoke|our conversation/);
 w=e.prepare(e.restore(JSON.parse(JSON.stringify(w))),{...c,channel:'email'},'two',now);assert.notEqual(w.drafts[1].nurture.contentId,w.drafts[0].nurture.contentId);
 const saved=ed.saveWorkingText(w,'two','Broker edited this.',now);assert.equal(e.restore(JSON.parse(JSON.stringify(saved))).drafts[1].body,'Broker edited this.');assert.equal(e.draftDisposition(saved.drafts[1],{...c,snapshotId:'s2'}),'keep-edits');
});
test('property activity offers help without revealing tracking and an inbound question outranks it',()=>{
 const activity={id:5,personId:42,created:'2026-11-21T18:00:00Z',type:'Viewed Property'},p=packet({events:[activity]});assert.equal(a.connectedProposal(input(p)).techniqueId,'OUT-042');assert.doesNotMatch(a.connectedProposal(input(p)).body,/viewed|tracking|committed/);
 const reply=packet({events:[activity],textMessages:[{id:9,created:'2026-11-21T19:00:00Z',direction:'inbound',message:'What about the HOA?'}]});const proposal=a.connectedProposal(input(reply));assert.equal(proposal.techniqueId,'OUT-041');assert.match(proposal.body,/one detail/);
});
test('specific scenarios require review and correct source/person/owner, and incomplete coverage blocks',()=>{
 assert.equal(a.connectedProposal({...input(),packet:{...packet(),personId:'99'}}).status,'hold');assert.equal(a.connectedProposal({...input(),packet:{...packet(),ownerId:''}}).status,'hold');assert.equal(a.connectedProposal({...input(),packet:{...packet(),coverageComplete:false}}).status,'hold');
 assert.equal(a.connectedProposal({...input(),selection:{...selection('OUT-011'),reviewed:false}}).status,'hold');assert.equal(a.connectedProposal({...input(),selection:selection('OUT-011')}).reason,'required-evidence-missing');
});
test('customer conditions win over a ready outcome or a manually chosen scenario',()=>{
 const c={...e.contextFor({...lead,nurturePreparation:packet()}),condition:'Only if plans change next year',outcomeId:'ready'};
 const w=e.prepare(e.emptyWorkspace(),c,'wait',now);assert.equal(w.drafts[0].nurture.techniqueId,'OUT-060');assert.doesNotMatch(w.drafts[0].body,/tour|appointment|ready to buy/);
 assert.throws(()=>e.prepare(e.emptyWorkspace(),{...c,nurtureSelection:selection('OUT-011')},'bad',now),/customer-timing/);
});
test('followups require an actual matching outbound owner message; Copy/Hold and another sender do not earn one',()=>{
 const first=a.connectedProposal(input()),d={leadId:'42',body:first.body,at:now.toISOString(),nurture:first},s={...selection('OUT-059'),phase:'follow-up',values:{},reviewedAt:'2026-11-22T20:00:00Z'};for(const k of a.requiredFields(s,'sms'))s.values[k]='Verified';
 const later=new Date('2026-11-22T20:00:00Z');assert.equal(a.connectedProposal({...input(),selection:s,drafts:[d],now:later}).status,'hold');
 const sent={id:'fub:textMessages:99',at:'2026-11-22T19:00:00Z',kind:'textMessages',text:first.body,outbound:true,brokerId:'7'},p={...packet(),sources:[sent,...packet().sources]};
 assert.equal(a.connectedProposal({...input(p),selection:s,drafts:[d],now:later}).status,'broker-review');assert.equal(a.connectedProposal({...input({...p,sources:[{...sent,brokerId:'8'},...packet().sources]}),selection:s,drafts:[d],now:later}).status,'hold');
});
test('only explicit connected calls by the same broker add a dated history hook',()=>{
 for(const row of [{id:1,created:'2026-08-01T10:00:00Z',userId:7,duration:30,outcome:'No answer'},{id:2,created:'2026-08-01T10:00:00Z',userId:8,duration:30,outcome:'Connected'}])assert.doesNotMatch(a.connectedProposal(input(packet({calls:[row]}))).body,/August/);
 assert.match(a.connectedProposal(input(packet({calls:[{id:3,created:'2026-08-01T10:00:00Z',userId:7,duration:30,outcome:'Connected'}]}))).body,/August 2026/);
});
test('expired broker confirmation cannot be copied, even if saved evidence has not changed',()=>{
 const current=new Date(),p=packet(),s={...selection('OUT-059'),reviewedAt:current.toISOString(),values:{permitted_relationship_context:'Verified relationship context'}};
 const c={...e.contextFor({...lead,nurturePreparation:p}),nurtureSelection:s};const w=e.prepare(e.emptyWorkspace(),c,'review-expiry',current);
 assert.equal(e.reviewDraft(w,c,'review-expiry').drafts[0].status,'approved');
 const expired={...c,nurtureSelection:{...s,reviewedAt:'2025-01-01T00:00:00Z'}},old={...w,drafts:w.drafts.map(d=>({...d,contextKey:e.contextKey(expired)}))};assert.throws(()=>e.reviewDraft(old,expired,'review-expiry'),/scenario-review-expired/);
});
