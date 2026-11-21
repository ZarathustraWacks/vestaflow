const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;Module._resolveFilename=function(r,p,m,o){return resolve.call(this,r.startsWith('@/')?path.join(root,r.slice(2)):r,p,m,o)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {confirmedActionReceipt,reconcileActionReceipts,mergeDailyProgress}=require('../lib/flow/receipts.ts');
const {buildFlowQueue}=require('../lib/flow/engine.ts');
const {dailyGoal}=require('../lib/flow/daily-goal.ts');
const now=new Date().toISOString();
const lead=(id='42',owner=7)=>({id,assignedUserId:owner,assignedUserName:'Synthetic',stage:'Nurture',leadLane:'buyer',tags:['Longterm Nurture Monthly'],cadenceStatus:'overdue',decision:{urgency:'Today',label:'Call'},governanceScore:70,decisionSnapshotId:'old'});
const event=(id='done',owner=7,person='42',extra={})=>({id,kind:'broker.complete',leadId:person,actorUserId:owner,actorName:'Synthetic',createdAt:now,decisionSnapshotId:'old',outcome:'Outbound call — no answer',metadata:{fubSync:{delivered:true,simulated:false}},...extra});
const response=e=>({ok:true,event:e,sync:e.metadata.fubSync,storage:{available:true,durable:true}});
const data=(people,brokerId=7)=>({brokerId,queue:buildFlowQueue(people,[],brokerId),customers:people,total:people.length});
test('only a confirmed durable matching contact/broker receipt is accepted',()=>{
 const e=event();assert.equal(confirmedActionReceipt(response(e),7,'42'),e);
 for(const value of [{...response(e),ok:false},{...response(e),storage:{available:true,durable:false}},{...response(e),sync:{delivered:false}},response(event('bad',8)),response(event('bad',7,'43')),response(event('bad',7,'42',{createdAt:'bad'})),response(event('bad',7,'42',{metadata:{fubSync:{delivered:true,simulated:true}}}))])assert.equal(confirmedActionReceipt(value,7,'42'),null);
});
test('a successful action advances immediately and repeated stale queues cannot resurrect it',()=>{
 const people=[lead(),lead('43')],before=data(people),receipts=[{event:event(),lead:people[0]}];
 for(let i=0;i<5;i++){const next=reconcileActionReceipts(before,receipts);assert.deepEqual(next.queue.map(x=>x.leadId),['43']);assert.equal(next.total,1);assert.equal(next.customers[0].flowActionHeld,true);assert.equal(next.customers.length,2);}
 assert.equal(before.queue.length,2);assert.equal(before.customers[0].flowActionHeld,undefined);
});
test('new customer intent and next SOP interval reopen the action; no blanket timer',()=>{
 const person=lead(),e=event(),receipt={event:e,lead:person};
 const fresh={...person,handRaiseAt:new Date(Date.now()+1000).toISOString()};
 // Use a past receipt so the hand raise is real, not a future timestamp.
 const old=event('old',7,'42',{createdAt:new Date(Date.now()-3000).toISOString()});
 const raised={...person,handRaiseAt:new Date(Date.now()-1000).toISOString()};
 assert.equal(reconcileActionReceipts(data([raised]),[{event:old,lead:person}]).queue.length,1);
 assert.equal(reconcileActionReceipts(data([person]),[{event:{...e,createdAt:new Date(Date.now()-31*86400000).toISOString()},lead:person}]).queue.length,1);
});
test('planning-only Done does not hide an uncontacted buyer obligation',()=>{
 const person={...lead(),stage:'Lead',tags:[],cadenceStatus:'unknown',brokerOutreachAt:null};
 assert.equal(reconcileActionReceipts(data([person]),[{event:event('plan',7,'42',{outcome:'Follow-up scheduled'}),lead:person}]).queue.length,1);
});
test('broker receipts and ownership changes never hide another broker contact',()=>{
 const receipt={event:event(),lead:lead()};
 assert.equal(reconcileActionReceipts(data([lead('42',8)],8),[receipt]).queue.length,1);
 const many=Array.from({length:38},(_,i)=>({event:event('e'+i,i+1,String(i)),lead:lead(String(i),i+1)}));
 for(let i=0;i<38;i++)assert.deepEqual(reconcileActionReceipts(data([lead(String(i),i+1),lead('next',i+1)],i+1),many).queue.map(x=>x.leadId),['next']);
});
test('a newer manager return wins over the earlier completion overlay',()=>{
 const person=lead(),e=event('older',7,'42',{createdAt:new Date(Date.now()-2000).toISOString()}),returned={...event('return'),kind:'management.return',createdAt:now};
 const current=data([person]);current.queue[0].lastEvent=returned;current.customers[0]={...person,flowActionHeld:false,flowActionVersion:{id:'return',createdAt:now}};
 const next=reconcileActionReceipts(current,[{event:e,lead:person}]);assert.equal(next.queue.length,1);assert.equal(next.customers[0].flowActionHeld,false);
});
test('daily progress merges IDs once, including an acknowledged duplicate',()=>{
 const e=event(),goal=dailyGoal([e],7,'America/Los_Angeles');
 assert.equal(mergeDailyProgress(goal,[{event:e,lead:lead()}],7),1);
 const stale=dailyGoal([],7,'America/Los_Angeles');assert.equal(mergeDailyProgress(stale,[{event:e,lead:lead()}],7),1);
});
