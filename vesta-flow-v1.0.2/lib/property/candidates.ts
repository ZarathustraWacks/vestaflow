import {PROPERTY_INSERTION_ENABLED} from './evidence';
export type Listing={id:string;address:string;price:number;status:string;checkedAt:string;bedrooms?:number;bathrooms?:number;city?:string;publicCanView:boolean};
export type Requirements={personId:string;confirmed:boolean;sourceIds:string[];maxPrice?:number;minBedrooms?:number;minBathrooms?:number;city?:string};
/** Rank only supplied saved inventory. No hidden browser search or vendor call. */
export function rankSavedCandidates(r:Requirements,listings:Listing[],now=new Date()){
 if(!r.confirmed||!r.personId||!r.sourceIds.length)return {status:'preferences-review' as const,candidates:[]};
 if(!r.maxPrice&&!r.minBedrooms&&!r.minBathrooms&&!r.city)return {status:'criteria-missing' as const,candidates:[]};
 const grouped=new Map<string,Listing[]>();for(const x of listings)grouped.set(x.id,[...(grouped.get(x.id)||[]),x]);
 const candidates=[...grouped.values()].filter(xs=>new Set(xs.map(x=>JSON.stringify(x))).size===1).map(xs=>xs[0]).filter(x=>
  /^[a-z0-9_-]+:[a-zA-Z0-9_-]+$/.test(x.id)&&x.publicCanView&&x.price>0&&['active','new','back_on_market','price_change','reactivated'].includes(x.status.toLowerCase())&&
  Number.isFinite(Date.parse(x.checkedAt))&&Date.parse(x.checkedAt)<=now.getTime()&&now.getTime()-Date.parse(x.checkedAt)<=24*3600000&&
  (!r.maxPrice||x.price<=r.maxPrice)&&(!r.minBedrooms||(x.bedrooms??-1)>=r.minBedrooms)&&(!r.minBathrooms||(x.bathrooms??-1)>=r.minBathrooms)&&(!r.city||x.city?.toLowerCase()===r.city.toLowerCase())
 ).sort((a,b)=>Number(b.bedrooms||0)-Number(a.bedrooms||0)||a.price-b.price||a.id.localeCompare(b.id));
 return {status:candidates.length?'saved-candidates-for-review' as const:'no-fresh-saved-match' as const,candidates};
}
/** Hard stop until Zenlist's supported inventory/link contract is approved. */
export function insertPropertyLink(_body:string,_listing:Listing):never{
 if(!PROPERTY_INSERTION_ENABLED)throw new Error('Property insertion is disabled pending Zenlist confirmation.');
 throw new Error('Property insertion has not been activated.');
}
