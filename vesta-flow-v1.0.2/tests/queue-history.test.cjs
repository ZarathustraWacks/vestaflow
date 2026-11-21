const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),resolve=Module._resolveFilename;Module._resolveFilename=function(r,p,m,o){return resolve.call(this,r.startsWith('@/')?path.join(root,r.slice(2)):r,p,m,o)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {listFlowQueueEvents}=require('../lib/flow/queue-history.ts');const original=global.fetch;let scope=0;
function configure(){process.env.VESTA_LEARNING_API_URL='https://render.example';process.env.VESTA_LEARNING_API_KEY='key';process.env.VESTA_FLOW_LEDGER_NAMESPACE='queue_test_'+(++scope);process.env.VESTA_FLOW_HISTORY_VERIFIED='true'}
test.afterEach(()=>{global.fetch=original;for(const key of ['VESTA_LEARNING_API_URL','VESTA_LEARNING_API_KEY','VESTA_FLOW_LEDGER_NAMESPACE','VESTA_FLOW_HISTORY_VERIFIED'])delete process.env[key]});
const ok=value=>({ok:true,json:async()=>({ok:true,...value})});
test('bootstrap reads beyond 500; later reads request only newer database positions',async()=>{
 configure();let total=1201;const calls=[];
 global.fetch=async url=>{const after=Number(new URL(url).searchParams.get('after'));calls.push(after);const end=Math.min(total,after+500);return ok({durable:true,cursorMode:'after',items:Array.from({length:end-after},(_,i)=>({id:String(after+i+1)})),cursor:end,nextAfter:end<total?end:null})};
 assert.equal((await listFlowQueueEvents()).length,1201);assert.deepEqual(calls,[0,500,1000]);
 total=1202;assert.equal((await listFlowQueueEvents()).length,1202);assert.equal(calls.at(-1),1201);
 assert.equal((await listFlowQueueEvents()).length,1202);assert.equal(calls.at(-1),1202);
});
test('failed pagination does not publish a partial ledger or advance its cursor',async()=>{
 configure();let fail=true;const calls=[];
 global.fetch=async url=>{const after=Number(new URL(url).searchParams.get('after'));calls.push(after);if(after===1&&fail)return {ok:false,status:503};return ok({durable:true,cursorMode:'after',items:[{id:String(after+1)}],cursor:after+1,nextAfter:after===0?1:null})};
 await assert.rejects(listFlowQueueEvents());fail=false;assert.equal((await listFlowQueueEvents()).length,2);assert.deepEqual(calls,[0,1,0,1]);
});
test('concurrent readers share one complete pass; immutable conflicting IDs fail',async()=>{
 configure();let calls=0;global.fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return ok({durable:true,cursorMode:'after',items:[{id:'one',leadId:'42'}],cursor:1,nextAfter:null})};
 const pages=await Promise.all(Array.from({length:38},()=>listFlowQueueEvents()));assert.equal(calls,1);assert.ok(pages.every(p=>p.length===1));
 global.fetch=async()=>ok({durable:true,cursorMode:'after',items:[{id:'one',leadId:'wrong'}],cursor:2,nextAfter:null});await assert.rejects(listFlowQueueEvents(),/Conflicting/);
});
test('old Render compatibility reads all pages rather than truncating at 500',async()=>{
 configure();const calls=[];global.fetch=async url=>{calls.push(String(url));const q=new URL(url).searchParams;if(q.has('after'))return ok({durable:true,items:[],nextBefore:null});return ok({durable:true,items:[{id:q.has('before')?'older':'new'}],nextBefore:q.has('before')?null:9})};
 assert.deepEqual((await listFlowQueueEvents()).map(e=>e.id),['new','older']);assert.equal(calls.length,3);
});

test('empty cursor jumps are rejected without losing earlier positions',async()=>{
 configure();global.fetch=async()=>ok({durable:true,cursorMode:'after',items:[],cursor:900,nextAfter:null});await assert.rejects(listFlowQueueEvents(),/Incomplete/);
 const calls=[];global.fetch=async url=>{calls.push(Number(new URL(url).searchParams.get('after')));return ok({durable:true,cursorMode:'after',items:[{id:'first'}],cursor:1,nextAfter:null})};assert.equal((await listFlowQueueEvents()).length,1);assert.deepEqual(calls,[0]);
});
