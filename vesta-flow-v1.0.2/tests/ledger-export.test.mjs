import test from 'node:test';
import assert from 'node:assert/strict';
import {stableExport} from '../scripts/export-flow-ledger.mjs';
const fixture=(count=5101)=>{
 const events=Array.from({length:count},(_,i)=>JSON.stringify({id:String(i)}));
 return async ([cmd,...args])=>cmd==='LLEN'?events.length:cmd==='LRANGE'?events.slice(args[1],args[2]+1):cmd==='SCAN'?['0',['p:run:r','p:claim:r','p:claim:pending']]:args[0]==='p:run:r'?JSON.stringify({runKey:'r',completedAt:'2026-10-12T00:00:00Z'}):args[0]==='p:claim:r'?'complete':'started';
};
test('complete read-only export exceeds old cap and identifies unresolved claims',async()=>{
 const data=await stableExport(fixture(),'e','p');assert.equal(data.events.length,5101);assert.equal(data.runs.length,1);assert.equal(data.unresolvedClaims.length,1);
});
test('changed history between passes fails closed',async()=>{
 const base=fixture(1);let calls=0;
 await assert.rejects(stableExport(async command=>command[0]==='LRANGE'?[JSON.stringify({id:String(calls++)})]:base(command),'e','p'),/changed/);
});
test('missing dispatch evidence fails closed',async()=>{
 const base=fixture(1);await assert.rejects(stableExport(async command=>command[0]==='GET'?null:base(command),'e','p'),/disappeared/);
});
