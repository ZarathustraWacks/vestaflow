/** Cadence may include a reply; broker-response obligations require outreach. */
export function brokerActionAt(lead:{brokerOutreachAt?:string|null;integrationCommunicationAt?:string|null;lastCommunicationAt:string|null;lastCommunicationSource?:string|null}){
 const valid=(value:string|null|undefined)=>Boolean(value&&Number.isFinite(Date.parse(value)));
 const contact=newestCommunicationDate(lead.brokerOutreachAt,lead.integrationCommunicationAt);
 if(contact)return contact;
 // Keep the established legacy aggregate fallback, but never substitute a reply.
 if(/^(two-way-|inbound-)/.test(lead.lastCommunicationSource||''))return null;
 return valid(lead.lastCommunicationAt)?lead.lastCommunicationAt:null;
}
export const newestCommunicationDate=(...values:(string|null|undefined)[])=>values.filter((value):value is string=>Boolean(value&&Number.isFinite(Date.parse(value)))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||null;
