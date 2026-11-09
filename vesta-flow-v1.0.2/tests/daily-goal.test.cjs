const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(require.resolve('../lib/flow/daily-goal.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loaded={exports:{}};new Function('module','exports',source)(loaded,loaded.exports);
const {dailyGoal}=loaded.exports;
const event=(id,extra={})=>({id,kind:'broker.complete',actorUserId:30,createdAt:'2026-11-08T18:00:00Z',metadata:{fubSync:{delivered:true,simulated:false}},...extra});
const now=new Date('2026-11-09T01:00:00Z'),zone='America/Los_Angeles';
test('daily goal counts successful completions only for the selected broker and local day',()=>{
 const events=[event('done'),event('done'),event('other',{actorUserId:4}),event('skip',{kind:'broker.skip'}),event('pass',{kind:'broker.pass'}),event('demo',{metadata:{fubSync:{delivered:true,simulated:true}}}),event('failed',{metadata:{fubSync:{delivered:false}}}),event('old',{createdAt:'2026-11-08T07:59:59Z'}),event('midnight',{createdAt:'2026-11-08T08:00:00Z'}),event('future',{createdAt:'2026-11-09T02:00:00Z'}),event('bad',{createdAt:'bad'})];
 assert.equal(dailyGoal(events,30,zone,now).completed,2);
});
test('daily count exceeds twenty and resets at local midnight across DST',()=>{
 const events=Array.from({length:24},(_,i)=>event(String(i)));
 assert.equal(dailyGoal(events,30,zone,now).completed,24);
 assert.equal(dailyGoal(events,30,zone,new Date('2026-11-09T08:00:00Z')).completed,0);
 const fall=[event('first',{createdAt:'2026-11-01T08:30:00Z'}),event('second',{createdAt:'2026-11-01T09:30:00Z'})];
 assert.equal(dailyGoal(fall,30,zone,new Date('2026-11-02T07:59:59Z')).completed,2);
 assert.equal(dailyGoal(fall,30,zone,new Date('2026-11-02T08:00:00Z')).completed,0);
});
