'use client';
import {library} from '@/lib/appointment/nurture/engine';
import {recommendedSelection,requiredFields,propertyTechniqueBlocked,type NurturePacket,type Selection} from '@/lib/appointment/nurture/connection';
import type {Context} from '@/lib/appointment/engine';
export default function NurtureScenario({context,onChange,disabled}:{context:Context;onChange:(selection:Selection|undefined)=>void;disabled:boolean}){
 const packet=context.nurture as NurturePacket|undefined;if(!packet)return null;
 const selection=context.nurtureSelection||recommendedSelection(packet),technique=library.techniques.find(t=>t.id===selection.techniqueId)!;
 const fields=requiredFields(selection,context.channel),change=(patch:Partial<Selection>)=>onChange({...selection,...patch,reviewed:false});
 return <details><summary>Choose a specific nurture situation</summary>
  <p>The default uses recorded activity without assuming buying intent. For a more specific message, select the situation, verify the evidence and prepare the draft. Customer timing and channel permission still apply.</p>
  <label>Situation<select aria-label="Nurture situation" disabled={disabled} value={selection.techniqueId} onChange={e=>change({techniqueId:e.target.value,approachId:e.target.value+'-A',phase:'opening',values:{}})}>{library.techniques.map(t=><option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}</select></label>
  <label>Approach<select aria-label="Nurture approach" disabled={disabled} value={selection.approachId} onChange={e=>change({approachId:e.target.value})}>{technique.approaches.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
  <p>{technique.evidenceRule}</p>
  <label>Message stage<select disabled={disabled} value={selection.phase} onChange={e=>change({phase:e.target.value as Selection['phase']})}><option value="opening">Opening / fresh situation</option><option value="follow-up">Follow-up after a recorded send</option><option value="alternate-angle">New angle after a recorded send</option></select></label>
  <label>Supporting FUB evidence<select aria-label="Supporting FUB evidence" disabled={disabled} value={selection.sourceId} onChange={e=>change({sourceId:e.target.value})}>{packet.sources.map(s=><option key={s.id} value={s.id}>{s.at.slice(0,10)} · {s.kind} · {s.text.slice(0,85)}</option>)}</select></label>
  {packet.sources.find(s=>s.id===selection.sourceId)?.text&&<blockquote>{packet.sources.find(s=>s.id===selection.sourceId)!.text}</blockquote>}
  {fields.map(key=><label key={key}>{key.replace(/_/g,' ')}<input aria-label={key.replace(/_/g,' ')} disabled={disabled} maxLength={600} value={selection.values[key]||''} onChange={e=>change({values:{...selection.values,[key]:e.target.value}})}/></label>)}
  {propertyTechniqueBlocked(selection,context.channel)?<p>Property-specific messages are paused until Zenlist confirms the inventory and link connection.</p>:<label><input type="checkbox" disabled={disabled} checked={!!context.nurtureSelection?.reviewed} onChange={e=>onChange({...selection,reviewed:e.target.checked,reviewedAt:e.target.checked?new Date().toISOString():undefined})}/> I verified this situation, approach and customer-safe facts against the selected record.</label>}
  <button disabled={disabled} onClick={()=>onChange(undefined)}>Use automatic suggestion</button>
 </details>;
}
