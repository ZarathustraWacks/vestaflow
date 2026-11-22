const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const e=require('../lib/property/evidence.ts'),c=require('../lib/property/candidates.ts'),now=new Date('2026-11-21T20:00:00Z');
const event=(extra={})=>({id:1,personId:42,type:'Viewed Property',created:'2026-08-01T10:00:00Z',property:{street:'10 Main',unit:'2',code:'60601',city:'Chicago',state:'IL',mlsNumber:'123',mls:'mred',price:'$400,000'},...extra});
test('FUB activity retains original times and structured properties without Zenlist membership',()=>{
 const p=e.propertyPreparation('42',[event(),event(),event({id:2,personId:43}),event({id:3,created:'2027-01-01'}),event({id:4,type:'Incoming Call'})],[],now);
 assert.equal(p.evidence.length,1);assert.equal(p.evidence[0].eventAt,'2026-08-01T10:00:00Z');assert.equal(p.observations[0].price,400000);assert.equal(p.observations[0].confirmation,'observed-only');assert.equal(p.timerEffect,'none');assert.equal(p.customerIdentityEffect,'none');assert.equal(p.propertyInsertionEnabled,false);
});
test('market plus MLS matches across customers, while address and MLS number alone require review',()=>{
 const a=e.fubPropertyEvidence('42',[event()],now)[0],z=e.savedZenlistProperty('99','zl:5',a.eventAt,{id:'mred:123',mls:'mred',mls_id:'123',address:'10 Main',unit:'2',zip:'60601',city:'Chicago',state:'IL'});
 assert.equal(e.matchSavedListing(a,[z]).listingId,'mred:123');assert.equal(e.matchSavedListing({...a,market:undefined},[z]).status,'address-review');assert.equal(e.matchSavedListing({...a,market:undefined,unit:'3'},[z]).status,'unresolved');
 assert.equal(e.matchSavedListing({...a,listingId:'mred:777'},[z]).status,'conflict');assert.equal(e.matchSavedListing(a,[z,{...z,listingId:'other:123'}]).status,'conflict');
});
test('untrusted URLs cannot become Zenlist identifiers and searches remain historical evidence',()=>{
 for(const u of ['http://zenlist.com/listing/mred:123','https://evil.test/listing/mred:123','https://user:secret@zenlist.com/listing/mred:123'])assert.equal(e.listingIdFromUrl(u),undefined);
 assert.equal(e.listingIdFromUrl('https://zenlist.com/listing/mred:123?as=broker'),'mred:123');
 const p=e.propertyPreparation('42',[event({type:'Saved Property Search',property:null,propertySearch:{priceMax:500000,city:'Chicago',nested:{secret:'x'}}})],[],now);assert.equal(p.searches.length,1);assert.equal(p.searches[0].fields.priceMax,'500000');assert.equal(p.searches[0].fields.nested,undefined);
});
test('candidate ranking excludes stale, inactive, duplicate-conflicted and mismatched saved listings',()=>{
 const r={personId:'42',confirmed:true,sourceIds:['fub:1'],maxPrice:500000,minBedrooms:2,city:'Chicago'},a={id:'mred:1',address:'10 Main',price:400000,status:'active',checkedAt:'2026-11-21T19:00:00Z',bedrooms:3,city:'Chicago',publicCanView:true};
 const rows=[a,a,{...a,id:'mred:2',status:'canceled'},{...a,id:'mred:3',checkedAt:'2026-08-01'},{...a,id:'mred:4',price:600000},{...a,id:'mred:5',publicCanView:false},{...a,id:'mred:6'},{...a,id:'mred:6',price:450000}];
 assert.deepEqual(c.rankSavedCandidates(r,rows,now).candidates.map(x=>x.id),['mred:1']);assert.equal(c.rankSavedCandidates({...r,confirmed:false},rows,now).status,'preferences-review');assert.throws(()=>c.insertPropertyLink('draft',a),/disabled/);
});
