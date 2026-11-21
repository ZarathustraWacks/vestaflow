const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {buildSmartListRows,filterSmartListRows}=require('../lib/flow/smart-list-view.ts');
const now=Date.parse('2026-11-20T12:00:00Z'),past=new Date(now-3600000).toISOString();
const person=(id=42,owner=7)=>({id,assignedUserId:owner,name:'Synthetic '+id,stage:'Nurture',source:'Website',lastActivityAt:past,brokerOutreachAt:past,decision:{label:'Call',urgency:'Today'}});
const signal=(extra={})=>({personId:'42',ownerId:'7',listId:'1',label:'Recent activity',signal:'recent-activity',observedAt:past,expiresAt:new Date(now+3600000).toISOString(),usage:'additive-opportunity',actualCredit:0,changesCadence:false,...extra});
const task=(extra={})=>({id:1,personId:42,assignedUserId:7,name:'Follow up',dueAt:past,...extra});
const defaults={search:'',list:'',stage:'',activity:'',overdue:false,sort:'name',direction:'asc'};
test('joins exact current broker ownership, merges list memberships and ignores foreign or invalid identity',()=>{
 const rows=buildSmartListRows([person(),person(43,8),person(44)],[task(),task({id:2,assignedUserId:8}),task({id:3,completed:true})],[signal(),signal(),signal({listId:'2',label:'Nurture'}),signal({personId:'43',ownerId:'7'}),signal({personId:'44',vestaId:'99'}),signal({personId:'999'})],7,now);
 assert.equal(rows.length,1);assert.equal(rows[0].memberships.length,2);assert.equal(rows[0].tasks.length,1);assert.equal(rows[0].lastOutreachAt,past);assert.equal(rows[0].lastActivityAt,past);
 assert.deepEqual(buildSmartListRows([person()],[],[signal()],8,now),[]);
});
test('expired, future and unsafe membership cannot masquerade as current activity',()=>{
 const p=person();delete p.lastActivityAt;delete p.brokerOutreachAt;
 for(const s of [signal({expiresAt:past}),signal({observedAt:new Date(now+1000).toISOString()}),signal({changesCadence:true}),signal({actualCredit:1}),signal({usage:'other'})])assert.equal(buildSmartListRows([p],[],[s],7,now).length,0);
 const row=buildSmartListRows([p],[],[signal()],7,now)[0];assert.equal(row.lastActivityAt,null);assert.equal(row.lastOutreachAt,null);assert.equal(filterSmartListRows([row],{...defaults,activity:'7'},now).length,0);
});
test('filters combine list, stage, actual activity and overdue broker-owned open tasks without mutation',()=>{
 const rows=buildSmartListRows([person(),{...person(43),name:'Alex',stage:'Lead',lastActivityAt:null}], [task()], [signal(),signal({personId:'43',listId:'2',label:'New buyers'})],7,now);
 assert.deepEqual(filterSmartListRows(rows,{...defaults,list:'1',stage:'Nurture',activity:'7',overdue:true},now).map(r=>r.id),['42']);
 assert.deepEqual(filterSmartListRows(rows,{...defaults,search:'new buyers'},now).map(r=>r.id),['43']);
 assert.equal(filterSmartListRows(rows,{...defaults,stage:'Closed'},now).length,0);assert.equal(rows.length,2);assert.equal(rows[0].tasks.length,1);
});
test('missing timestamps sort last in either direction; a contact only appears once',()=>{
 const rows=buildSmartListRows([person(),person(),{...person(43),lastActivityAt:null}],[],[signal(),signal({personId:'43'})],7,now);assert.equal(rows.length,2);
 for(const direction of ['asc','desc'])assert.deepEqual(filterSmartListRows(rows,{...defaults,sort:'activity',direction},now).map(r=>r.id),['42','43']);
});
