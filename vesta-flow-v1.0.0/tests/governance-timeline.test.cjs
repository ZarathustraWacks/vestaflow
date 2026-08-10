const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');

const root=path.resolve(__dirname,'..');
const originalResolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,isMain,options){
  if(request.startsWith('@/'))request=path.join(root,request.slice(2));
  return originalResolve.call(this,request,parent,isMain,options);
};
require.extensions['.ts']=function(module,filename){
  const source=fs.readFileSync(filename,'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  module._compile(output,filename);
};

const {classifyBusinessSegment,normalizePersonBase,normalizeTask,normalizeUser}=require('../lib/fub/normalize.ts');
const {enrichLead}=require('../lib/spine/governance.ts');
const {buildTimeline}=require('../lib/spine/timeline.ts');
const {auditAppointments}=require('../lib/policy/appointments.ts');
const {listingProcess}=require('../lib/integrations/listing.ts');
const {buildFlowQueue,buildManagementExceptions}=require('../lib/flow/engine.ts');

const iso=(offsetDays)=>new Date(Date.now()+offsetDays*86400000).toISOString();
const users=new Map([[7,normalizeUser({id:7,name:'Rental Agent',role:'Agent',status:'Active'})]]);
const person=(extra={})=>normalizePersonBase({id:42,name:'Test Lead',stage:'Lead',source:'Website',assignedUserId:7,created:iso(-10),updated:iso(-1),lastActivity:iso(-1),lastCommunication:iso(-1),tags:['buyer'],...extra},users);

test('normalizes FUB owner, timed task due date, string completion, and rental marker',()=>{
  const lead=normalizePersonBase({id:1,firstName:'Rae',lastName:'Doe',assignedUserId:'7',stage:'Rental Lead',source:'Website',created:iso(-2),tags:[{name:'Tenant'}]},users);
  const task=normalizeTask({id:9,personId:'1',assignedUserId:'7',dueDate:'2099-01-01',dueDateTime:'2099-01-01T15:30:00Z',isCompleted:'false'},users);
  assert.equal(lead.assignedUserName,'Rental Agent');
  assert.equal(lead.businessSegment,'rental');
  assert.equal(task.dueAt,'2099-01-01T15:30:00Z');
  assert.equal(task.isCompleted,false);
});

test('classifies common rental variants without leaking ordinary buyers and sellers',()=>{
  const rentals=[
    {tags:['Rent']},
    {tags:[{value:'Renter'}]},
    {tags:[{tag:'Tenant Lead'}]},
    {source:'Apartments.com'},
    {assignedPond:{name:'Rental Pond'}},
    {customTransactionType:'Lease'},
    {customFields:{lead_category:'Rentals'}},
  ];
  for(const fixture of rentals)assert.equal(classifyBusinessSegment(fixture).segment,'rental',JSON.stringify(fixture));
  for(const fixture of [{tags:['buyer']},{source:'Website',stage:'Seller'},{customNotes:'Currently renting but buying'}])assert.equal(classifyBusinessSegment(fixture).segment,'buyer-seller',JSON.stringify(fixture));
});

test('Apartments.com remains rental when an older environment marker list is configured',()=>{
  const previous=process.env.VESTA_RENTAL_MARKERS;
  process.env.VESTA_RENTAL_MARKERS='rental,rentals,renter,tenant,lease,leasing';
  try{
    assert.equal(classifyBusinessSegment({source:'Apartments.com'}).reason,'source:apartments.com');
    assert.equal(classifyBusinessSegment({source:'https://www.apartments.com/chicago/'}).segment,'rental');
  }finally{
    if(previous===undefined)delete process.env.VESTA_RENTAL_MARKERS;else process.env.VESTA_RENTAL_MARKERS=previous;
  }
});

test('conflicting seller and predictive renter tags require classification',()=>{
  const result=classifyBusinessSegment({tags:['Seller','Zillow Likely Renter','Zillow seller Selected']});
  assert.equal(result.segment,'needs-classification');
  assert.equal(result.reason,'conflicting-transaction-signals');
  assert.ok(result.evidence.some(x=>x.includes('seller')));
  assert.ok(result.evidence.some(x=>x.includes('renter')));
});

test('generic Buyer plus explicit Rental remains in rentals',()=>{
  const result=classifyBusinessSegment({tags:['Buyer','Rental','Zillow']});
  assert.equal(result.segment,'rental');
  assert.match(result.reason,/rental/);
});

test('governance chooses the earliest future task and still flags overdue one-off work',()=>{
  const tasks=[normalizeTask({id:1,personId:42,dueDateTime:iso(-3),isCompleted:false},users),normalizeTask({id:2,personId:42,dueDateTime:iso(2),isCompleted:false},users)];
  const lead=enrichLead(person({lastCommunication:iso(-.2)}),tasks);
  assert.equal(lead.nextTaskAt,tasks[1].dueAt);
  assert.equal(lead.governanceSignals.find(x=>x.key==='task-hygiene').status,'fail');
  assert.equal(lead.overdueTaskCount,1);
  assert.equal(lead.decision.type,'task');
});

test('governance treats a date-only task due today as a current future action',()=>{
  const today=new Date().toLocaleDateString('en-CA');
  const lead=enrichLead(person(),[normalizeTask({id:1,personId:42,dueDate:today,isCompleted:false},users)]);
  assert.equal(lead.nextTaskAt,today);
  assert.equal(lead.governanceSignals.find(x=>x.key==='task-hygiene').status,'pass');
});

test('renter records are exempt from buyer and seller cadence',()=>{
  const lead=enrichLead(person({stage:'Renter',source:'Apartments.com',tags:['Rental'],lastCommunication:null}),[]);
  assert.equal(lead.leadLane,'renter');
  assert.equal(lead.cadenceStatus,'not-required');
  assert.notEqual(lead.decision.matchedRule,'cadence.sop-due');
});

test('seller nurture uses the approved timeframe cadence',()=>{
  const lead=enrichLead(person({stage:'Nurture',tags:['Seller'],timeframeStatus:'3-6 Months',lastCommunication:iso(-15)}),[]);
  assert.equal(lead.leadLane,'seller');
  assert.equal(lead.cadenceKey,'seller-3-6');
  assert.equal(lead.cadenceStatus,'overdue');
});

test('missing future task alone does not create a governance failure',()=>{
  const lead=enrichLead(person({stage:'Renter',tags:['Rental'],lastCommunication:iso(-200)}),[]);
  assert.equal(lead.overdueTaskCount,0);
  assert.equal(lead.governanceSignals.find(x=>x.key==='task-hygiene').status,'pass');
});

test('Apartments.com without a confirmed rental stage becomes a rental candidate',()=>{
  const lead=person({source:'Apartments.com',stage:'Lead',tags:['Buyer']});
  assert.equal(lead.leadLane,'candidate-rental');
  assert.equal(lead.businessSegment,'needs-classification');
});

test('one-minute SLA applies only to a documented hand raise',()=>{
  const pending=enrichLead(person({lastInquiry:new Date(Date.now()-30000).toISOString(),lastCommunication:null}),[]);
  const breached=enrichLead(person({lastInquiry:new Date(Date.now()-120000).toISOString(),lastCommunication:null}),[]);
  const ordinary=enrichLead(person({lastInquiry:null,lastCommunication:null,stage:'Renter',tags:['Rental']}),[]);
  assert.equal(pending.responseSlaStatus,'pending');
  assert.equal(breached.responseSlaStatus,'breached');
  assert.equal(ordinary.responseSlaStatus,'not-applicable');
});

test('appointment audit detects missing client and reminder evidence',()=>{
  const result=auditAppointments([{id:1,start:iso(2),type:'Buyer Appointment'}]);
  assert.equal(result.review,1);
  assert.ok(result.findings[0].issues.some(x=>x.includes('client')));
  assert.ok(result.findings[0].issues.some(x=>x.includes('Reminder')));
});

test('listing process uses approved chase intervals and respects opt out',()=>{
  const near=listingProcess({tags:['Seller'],customFields:{customExpectedListDate:iso(7)}});
  const optedOut=listingProcess({tags:['Seller'],customFields:{customExpectedListDate:iso(30),customListingChaseOptOut:true}});
  assert.equal(near.chase.intervalDays,1);
  assert.equal(optedOut.chase.status,'not-required');
});

test('owner governance and decision agree that a name without a user id is unresolved',()=>{
  const lead=enrichLead(person({assignedUserId:null,assignedTo:'Former Agent'}),[]);
  assert.equal(lead.governanceSignals.find(x=>x.key==='owner').status,'fail');
  assert.equal(lead.decision.type,'assign');
});

test('timeline does not invent assignment-at-creation and retains completed tasks',()=>{
  const lead=enrichLead(person(),[]);
  const completed=normalizeTask({id:3,personId:42,name:'Completed call',type:'Call',dueDateTime:iso(-2),isCompleted:true},users);
  const timeline=buildTimeline(lead,[completed],{calls:[{id:5,created:iso(-1),type:'Outbound Call',outcome:'Connected'}],notes:[{id:6,created:'not-a-date',body:'invalid timestamp'}]});
  assert.equal(timeline.some(x=>x.type==='assignment'),false);
  assert.equal(timeline.find(x=>x.id==='task-3').detail,'Call · Completed');
  assert.equal(timeline.some(x=>x.id==='notes-6'),false);
  assert.equal(timeline[0].id,'calls-5');
});

test('completed flow item stays out until its intelligence snapshot changes',()=>{
  const lead=enrichLead(person({lastCommunication:iso(-.2)}),[]);
  const event={id:'complete-1',kind:'broker.complete',leadId:String(lead.id),decisionSnapshotId:lead.decisionSnapshotId,actorUserId:7,actorName:'Rental Agent',createdAt:new Date().toISOString(),recommendation:lead.decision.label,priority:lead.decision.urgency,outcome:'Connected'};
  assert.equal(buildFlowQueue([lead],[event],7).length,0);
  assert.equal(buildFlowQueue([{...lead,decisionSnapshotId:'changed'}],[event],7).length,1);
});

test('future skip hides an item and an expired skip returns it',()=>{
  const lead=enrichLead(person({lastCommunication:iso(-.2)}),[]),base={id:'skip-1',kind:'broker.skip',leadId:String(lead.id),decisionSnapshotId:lead.decisionSnapshotId,actorUserId:7,actorName:'Rental Agent',createdAt:new Date().toISOString(),recommendation:lead.decision.label,priority:lead.decision.urgency,reason:'Call later'};
  assert.equal(buildFlowQueue([lead],[{...base,returnAt:iso(1)}],7).length,0);
  assert.equal(buildFlowQueue([lead],[{...base,returnAt:iso(-1)}],7).length,1);
});

test('pass creates management exception and reroute moves ownership',()=>{
  const lead=enrichLead(person({lastCommunication:iso(-.2)}),[]),pass={id:'pass-1',kind:'broker.pass',leadId:String(lead.id),decisionSnapshotId:lead.decisionSnapshotId,actorUserId:7,actorName:'Rental Agent',createdAt:new Date().toISOString(),recommendation:lead.decision.label,priority:lead.decision.urgency,reason:'Capacity conflict'};
  const usersForFlow=[{id:7,name:'Rental Agent',role:'Agent',isActive:true},{id:8,name:'Next Broker',role:'Agent',isActive:true}];
  assert.equal(buildFlowQueue([lead],[pass],7).length,0);
  assert.equal(buildManagementExceptions([lead],[pass],usersForFlow).length,1);
  const reroute={id:'route-1',kind:'management.reroute',leadId:String(lead.id),decisionSnapshotId:lead.decisionSnapshotId,actorUserId:null,actorName:'Management',createdAt:new Date().toISOString(),recommendation:lead.decision.label,priority:lead.decision.urgency,parentEventId:pass.id,targetUserId:8,targetUserName:'Next Broker'};
  assert.equal(buildManagementExceptions([lead],[reroute,pass],usersForFlow).length,0);
  assert.equal(buildFlowQueue([lead],[reroute,pass],8).length,1);
});
