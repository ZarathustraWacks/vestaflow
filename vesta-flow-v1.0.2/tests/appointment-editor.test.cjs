const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const e=require('../lib/appointment/engine.ts'),a=require('../lib/appointment/editor.ts');
const lead=(id='42',extra={})=>({id,name:'Synthetic Buyer '+id,stage:'Lead',source:'Website',phones:['555'],emails:['buyer@example.test'],leadLane:'buyer',decisionSnapshotId:'s1',...extra});
const fresh=()=>e.contextFor(lead()),draft=()=>e.prepare(e.emptyWorkspace(),fresh(),'d1');
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
test('typing survives reload without Copy or Hold, and removes previous approval',()=>{
 const original=e.reviewDraft(draft(),fresh(),'d1'),edited=a.saveWorkingText(original,'d1','My exact work, before I clicked anything.');
 const storage=store();a.persistWorkspace(storage,'broker:7',null,edited);const reloaded=e.restore(JSON.parse(storage.getItem('broker:7')));
 assert.equal(reloaded.drafts[0].body,'My exact work, before I clicked anything.');assert.equal(reloaded.drafts[0].approvedKey,null);assert.equal(reloaded.drafts[0].status,'draft');assert.equal(reloaded.results.length,0);assert.equal(reloaded.held.length,0);
});
test('many keystrokes preserve original proposal without consuming history per character',()=>{
 let w=draft();const original=w.history[0].body;for(let i=1;i<=500;i++)w=a.saveWorkingText(w,'d1','x'.repeat(i));
 assert.equal(w.history.length,2);assert.equal(w.history[0].body,original);assert.equal(w.history[1].body,'x'.repeat(500));assert.equal(w.drafts[0].body,'x'.repeat(500));
});
test('contact switching restores each contact wording independently',()=>{
 let w=a.saveWorkingText(draft(),'d1','Message for Buyer 42');w=e.prepare(w,e.contextFor(lead('43')),'d2');w=a.saveWorkingText(w,'d2','Different message for Buyer 43');w=e.restore(JSON.parse(JSON.stringify(w)));
 assert.equal(w.drafts.find(d=>d.leadId==='42').body,'Message for Buyer 42');assert.equal(w.drafts.find(d=>d.leadId==='43').body,'Different message for Buyer 43');
});
test('outcome, channel, condition, manager direction and feedback survive remount',()=>{
 const base=fresh(),chosen={...base,outcomeId:'ready',pathId:'seller',condition:'Only after a callback',conditionCleared:true,managerReason:'Broker knows client',channel:'email',consent:true,identityVerified:true};
 const w=e.restore(JSON.parse(JSON.stringify(a.rememberEditor(draft(),chosen,base,'Keep this training feedback.'))));const r=a.resumeEditor(w,lead());
 for(const k of ['outcomeId','pathId','condition','conditionCleared','managerReason','channel'])assert.equal(r.context[k],chosen[k]);assert.equal(r.holdReason,'Keep this training feedback.');assert.equal(r.context.consent,false);assert.equal(r.context.identityVerified,false);assert.equal(w.selectedLeadId,'42');
});
test('routine new publication retains saved context choices, but requires fresh draft review',()=>{
 const base=fresh(),chosen={...base,pathId:'finance',outcomeId:'reply'};let w=a.rememberEditor(a.saveWorkingText(draft(),'d1','Edited before refresh'),chosen,base);
 const r=a.resumeEditor(w,lead('42',{decisionSnapshotId:'s2'}));assert.equal(r.context.pathId,'finance');assert.equal(r.context.snapshotId,'s2');assert.equal(e.draftDisposition(w.drafts[0],r.context),'keep-edits');assert.throws(()=>e.reviewDraft(w,r.context,'d1'),/changed/);assert.equal(w.drafts[0].body,'Edited before refresh');
});
test('new FUB intent cannot be overwritten by stale saved context, and old choices are retained for recovery',()=>{
 const base=fresh();const w=a.rememberEditor(draft(),{...base,conditionCleared:true,pathId:'new'},base);const r=a.resumeEditor(w,lead('42',{contactContext:{kind:'long-term',condition:'Wait until next year'}}));
 assert.equal(r.choicesChanged,true);assert.equal(r.context.condition,'Wait until next year');assert.equal(r.context.conditionCleared,false);assert.equal(w.editors['42'].context.conditionCleared,true);
});
test('current channel-specific opt-out wins over saved email selection',()=>{
 const base=fresh(),w=a.rememberEditor(draft(),{...base,channel:'email'},base);const r=a.resumeEditor(w,lead('42',{raw:{doNotEmail:true}}));assert.equal(r.context.dnc,true);assert.equal(r.context.sourceDnc,true);assert.ok(e.preparationGate(r.context));
});
test('broker storage remains isolated and stale tab cannot overwrite saved work',()=>{
 const s=store();const first=a.persistWorkspace(s,'broker:7',null,draft());const changed=a.saveWorkingText(draft(),'d1','Saved from first tab');a.persistWorkspace(s,'broker:7',first,changed);
 assert.throws(()=>a.persistWorkspace(s,'broker:7',first,draft()),/Another tab/);a.persistWorkspace(s,'broker:8',null,draft());assert.equal(JSON.parse(s.getItem('broker:7')).drafts[0].body,'Saved from first tab');assert.notEqual(s.getItem('broker:8'),s.getItem('broker:7'));
});
test('storage failure is surfaced without claiming a successful save or changing prior data',()=>{
 const prior=JSON.stringify(draft()),s={getItem:()=>prior,setItem:()=>{throw new Error('quota exceeded')}};assert.throws(()=>a.persistWorkspace(s,'broker:7',prior,a.saveWorkingText(draft(),'d1','Still on screen')),/quota/);assert.equal(s.getItem(),prior);
});
test('old workspaces migrate without clearing drafts, while malformed editor state fails closed',()=>{
 const w=draft();assert.equal(e.restore(w).drafts[0].body,w.drafts[0].body);assert.throws(()=>e.restore({...w,editors:{'42':{}}}),/editor choices/);
});
test('held examples remain immutable, and autosaving cannot simulate delivery or completion',()=>{
 const c=fresh(),w=e.hold(draft(),c,'d1','Review','h1');assert.throws(()=>a.saveWorkingText(w,'d1','Overwrite held example'),/editable/);assert.equal(w.results.length,0);assert.equal(w.held[0].sent,false);
});
