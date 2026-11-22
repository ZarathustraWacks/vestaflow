const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const h=require('../lib/appointment/handoff.ts');
test('Cadence links carry exact lead and broker identifiers to the fixed Flow destination',()=>{
 const u=new URL(h.messagingHandoffUrl('42',7));assert.equal(u.origin,'https://vestaflow.vercel.app');assert.deepEqual(h.parseMessagingHandoff(u.searchParams),{leadId:'42',brokerId:7});assert.equal(u.searchParams.size,3);
 for(const id of ['0','-1','1e3','42&leadId=9','9007199254740992','https://evil.test'])assert.equal(h.messagingHandoffUrl(id,7),null);
 assert.equal(h.parseMessagingHandoff(new URLSearchParams('workspace=other&leadId=42&brokerId=7')),null);
});
test('an ineligible requested contact never falls through to a saved or first contact',()=>{
 const contacts=[{id:'1'},{id:'2'}];assert.equal(h.handoffContactId(contacts,'42','1'),'');assert.equal(h.handoffContactId([], '42'),'');assert.equal(h.handoffContactId(contacts,'2','1'),'2');assert.equal(h.handoffContactId(contacts,undefined,'2'),'2');assert.equal(h.handoffContactId(contacts,undefined,'99'),'1');
});
