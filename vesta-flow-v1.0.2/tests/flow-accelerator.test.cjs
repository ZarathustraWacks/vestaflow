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


const {fetchFlowDelivery,enqueueFlowContactRefresh}=require('../lib/render/flow-accelerator.ts');
const originalFetch=global.fetch;
const vars=['VESTA_FLOW_ACCELERATOR_URL','VESTA_FLOW_ACCELERATOR_READ_KEY','VESTA_FLOW_ACCELERATOR_REFRESH_KEY','VESTA_RENDER_LEARNING_API_URL','VESTA_RENDER_LEARNING_API_KEY'];
function configure(){process.env.VESTA_FLOW_ACCELERATOR_URL='https://accelerator.example';process.env.VESTA_FLOW_ACCELERATOR_READ_KEY='read-secret';process.env.VESTA_FLOW_ACCELERATOR_REFRESH_KEY='refresh-secret';process.env.VESTA_RENDER_LEARNING_API_URL='https://existing.example';process.env.VESTA_RENDER_LEARNING_API_KEY='existing-secret'}
test.afterEach(()=>{global.fetch=originalFetch;for(const v of vars)delete process.env[v]});
test('delivery uses accelerator read credential and preserves assigned scope',async()=>{configure();let seen;global.fetch=async(url,init)=>{seen={url,init};return {ok:true}};await fetchFlowDelivery('/v1/manager-delivery/assigned/7');assert.equal(seen.url,'https://accelerator.example/v1/manager-delivery/assigned/7');assert.equal(seen.init.headers.authorization,'Bearer read-secret');assert.equal(seen.init.redirect,'error');assert.equal(process.env.VESTA_RENDER_LEARNING_API_URL,'https://existing.example')});
test('accelerator failure falls back to established delivery with its own credential',async()=>{configure();const calls=[];global.fetch=async(url,init)=>{calls.push([url,init]);return {ok:calls.length===2}};await fetchFlowDelivery('/v1/manager-delivery');assert.equal(calls.length,2);assert.equal(calls[1][0],'https://existing.example/v1/manager-delivery');assert.equal(calls[1][1].headers.authorization,'Bearer existing-secret')});
test('refresh only queues a contact and uses separate refresh credential',async()=>{configure();let seen;global.fetch=async(url,init)=>{seen={url,init};return {status:202}};assert.deepEqual(await enqueueFlowContactRefresh('12'),{queued:true});assert.equal(seen.url,'https://accelerator.example/v1/refresh');assert.equal(seen.init.headers.authorization,'Bearer refresh-secret');assert.deepEqual(JSON.parse(seen.init.body),{scope:'contact',target:'12'})});
test('optional refresh failure never changes confirmed completion success',async()=>{configure();global.fetch=async()=>{throw new Error('unavailable')};assert.deepEqual(await enqueueFlowContactRefresh('12'),{queued:false});await assert.rejects(fetchFlowDelivery('/v1/flow-ledger'),/Invalid/);assert.deepEqual(await enqueueFlowContactRefresh('../users'),{queued:false})});
test('completion keeps FUB confirmation and ledger before background refresh',()=>{const s=fs.readFileSync(path.join(root,'app/api/flow/actions/route.ts'),'utf8');assert.ok(s.indexOf('syncCompletionToFub({')<s.indexOf('await appendFlowEvent(event)'));assert.ok(s.indexOf('await appendFlowEvent(event)')<s.indexOf("after(()=>enqueueFlowContactRefresh"));assert.ok(s.includes('getFlowSpine({ownUserId:ownId,manager,brokerId:requestedBroker})'));assert.ok(s.includes('duplicatePrevented:true'));});
