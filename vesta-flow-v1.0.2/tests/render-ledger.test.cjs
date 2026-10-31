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


const {ledger,ledgerReady}=require('../lib/render/flow-ledger.ts');
const {listFlowEvents,appendFlowEvent,flowStorageStatus}=require('../lib/flow/store.ts');
const originalFetch=global.fetch;
function configured(){process.env.VESTA_LEARNING_API_URL='https://render.example';process.env.VESTA_LEARNING_API_KEY='test-key';process.env.VESTA_FLOW_LEDGER_NAMESPACE='staging';process.env.VESTA_FLOW_HISTORY_VERIFIED='true'}
test.afterEach(()=>{global.fetch=originalFetch;for(const key of ['VESTA_LEARNING_API_URL','VESTA_LEARNING_API_KEY','VESTA_FLOW_LEDGER_NAMESPACE','VESTA_FLOW_HISTORY_VERIFIED'])delete process.env[key]});
test('unverified history fails closed',async()=>{
 configured();delete process.env.VESTA_FLOW_HISTORY_VERIFIED;let fetched=false;global.fetch=async()=>{fetched=true};
 assert.equal(ledgerReady(),false);assert.equal(flowStorageStatus().available,false);await assert.rejects(listFlowEvents());assert.equal(fetched,false);
});
test('history pagination returns every page and uses server authentication',async()=>{
 configured();const requests=[];global.fetch=async(url,init)=>{requests.push([String(url),init]);return {ok:true,json:async()=>({ok:true,durable:true,items:[{id:String(requests.length)}],nextBefore:requests.length===1?15:null})}};
 const events=await listFlowEvents();assert.deepEqual(events.map(x=>x.id),['1','2']);assert.ok(requests[1][0].endsWith('/staging/events?before=15'));assert.equal(requests[0][1].headers.authorization,'Bearer test-key');assert.equal(requests[0][1].redirect,'error');
});
test('bad pages and service failures cannot become empty history',async()=>{
 configured();global.fetch=async()=>({ok:false,status:503});await assert.rejects(listFlowEvents(),/503/);
 global.fetch=async()=>({ok:true,json:async()=>({ok:true,durable:true,items:[],nextBefore:10})});await assert.rejects(listFlowEvents(),/Incomplete/);
});
test('append keeps the original event',async()=>{
 configured();const event={id:'stable-id',actorUserId:7,createdAt:'2026-01-01T00:00:00Z',verificationStatus:'unverified'};let request;
 global.fetch=async(url,init)=>{request=init;return {ok:true,json:async()=>({ok:true,inserted:1})}};
 await appendFlowEvent(event);assert.deepEqual(JSON.parse(request.body),{events:[event]});assert.equal(request.method,'POST');
});
test('insecure endpoints are rejected before sending the key',async()=>{
 configured();process.env.VESTA_LEARNING_API_URL='http://render.example';let fetched=false;global.fetch=async()=>{fetched=true};await assert.rejects(ledger('/events'),/HTTPS/);assert.equal(fetched,false);
});
