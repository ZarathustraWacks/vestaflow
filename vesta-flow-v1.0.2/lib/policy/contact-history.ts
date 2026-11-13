/** Lifetime relationship evidence is independent of the latest cadence clock. */
export type ContactHistoryState='no-conversation'|'needs-review'|'prior-conversation';
export const CONTACT_HISTORY_CONTRACT='vesta-contact-history-v1';
export const historyDate=(value:unknown,now=Date.now()):string|null=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now?value:null;
const latest=(values:unknown[],now:number)=>values.map(value=>historyDate(value,now)).filter((value):value is string=>Boolean(value)).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
const explicitTrue=(v:unknown)=>v===true||v===1||v==='1'||v==='true';
/** Only our per-person, event-derived projection may supplement summary dates.
 * An inbound event alone or a later unanswered attempt is not a conversation. */
export function historicalConversationAt(person:any,outbound:unknown[]=[],inbound:unknown[]=[],now=Date.now()){
 const projection=person?.vestaContactHistory||person?.raw?.vestaContactHistory;
 const pid=String(person?.id??person?.leadId??'');
 const retained=projection?.contractVersion===CONTACT_HISTORY_CONTRACT&&String(projection.personId)===pid?projection.twoWayEngagementAt:null;
 const outs=outbound.map(value=>historyDate(value,now)).filter((value):value is string=>Boolean(value));
 const pairs=inbound.map(value=>historyDate(value,now)).filter((value):value is string=>Boolean(value)&&outs.some(out=>Date.parse(out)<=Date.parse(value!)));
 return latest([retained,person?.twoWayEngagementAt,...pairs],now);
}
export function contactHistoryState(lead:any,now=Date.now()):ContactHistoryState{
 const raw=lead?.raw||{},context=lead?.contactContext||raw.vestaContactContext;
 const stage=String(lead?.crmStage||lead?.stage||'').trim().toLowerCase();
 if(historicalConversationAt(lead,[],[],now)||historyDate(lead?.documentedContactAt,now)||context?.contactEstablished===true||explicitTrue(lead?.contacted)||explicitTrue(raw.contacted)||['spoke with','spoke with customer','met with customer','showing buyers','offers submitted','offer submitted','submitted offers','appointment set','appointment met','showing homes','submitting offers','under contract','closed'].includes(stage))return 'prior-conversation';
 // A response without enough retained pairing evidence must not be advertised
 // as an untouched lead. Keep it for review without fabricating contact credit.
 if(historyDate(lead?.customerResponseAt,now)||lead?.contextConflict||context?.kind==='review'||(historyDate(lead?.lastCommunicationAt,now)&&!/^outbound-(call|text|email)$/.test(lead?.lastCommunicationSource||'')&&lead?.lastCommunicationSource!=='integration-outcome')||(raw.contacted!=null&&![false,0,'0','false'].includes(raw.contacted)))return 'needs-review';
 return 'no-conversation';
}
