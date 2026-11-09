/** Versioned deterministic contact context shared by all operational consumers. */
export const CONTACT_CONTEXT_VERSION='vesta-contact-context-v1';
export const validContextDate=(value:any,now=Date.now()):string|null=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now?value:null;
export const contextCreatedAt=(row:any,now:number)=>validContextDate(row.sent??row.startedAt??row.created??row.createdAt,now);
const plain=(value:any)=>String(value||'').replace(/<\s*(br\s*\/?|\/p|\/div|\/li)\s*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
const field=(body:string,label:string)=>body.match(new RegExp('(?:^|\\n)\\s*'+label+'\\s*:\\s*([^\\n]+)','i'))?.[1]?.trim()||null;
export function communicationOutcome(note:any,now=Date.now()){
 const source=String(note.systemName||''),at=contextCreatedAt(note,now);
 // A connected app may log through an administrative API identity. Use the
 // source-system metadata, never its account owner, for provenance/credit.
 if(!(source&&(note.isExternal===true||/^(zapier|shilo)(?:\b|$)/i.test(source)))||!at)return null;
 const body=plain(note.body??note.text);
 const flow=String(note.subject||'')==='Vesta Flow · Done'&&body.includes('Recorded from Vesta Flow.')&&/\[Vesta Flow sync: [a-f0-9]{24}\]/.test(body);
 const explicit=typeof note.outcome==='string'?note.outcome:typeof note.outcome?.name==='string'?note.outcome.name:null;
 const outcome=field(body,'Call Outcome')||field(body,'Communication Outcome')||explicit||(flow?field(body,'Outcome'):null);
 if(!outcome)return null;
 const normalized=outcome.toLowerCase().replace(/[-_—–]/g,' ').replace(/\s+/g,' ').trim();
 if(flow&&!/^(connected conversation|outbound call no answer|left voicemail|outbound text sent|outbound email sent|client not ready)$/.test(normalized))return null;
 const kind=/^(long term lead|long term|nurture|not ready|client not ready)$/.test(normalized)?'long-term':/^(connected|connected conversation|spoke with|spoke with customer|interested|hot lead|warm lead)$/.test(normalized)?'connected':/^(no answer|outbound call no answer|outbound text sent|outbound email sent|left voicemail|voicemail|attempted contact|not reached)$/.test(normalized)?'attempted':'review';
 const type=(field(body,'Lead Type')||String(note.leadType||''))?.toLowerCase(),lane=type==='seller'||type==='buyer'?type:null,timeframe=field(body,'Time ?Frame')||note.timeframeStatus||null;
 const condition=body.split(/\n+|(?<=[.!?])\s+/).find(sentence=>/\b(if|dependent|conditional|tentative|maybe someday|possibility)\b/i.test(sentence))?.trim().slice(0,500)||null;
 return {contractVersion:CONTACT_CONTEXT_VERSION,noteId:String(note.id||''),source:flow?'Vesta Flow':source,at,outcome,kind,lane,timeframe,condition,conditional:kind==='long-term'&&Boolean(condition),contactEstablished:kind==='long-term'||kind==='connected',intentBearing:kind==='long-term'||Boolean(lane||timeframe)||/^(hot lead|warm lead|interested)$/.test(normalized)};
}

/** Communication can advance without erasing the last explicit intent assessment. */
export function mergeContactContext(previous:any,next:any):any{
 if(!next)return previous||null;if(!previous)return {...next,documentedContactAt:next.contactEstablished?next.at:null,latestCommunication:{noteId:next.noteId,source:next.source,at:next.at,outcome:next.outcome,kind:next.kind,contactEstablished:next.contactEstablished}};
 const newest=(a:any,b:any)=>Date.parse(a.at)>=Date.parse(b.at)?a:b;
 const event=(value:any)=>value.latestCommunication||{noteId:value.noteId,source:value.source,at:value.at,outcome:value.outcome,kind:value.kind,contactEstablished:value.contactEstablished};
 const latestCommunication=newest(event(previous),event(next));
 let intent=previous.intentBearing&&next.intentBearing?newest(previous,next):previous.intentBearing?previous:next.intentBearing?next:newest(previous,next);
 const detailed=(value:any)=>Boolean(value.lane||value.timeframe||value.condition);
 if(previous.kind===next.kind&&previous.intentBearing&&next.intentBearing&&detailed(previous)!==detailed(next))intent=detailed(previous)?previous:next;
 const inheritedLane=intent.lane?null:previous.lane?(previous.laneEvidence||{source:previous.source,noteId:previous.noteId,at:previous.at}):next.lane?(next.laneEvidence||{source:next.source,noteId:next.noteId,at:next.at}):null;
 const dates=[previous.documentedContactAt|| (previous.contactEstablished?previous.at:null),next.documentedContactAt||(next.contactEstablished?next.at:null)].filter(Boolean).sort((a,b)=>Date.parse(b)-Date.parse(a));
 const documentedContactAt=dates[0]||null;
 return {...intent,lane:intent.lane||previous.lane||next.lane||null,laneEvidence:inheritedLane,timeframe:intent.timeframe||(intent.kind==='long-term'?(previous.timeframe||next.timeframe||null):null),contactEstablished:Boolean(documentedContactAt),documentedContactAt,latestCommunication};
}
