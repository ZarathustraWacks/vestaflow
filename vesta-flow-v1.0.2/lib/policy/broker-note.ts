import {newestCommunicationDate} from './communication';
const noteDate=(note:any):string|null=>{for(const key of ['created','createdAt','date','timestamp','updatedAt']){const value=note?.[key];if(typeof value==='string'&&Number.isFinite(Date.parse(value)))return value;}return null;};
const noteAuthorId=(note:any)=>Number(note?.userId??note?.createdById??note?.createdBy?.id??note?.author?.id);
const noteAuthorName=(note:any)=>String(note?.userName??note?.createdBy?.name??note?.author?.name??'').trim().toLowerCase();
/** Broker-authored FUB notes are accountable actions and reset cadence. */
export function applyBrokerCadenceNote(lead:any,notes:any[]){
 const brokerId=Number(lead.assignedUserId),brokerName=String(lead.assignedUserName||'').trim().toLowerCase();
 const candidates=notes.map(note=>({note,at:noteDate(note),authorId:noteAuthorId(note),authorName:noteAuthorName(note)})).filter(item=>item.at).filter(item=>{
  if(item.note?.isExternal===true||(/^(zapier|shilo|sisu)(?:\b|$)/i.test(String(item.note?.systemName||''))))return false;
  const idKnown=Number.isFinite(item.authorId)&&item.authorId>0,nameKnown=Boolean(item.authorName);
  return idKnown?item.authorId===brokerId:Boolean(nameKnown&&brokerName&&item.authorName===brokerName);
 }).sort((a,b)=>Date.parse(b.at!)-Date.parse(a.at!));
 const latest=candidates[0];if(!latest)return lead;
 const noteAt=latest.at!,current=lead.brokerOutreachAt;
 if(current&&Date.parse(current)>=Date.parse(noteAt))return lead;
 const cadenceAt=newestCommunicationDate(lead.lastCommunicationAt,noteAt);
 return {...lead,lastCommunicationAt:cadenceAt,lastCommunicationSource:cadenceAt===noteAt?'fub-note':lead.lastCommunicationSource,brokerOutreachAt:noteAt,cadenceNoteAt:noteAt,cadenceNoteText:String(latest.note?.body??latest.note?.text??latest.note?.note??'').trim()||null};
}

