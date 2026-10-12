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


const {POST,GET}=require('../app/api/migration/legacy-status/route.ts');
const originalFetch=global.fetch;
function config(){process.env.VERCEL_ENV='preview';process.env.VERCEL_GIT_COMMIT_REF='codex/flow-render-ledger-2026-10-12';process.env.VESTA_LEARNING_API_KEY='test';process.env.UPSTASH_REDIS_REST_URL='https://redis.example';process.env.UPSTASH_REDIS_REST_TOKEN='private-token'}
const req=(key='test')=>new Request('https://preview.example/api/migration/legacy-status',{method:'POST',headers:{authorization:'Bearer '+key}});
test.afterEach(()=>{global.fetch=originalFetch;for(const k of ['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','VESTA_LEARNING_API_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])delete process.env[k]});
test('production and unauthorized requests never contact legacy storage',async()=>{config();global.fetch=async()=>{throw Error('must not fetch')};assert.equal((await POST(req('wrong'))).status,401);process.env.VERCEL_ENV='production';assert.equal((await POST(req())).status,404)});
test('diagnostic uses only read-only commands and returns counts without credentials',async()=>{config();const commands=[];global.fetch=async(_,init)=>{const c=JSON.parse(init.body);commands.push(c);return {ok:true,json:async()=>({result:c[0]==='PING'?'PONG':5101})}};const r=await POST(req());const body=await r.json();assert.equal(body.eventRows,5101);assert.deepEqual(commands.map(c=>c[0]),['PING','LLEN']);assert.equal(JSON.stringify(body).includes('private-token'),false)});
test('errors never return the endpoint, token, or unknown raw server text',async()=>{config();global.fetch=async()=>{throw Error('private-token https://redis.example')};const r=await POST(req());assert.equal(r.status,503);assert.equal((await r.json()).reason,'connection-failed')});

test('browser form stays authenticated and rejects cross-origin submissions',async()=>{config();assert.equal((await GET()).status,200);let contacted=false;global.fetch=async()=>{contacted=true};const request=new Request('https://preview.example/api/migration/legacy-status',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/x-www-form-urlencoded'},body:'key=test'});assert.equal((await POST(request)).status,403);assert.equal(contacted,false);process.env.VERCEL_ENV='production';assert.equal((await GET()).status,404)});
