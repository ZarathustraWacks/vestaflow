/** Passive evidence only. A property match never establishes a customer identity. */
export type PropertyEvidence={personId:string;sourceId:string;source:'fub'|'zenlist';eventAt:string;kind:string;listingId?:string;market?:string;mlsNumber?:string;address?:string;city?:string;state?:string;zip?:string;unit?:string;price?:number;bedrooms?:number;bathrooms?:number;url?:string};
export const PROPERTY_INSERTION_ENABLED=false as const;
const text=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v).trim():'';
const positive=(v:unknown)=>{const n=Number(text(v).replace(/[$,]/g,''));return Number.isFinite(n)&&n>0?n:undefined};
export function listingIdFromUrl(value:unknown){
 try{const u=new URL(text(value));if(u.protocol!=='https:'||u.hostname!=='zenlist.com'||u.username||u.password)return;
  const match=u.pathname.match(/^\/(?:app\/)?listing\/([a-z0-9_-]+:[a-zA-Z0-9_-]+)\/?$/);return match?.[1];
 }catch{return;}
}
const validId=(v:unknown)=>/^[a-z0-9_-]+:[a-zA-Z0-9_-]+$/.test(text(v))?text(v):undefined;
function reference(p:any){
 const direct=validId(p.zenlistListingId)||listingIdFromUrl(p.url)||listingIdFromUrl(p.listing_url)||validId(p.id);
 const market=text(p.mls||p.market).toLowerCase()||undefined,mlsNumber=text(p.mlsNumber||p.mls_id)||undefined;
 return {listingId:direct,market,mlsNumber,address:text(p.street||p.address)||undefined,city:text(p.city)||undefined,state:text(p.state)||undefined,zip:text(p.code||p.zip)||undefined,unit:text(p.unit)||undefined,price:positive(p.price),bedrooms:positive(p.bedrooms),bathrooms:positive(p.bathrooms)};
}
export function fubPropertyEvidence(personId:string,events:any[],now=new Date()):PropertyEvidence[]{
 const result=new Map<string,PropertyEvidence>();
 for(const e of events){
  // Only a person-scoped FUB collection is accepted by the caller; reject
  // explicit cross-person entries, future dates and malformed records.
  if(!e||!e.id||(e.personId!=null&&String(e.personId)!==personId)||!['Viewed Property','Saved Property','Property Inquiry','Inquiry','Visited Open House','Property Search','Saved Property Search'].includes(e.type))continue;
  const at=text(e.created||e.createdAt);if(!Number.isFinite(Date.parse(at))||Date.parse(at)>now.getTime())continue;
  const p=e.property;if(!p||typeof p!=='object')continue;
  const r=reference(p);if(!r.listingId&&!r.mlsNumber&&!r.address)continue;
  const sourceId='fub:event:'+e.id;
  result.set(sourceId,{personId,sourceId,source:'fub',eventAt:at,kind:e.type,...r});
 }
 return [...result.values()].sort((a,b)=>Date.parse(b.eventAt)-Date.parse(a.eventAt)||a.sourceId.localeCompare(b.sourceId));
}
/** Adapter for locally saved Zenlist listing objects. No source requests. */
export function savedZenlistProperty(personId:string,sourceId:string,eventAt:string,listing:any):PropertyEvidence|null{
 if(!sourceId||!Number.isFinite(Date.parse(eventAt))||!listing||typeof listing!=='object')return null;
 const r=reference(listing);if(!r.listingId&&!r.mlsNumber&&!r.address)return null;
 return {personId,sourceId,source:'zenlist',eventAt,kind:'saved-source-listing',...r};
}
const norm=(v:unknown)=>text(v).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
const addressKey=(e:PropertyEvidence)=>e.address&&e.zip?[e.address,e.unit||'',e.city||'',e.state||'',e.zip].map(norm).join('|'):null;
export function matchSavedListing(e:PropertyEvidence,saved:PropertyEvidence[]){
 if(e.listingId&&e.market&&e.mlsNumber&&e.listingId!==`${e.market}:${e.mlsNumber}`)return {status:'conflict' as const,listingId:null,sourceIds:[e.sourceId]};
 const candidate=saved.filter(x=>x.listingId);
 const explicit=candidate.filter(x=>e.listingId&&x.listingId===e.listingId);
 const mls=candidate.filter(x=>e.market&&e.mlsNumber&&x.market===e.market&&x.mlsNumber===e.mlsNumber);
 const exact=[...explicit,...mls],ids=[...new Set(exact.map(x=>x.listingId!))];
 if(ids.length>1||(e.listingId&&mls.some(x=>x.listingId!==e.listingId)))return {status:'conflict' as const,listingId:null,sourceIds:exact.map(x=>x.sourceId)};
 if(ids.length===1||e.listingId)return {status:'exact-property-reference' as const,listingId:ids[0]||e.listingId!,sourceIds:[e.sourceId,...exact.map(x=>x.sourceId)]};
 const address=addressKey(e),near=address?candidate.filter(x=>addressKey(x)===address):[];
 return {status:near.length?'address-review' as const:'unresolved' as const,listingId:null,sourceIds:near.map(x=>x.sourceId)};
}
export function propertyPreparation(personId:string,events:any[],saved:PropertyEvidence[]=[],now=new Date()){
 const evidence=fubPropertyEvidence(personId,events,now);
 const searches=events.filter(e=>e?.id&&(e.personId==null||String(e.personId)===personId)&&['Property Search','Saved Property Search'].includes(e.type)&&e.propertySearch&&typeof e.propertySearch==='object'&&Number.isFinite(Date.parse(e.created))&&Date.parse(e.created)<=now.getTime()).map(e=>({sourceId:'fub:event:'+e.id,eventAt:e.created,
  fields:Object.fromEntries(Object.entries(e.propertySearch).slice(0,50).filter(([key,v])=>key.length<80&&['string','number','boolean'].includes(typeof v)).map(([k,v])=>[k,String(v).slice(0,300)])),confirmation:'observed-only' as const}));
 return {version:'property-evidence-v1',personId,propertyInsertionEnabled:PROPERTY_INSERTION_ENABLED,inventorySearchEnabled:false,
  evidence:evidence.map(e=>({...e,match:matchSavedListing(e,saved)})),
  // Observations are not confirmed preferences, intent or a contact attempt.
  searches,observations:evidence.map(e=>({sourceId:e.sourceId,eventAt:e.eventAt,price:e.price,bedrooms:e.bedrooms,bathrooms:e.bathrooms,confirmation:'observed-only' as const})),
  timerEffect:'none',customerIdentityEffect:'none'};
}
