import {HAND_RAISE_TYPES} from './vesta';
import {newestCommunicationDate} from './communication';
/** Detail collections may be empty or restricted; preserve a documented person-summary inquiry. */
export function latestHandRaiseAt(summary:string|null,events:Record<string,unknown>[]){
 const allowed=new Set(HAND_RAISE_TYPES.map(value=>value.toLowerCase()));
 return newestCommunicationDate(summary,...events.filter(event=>allowed.has(String(event.type||event.eventType||event.name||'').trim().toLowerCase())).map(event=>{
  const value=event.created||event.createdAt||event.occurredAt||event.date;
  return typeof value==='string'?value:null;
 }));
}
